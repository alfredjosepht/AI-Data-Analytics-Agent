# AI-Data-Analytics-Agent 📊🤖

An enterprise-grade, premium intelligent business intelligence and data analytics platform. It automatically processes datasets (CSV, Excel, TSV, Parquet) and documents (PDF, DOCX, TXT) to audit quality, recommend/apply cleaning actions, generate SQL queries via LLM code generation, execute them using a high-performance **DuckDB** engine, build automatic **Plotly** interactive charts, and compile professional summaries, PDF reports, or PowerPoint decks.

---

## Key Features 🚀

### 1. 🔍 Proactive Data Quality & Cleaning
- **Automatic Diagnostics**: Audits your data for duplicates, nulls, outliers, and schema types instantly upon loading.
- **Data Cleaning Control Panel**: Displays specific cleaning suggestions (e.g., impute missing values, drop null columns, prune outliers based on IQR, remove duplicates) that can be applied in one click.
- **Version Rollbacks**: Saves a full historic trail of cleaning runs and allows users to rollback the dataset version at any time.

### 2. 💬 ChatGPT-style Conversational Memory & Persistence
- **Persistent Chat History**: Works exactly like ChatGPT; keeps all previous questions, answers, and visual blocks visible in a scrollable history thread.
- **Workspace-Specific Memory**: Maintains isolated chat histories per workspace, loading the correct history automatically upon workspace activation.
- **Database Persistence**: Stores chat history permanently in SQLite (`chat_messages` table) so that it survives page refreshes and application restarts.
- **Chat UX & Markdown**: Supports smooth scrolling to the latest message, message timestamps, a typing indicator, and custom markdown rendering (including headers, lists, and SQL code block formatting with a copy button).
- **In-Line Interactive Elements**: Renders SQL viewers, result tables, and Plotly charts directly inside message bubbles.
- **Chat Search**: Real-time filtering search bar in the console header to find specific queries or SQL code blocks.
- **Clear Chat**: Clean confirmation modal to delete chat messages for the current workspace without deleting RAG metadata, versions, or datasets.

### 3. 📊 Smart Interactive Visualizations
- **Auto-Chart Generation**: Evaluates query results and automatically constructs suitable Plotly.js charts.
- **Chart Selector & Tools**: Includes controls to switch chart types, zoom, pan, enter fullscreen, or download as PNG.

### 4. 🗂️ Multi-Format Document Analytics
- Supports tabular datasets (`.csv`, `.tsv`, `.xlsx`, `.parquet`) and textual reports (`.pdf`, `.docx`, `.txt`).
- Text files undergo semantic chunking and embedding-based RAG indexing using **Sentence Transformers** and **FAISS** to answer qualitative queries.

### 5. ⏰ Automated Scheduling & Cron Reports
- Configure scheduled data report queries running on intervals (Daily, Weekly, Monthly) or custom cron expressions.
- Automated jobs compile insights in the background.

### 6. 📥 Enterprise Exports & Wizard
- **Export Report Wizard**: Configurable modal allowing selection of format (PDF, PPTX, Excel), scope (Current Query or Entire Chat Session), and target sections (Dataset Summary, SQL, Insights, Charts, Tables).
- **Preview Summary**: Displays counts of queries, tables, and charts to be exported before finalizing the report.
- **Chart Export Support**: Visual Plotly charts are generated as high-resolution images and embedded directly inside exported PDF and PPTX files.
- **Clean Datasets**: Download your refined, cleaned datasets directly as **CSV** or **Excel** sheets.
- **Excel Custom Sheet Export**: Generates tab-separated sheets for each query in scope with formatting, metadata, and custom fits.

---

## Technology Stack 🛠️

- **Backend**: FastAPI (Python), Uvicorn, Pandas, DuckDB (OLAP analysis), SQLite3 (Metadata management), FAISS & Sentence Transformers (Semantic vector store & embeddings).
- **Frontend**: React.js, Vite, Vanilla CSS with custom glassmorphism design tokens, Lucide Icons, Plotly.js.
- **AI Engine**: Google Gemini API (`gemini-2.5-flash`).

---

## Getting Started ⚙️

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- A Google Gemini API Key

---

### Local Installation Guide

#### 1. Clone & Set Up environment
Copy the environment template and insert your Gemini API Key:
```bash
# In the project root, create a .env file:
GOOGLE_API_KEY=your_gemini_api_key_here
```

#### 2. Backend Setup
1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate       # On Windows PowerShell
   # source .venv/bin/activate  # On Linux/macOS
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI backend:
   ```bash
   python main.py
   # Or directly run: uvicorn backend.main:app --port 8000 --reload
   ```
The backend server will run on `http://127.0.0.1:8000`.

#### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm modules:
   ```bash
   npm install
   ```
3. Launch the Vite development server:
   ```bash
   npm run dev
   ```
Open `http://localhost:5173` in your browser to view the application.

---

### Run using Docker 🐳

To run the entire platform inside a containerized environment:

```bash
# 1. Build the Docker image
docker build -t ai-data-agent .

# 2. Run the container, mapping port 8000 and passing your API key
docker run -p 8000:8000 -e GOOGLE_API_KEY=your_gemini_api_key_here ai-data-agent
```

---

## Directory Structure 📂

```
ai-data-analytics-agent/
├── backend/
│   ├── agents/             # Multi-Agent coordination modules (schema, cleaning, query, etc.)
│   ├── api/                # FastAPI endpoints (upload, chat, cleaning, export, workspaces)
│   ├── database/           # SQLite (app.db) and DuckDB (analytics.duckdb) managers
│   ├── file_processing/    # Extractor factories for CSV, Excel, PDF, Word, TXT
│   ├── llm/                # Gemini client integrations and prompts
│   ├── memory/             # User session workspaces state storage
│   └── main.py             # Backend entrypoint and startup routers
├── frontend/
│   ├── src/
│   │   ├── components/     # UI modules (sidebar, upload panel, query chat console, results)
│   │   ├── services/       # Axios API client requests
│   │   ├── App.jsx         # Main interface grid and state coordinator
│   │   └── index.css       # Core styling system (glassmorphism tokens)
│   ├── index.html
│   └── package.json
├── main.py                 # Root application wrapper
├── requirements.txt        # Python backend packages
└── README.md               # Project documentation
```

---

## UI Styling & Design Tokens 🎨

The UI features a dark Apple-inspired minimalist design constructed with:
- **Glassmorphism**: Elegant card layouts utilizing `backdrop-filter: blur(20px)` and subtle borders (`rgba(255, 255, 255, 0.08)`).
- **Interactive Accents**: Soft violet/indigo focus outlines and glows (`box-shadow: 0 0 30px rgba(167, 139, 250, 0.15)`).
- **Fluid Transitions**: Smooth `250ms` hover and select transitions across all buttons, inputs, and list nodes.
