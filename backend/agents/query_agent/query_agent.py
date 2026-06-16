from backend.agents.code_generation_agent.code_agent import (
    CodeGenerationAgent
)

from backend.agents.insight_agent.insight_agent import (
    InsightAgent
)

from backend.agents.visualization_agent.visualization_agent import (
    VisualizationAgent
)

from backend.database.duckdb_manager import (
    duckdb_manager
)

from backend.database.sqlite_manager import (
    sqlite_manager
)

from backend.memory.session_store import (
    get_active_workspace
)


class QueryAgent:

    @staticmethod
    def execute_question(
        question
    ):

        workspace = (
            get_active_workspace()
        )

        if not workspace or not workspace.get("workspace_id"):

            return {
                "question": question,
                "answer":
                "No active workspace. Upload a dataset first.",
                "sql": None,
                "chart": None,
                "result": []
            }

        table_name = (
            workspace.get("table_name")
        )

        schema = (
            workspace.get("schema")
        )

        if not table_name or not schema:
            # Check if this is a document workspace
            db_workspace = sqlite_manager.get_workspace(workspace.get("workspace_id"))
            if db_workspace and db_workspace.get("document_text"):
                from backend.agents.rag_agent import RAGAgent
                try:
                    res = RAGAgent.query_workspace(workspace.get("workspace_id"), question)
                    return {
                        "question": question,
                        "answer": res.get("answer"),
                        "sql": None,
                        "chart": None,
                        "result": [],
                        "hits": res.get("hits")
                    }
                except Exception as e:
                    return {
                        "question": question,
                        "answer": f"RAG Query Error: {e}",
                        "sql": None,
                        "chart": None,
                        "result": []
                    }

            return {
                "question": question,
                "answer":
                "The active workspace does not contain a structured dataset available for SQL queries.",
                "sql": None,
                "chart": None,
                "result": []
            }

        sql = (
            CodeGenerationAgent
            .generate_sql(
                question,
                table_name,
                schema
            )
        )

        # Gemini quota error
        if (
            isinstance(sql, str)
            and
            sql.startswith("ERROR")
        ):

            return {
                "question":
                question,

                "answer":
                sql,

                "sql":
                None,

                "chart":
                None,

                "result":
                []
            }

        try:

            result_df = (
                duckdb_manager
                .query(sql)
            )

        except Exception as e:

            return {
                "question":
                question,

                "answer":
                f"SQL Error: {str(e)}",

                "sql":
                sql,

                "chart":
                None,

                "result":
                []
            }

        result = (
            result_df
            .to_dict(
                orient="records"
            )
        )

        answer = (
            InsightAgent
            .generate_answer(
                question,
                result
            )
        )

        if (
            isinstance(answer, str)
            and
            answer.startswith("ERROR")
        ):

            answer = (
                "Query executed successfully "
                "but AI insight generation "
                "failed because Gemini quota "
                "has been exceeded."
            )

        chart_path = None

        try:
            if (
                len(
                    result_df.columns
                ) >= 2
            ):
                chart_path = (
                    VisualizationAgent
                    .create_chart(
                        result_df
                    )
                )
        except Exception as e:
            print(
                f"Chart Error: {e}"
            )

        workspace_id = workspace.get("workspace_id")

        import json
        try:
            sqlite_manager.save_chat(
                workspace_id=workspace_id,
                question=question,
                answer=answer,
                sql_query=sql,
                result_json=json.dumps(result) if result else None,
                chart_json=json.dumps(chart_path) if chart_path else None
            )
        except Exception as e:
            print(
                f"Chat save error: {e}"
            )

        return {

            "question":
            question,

            "answer":
            answer,

            "table":
            table_name,

            "sql":
            sql,

            "chart":
            chart_path,

            "result":
            result
        }