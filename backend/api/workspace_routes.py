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


from pydantic import BaseModel

class RenameRequest(BaseModel):
    name: str


@router.post("/{workspace_id}/rename")
def rename_workspace(workspace_id: int, request: RenameRequest):
    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Workspace name cannot be empty")
    
    sqlite_manager.rename_workspace(workspace_id, request.name.strip())
    return {
        "status": "success",
        "message": f"Workspace renamed to {request.name.strip()}",
        "workspace": sqlite_manager.get_workspace(workspace_id)
    }


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int):
    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # 1. Clean up physical files for versions
    versions = sqlite_manager.get_versions(workspace_id)
    for v in versions:
        v_path = v.get("file_path")
        if v_path and os.path.exists(v_path):
            try:
                os.remove(v_path)
            except Exception as e:
                print(f"Error deleting version file {v_path}: {e}")

    # 2. Clean up original dataset file
    raw_path = workspace.get("file_path")
    if raw_path and os.path.exists(raw_path):
        try:
            os.remove(raw_path)
        except Exception as e:
            print(f"Error deleting raw file {raw_path}: {e}")

    # 3. Clean up RAG index files
    index_path = os.path.join("rag_indexes", f"ws_{workspace_id}.index")
    docs_path = os.path.join("rag_indexes", f"ws_{workspace_id}.docs")
    for p in [index_path, docs_path]:
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception as e:
                print(f"Error deleting RAG index file {p}: {e}")

    # 4. Clean up reports
    reports = sqlite_manager.list_reports(workspace_id)
    for r in reports:
        r_path = r.get("file_path")
        if r_path and os.path.exists(r_path):
            try:
                os.remove(r_path)
            except Exception as e:
                print(f"Error deleting report file {r_path}: {e}")

    # 5. Drop table in DuckDB
    table_name = workspace.get("table_name")
    if table_name:
        tables = [t.strip() for t in table_name.split(",") if t.strip()]
        for tbl in tables:
            try:
                conn = duckdb_manager.get_connection()
                conn.execute(f"DROP TABLE IF EXISTS {tbl}")
                conn.close()
            except Exception as ex:
                print(f"Error dropping table {tbl} in DuckDB: {ex}")

    # 6. Delete entries from SQLite database
    sqlite_manager.delete_workspace(workspace_id)

    # 7. Check if active workspace is the deleted one, reset it if so
    from backend.memory.session_store import get_active_workspace as get_active, set_active_workspace as set_active
    active = get_active()
    if active and active.get("workspace_id") == workspace_id:
        set_active(None, None, None)

    return {
        "status": "success",
        "message": f"Workspace {workspace_id} deleted permanently."
    }


@router.post("/{workspace_id}/duplicate")
def duplicate_workspace(workspace_id: int):
    import shutil
    import uuid

    workspace = sqlite_manager.get_workspace(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    suffix = uuid.uuid4().hex[:6]
    orig_name = workspace.get("name")
    new_name = f"{orig_name} (Copy)"
    orig_table = workspace.get("table_name")
    
    # 1. Copy files on disk
    raw_path = workspace.get("file_path")
    new_raw_path = None
    if raw_path and os.path.exists(raw_path):
        os.makedirs("uploads/raw", exist_ok=True)
        filename = os.path.basename(raw_path)
        base, ext = os.path.splitext(filename)
        new_filename = f"{base}_dup_{suffix}{ext}"
        new_raw_path = os.path.join("uploads/raw", new_filename)
        try:
            shutil.copyfile(raw_path, new_raw_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to copy raw dataset: {e}")

    # 2. Duplicate DuckDB tables
    new_table_name = None
    if orig_table:
        tables = [t.strip() for t in orig_table.split(",") if t.strip()]
        new_tables = []
        for tbl in tables:
            new_tbl = f"{tbl}_dup_{suffix}"
            try:
                df = duckdb_manager.query(f"SELECT * FROM {tbl}")
                duckdb_manager.save_dataframe(new_tbl, df)
                new_tables.append(new_tbl)
            except Exception as e:
                print(f"Error copying table {tbl} in DuckDB: {e}")
        new_table_name = ", ".join(new_tables) if new_tables else None

    # 3. Create the duplicate workspace record in SQLite
    new_workspace_id = sqlite_manager.create_workspace(
        name=new_name,
        file_name=workspace.get("file_name"),
        file_path=new_raw_path or workspace.get("file_path"),
        table_name=new_table_name or workspace.get("table_name"),
        schema=workspace.get("schema"),
        metadata=workspace.get("metadata"),
        cleaning_report=workspace.get("cleaning_report"),
        document_text=workspace.get("document_text"),
        document_tables=workspace.get("document_tables")
    )

    # 4. If cleaning approved originally, approve it for the copy too
    if workspace.get("cleaning_approved"):
        sqlite_manager.approve_cleaning(new_workspace_id)

    # 5. Replicate versions
    versions = sqlite_manager.get_versions(workspace_id)
    versions_sorted = sorted(versions, key=lambda x: x["version_num"])
    for v in versions_sorted:
        v_path = v.get("file_path")
        new_v_path = None
        if v_path and os.path.exists(v_path):
            os.makedirs("uploads/cleaned", exist_ok=True)
            v_filename = os.path.basename(v_path)
            v_base, v_ext = os.path.splitext(v_filename)
            new_v_filename = f"{v_base}_dup_{suffix}{v_ext}"
            new_v_path = os.path.join("uploads/cleaned", new_v_filename)
            try:
                shutil.copyfile(v_path, new_v_path)
            except Exception as e:
                print(f"Error duplicating version file {v_path}: {e}")
        
        sqlite_manager.create_version(
            workspace_id=new_workspace_id,
            version_num=v.get("version_num"),
            file_path=new_v_path or v_path,
            table_name=new_table_name or v.get("table_name"),
            description=v.get("description")
        )

    # 6. Activate the duplicate workspace automatically
    set_active_workspace(
        new_workspace_id,
        new_table_name or workspace.get("table_name"),
        workspace.get("schema")
    )

    return {
        "status": "success",
        "message": f"Workspace duplicated successfully as '{new_name}'",
        "workspace": sqlite_manager.get_workspace(new_workspace_id)
    }

