from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import pandas as pd

from backend.database.sqlite_manager import sqlite_manager
from backend.database.duckdb_manager import duckdb_manager
from backend.agents.cleaning_agent.cleaner import DataCleaner
from backend.agents.schema_agent.schema_agent import SchemaAgent
from backend.agents.metadata_agent.metadata_agent import MetadataAgent
from backend.memory.session_store import set_active_workspace

router = APIRouter(
    tags=["Cleaning"]
)


class CleanRequest(BaseModel):
    approved_actions: List[str]


@router.post("/workspaces/{workspace_id}/approve_cleaning")
def approve_cleaning(workspace_id: int):

    workspace = sqlite_manager.get_workspace(workspace_id)

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    try:
        sqlite_manager.approve_cleaning(workspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    updated = sqlite_manager.get_workspace(workspace_id)

    return {
        "status": "success",
        "message": f"Cleaning approved for workspace {workspace_id}",
        "workspace": updated
    }


@router.post("/workspaces/{workspace_id}/clean")
def clean_workspace(workspace_id: int, request: CleanRequest):
    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    file_path = workspace.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Original dataset file not found.")

    try:
        from backend.file_processing.parser_factory import ParserFactory
        parsed_data = ParserFactory.parse(file_path)

        if not hasattr(parsed_data, "to_csv"):
            raise HTTPException(status_code=400, detail="Workspace does not contain a structured tabular dataset.")

        versions = sqlite_manager.get_versions(workspace_id)
        current_version_num = len(versions) + 1

        cleaned_df, report = DataCleaner.clean(parsed_data, request.approved_actions)

        schema = SchemaAgent.generate_schema(cleaned_df)
        metadata = MetadataAgent.generate_metadata(cleaned_df)

        table_name = workspace.get("table_name")

        duckdb_manager.save_dataframe(table_name, cleaned_df)

        clean_folder = "uploads/cleaned"
        os.makedirs(clean_folder, exist_ok=True)
        versioned_file_name = f"cleaned_{table_name}_v{current_version_num}.csv"
        versioned_path = os.path.join(clean_folder, versioned_file_name)
        try:
            cleaned_df.to_csv(versioned_path, index=False)
        except PermissionError:
            import time
            timestamp = int(time.time())
            versioned_file_name = f"cleaned_{table_name}_v{current_version_num}_{timestamp}.csv"
            versioned_path = os.path.join(clean_folder, versioned_file_name)
            cleaned_df.to_csv(versioned_path, index=False)

        desc = f"Cleaned version {current_version_num} applying actions: {', '.join(request.approved_actions)}"
        sqlite_manager.create_version(workspace_id, current_version_num, versioned_path, table_name, desc)

        sqlite_manager.update_workspace_version(workspace_id, table_name, schema, metadata)
        sqlite_manager.approve_cleaning(workspace_id)

        set_active_workspace(workspace_id, table_name, schema)

        return {
            "status": "success",
            "message": f"Applied cleaning actions to workspace {workspace_id}",
            "cleaning_report": report,
            "schema": schema,
            "metadata": metadata,
            "workspace": sqlite_manager.get_workspace(workspace_id)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
