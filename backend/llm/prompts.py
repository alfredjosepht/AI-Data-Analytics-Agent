SQL_GENERATION_PROMPT = """
You are a senior data analyst.

Table Name:
{table_name}

Schema:
{schema}

User Question:
{question}

Generate ONLY valid DuckDB SQL.

Rules:
1. Output ONLY SQL
2. No markdown
3. No explanation
4. Must start with SELECT

SQL:
"""


INSIGHT_PROMPT = """
You are a business analyst.

Question:
{question}

SQL Result:
{result}

Provide a short business answer.

Rules:
1. Maximum 2 sentences
2. Human readable
3. No markdown
4. No bullet points

Answer:
"""