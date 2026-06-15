import pandas as pd

class ChartRecommender:

    @staticmethod
    def recommend(df):
        cols = list(df.columns)
        if len(cols) < 2:
            return {
                "recommended": "table",
                "alternatives": ["table"]
            }

        # Identify types
        numeric_cols = []
        date_cols = []
        categorical_cols = []

        for col in cols:
            series = df[col]
            if pd.api.types.is_numeric_dtype(series):
                numeric_cols.append(col)
            elif pd.api.types.is_datetime64_any_dtype(series) or "date" in str(col).lower() or "time" in str(col).lower():
                date_cols.append(col)
            else:
                categorical_cols.append(col)

        # 1. Date + Metric
        if date_cols and numeric_cols:
            return {
                "recommended": "line",
                "alternatives": ["line", "bar", "area", "scatter"],
                "x": date_cols[0],
                "y": numeric_cols[0]
            }

        # 2. Category + Metric
        if categorical_cols and numeric_cols:
            return {
                "recommended": "bar",
                "alternatives": ["bar", "pie", "area", "scatter", "treemap", "waterfall"],
                "x": categorical_cols[0],
                "y": numeric_cols[0]
            }

        # 3. Two Numerics
        if len(numeric_cols) >= 2:
            return {
                "recommended": "scatter",
                "alternatives": ["scatter", "line", "bar", "box"],
                "x": numeric_cols[0],
                "y": numeric_cols[1]
            }

        # 4. Single Numeric (distribution)
        if len(numeric_cols) == 1:
            return {
                "recommended": "histogram",
                "alternatives": ["histogram", "box"],
                "x": numeric_cols[0],
                "y": numeric_cols[0]
            }

        # Default fallback
        return {
            "recommended": "bar",
            "alternatives": ["bar", "line", "pie", "scatter", "heatmap"],
            "x": cols[0],
            "y": cols[1] if len(cols) > 1 else cols[0]
        }
