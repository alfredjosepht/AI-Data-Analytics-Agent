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
    get_active_workspace,
    set_active_workspace
)

import json
import os
import re
import pandas as pd


def sanitize_json_values(val):
    import math
    import pandas as pd
    import numpy as np

    if isinstance(val, dict):
        return {k: sanitize_json_values(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [sanitize_json_values(v) for v in val]
    elif isinstance(val, (float, np.floating)):
        if math.isnan(val) or math.isinf(val) or np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    elif isinstance(val, (int, np.integer)):
        return int(val)
    elif pd.isna(val):
        return None
    return val


def is_dimension_column(col_name, col_schema):
    known_dimensions = {
        "region", "country", "state", "city", "category", "department", 
        "channel", "product_type", "segment", "territory", "gender", 
        "age_group", "customer_type"
    }
    if col_name.lower() in known_dimensions:
        return True
    if col_schema and isinstance(col_schema, dict):
        dtype = col_schema.get("dtype", "").lower()
        if "object" in dtype or "category" in dtype or "string" in dtype:
            return True
    return False


class QueryAgent:

    @staticmethod
    def verify_consistency(question, sql, result, answer, chart):
        # Clean results sample
        result_sample = result[:100] if result else []
        
        # Check LLM client availability
        from backend.llm.gemini_client import gemini_client
        if gemini_client and getattr(gemini_client, "available", False):
            prompt = f"""You are a Data Consistency Validator.
Your task is to analyze if there are any discrepancies, contradictions, or hallucinations between:
1. The user's question: "{question}"
2. The generated SQL query: "{sql}"
3. The SQL query results (first 20 rows): {result_sample}
4. The AI-generated insights/answer: "{answer}"
5. The Plotly chart configuration: {chart}

Please inspect if:
1. The AI insights mention any numbers, categories, or trends that contradict or are not present in the SQL results.
2. The Plotly chart config visualizes variables or data that contradict or do not match the SQL results.
3. The SQL query logic is inconsistent with the user's question.

Respond in JSON format with exactly:
{{
  "consistent": true/false,
  "reason": "Description of any discrepancies, or 'No discrepancies detected' if consistent."
}}
Ensure your response is valid JSON and contains nothing else."""
            try:
                res_text = gemini_client.generate(prompt)
                clean_json_str = res_text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_json_str)
                return bool(parsed.get("consistent", True)), parsed.get("reason", "")
            except Exception as e:
                print(f"Gemini consistency verification failed, falling back: {e}")

        # Programmatic fallback
        return QueryAgent._verify_consistency_programmatic(question, sql, result, answer, chart)

    @staticmethod
    def _verify_consistency_programmatic(question, sql, result, answer, chart):
        if not result or not isinstance(result, list):
            return True, "No structured results to verify"
        
        # 1. Check if chart uses columns that don't exist in results
        if chart and isinstance(chart, dict):
            rec = chart.get("recommendation", {})
            x_col = rec.get("x")
            y_col = rec.get("y")
            first_row = result[0]
            if x_col and x_col not in first_row:
                return False, f"Chart x-column '{x_col}' does not exist in SQL result columns."
            if y_col and y_col not in first_row:
                return False, f"Chart y-column '{y_col}' does not exist in SQL result columns."
                
        # 2. Check if numbers mentioned in the answer exist in the result or are close to them
        numbers_in_answer = re.findall(r'\b\d+(?:\.\d+)?\b', str(answer))
        if numbers_in_answer and result:
            result_numbers = set()
            for row in result:
                for val in row.values():
                    if isinstance(val, (int, float)):
                        result_numbers.add(round(float(val), 2))
                        result_numbers.add(int(val))
                    elif isinstance(val, str):
                        for num in re.findall(r'\b\d+(?:\.\d+)?\b', val):
                            result_numbers.add(round(float(num), 2))
            
            mismatches = []
            for num_str in numbers_in_answer:
                try:
                    num_val = float(num_str)
                    if num_val < 5 or (1990 <= num_val <= 2040):
                        continue
                    rounded_num = round(num_val, 2)
                    found = False
                    for r_num in result_numbers:
                        if abs(r_num - rounded_num) < 0.05 * max(abs(r_num), 1):
                            found = True
                            break
                    if not found:
                        mismatches.append(num_str)
                except ValueError:
                    pass
            
            if mismatches:
                return False, f"Numbers mentioned in the insights {mismatches} do not match any values in the SQL query results."
                
        return True, "No discrepancies detected programmatically"

    @staticmethod
    def _find_identical_or_similar_question(question, history):
        from backend.llm.gemini_client import gemini_client
        if not gemini_client or not getattr(gemini_client, "available", False):
            return None

        # Format history questions and answers
        # We only pass a maximum of the last 15 messages to keep context concise
        recent_history = history[-15:]
        history_str = ""
        for idx, chat in enumerate(recent_history):
            history_str += f"Index: {idx}\nQuestion: \"{chat.get('question')}\"\nSQL: \"{chat.get('sql_query')}\"\nAnswer: \"{chat.get('answer')}\"\n---\n"

        prompt = f"""You are a chat history analyzer.
Your task is to compare a new user question with previous questions in the chat history.
We want to determine if the new question has the same intent and can reuse a previous response directly, or if only small details have changed so that we can adapt the previous SQL query instead of generating a new one from scratch.

CHAT HISTORY:
{history_str}

NEW QUESTION:
"{question}"

DETERMINE the relationship of the NEW QUESTION to the items in the CHAT HISTORY:
- "exact": The new question is the same or substantially identical in meaning/intent (e.g., asking for the same data, just with slightly different phrasing or capitalizations).
- "small_change": The new question is a direct variation of a previous question, where only a minor detail has changed (such as a specific year, filter value, category name, or ranking size (e.g. top 5 instead of top 10)), but the overall structure and query logic remain the same.
- "none": The new question has a different intent or requests completely different metrics, tables, columns, or analysis.

Choose the closest match from the chat history.

Output your response as a valid JSON object with the following fields:
- "match_type": One of "exact", "small_change", "none".
- "match_index": The 0-based Index of the closest matching item in the CHAT HISTORY (only required if match_type is "exact" or "small_change", otherwise null).
- "updated_sql": (Only required if match_type is "small_change") The updated DuckDB SQL query. You must adapt the SQL query of the matched history item to reflect ONLY the small detail changes in the new question. Do not modify any other tables, joins, aliases, or filters.

Ensure your response is valid JSON and contains absolutely nothing else. Do not include markdown code block formatting (like ```json)."""

        try:
            res_text = gemini_client.generate(prompt)
            clean_json_str = res_text.replace("```json", "").replace("```", "").strip()
            match = re.search(r'\{.*\}', clean_json_str, re.DOTALL)
            if match:
                clean_json_str = match.group(0)
            parsed = json.loads(clean_json_str)
            return parsed
        except Exception as e:
            print(f"Similarity analysis failed: {e}")
            return None

    @staticmethod
    def _update_answer_with_new_data(new_question, old_question, old_answer, old_result, new_result):
        from backend.llm.gemini_client import gemini_client
        if not gemini_client or not getattr(gemini_client, "available", False):
            return "Unable to regenerate answer text."

        prompt = f"""You are a Data Analyst.
A user asked a new question that is a minor variation of a previous question.
We have executed the updated SQL query and got new results.

PREVIOUS QUESTION: "{old_question}"
PREVIOUS SQL RESULT: {old_result}
PREVIOUS ANSWER: "{old_answer}"

NEW QUESTION: "{new_question}"
NEW SQL RESULT: {new_result}

TASK:
Update the PREVIOUS ANSWER to reflect the values from the NEW SQL RESULT.
Keep all other wording, tone, formatting, and structure exactly the same.
Update only the specific details (like dates, metrics, numbers, or category names) that changed.
Keep the answer concise to save time and tokens. Do not add any new insights or explanations.

UPDATED ANSWER:"""

        try:
            res_text = gemini_client.generate(prompt)
            return res_text.strip()
        except Exception as e:
            print(f"Failed to update answer with new results: {e}")
            return "Error updating answer."

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

        workspace_id = workspace.get("workspace_id")

        # Check similarity cache
        try:
            history = sqlite_manager.get_chat_history(workspace_id)
            if history:
                match_result = QueryAgent._find_identical_or_similar_question(question, history)
                if match_result and match_result.get("match_type") == "exact":
                    matched_idx = match_result.get("match_index")
                    if matched_idx is not None:
                        try:
                            matched_idx = int(matched_idx)
                        except (ValueError, TypeError):
                            matched_idx = None

                    if matched_idx is not None and 0 <= matched_idx < len(history):
                        matched_chat = history[matched_idx]
                        
                        res_data = None
                        if matched_chat.get("result_json"):
                            try:
                                res_data = json.loads(matched_chat["result_json"])
                            except Exception:
                                res_data = []
                        else:
                            res_data = []
                        
                        chart_data = None
                        if matched_chat.get("chart_json"):
                            try:
                                chart_data = json.loads(matched_chat["chart_json"])
                            except Exception:
                                chart_data = None

                        sqlite_manager.save_chat(
                            workspace_id=workspace_id,
                            question=question,
                            answer=matched_chat.get("answer"),
                            sql_query=matched_chat.get("sql_query"),
                            result_json=matched_chat.get("result_json"),
                            chart_json=matched_chat.get("chart_json")
                        )

                        response = {
                            "question": question,
                            "answer": matched_chat.get("answer"),
                            "sql": matched_chat.get("sql_query"),
                            "chart": chart_data,
                            "result": res_data,
                        }
                        if table_name:
                            response["table"] = table_name
                            response["null_transparency"] = None
                        return response

                elif match_result and match_result.get("match_type") == "small_change":
                    matched_idx = match_result.get("match_index")
                    if matched_idx is not None:
                        try:
                            matched_idx = int(matched_idx)
                        except (ValueError, TypeError):
                            matched_idx = None

                    updated_sql = match_result.get("updated_sql")
                    if updated_sql:
                        updated_sql = updated_sql.replace("```sql", "").replace("```", "").strip()

                    if matched_idx is not None and 0 <= matched_idx < len(history) and updated_sql and table_name:
                        matched_chat = history[matched_idx]
                        
                        try:
                            result_df = duckdb_manager.query(updated_sql)
                            new_result = result_df.to_dict(orient="records")
                            
                            old_result_data = None
                            if matched_chat.get("result_json"):
                                try:
                                    old_result_data = json.loads(matched_chat["result_json"])
                                except Exception:
                                    old_result_data = []

                            updated_answer = QueryAgent._update_answer_with_new_data(
                                question,
                                matched_chat.get("question"),
                                matched_chat.get("answer"),
                                old_result_data,
                                new_result
                            )
                            
                            chart_path = None
                            try:
                                if len(result_df.columns) >= 2:
                                    chart_path = VisualizationAgent.create_chart(result_df)
                            except Exception as e:
                                print(f"Chart error in small change path: {e}")

                            sanitized_result = sanitize_json_values(new_result) if new_result else []
                            sanitized_chart_path = sanitize_json_values(chart_path) if chart_path else None

                            sqlite_manager.save_chat(
                                workspace_id=workspace_id,
                                question=question,
                                answer=updated_answer,
                                sql_query=updated_sql,
                                result_json=json.dumps(sanitized_result) if sanitized_result else None,
                                chart_json=json.dumps(sanitized_chart_path) if sanitized_chart_path else None
                            )

                            return {
                                "question": question,
                                "answer": updated_answer,
                                "table": table_name,
                                "sql": updated_sql,
                                "chart": sanitized_chart_path,
                                "result": sanitized_result,
                                "null_transparency": None
                            }
                        except Exception as sql_err:
                            print(f"Failed to run updated SQL for small change: {sql_err}. Falling back to normal pipeline.")
        except Exception as err:
            print(f"Error checking cache / similarity: {err}")

        if not table_name or not schema:
            # Check if this is a document workspace
            db_workspace = sqlite_manager.get_workspace(workspace_id)
            if db_workspace and db_workspace.get("document_text"):
                from backend.agents.rag_agent import RAGAgent
                try:
                    res = RAGAgent.query_workspace(workspace_id, question)
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

        # 1. Generate SQL
        sql = (
            CodeGenerationAgent
            .generate_sql(
                question,
                table_name,
                schema
            )
        )

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

        # Check if the generated SQL contains multiple queries separated by semicolons
        sql_statements = [s.strip() for s in sql.split(";") if s.strip()]
        
        result_dfs = []
        combined_results = []
        execution_errors = []
        
        for stmt in sql_statements:
            try:
                stmt_df = duckdb_manager.query(stmt)
                result_dfs.append(stmt_df)
                combined_results.extend(stmt_df.to_dict(orient="records"))
            except Exception as e_stmt:
                execution_errors.append(f"SQL Error in statement '{stmt}': {str(e_stmt)}")
                
        if not result_dfs:
            err_msg = execution_errors[0] if execution_errors else "SQL Execution Error"
            return {
                "question": question,
                "answer": err_msg,
                "sql": sql,
                "chart": None,
                "result": []
            }
            
        # Use the first successful result_df for UI table and visualization
        result_df = result_dfs[0]

        # Identify grouping columns
        grouping_cols = []
        group_by_match = re.search(r'GROUP\s+BY\s+([\s\S]+?)(?:ORDER\s+BY|LIMIT|HAVING|WINDOW|\)|$)', sql, re.IGNORECASE)
        if group_by_match:
            group_by_clause = group_by_match.group(1)
            for part in group_by_clause.split(","):
                col = part.strip().split(".")[-1].split(" ")[0].strip("`\"' \n\r\t;,")
                if col in result_df.columns:
                    grouping_cols.append(col)
                else:
                    for c in result_df.columns:
                        if c.lower() == col.lower() or c.lower().strip("`\"' ;,") == col.lower().strip("`\"' ;,"):
                            grouping_cols.append(c)
                            break
                            
        # Fallback: if we have a GROUP BY in SQL but grouping_cols is empty,
        # find any non-numeric columns in result_df
        if not grouping_cols and sql and "group by" in sql.lower():
            for c in result_df.columns:
                if result_df[c].dtype == 'object' or str(result_df[c].dtype) in ('string', 'category'):
                    grouping_cols.append(c)

        # Apply Rule 1 & Rule 2 to result_df:
        if grouping_cols:
            for col in grouping_cols:
                def clean_val(v):
                    if pd.isna(v) or str(v).strip().lower() in ("none", "nan", "unknown") or "unassigned" in str(v).lower():
                        return f"⚠️ Unassigned (Missing {col.replace('_', ' ').title()})"
                    return v
                result_df[col] = result_df[col].apply(clean_val)
            
            # Sort so rows with "⚠️ Unassigned" are at the bottom
            is_unassigned = result_df[grouping_cols[0]].astype(str).str.contains("⚠️ Unassigned")
            for col in grouping_cols[1:]:
                is_unassigned |= result_df[col].astype(str).str.contains("⚠️ Unassigned")
            
            result_df["_sort_unassigned"] = is_unassigned.astype(int)
            result_df = result_df.sort_values(by=["_sort_unassigned"], ascending=True).drop(columns=["_sort_unassigned"])

        result = (
            result_df
            .to_dict(
                orient="records"
            )
        )

        # 2. Generate Insight
        answer = (
            InsightAgent
            .generate_answer(
                question,
                combined_results
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

        # Compute Null Transparency Stats
        null_transparency = None
        try:
            # 1. Total rows in the table
            total_rows = int(duckdb_manager.query(f"SELECT COUNT(*) FROM {table_name}").iloc[0, 0])
            
            # Find units and revenue columns in the schema
            units_cols = [c for c in schema if c.lower() in ["units_sold", "units", "quantity_sold", "quantity", "qty", "volume", "number_of_units"]]
            revenue_cols = [c for c in schema if c.lower() in ["revenue", "sales", "total_revenue", "amount", "total_amount", "grand_total", "price_total"]]
            
            # Calculate metrics for grouping columns
            excluded_grouping_rows = 0
            excluded_units = 0.0
            excluded_revenue = 0.0
            
            # Filter grouping columns to those actually in schema
            schema_grouping_cols = [col for col in grouping_cols if col in schema]
            
            if schema_grouping_cols:
                where_clause = " OR ".join([
                    f"({col} IS NULL OR TRIM(CAST({col} AS VARCHAR)) = '' OR LOWER(CAST({col} AS VARCHAR)) IN ('none', 'nan', 'unknown'))"
                    for col in schema_grouping_cols
                ])
                excluded_grouping_rows = int(duckdb_manager.query(f"SELECT COUNT(*) FROM {table_name} WHERE {where_clause}").iloc[0, 0])
                
                # Sum of units/revenue in excluded rows
                for uc in units_cols:
                    val = duckdb_manager.query(f"SELECT SUM(COALESCE({uc}, 0)) FROM {table_name} WHERE {where_clause}").iloc[0, 0]
                    if pd.notna(val):
                        excluded_units += float(val)
                for rc in revenue_cols:
                    val = duckdb_manager.query(f"SELECT SUM(COALESCE({rc}, 0)) FROM {table_name} WHERE {where_clause}").iloc[0, 0]
                    if pd.notna(val):
                        excluded_revenue += float(val)
                        
            # Also calculate overall NULLs in metric columns themselves
            null_units_count = 0
            null_revenue_count = 0
            for uc in units_cols:
                cnt = int(duckdb_manager.query(f"SELECT COUNT(*) FROM {table_name} WHERE {uc} IS NULL").iloc[0, 0])
                null_units_count += cnt
            for rc in revenue_cols:
                cnt = int(duckdb_manager.query(f"SELECT COUNT(*) FROM {table_name} WHERE {rc} IS NULL").iloc[0, 0])
                null_revenue_count += cnt
                
            null_transparency = {
                "total_rows_analyzed": total_rows,
                "grouping_columns": schema_grouping_cols,
                "rows_excluded_grouping_null": excluded_grouping_rows,
                "units_excluded_grouping_null": float(round(excluded_units, 2)),
                "revenue_excluded_grouping_null": float(round(excluded_revenue, 2)),
                "null_units_count": null_units_count,
                "null_revenue_count": null_revenue_count
            }
        except Exception as e_transparency:
            print(f"Failed to calculate null transparency stats: {e_transparency}")

        # Auto-generate Rule 3 Footnotes and Rule 5 Completeness scores
        transparency_messages = []
        if grouping_cols:
            for col in grouping_cols:
                col_schema = schema.get(col, {})
                if is_dimension_column(col, col_schema):
                    dim_display = col.replace('_', ' ').lower()
                    
                    # Z (Total rows in dataset)
                    Z = total_rows if 'total_rows' in locals() else 0
                    if Z == 0:
                        try:
                            Z = int(duckdb_manager.query(f"SELECT COUNT(*) FROM {table_name}").iloc[0, 0])
                        except Exception:
                            Z = 0
                    
                    # X (Missing rows count)
                    try:
                        missing_query = f"""
                        SELECT COUNT(*) 
                        FROM {table_name} 
                        WHERE {col} IS NULL 
                           OR TRIM(CAST({col} AS VARCHAR)) = '' 
                           OR LOWER(CAST({col} AS VARCHAR)) IN ('none', 'nan', 'unknown')
                        """
                        X = int(duckdb_manager.query(missing_query).iloc[0, 0])
                    except Exception as e_missing:
                        print(f"Failed to query missing count for {col}: {e_missing}")
                        X = 0
                        
                    Y_comp = Z - X
                    comp_pct = (Y_comp / Z) * 100 if Z > 0 else 0.0
                    
                    # Rule 5: Always show completeness score below every grouped result
                    comp_score_str = f"Dimension Completeness: {round(comp_pct, 1)}% of rows have a valid {dim_display} value ({Y_comp:,} of {Z:,} total rows)"
                    transparency_messages.append(comp_score_str)
                    
                    # Rule 3: Always show footnote if there are missing values (X > 0)
                    if X > 0:
                        y_units = 0.0
                        z_revenue = 0.0
                        
                        u_col = units_cols[0] if ('units_cols' in locals() and units_cols) else None
                        r_col = revenue_cols[0] if ('revenue_cols' in locals() and revenue_cols) else None
                        
                        # Fallbacks in case local variables are not defined due to exception
                        if not u_col:
                            for c in schema:
                                if c.lower() in ["units_sold", "units", "quantity_sold", "quantity", "qty", "volume", "number_of_units"]:
                                    u_col = c
                                    break
                        if not r_col:
                            for c in schema:
                                if c.lower() in ["revenue", "sales", "total_revenue", "amount", "total_amount", "grand_total", "price_total"]:
                                    r_col = c
                                    break
                        
                        select_parts = []
                        if u_col:
                            select_parts.append(f"SUM(COALESCE({u_col}, 0)) AS y_units")
                        if r_col:
                            select_parts.append(f"SUM(COALESCE({r_col}, 0)) AS z_revenue")
                            
                        if select_parts:
                            try:
                                stats_query = f"""
                                SELECT {', '.join(select_parts)}
                                FROM {table_name}
                                WHERE {col} IS NULL 
                                   OR TRIM(CAST({col} AS VARCHAR)) = '' 
                                   OR LOWER(CAST({col} AS VARCHAR)) IN ('none', 'nan', 'unknown')
                                """
                                stats_res = duckdb_manager.query(stats_query)
                                if not stats_res.empty:
                                    if u_col and pd.notna(stats_res.iloc[0]['y_units']):
                                        y_units = float(stats_res.iloc[0]['y_units'])
                                    if r_col and pd.notna(stats_res.iloc[0]['z_revenue']):
                                        z_revenue = float(stats_res.iloc[0]['z_revenue'])
                            except Exception as e_stats:
                                print(f"Failed to query units/revenue stats for missing {col}: {e_stats}")
                                
                        y_formatted = f"{int(y_units):,}" if y_units.is_integer() else f"{y_units:,.1f}"
                        z_formatted = f"{z_revenue:,.2f}"
                        
                        footnote_str = f"⚠️ Data Quality Notice: {X:,} rows ({y_formatted} units / ${z_formatted} revenue) could not be attributed to any {dim_display} due to missing values in the source data. These are excluded from {dim_display} KPI calculations and benchmarks."
                        transparency_messages.append(footnote_str)

        # Append to answer
        if transparency_messages:
            answer += "\n\n" + "\n".join(transparency_messages)

        # 3. Generate Chart
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

        # 4. Consistency Verification
        consistent, reason = True, "No discrepancies detected"
        try:
            consistent, reason = QueryAgent.verify_consistency(question, sql, combined_results, answer, chart_path)
        except Exception as exc:
            print(f"Consistency verification error: {exc}")

        if not consistent:
            print(f"\n[CONSISTENCY MISMATCH BLOCKED]: {reason}")
            # Check if dataset has not been cleaned yet
            db_workspace = sqlite_manager.get_workspace(workspace_id)
            if db_workspace and not db_workspace.get("cleaning_approved"):
                print("Auto-cleaning dataset to fix query discrepancies...")
                try:
                    from backend.agents.quality_agent import QualityAgent
                    profile_res = QualityAgent.profile_workspace(workspace_id)
                    recs = profile_res.get("profile", {}).get("recommendations", [])
                    approved_actions = [r["id"] for r in recs]

                    if approved_actions:
                        file_path = db_workspace.get("file_path")
                        from backend.file_processing.parser_factory import ParserFactory
                        parsed_data = ParserFactory.parse(file_path)
                        
                        versions = sqlite_manager.get_versions(workspace_id)
                        current_version_num = len(versions) + 1
                        
                        from backend.agents.cleaning_agent.cleaner import DataCleaner
                        cleaned_df, report = DataCleaner.clean(parsed_data, approved_actions)
                        
                        from backend.agents.schema_agent.schema_agent import SchemaAgent
                        from backend.agents.metadata_agent.metadata_agent import MetadataAgent
                        schema = SchemaAgent.generate_schema(cleaned_df)
                        metadata = MetadataAgent.generate_metadata(cleaned_df)
                        
                        duckdb_manager.save_dataframe(table_name, cleaned_df)
                        
                        clean_folder = "uploads/cleaned"
                        os.makedirs(clean_folder, exist_ok=True)
                        versioned_file_name = f"cleaned_{table_name}_v{current_version_num}.csv"
                        versioned_path = os.path.join(clean_folder, versioned_file_name)
                        cleaned_df.to_csv(versioned_path, index=False)
                        
                        desc = f"Auto-cleaned (due to consistency mismatch) applying actions: {', '.join(approved_actions)}"
                        sqlite_manager.create_version(workspace_id, current_version_num, versioned_path, table_name, desc)
                        
                        sqlite_manager.update_cleaning_info(workspace_id, report, cleaning_approved=1)
                        sqlite_manager.update_workspace_version(workspace_id, table_name, schema, metadata)
                        
                        set_active_workspace(workspace_id, table_name, schema)
                        
                        # Regenerate
                        sql = CodeGenerationAgent.generate_sql(question, table_name, schema)
                        
                        try:
                            result_df = duckdb_manager.query(sql)
                            result = result_df.to_dict(orient="records")
                        except Exception as e_sql:
                            result = []
                            result_df = pd.DataFrame()
                        
                        answer = InsightAgent.generate_answer(question, result)
                        
                        chart_path = None
                        try:
                            if len(result_df.columns) >= 2:
                                chart_path = VisualizationAgent.create_chart(result_df)
                        except Exception as e_ch:
                            print(f"Re-chart Error: {e_ch}")

                except Exception as clean_err:
                    print(f"Auto-cleaning query correction pipeline failed: {clean_err}")

        # Sanitize result and chart_path for JSON compliance
        sanitized_result = sanitize_json_values(result) if result else []
        sanitized_chart_path = sanitize_json_values(chart_path) if chart_path else None

        # Save Chat to Database
        try:
            sqlite_manager.save_chat(
                workspace_id=workspace_id,
                question=question,
                answer=answer,
                sql_query=sql,
                result_json=json.dumps(sanitized_result) if sanitized_result else None,
                chart_json=json.dumps(sanitized_chart_path) if sanitized_chart_path else None
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
            sanitized_chart_path,

            "result":
            sanitized_result,

            "null_transparency":
            null_transparency
        }