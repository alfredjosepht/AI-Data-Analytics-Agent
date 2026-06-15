import os
try:
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np
except Exception:
    SentenceTransformer = None
    faiss = None
    np = None

from backend.database.sqlite_manager import sqlite_manager


class RAGAgent:

    INDEX_DIR = "rag_indexes"

    @staticmethod
    def _ensure_index_dir():
        os.makedirs(RAGAgent.INDEX_DIR, exist_ok=True)

    @staticmethod
    def index_workspace(workspace_id: int):
        workspace = sqlite_manager.get_workspace(workspace_id)

        if not workspace:
            raise ValueError("Workspace not found")

        text = workspace.get("document_text")

        if not text:
            raise ValueError("No document text to index for this workspace")

        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers or faiss not installed")

        model = SentenceTransformer("all-MiniLM-L6-v2")
        # Chunk text by paragraphs
        docs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not docs:
            docs = [p.strip() for p in text.split("\n") if p.strip()]

        embeddings = model.encode(docs, convert_to_numpy=True)

        RAGAgent._ensure_index_dir()

        dim = embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(embeddings)

        path = os.path.join(RAGAgent.INDEX_DIR, f"ws_{workspace_id}.index")
        faiss.write_index(index, path)

        # save docs
        with open(os.path.join(RAGAgent.INDEX_DIR, f"ws_{workspace_id}.docs"), "w", encoding="utf-8") as f:
            for d in docs:
                f.write(d.replace('\n', ' ') + "\n---\n")

        return {"indexed_blocks": len(docs)}

    @staticmethod
    def query_workspace(workspace_id: int, query: str, top_k: int = 3):
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers or faiss not installed. Wait for pip installation to finish.")

        path = os.path.join(RAGAgent.INDEX_DIR, f"ws_{workspace_id}.index")
        docs_path = os.path.join(RAGAgent.INDEX_DIR, f"ws_{workspace_id}.docs")

        # If index doesn't exist, try indexing first
        if not os.path.exists(path) or not os.path.exists(docs_path):
            try:
                RAGAgent.index_workspace(workspace_id)
            except Exception as e:
                raise ValueError(f"Index not found and auto-indexing failed: {e}")

        index = faiss.read_index(path)

        model = SentenceTransformer("all-MiniLM-L6-v2")
        q_emb = model.encode([query], convert_to_numpy=True)

        D, I = index.search(q_emb, top_k)

        with open(docs_path, "r", encoding="utf-8") as f:
            raw = f.read().split("\n---\n")

        hits = []
        for idx in I[0]:
            if idx < len(raw):
                cleaned_hit = raw[idx].strip()
                if cleaned_hit:
                    hits.append(cleaned_hit)

        # Synthesize answer using Gemini
        from backend.llm.gemini_client import gemini_client
        
        context_str = ""
        for i, hit in enumerate(hits):
            context_str += f"[Block {i+1}]: {hit}\n\n"
            
        prompt = f"""You are a document analytics assistant. Answer the user's question based strictly on the provided document excerpts.
        
Document Excerpts:
{context_str}

User Question:
{query}

Rules:
1. Answer the question using ONLY the provided excerpts.
2. If the answer cannot be found in the excerpts, say "I cannot find the answer in the uploaded document."
3. Cite your sources by appending [Block X] to the relevant sentences in your response.
4. Keep the answer concise and professional. Do not use formatting like bullet points or markdown unless asked.
"""
        if gemini_client and getattr(gemini_client, "available", False):
            answer = gemini_client.generate(prompt)
        else:
            answer = f"Found matches in document. Snippet:\n" + "\n".join([f"- [Block {i+1}]: {h[:150]}..." for i, h in enumerate(hits[:2])])

        # Also log the chat to sqlite database
        try:
            sqlite_manager.save_chat(workspace_id, query, answer)
        except Exception as e:
            print(f"Failed to save RAG chat: {e}")

        return {"query": query, "hits": hits, "answer": answer}
