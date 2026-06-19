import sys
from pathlib import Path

# Ensure the workspace root is on sys.path when running from backend/ directly
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.upload_routes import router as upload_router
from backend.api.chat_routes import router as chat_router
from backend.api.chart_routes import router as chart_router
from backend.api.workspace_routes import router as workspace_router
from backend.api.profiling_routes import router as profiling_router
from backend.api.cleaning_routes import router as cleaning_router
from backend.api.rag_routes import router as rag_router
from backend.api.export_routes import router as export_router
from backend.api.scheduler_routes import router as scheduler_router



app = FastAPI(
    title="AI Data Analytics Agent"
)
# Force hot reload of modules



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    upload_router,
    prefix="/upload",
    tags=["Upload"]
)

app.include_router(
    chat_router,
    prefix="/chat",
    tags=["Chat"]
)

app.include_router(
    chart_router,
    prefix="/chart",
    tags=["Charts"]
)

app.include_router(
    workspace_router,
    prefix="/workspaces",
    tags=["Workspaces"]
)

app.include_router(
    profiling_router,
    prefix="",
    tags=["Profiling"]
)

app.include_router(
    cleaning_router,
    prefix="",
    tags=["Cleaning"]
)

app.include_router(
    rag_router,
    prefix="",
    tags=["RAG"]
)

app.include_router(
    export_router,
    prefix="",
    tags=["Export"]
)

app.include_router(
    scheduler_router,
    prefix="",
    tags=["Schedules & Reports"]
)


@app.on_event("startup")
def on_startup():
    from backend.agents.scheduler_agent import scheduler_agent
    scheduler_agent.start_existing_jobs()
    print("Loaded active scheduled jobs into background scheduler.")


@app.get("/")
def root():

    return {
        "message": "AI Data Analytics Agent Running - Refactored!"
    }