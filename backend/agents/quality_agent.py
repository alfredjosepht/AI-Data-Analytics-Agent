from backend.database.sqlite_manager import sqlite_manager
from backend.database.duckdb_manager import duckdb_manager
import pandas as pd
import numpy as np
import re


class QualityAgent:

    @staticmethod
    def _levenshtein(s1, s2):
        if len(s1) < len(s2):
            return QualityAgent._levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]

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

        # Exact Duplicates
        try:
            dup_count = int(df.duplicated().sum())
            profile["duplicate_rows_percent"] = float(dup_count) / max(len(df), 1)
            if dup_count > 0:
                issues.append(f"Exact Duplicates: {dup_count} exact duplicate rows detected.")
                score -= min(20.0, (float(dup_count) / len(df)) * 50.0)
        except Exception:
            pass

        # Near-Duplicates
        near_dup_count = 0
        try:
            id_date_cols = [
                c for c in df.columns 
                if any(kw in str(c).lower() for kw in ["id", "date", "time", "timestamp", "index", "key"]) 
                or pd.api.types.is_datetime64_any_dtype(df[c])
            ]
            comp_cols = [c for c in df.columns if c not in id_date_cols]
            if len(comp_cols) >= 2 and len(df) > 1:
                sample_df = df[comp_cols].head(1000).astype(str)
                arr = sample_df.values
                n_rows, n_cols = arr.shape
                matched_indices = set()
                for i in range(n_rows):
                    if i in matched_indices:
                        continue
                    row_vals = arr[i]
                    diffs = (arr[i+1:] == row_vals)
                    match_percentages = diffs.mean(axis=1)
                    dup_indices = np.where(match_percentages >= 0.9)[0] + (i + 1)
                    if len(dup_indices) > 0:
                        matched_indices.add(i)
                        for idx in dup_indices:
                            matched_indices.add(idx)
                near_dup_count = int(len(matched_indices) * (len(df) / len(sample_df)))
                if near_dup_count > 0:
                    issues.append(f"Near-Duplicates: Approximately {near_dup_count} rows match another row by 90%+ similarity (excluding unique identifier/date columns).")
                    score -= min(15.0, (near_dup_count / len(df)) * 30.0)
        except Exception as e:
            print(f"Error checking near-duplicates: {e}")

        # Per-column metrics & quality checks
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

            # Null values audit
            if nulls > 0:
                if nulls == len(df):
                    issues.append(f"Column '{col}' is entirely empty.")
                    score -= 10.0
                else:
                    issues.append(f"Missing Values: Column '{col}' has {nulls} missing values ({null_pct*100:.1f}%).")
                    score -= min(15.0, null_pct * 30.0)

            # Numeric columns audits (outliers & impossible values)
            if col_series.dtype.kind in "if":
                try:
                    mn = float(col_series.min())
                    mx = float(col_series.max())
                    mean = float(col_series.mean())
                    col_profile.update({
                        "min": mn,
                        "max": mx,
                        "mean": mean
                    })

                    # Outliers detection: IQR
                    q1 = col_series.quantile(0.25)
                    q3 = col_series.quantile(0.75)
                    iqr = q3 - q1
                    iqr_outliers = pd.Series([False] * len(col_series), index=col_series.index)
                    if iqr > 0:
                        lower_bound = q1 - 1.5 * iqr
                        upper_bound = q3 + 1.5 * iqr
                        iqr_outliers = (col_series < lower_bound) | (col_series > upper_bound)

                    # Outliers detection: Z-score (|Z| > 3)
                    z_outliers = pd.Series([False] * len(col_series), index=col_series.index)
                    std = col_series.std()
                    if std > 0:
                        z_scores = (col_series - mean) / std
                        z_outliers = z_scores.abs() > 3

                    combined_outliers = iqr_outliers | z_outliers
                    outlier_count = int(combined_outliers.sum())
                    if outlier_count > 0:
                        issues.append(f"Outliers: Column '{col}' contains {outlier_count} outliers (detected via IQR/Z-score bounds).")
                        score -= min(10.0, (outlier_count / len(df)) * 20.0)
                except Exception:
                    pass

                # Impossible values (negative values for price, salary, quantity)
                col_lower = str(col).lower()
                if any(kw in col_lower for kw in ["price", "salary", "quantity"]):
                    try:
                        negatives = int((col_series < 0).sum())
                        if negatives > 0:
                            issues.append(f"Impossible Values: Column '{col}' has {negatives} negative values (impossible for pricing/salary/quantity).")
                            score -= 5.0
                    except Exception:
                        pass
                if "age" in col_lower:
                    try:
                        out_of_bounds = int(((col_series < 0) | (col_series > 120)).sum())
                        if out_of_bounds > 0:
                            issues.append(f"Impossible Values: Column '{col}' has {out_of_bounds} values outside [0, 120] (impossible for age).")
                            score -= 5.0
                    except Exception:
                        pass

            # String/Object column audits
            elif pd.api.types.is_string_dtype(col_series) or isinstance(col_series.dtype, pd.CategoricalDtype):
                unique_vals = [str(x).strip() for x in col_series.dropna().unique() if str(x).strip()]

                # Mixed Capitalization
                lowered_map = {}
                for val in unique_vals:
                    l_val = val.lower()
                    lowered_map.setdefault(l_val, []).append(val)
                
                capitalization_issues = []
                for l_val, original_vals in lowered_map.items():
                    if len(original_vals) > 1:
                        quoted_vals = [f"'{o}'" for o in original_vals]
                        capitalization_issues.append(f"mixed casing of '{original_vals[0]}' (e.g. {', '.join(quoted_vals)})")
                
                if capitalization_issues:
                    issues.append(f"Capitalization Inconsistencies: Column '{col}' contains mixed capitalization: {'; '.join(capitalization_issues)}.")
                    score -= 2.0

                # Near-duplicate category names via Levenshtein
                col_lower = str(col).lower()
                is_id_or_date = any(kw in col_lower for kw in ["id", "date", "time", "timestamp", "batch", "serial", "code", "key", "index", "email", "phone"])
                unique_lowered = list(lowered_map.keys())
                near_dup_cats = []
                if not is_id_or_date and len(unique_lowered) <= 100:
                    for i in range(len(unique_lowered)):
                        for j in range(i + 1, len(unique_lowered)):
                            s1, s2 = unique_lowered[i], unique_lowered[j]
                            dist = QualityAgent._levenshtein(s1, s2)
                            max_len = max(len(s1), len(s2))
                            if dist <= 2 and dist < 0.3 * max_len:
                                orig_s1 = lowered_map[s1][0]
                                orig_s2 = lowered_map[s2][0]
                                near_dup_cats.append(f"'{orig_s1}' and '{orig_s2}'")
                
                if near_dup_cats:
                    issues.append(f"Inconsistent Categories: Column '{col}' has near-duplicate category groups: {', '.join(near_dup_cats)}.")
                    score -= 2.0

                # Invalid Formats
                currency_comma_pat = re.compile(r'^\s*[\$\-\+\€\£]?\s*\d{1,3}(,\d{3})*(\.\d+)?\s*[\%]?\s*$')
                numeric_like_count = 0
                non_null_count = len([x for x in col_series if pd.notna(x)])
                if non_null_count > 0:
                    for val in col_series:
                        if pd.notna(val):
                            val_str = str(val)
                            if val_str.replace('.', '', 1).isdigit():
                                continue
                            if currency_comma_pat.match(val_str):
                                numeric_like_count += 1
                    
                    if numeric_like_count > 0.5 * non_null_count:
                        issues.append(f"Invalid Format: Column '{col}' appears to contain formatted numeric values (currency symbols, commas, or percent signs) but is stored as text.")
                        score -= 5.0

                # Mixed / Invalid Dates
                date_keywords = ["date", "day", "month", "year", "time"]
                is_date_col = any(kw in str(col).lower() for kw in date_keywords)
                if is_date_col and non_null_count > 0:
                    invalid_date_count = 0
                    for val in col_series:
                        if pd.notna(val) and str(val).strip():
                            try:
                                pd.to_datetime(val)
                            except Exception:
                                invalid_date_count += 1
                    if invalid_date_count > 0:
                        issues.append(f"Invalid Format: Column '{col}' is flagged as a date column but contains {invalid_date_count} invalid or unparseable date values.")
                        score -= 5.0

            profile["columns"].append(col_profile)

        # Ensure score stays in [0, 100]
        profile["overall_score"] = max(0.0, min(100.0, round(score, 1)))
        profile["issues"] = issues

        # Add data cleaner recommendations
        from backend.agents.cleaning_agent.cleaner import DataCleaner
        profile["recommendations"] = DataCleaner.detect_recommendations(df)

        return {
            "workspace_id": workspace_id,
            "profile": profile,
            "row_count": profile.get("row_count", 0),
            "column_count": profile.get("column_count", 0),
            "overall_score": profile.get("overall_score", 100.0)
        }
