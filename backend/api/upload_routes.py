from fastapi import APIRouter
from fastapi import UploadFile
from fastapi import File
from fastapi import HTTPException

from backend.file_processing.parser_factory import (
    ParserFactory
)

from backend.agents.cleaning_agent.cleaner import (
    DataCleaner
)

from backend.agents.schema_agent.schema_agent import (
    SchemaAgent
)

from backend.agents.metadata_agent.metadata_agent import (
    MetadataAgent
)

from backend.database.duckdb_manager import (
    duckdb_manager
)

from backend.database.sqlite_manager import (
    sqlite_manager
)

from backend.memory.session_store import (
    set_active_workspace
)

import os
import shutil
import traceback

router = APIRouter(
    tags=["Upload"]
)

RAW_FOLDER = "uploads/raw"
CLEAN_FOLDER = "uploads/cleaned"

os.makedirs(
    RAW_FOLDER,
    exist_ok=True
)

os.makedirs(
    CLEAN_FOLDER,
    exist_ok=True
)


@router.post("/")
async def upload_file(
    file: UploadFile = File(...)
):

    try:

        file_path = os.path.join(
            RAW_FOLDER,
            file.filename
        )

        with open(
            file_path,
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

        parsed_data = (
            ParserFactory.parse(
                file_path
            )
        )

        if hasattr(parsed_data, "to_csv"):
            df = DataCleaner.standardize_column_names(parsed_data)
            cleaned_df, report = DataCleaner.clean(df, approved_actions=[])

            schema = SchemaAgent.generate_schema(cleaned_df)
            metadata = MetadataAgent.generate_metadata(cleaned_df)
            table_name = file.filename.split(".")[0].lower().replace(" ", "_")

            # Save initial cleaned df to DuckDB
            duckdb_manager.save_dataframe(table_name, cleaned_df)

            # Detect if there are major recommendations
            recs = DataCleaner.detect_recommendations(cleaned_df)
            has_major_recs = any(r.get("severity") == "major" for r in recs)

            # Save cleaned copy initially
            cleaned_path = os.path.join(CLEAN_FOLDER, f"cleaned_{table_name}.csv")
            try:
                cleaned_df.to_csv(cleaned_path, index=False)
            except PermissionError:
                import time
                timestamp = int(time.time())
                cleaned_path = os.path.join(CLEAN_FOLDER, f"cleaned_{table_name}_{timestamp}.csv")
                cleaned_df.to_csv(cleaned_path, index=False)

            # Create workspace
            workspace_id = sqlite_manager.create_workspace(
                name=table_name,
                file_name=file.filename,
                file_path=file_path,
                table_name=table_name,
                schema=schema,
                metadata=metadata,
                cleaning_report=report,
                document_text=None,
                document_tables=0
            )

            # Save Version 1
            sqlite_manager.create_version(
                workspace_id=workspace_id,
                version_num=1,
                file_path=cleaned_path,
                table_name=table_name,
                description="Initial upload (automatic minor cleaning applied)"
            )

            # If no major cleaning recommendations, approve automatically
            if not has_major_recs:
                sqlite_manager.approve_cleaning(workspace_id)

            # Store active workspace
            set_active_workspace(
                workspace_id,
                table_name,
                schema
            )

            response = {
                "status": "success",
                "name": table_name,
                "file_name": str(file.filename),
                "workspace_id": workspace_id,
                "table_name": str(table_name),
                "schema": schema,
                "metadata": metadata,
                "cleaning_report": report,
                "recommendations": recs,
                "cleaning_approved": not has_major_recs
            }

            print("\nUPLOAD RESPONSE:")
            print(response)
            return response

        if isinstance(parsed_data, dict):
            document_text = parsed_data.get("text")
            tables = parsed_data.get("tables", [])
            document_tables = len(tables)

            base_name = file.filename.split(".")[0].lower().replace(" ", "_")
            
            # Save tables to DuckDB and collect table names
            table_names = []
            for i, tbl_df in enumerate(tables):
                tbl_name = f"{base_name}_table_{i+1}"
                try:
                    duckdb_manager.save_dataframe(tbl_name, tbl_df)
                    table_names.append(tbl_name)
                except Exception as tbl_err:
                    print(f"Failed to save PDF table {i+1} to DuckDB: {tbl_err}")

            workspace_id = sqlite_manager.create_workspace(
                name=file.filename.split(".")[0].lower(),
                file_name=file.filename,
                file_path=file_path,
                table_name=", ".join(table_names) if table_names else None,
                schema=None,
                metadata={"tables": table_names} if table_names else None,
                cleaning_report=None,
                document_text=document_text,
                document_tables=document_tables
            )

            # No cleaning needed for text documents
            sqlite_manager.approve_cleaning(workspace_id)

            set_active_workspace(
                workspace_id,
                ", ".join(table_names) if table_names else None,
                None
            )

            return {
                "status": "success",
                "name": file.filename.split(".")[0].lower(),
                "file_name": str(file.filename),
                "workspace_id": workspace_id,
                "document_text": document_text,
                "document_tables": document_tables,
                "table_name": ", ".join(table_names) if table_names else None,
                "cleaning_approved": True
            }

        return {
            "status": "success",
            "filename": str(file.filename)
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))