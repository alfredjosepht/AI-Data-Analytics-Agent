from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.agents.rag_agent import RAGAgent

router = APIRouter(
    tags=["RAG"]
)


class QueryRequest(BaseModel):
    query: str
    top_k: int = 3


@router.post("/workspaces/{workspace_id}/index")
def index_workspace(workspace_id: int):

    try:
        res = RAGAgent.index_workspace(workspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "success", "result": res}


@router.post("/workspaces/{workspace_id}/query")
def query_workspace(workspace_id: int, request: QueryRequest):

    try:
        res = RAGAgent.query_workspace(workspace_id, request.query, request.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "success", "result": res}
