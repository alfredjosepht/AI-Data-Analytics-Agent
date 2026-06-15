from fastapi import APIRouter, HTTPException

from backend.agents.quality_agent import QualityAgent

router = APIRouter(
    tags=["Profiling"]
)


@router.get("/workspaces/{workspace_id}/profile")
def profile_workspace(workspace_id: int):

    try:
        result = QualityAgent.profile_workspace(workspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": "success",
        "profile": result
    }
