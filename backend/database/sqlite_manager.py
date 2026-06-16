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
            sql_query TEXT,
            result_json TEXT,
            chart_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        )
        """)

        # Migration block for existing databases
        for col in ["sql_query", "result_json", "chart_json"]:
            try:
                cursor.execute(f"ALTER TABLE chat_history ADD COLUMN {col} TEXT")
            except Exception:
                pass

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id INTEGER,
            role TEXT,
            message TEXT,
            sql_query TEXT,
            result_json TEXT,
            chart_json TEXT,
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
        self.migrate_chat_history_to_messages()

    def migrate_chat_history_to_messages(self):
        cursor = self.conn.cursor()
        
        # Check if chat_messages exists and has any records
        try:
            cursor.execute("SELECT COUNT(*) FROM chat_messages")
            msg_count = cursor.fetchone()[0]
            if msg_count > 0:
                return
        except Exception:
            return
            
        # Check if chat_history has records
        try:
            cursor.execute("SELECT workspace_id, question, answer, sql_query, result_json, chart_json, created_at FROM chat_history ORDER BY created_at ASC")
            history_rows = cursor.fetchall()
        except Exception:
            return
            
        if not history_rows:
            return
            
        # Migrate history to chat_messages
        for row in history_rows:
            workspace_id, question, answer, sql_query, result_json, chart_json, created_at = row
            
            # User question message
            cursor.execute(
                """
                INSERT INTO chat_messages(workspace_id, role, message, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (workspace_id, "user", question, created_at)
            )
            
            # Assistant answer message
            cursor.execute(
                """
                INSERT INTO chat_messages(workspace_id, role, message, sql_query, result_json, chart_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (workspace_id, "assistant", answer, sql_query, result_json, chart_json, created_at)
            )
            
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
        answer,
        sql_query=None,
        result_json=None,
        chart_json=None
    ):

        cursor = self.conn.cursor()

        # Insert user message
        cursor.execute(
            """
            INSERT INTO chat_messages(
                workspace_id,
                role,
                message
            )
            VALUES (?, 'user', ?)
            """,
            (
                workspace_id,
                question
            )
        )

        # Insert assistant message
        cursor.execute(
            """
            INSERT INTO chat_messages(
                workspace_id,
                role,
                message,
                sql_query,
                result_json,
                chart_json
            )
            VALUES (?, 'assistant', ?, ?, ?, ?)
            """,
            (
                workspace_id,
                answer,
                sql_query,
                result_json,
                chart_json
            )
        )

        self.conn.commit()
        return cursor.lastrowid


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
            SELECT id, workspace_id, role, message, sql_query, result_json, chart_json, created_at
            FROM chat_messages
            WHERE workspace_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (workspace_id,)
        )
        rows = cursor.fetchall()
        
        # Reconstruct Q&A pairs
        history = []
        current_q = None
        current_q_time = None
        
        for r in rows:
            mid, ws_id, role, msg, sql, res, chart, created_at = r
            if role == 'user':
                if current_q is not None:
                    # Unpaired user question
                    history.append({
                        "id": mid,
                        "workspace_id": ws_id,
                        "question": current_q,
                        "answer": "",
                        "sql_query": None,
                        "result_json": None,
                        "chart_json": None,
                        "created_at": current_q_time
                    })
                current_q = msg
                current_q_time = created_at
            else: # assistant
                history.append({
                    "id": mid,
                    "workspace_id": ws_id,
                    "question": current_q or "System Query",
                    "answer": msg,
                    "sql_query": sql,
                    "result_json": res,
                    "chart_json": chart,
                    "created_at": created_at
                })
                current_q = None
                current_q_time = None
                
        if current_q is not None:
            # Trailing unpaired user question
            history.append({
                "id": len(rows),
                "workspace_id": workspace_id,
                "question": current_q,
                "answer": "",
                "sql_query": None,
                "result_json": None,
                "chart_json": None,
                "created_at": current_q_time
            })
            
        return history

    def get_chat_messages(self, workspace_id):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, workspace_id, role, message, sql_query, result_json, chart_json, created_at
            FROM chat_messages
            WHERE workspace_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (workspace_id,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "workspace_id": r[1],
                "role": r[2],
                "message": r[3],
                "sql_query": r[4],
                "result_json": r[5],
                "chart_json": r[6],
                "created_at": r[7]
            }
            for r in rows
        ]

    def rename_workspace(self, workspace_id, new_name):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            UPDATE workspaces
            SET name = ?
            WHERE id = ?
            """,
            (new_name, workspace_id)
        )
        self.conn.commit()

    def delete_workspace(self, workspace_id):
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM chat_messages WHERE workspace_id = ?", (workspace_id,))
        cursor.execute("DELETE FROM chat_history WHERE workspace_id = ?", (workspace_id,))
        cursor.execute("DELETE FROM dataset_versions WHERE workspace_id = ?", (workspace_id,))
        cursor.execute("DELETE FROM reports WHERE workspace_id = ?", (workspace_id,))
        cursor.execute("DELETE FROM schedules WHERE workspace_id = ?", (workspace_id,))
        cursor.execute("DELETE FROM workspaces WHERE id = ?", (workspace_id,))
        self.conn.commit()

    def delete_chat_message(self, chat_id):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            DELETE FROM chat_messages
            WHERE id = ?
            """,
            (chat_id,)
        )
        self.conn.commit()

    def clear_workspace_chat(self, workspace_id):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            DELETE FROM chat_messages
            WHERE workspace_id = ?
            """,
            (workspace_id,)
        )
        self.conn.commit()



sqlite_manager = SQLiteManager()