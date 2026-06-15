from fastapi import APIRouter, HTTPException
import os
import pandas as pd

from backend.database.sqlite_manager import sqlite_manager
from backend.database.duckdb_manager import duckdb_manager
from backend.memory.session_store import (
    get_active_workspace as get_active_workspace_state,
    set_active_workspace
)
from backend.agents.schema_agent.schema_agent import SchemaAgent
from backend.agents.metadata_agent.metadata_agent import MetadataAgent

router = APIRouter(
    tags=["Workspaces"]
)


@router.get("/")
def list_workspaces():
    workspaces = sqlite_manager.list_workspaces()
    return {
        "status": "success",
        "workspaces": workspaces
    }


@router.get("/active")
def get_active_workspace():
    workspace = get_active_workspace_state()
    if not workspace or not workspace.get("workspace_id"):
        return {
            "status": "success",
            "workspace": None
        }
    return {
        "status": "success",
        "workspace": workspace
    }


@router.get("/{workspace_id}")
def get_workspace(workspace_id: int):
    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {
        "status": "success",
        "workspace": workspace
    }


@router.post("/{workspace_id}/activate")
def activate_workspace(workspace_id: int):
    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    table_name = workspace.get("table_name")
    if table_name:
        # Check if table exists in DuckDB
        if not duckdb_manager.table_exists(table_name):
            # Try to restore from the latest version file
            versions = sqlite_manager.get_versions(workspace_id)
            if versions:
                latest_version = versions[0] # ordered by version_num DESC
                file_path = latest_version.get("file_path")
                if file_path and os.path.exists(file_path):
                    try:
                        df = pd.read_csv(file_path)
                        duckdb_manager.save_dataframe(table_name, df)
                        print(f"Automatically restored table {table_name} in DuckDB from version {latest_version['version_num']}.")
                    except Exception as e:
                        print(f"Failed to auto-restore table: {e}")
            else:
                # If no versions found, check if raw file exists and load it
                raw_path = workspace.get("file_path")
                if raw_path and os.path.exists(raw_path):
                    try:
                        if raw_path.endswith('.csv'):
                            df = pd.read_csv(raw_path)
                            duckdb_manager.save_dataframe(table_name, df)
                            print(f"Automatically restored table {table_name} in DuckDB from raw file.")
                    except Exception as e:
                        print(f"Failed to auto-restore table from raw file: {e}")

    set_active_workspace(
        workspace_id,
        workspace.get("table_name"),
        workspace.get("schema")
    )

    return {
        "status": "success",
        "workspace_id": workspace_id,
        "workspace": workspace
    }


@router.get("/{workspace_id}/versions")
def get_workspace_versions(workspace_id: int):
    versions = sqlite_manager.get_versions(workspace_id)
    return {
        "status": "success",
        "versions": versions
    }


@router.post("/{workspace_id}/versions/{version_num}/rollback")
def rollback_workspace_version(workspace_id: int, version_num: int):
    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    versions = sqlite_manager.get_versions(workspace_id)
    target_version = None
    for v in versions:
        if v["version_num"] == version_num:
            target_version = v
            break

    if not target_version:
        raise HTTPException(status_code=404, detail=f"Version {version_num} not found")

    file_path = target_version["file_path"]
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"Version file '{file_path}' does not exist on disk.")

    try:
        df = pd.read_csv(file_path)
        table_name = target_version["table_name"] or workspace.get("table_name")

        duckdb_manager.save_dataframe(table_name, df)

        schema = SchemaAgent.generate_schema(df)
        metadata = MetadataAgent.generate_metadata(df)

        sqlite_manager.update_workspace_version(workspace_id, table_name, schema, metadata)
        set_active_workspace(workspace_id, table_name, schema)

        return {
            "status": "success",
            "message": f"Rolled back workspace {workspace_id} to version {version_num}",
            "workspace": sqlite_manager.get_workspace(workspace_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
