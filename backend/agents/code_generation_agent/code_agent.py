from backend.llm.gemini_client import (
    gemini_client
)

from backend.llm.prompts import (
    SQL_GENERATION_PROMPT
)


class CodeGenerationAgent:

    @staticmethod
    def generate_sql(
        question,
        table_name,
        schema
    ):
        # If Gemini/LLM is unavailable, use a lightweight rule-based SQL fallback
        def simple_sql_fallback(q, table, sch):
            ql = q.lower()

            # find numeric columns from schema
            numeric_cols = [c for c, v in (sch or {}).items() if "int" in v.get("dtype", "") or "float" in v.get("dtype", "")]
            cols = list((sch or {}).keys()) if sch else []

            # total / sum
            if any(k in ql for k in ["total", "sum", "how much", "amount"]):
                # pick first numeric column or a column named "sales"
                target = None
                if "sales" in cols:
                    target = "sales"
                elif numeric_cols:
                    target = numeric_cols[0]

                if target:
                    return f"SELECT SUM({target}) AS total_{target} FROM {table}"

            # group by X (e.g., "by category")
            if " by " in ql or " per " in ql or "group by" in ql:
                # try to extract group column from question
                for c in cols:
                    if c in ql:
                        # aggregate with sum of numeric column
                        agg = ""
                        if "sales" in cols:
                            agg = f", SUM(sales) AS total_sales"
                        elif numeric_cols:
                            agg = f", SUM({numeric_cols[0]}) AS total_{numeric_cols[0]}"
                        return f"SELECT {c}{agg} FROM {table} GROUP BY {c} ORDER BY 2 DESC"

            # sample / head (e.g., "show first 5 rows")
            import re
            m = re.search(r"first\s+(\d+)", ql)
            if not m:
                m = re.search(r"top\s+(\d+)", ql)
            if m:
                n = int(m.group(1))
                return f"SELECT * FROM {table} LIMIT {n}"

            # count rows
            if any(k in ql for k in ["count", "how many", "rows"]) and "show" not in ql and "first" not in ql:
                return f"SELECT COUNT(*) AS row_count FROM {table}"

            # fallback: select top 10
            # try to find columns mentioned in question
            select_cols = [c for c in cols if c in ql]
            if not select_cols:
                # default to all
                return f"SELECT * FROM {table} LIMIT 10"
            else:
                return f"SELECT {', '.join(select_cols)} FROM {table} LIMIT 10"

        # Prefer LLM when available
        if gemini_client and getattr(gemini_client, "available", False):
            prompt = (
                SQL_GENERATION_PROMPT
                .format(
                    question=question,
                    table_name=table_name,
                    schema=schema
                )
            )

            sql = (
                gemini_client.generate(
                    prompt
                )
            )

            sql = (
                sql
                .replace(
                    "```sql",
                    ""
                )
                .replace(
                    "```",
                    ""
                )
                .strip()
            )

            # if LLM returned an error-like string, fall back
            if isinstance(sql, str) and sql.startswith("ERROR"):
                return simple_sql_fallback(question, table_name, schema)

            return sql

        # No LLM available — use simple fallback
        return simple_sql_fallback(question, table_name, schema)