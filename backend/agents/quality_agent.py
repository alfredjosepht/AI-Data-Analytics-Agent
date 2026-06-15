from backend.database.sqlite_manager import sqlite_manager
from backend.database.duckdb_manager import duckdb_manager
import pandas as pd
import numpy as np


class QualityAgent:

    @staticmethod
    def profile_workspace(workspace_id: int):

        workspace = sqlite_manager.get_workspace(workspace_id)

        if not workspace:
            raise ValueError("Workspace not found")

        table = workspace.get("table_name")

        if not table:
            return {
                "workspace_id": workspace_id,
                "profile": None,
                "message": "No structured table available for this workspace"
            }

        try:
            df = duckdb_manager.query(f"SELECT * FROM {table} LIMIT 100000")
        except Exception as e:
            return {
                "workspace_id": workspace_id,
                "profile": None,
                "error": str(e)
            }

        profile = {
            "row_count": int(workspace.get("metadata", {}).get("row_count") or len(df)),
            "column_count": len(df.columns),
            "columns": [],
            "duplicate_rows_percent": 0.0,
            "overall_score": 100.0,
            "issues": [],
            "recommendations": []
        }

        issues = []
        score = 100.0

        # duplicates
        try:
            dup_count = int(df.duplicated().sum())
            profile["duplicate_rows_percent"] = float(dup_count) / max(len(df), 1)
            if dup_count > 0:
                issues.append(f"{dup_count} duplicate rows")
                score -= min(30.0, (float(dup_count) / len(df)) * 50.0)
        except Exception:
            pass

        # per-column metrics
        for col in df.columns:
            col_series = df[col]
            nulls = int(col_series.isnull().sum())
            unique = int(col_series.nunique())
            null_pct = float(nulls) / max(len(df), 1)

            col_profile = {
                "name": str(col),
                "null_count": nulls,
                "null_percent": null_pct,
                "unique_count": unique,
                "dtype": str(col_series.dtype)
            }

            if nulls > 0:
                if nulls == len(df):
                    issues.append(f"Column '{col}' is entirely empty")
                    score -= 10.0
                else:
                    issues.append(f"{nulls} missing values in '{col}'")
                    score -= min(15.0, null_pct * 30.0)

            # numeric stats & outliers
            try:
                if col_series.dtype.kind in "if":
                    mn = float(col_series.min())
                    mx = float(col_series.max())
                    mean = float(col_series.mean())
                    col_profile.update({
                        "min": mn,
                        "max": mx,
                        "mean": mean
                    })
                    
                    # IQR Outlier check
                    q1 = col_series.quantile(0.25)
                    q3 = col_series.quantile(0.75)
                    iqr = q3 - q1
                    if iqr > 0:
                        lower_bound = q1 - 1.5 * iqr
                        upper_bound = q3 + 1.5 * iqr
                        outliers = col_series[(col_series < lower_bound) | (col_series > upper_bound)]
                        outlier_count = len(outliers)
                        if outlier_count > 0:
                            issues.append(f"{outlier_count} outliers in '{col}'")
                            score -= min(10.0, (outlier_count / len(df)) * 20.0)
            except Exception:
                pass

            profile["columns"].append(col_profile)

        # Ensure score stays in [0, 100]
        profile["overall_score"] = max(0.0, min(100.0, round(score, 1)))
        profile["issues"] = issues

        # Add data cleaner recommendations
        from backend.agents.cleaning_agent.cleaner import DataCleaner
        profile["recommendations"] = DataCleaner.detect_recommendations(df)

        return {
            "workspace_id": workspace_id,
            "profile": profile
        }
