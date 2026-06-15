import json
import os
import sqlite3
from dotenv import load_dotenv

from pathlib import Path

load_dotenv()

root_dir = Path(__file__).resolve().parent.parent.parent

DB_PATH = os.getenv("SQLITE_DB_PATH")
if not DB_PATH:
    DB_PATH = str(root_dir / "database" / "app.db")
else:
    db_path_obj = Path(DB_PATH)
    if not db_path_obj.is_absolute():
        DB_PATH = str(root_dir / db_path_obj)

DB_DIR = os.path.dirname(DB_PATH)
if DB_DIR:
    os.makedirs(DB_DIR, exist_ok=True)


class SQLiteManager:

    def __init__(self):
        self.conn = sqlite3.connect(
            DB_PATH,
            check_same_thread=False
        )
        self.create_tables()

    def create_tables(self):

        cursor = self.conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workspaces(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            file_name TEXT,
            file_path TEXT,
            table_name TEXT,
            schema_json TEXT,
            metadata_json TEXT,
            cleaning_report_json TEXT,
            cleaning_approved INTEGER DEFAULT 0,
            document_text TEXT,
            document_tables INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER,
            question TEXT,
            answer TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS dataset_versions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER,
            version_num INTEGER,
            file_path TEXT,
            table_name TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER,
            title TEXT,
            file_path TEXT,
            file_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedules(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER,
            name TEXT,
            query TEXT,
            frequency TEXT,
            cron_expr TEXT,
            next_run TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        )
        """)

        self.conn.commit()

    def create_workspace(
        self,
        name,
        file_name,
        file_path,
        table_name=None,
        schema=None,
        metadata=None,
        cleaning_report=None,
        document_text=None,
        document_tables=0
    ):

        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO workspaces(
                name,
                file_name,
                file_path,
                table_name,
                schema_json,
                metadata_json,
                cleaning_report_json,
                cleaning_approved,
                document_text,
                document_tables
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                file_name,
                file_path,
                table_name,
                json.dumps(schema) if schema is not None else None,
                json.dumps(metadata) if metadata is not None else None,
                json.dumps(cleaning_report) if cleaning_report is not None else None,
                0,
                document_text,
                document_tables,
            )
        )

        self.conn.commit()

        return cursor.lastrowid

    def get_workspace(self, workspace_id):

        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT id, name, file_name, file_path, table_name,
                   schema_json, metadata_json, cleaning_report_json,
                   cleaning_approved, document_text, document_tables, created_at
            FROM workspaces
            WHERE id = ?
            """,
            (workspace_id,)
        )

        row = cursor.fetchone()

        if not row:
            return None

        return {
            "id": row[0],
            "name": row[1],
            "file_name": row[2],
            "file_path": row[3],
            "table_name": row[4],
            "schema": json.loads(row[5]) if row[5] else None,
            "metadata": json.loads(row[6]) if row[6] else None,
            "cleaning_report": json.loads(row[7]) if row[7] else None,
            "cleaning_approved": bool(row[8]) if row[8] is not None else False,
            "document_text": row[9],
            "document_tables": row[10],
            "created_at": row[11]
        }

    def list_workspaces(self):

        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT id, name, file_name, file_path, table_name, created_at
            FROM workspaces
            ORDER BY created_at DESC
            """
        )

        rows = cursor.fetchall()

        workspaces = []

        for row in rows:
            workspaces.append({
                "id": row[0],
                "name": row[1],
                "file_name": row[2],
                "file_path": row[3],
                "table_name": row[4],
                "created_at": row[5]
            })

        return workspaces

    def save_chat(
        self,
        workspace_id,
        question,
        answer
    ):

        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO chat_history(
                workspace_id,
                question,
                answer
            )
            VALUES (?, ?, ?)
            """,
            (
                workspace_id,
                question,
                answer
            )
        )

        self.conn.commit()

    def approve_cleaning(self, workspace_id):

        cursor = self.conn.cursor()

        cursor.execute(
            """
            UPDATE workspaces
            SET cleaning_approved = 1
            WHERE id = ?
            """,
            (workspace_id,)
        )

        self.conn.commit()

    def create_version(self, workspace_id, version_num, file_path, table_name, description):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO dataset_versions (workspace_id, version_num, file_path, table_name, description)
            VALUES (?, ?, ?, ?, ?)
            """,
            (workspace_id, version_num, file_path, table_name, description)
        )
        self.conn.commit()
        return cursor.lastrowid

    def get_versions(self, workspace_id):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, workspace_id, version_num, file_path, table_name, description, created_at
            FROM dataset_versions
            WHERE workspace_id = ?
            ORDER BY version_num DESC
            """,
            (workspace_id,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "workspace_id": r[1],
                "version_num": r[2],
                "file_path": r[3],
                "table_name": r[4],
                "description": r[5],
                "created_at": r[6]
            }
            for r in rows
        ]

    def update_workspace_version(self, workspace_id, table_name, schema, metadata):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            UPDATE workspaces
            SET table_name = ?, schema_json = ?, metadata_json = ?
            WHERE id = ?
            """,
            (table_name, json.dumps(schema) if schema else None, json.dumps(metadata) if metadata else None, workspace_id)
        )
        self.conn.commit()

    def create_report(self, workspace_id, title, file_path, file_type):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO reports (workspace_id, title, file_path, file_type)
            VALUES (?, ?, ?, ?)
            """,
            (workspace_id, title, file_path, file_type)
        )
        self.conn.commit()
        return cursor.lastrowid

    def list_reports(self, workspace_id=None):
        cursor = self.conn.cursor()
        if workspace_id:
            cursor.execute(
                """
                SELECT id, workspace_id, title, file_path, file_type, created_at
                FROM reports
                WHERE workspace_id = ?
                ORDER BY created_at DESC
                """,
                (workspace_id,)
            )
        else:
            cursor.execute(
                """
                SELECT id, workspace_id, title, file_path, file_type, created_at
                FROM reports
                ORDER BY created_at DESC
                """
            )
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "workspace_id": r[1],
                "title": r[2],
                "file_path": r[3],
                "file_type": r[4],
                "created_at": r[5]
            }
            for r in rows
        ]

    def create_schedule(self, workspace_id, name, query, frequency, cron_expr, next_run):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO schedules (workspace_id, name, query, frequency, cron_expr, next_run)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (workspace_id, name, query, frequency, cron_expr, next_run)
        )
        self.conn.commit()
        return cursor.lastrowid

    def list_schedules(self, workspace_id=None):
        cursor = self.conn.cursor()
        if workspace_id:
            cursor.execute(
                """
                SELECT id, workspace_id, name, query, frequency, cron_expr, next_run, created_at
                FROM schedules
                WHERE workspace_id = ?
                ORDER BY created_at DESC
                """,
                (workspace_id,)
            )
        else:
            cursor.execute(
                """
                SELECT id, workspace_id, name, query, frequency, cron_expr, next_run, created_at
                FROM schedules
                ORDER BY created_at DESC
                """
            )
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "workspace_id": r[1],
                "name": r[2],
                "query": r[3],
                "frequency": r[4],
                "cron_expr": r[5],
                "next_run": r[6],
                "created_at": r[7]
            }
            for r in rows
        ]

    def delete_schedule(self, schedule_id):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            DELETE FROM schedules
            WHERE id = ?
            """,
            (schedule_id,)
        )
        self.conn.commit()

    def update_schedule_next_run(self, schedule_id, next_run):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            UPDATE schedules
            SET next_run = ?
            WHERE id = ?
            """,
            (next_run, schedule_id)
        )
        self.conn.commit()

    def get_chat_history(self, workspace_id):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, workspace_id, question, answer, created_at
            FROM chat_history
            WHERE workspace_id = ?
            ORDER BY created_at ASC
            """,
            (workspace_id,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "workspace_id": r[1],
                "question": r[2],
                "answer": r[3],
                "created_at": r[4]
            }
            for r in rows
        ]


sqlite_manager = SQLiteManager()