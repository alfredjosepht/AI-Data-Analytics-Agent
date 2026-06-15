from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from backend.database.sqlite_manager import sqlite_manager
from backend.agents.scheduler_agent import scheduler_agent

router = APIRouter(
    tags=["Schedules & Reports"]
)


class ScheduleRequest(BaseModel):
    workspace_id: int
    name: str
    query: str
    frequency: str
    cron_expr: Optional[str] = None


@router.post("/schedule-report")
def create_schedule(request: ScheduleRequest):
    workspace = sqlite_manager.get_workspace(request.workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    try:
        next_run_init = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        schedule_id = sqlite_manager.create_schedule(
            workspace_id=request.workspace_id,
            name=request.name,
            query=request.query,
            frequency=request.frequency,
            cron_expr=request.cron_expr,
            next_run=next_run_init
        )

        scheduler_agent.add_report_job(
            workspace_id=request.workspace_id,
            schedule_id=schedule_id,
            name=request.name,
            query=request.query,
            frequency=request.frequency,
            cron_expr=request.cron_expr
        )

        return {
            "status": "success",
            "message": f"Schedule '{request.name}' created successfully",
            "schedule_id": schedule_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
def list_reports(workspace_id: Optional[int] = None):
    try:
        reports = sqlite_manager.list_reports(workspace_id)
        return {
            "status": "success",
            "reports": reports
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/scheduled")
def list_scheduled(workspace_id: Optional[int] = None):
    try:
        schedules = sqlite_manager.list_schedules(workspace_id)
        return {
            "status": "success",
            "schedules": schedules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reports/scheduled/{schedule_id}")
def delete_schedule(schedule_id: int):
    try:
        sqlite_manager.delete_schedule(schedule_id)
        scheduler_agent.remove_job(schedule_id)
        return {
            "status": "success",
            "message": f"Schedule {schedule_id} deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
