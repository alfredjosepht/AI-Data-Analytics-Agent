from backend.llm.gemini_client import (
    gemini_client
)

from backend.llm.prompts import (
    INSIGHT_PROMPT
)


class InsightAgent:

    @staticmethod
    def generate_answer(
        question,
        result
    ):
        # If Gemini/LLM unavailable, return a simple rule-based summary
        if not gemini_client or not getattr(gemini_client, "available", False):
            try:
                # result is a list of dicts
                rows = result or []
                row_count = len(rows)
                if row_count == 0:
                    return "No results to summarize."

                cols = list(rows[0].keys())
                numeric_summaries = []
                categorical_summaries = []

                # build column summaries
                for c in cols:
                    try:
                        vals = [r.get(c) for r in rows if r.get(c) is not None]
                        if not vals:
                            continue
                        # numeric check
                        if all(isinstance(v, (int, float)) for v in vals):
                            mn = min(vals)
                            mx = max(vals)
                            mean = sum(vals) / len(vals)
                            numeric_summaries.append(f"{c}: mean={mean:.2f}, min={mn}, max={mx}")
                        else:
                            # top categories
                            from collections import Counter
                            top = Counter(vals).most_common(3)
                            top_str = ", ".join([f"{k}({v})" for k, v in top])
                            categorical_summaries.append(f"{c}: {top_str}")
                    except Exception:
                        continue

                parts = [f"Rows: {row_count}", f"Columns: {len(cols)}"]
                if numeric_summaries:
                    parts.append("Numeric: " + "; ".join(numeric_summaries))
                if categorical_summaries:
                    parts.append("Categorical: " + "; ".join(categorical_summaries))

                return " | ".join(parts)
            except Exception as e:
                return f"ERROR: failed to generate simple insight: {e}"

        prompt = (
            INSIGHT_PROMPT
            .format(
                question=question,
                result=result
            )
        )

        answer = (
            gemini_client.generate(
                prompt
            )
        )

        return answer