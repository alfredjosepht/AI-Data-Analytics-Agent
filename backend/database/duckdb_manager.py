import duckdb
import tempfile
from pathlib import Path


class DuckDBManager:

    def __init__(self):
        root_dir = Path(__file__).resolve().parent.parent.parent
        self.db_path = str(root_dir / "analytics.duckdb")

    def get_connection(self):
        conn = duckdb.connect(
            self.db_path
        )
        try:
            conn.execute("""
            CREATE OR REPLACE MACRO initcap(ws) AS (
                list_reduce(
                    list_transform(
                        regexp_split_to_array(ws, '\\s+'), 
                        w -> concat(upper(w[1]), lower(substring(w, 2)))
                    ),
                    (a, b) -> concat(a, ' ', b)
                )
            );
            """)
        except Exception as e:
            print(f"Failed to register initcap macro in DuckDB: {e}")
        return conn

    def save_dataframe(
        self,
        table_name,
        dataframe
    ):

        conn = self.get_connection()

        try:
            try:
                conn.register(
                    "temp_df",
                    dataframe
                )

                conn.execute(
                    f"""
                    CREATE OR REPLACE TABLE
                    {table_name}
                    AS
                    SELECT *
                    FROM temp_df
                    """
                )
            except Exception:
                tmp_path = None

                try:
                    with tempfile.NamedTemporaryFile(
                        suffix=".csv",
                        mode="w",
                        newline="",
                        encoding="utf-8",
                        delete=False
                    ) as temp_file:
                        tmp_path = temp_file.name
                        dataframe.to_csv(
                            tmp_path,
                            index=False
                        )

                    conn.execute(
                        f"""
                        CREATE OR REPLACE TABLE
                        {table_name}
                        AS
                        SELECT *
                        FROM read_csv_auto('{Path(tmp_path).as_posix()}')
                        """
                    )
                finally:
                    if tmp_path is not None:
                        try:
                            Path(tmp_path).unlink()
                        except OSError:
                            pass
        finally:
            conn.close()

    def get_tables(self):

        conn = self.get_connection()

        tables = conn.execute(
            """
            SHOW TABLES
            """
        ).fetchall()

        conn.close()

        return tables

    def query(
        self,
        sql_query
    ):
        # Validate query safety
        import re
        query_clean = sql_query.lower().strip()
        forbidden_keywords = ["delete", "drop", "alter", "update", "insert"]
        for kw in forbidden_keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", query_clean):
                raise ValueError(f"Unauthorized SQL operation: {kw.upper()} is not allowed.")

        conn = self.get_connection()

        result = conn.execute(
            sql_query
        ).fetchdf()

        conn.close()

        return result

    def table_exists(
        self,
        table_name
    ):
        try:
            tables = [t[0].lower() for t in self.get_tables()]
            return table_name.lower() in tables
        except Exception:
            return False


duckdb_manager = DuckDBManager()