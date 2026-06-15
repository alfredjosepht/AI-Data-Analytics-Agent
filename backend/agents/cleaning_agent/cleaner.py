import pandas as pd
import numpy as np
from backend.agents.cleaning_agent.validators import DataValidator
from backend.agents.cleaning_agent.report_generator import CleaningReportGenerator


class DataCleaner:

    @staticmethod
    def standardize_column_names(df):
        df.columns = [
            str(col).strip().lower().replace(" ", "_")
            for col in df.columns
        ]
        return df

    @staticmethod
    def detect_recommendations(df):
        recommendations = []
        
        # 1. Check duplicates
        try:
            dup_count = int(df.duplicated().sum())
            if dup_count > 0:
                recommendations.append({
                    "id": "remove_duplicates",
                    "type": "remove_duplicates",
                    "description": f"Remove {dup_count} duplicate rows from the dataset.",
                    "severity": "minor",
                    "impact": f"Cleans up {dup_count} redundant rows."
                })
        except Exception:
            pass

        # 2. Check missing values
        for col in df.columns:
            null_count = int(df[col].isna().sum())
            if null_count > 0:
                pct = (null_count / len(df)) * 100
                severity = "major" if pct > 10 else "minor"
                recommendations.append({
                    "id": f"impute_missing:{col}",
                    "type": "impute_missing",
                    "column": col,
                    "description": f"Impute {null_count} missing values ({pct:.1f}%) in '{col}' using median/mode.",
                    "severity": severity,
                    "impact": f"Fills {null_count} null cells in '{col}'."
                })
                recommendations.append({
                    "id": f"drop_null_rows:{col}",
                    "type": "drop_null_rows",
                    "column": col,
                    "description": f"Remove all {null_count} rows with missing values in column '{col}'.",
                    "severity": "major",
                    "impact": f"Deletes {null_count} rows ({pct:.1f}% of data)."
                })

        # 3. Check outliers in numeric columns
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                try:
                    q1 = df[col].quantile(0.25)
                    q3 = df[col].quantile(0.75)
                    iqr = q3 - q1
                    if iqr > 0:
                        lower_bound = q1 - 1.5 * iqr
                        upper_bound = q3 + 1.5 * iqr
                        outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
                        outlier_count = len(outliers)
                        if outlier_count > 0:
                            pct = (outlier_count / len(df)) * 100
                            recommendations.append({
                                "id": f"remove_outliers:{col}",
                                "type": "remove_outliers",
                                "column": col,
                                "description": f"Remove {outlier_count} outliers ({pct:.1f}%) in '{col}' based on IQR boundary.",
                                "severity": "major",
                                "impact": f"Removes values outside [{lower_bound:.2f}, {upper_bound:.2f}] in '{col}'."
                            })
                except Exception:
                    pass

        return recommendations

    @staticmethod
    def clean(df, approved_actions=None):
        stats = {
            "empty_rows_removed": 0,
            "empty_columns_removed": 0,
            "duplicates_removed": 0,
            "missing_values_filled": 0,
            "outliers_removed": 0,
            "datatype_conversions": 0,
            "rows_deleted": 0
        }
        
        # Always run column name standardization first
        df = DataCleaner.standardize_column_names(df)

        # Always apply automatic minor fixes
        # Trim whitespace & clean strings
        for col in df.columns:
            if df[col].dtype == object:
                try:
                    df[col] = df[col].astype(str).str.strip()
                except Exception:
                    pass

        # Remove completely empty rows & cols
        df, removed_rows = DataValidator.remove_empty_rows(df)
        stats["empty_rows_removed"] = int(removed_rows)

        df, removed_cols = DataValidator.remove_empty_columns(df)
        stats["empty_columns_removed"] = int(removed_cols)

        # Date standardizations
        date_keywords = ["date", "day", "month", "year", "time"]
        for col in df.columns:
            col_name = str(col).lower()
            if any(keyword in col_name for keyword in date_keywords):
                try:
                    df[col] = pd.to_datetime(df[col], errors="coerce")
                    stats["datatype_conversions"] += 1
                except Exception:
                    pass

        # If user approved specific actions, execute them
        if approved_actions:
            # 1. Duplicates
            if "remove_duplicates" in approved_actions:
                df, dups = DataValidator.remove_duplicates(df)
                stats["duplicates_removed"] = int(dups)

            for action in approved_actions:
                # 2. Outliers removal
                if action.startswith("remove_outliers:"):
                    col = action.split(":", 1)[1]
                    if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        try:
                            before = len(df)
                            q1 = df[col].quantile(0.25)
                            q3 = df[col].quantile(0.75)
                            iqr = q3 - q1
                            if iqr > 0:
                                lower_bound = q1 - 1.5 * iqr
                                upper_bound = q3 + 1.5 * iqr
                                df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
                                stats["outliers_removed"] += (before - len(df))
                        except Exception:
                            pass
                
                # 3. Drop null rows
                elif action.startswith("drop_null_rows:"):
                    col = action.split(":", 1)[1]
                    if col in df.columns:
                        before = len(df)
                        df = df.dropna(subset=[col])
                        stats["rows_deleted"] += (before - len(df))
                
                # 4. Impute missing
                elif action.startswith("impute_missing:"):
                    col = action.split(":", 1)[1]
                    if col in df.columns:
                        null_mask = df[col].isna()
                        null_count = int(null_mask.sum())
                        if null_count > 0:
                            if pd.api.types.is_numeric_dtype(df[col]):
                                fill_val = df[col].median()
                                if pd.isna(fill_val):
                                    fill_val = 0
                            else:
                                mode = df[col].mode()
                                fill_val = mode[0] if len(mode) > 0 else "unknown"
                            df[col] = df[col].fillna(fill_val)
                            stats["missing_values_filled"] += null_count

        report = CleaningReportGenerator.generate(stats)
        return df, report