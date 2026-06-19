import pandas as pd
import numpy as np
import re
import os
from backend.agents.cleaning_agent.validators import DataValidator

# Acronyms that must NOT be title-cased
_PROTECTED_UPPERCASE = {"IPA", "ABV", "SKU", "ID", "URL", "ISBN", "UUID"}

# Helper to title-case strings safely
def _title_case_safe(val: str) -> str:
    if not isinstance(val, str):
        return val
    words = val.strip().split()
    result = []
    for word in words:
        upper = word.upper()
        if upper in _PROTECTED_UPPERCASE:
            result.append(upper)
        else:
            result.append(word.capitalize())
    return " ".join(result)

# Helper to parse yes/no/true/false
_BOOL_VALUES = {"yes", "no", "true", "false", "t", "f", "1", "0"}
def _parse_bool(val):
    if pd.isna(val):
        return val
    s = str(val).strip().lower()
    if s in ("yes", "true", "t", "1"):
        return True
    if s in ("no", "false", "f", "0"):
        return False
    return val

# Helper to normalize gender
def _std_gender(val) -> str:
    if pd.isna(val):
        return val
    s = str(val).strip().lower()
    if s in ("f", "female"):
        return "Female"
    if s in ("m", "male"):
        return "Male"
    return str(val).strip().title()


class DataCleaner:
    # Heuristics keywords for Column Roles
    IDENTIFIER_KEYWORDS = {"id", "sku", "serial", "code", "key", "number", "uuid", "invoice_id", "transaction_id", "sale_id", "customer_id", "batch_number", "distributor_id", "order_id"}
    BUSINESS_METRIC_KEYWORDS = {"revenue", "sales", "units_sold", "quantity", "profit", "amount", "cost", "cogs", "unit_price", "price", "margin", "discount"}
    DATE_KEYWORDS = {"date", "time", "timestamp", "day", "month", "year"}
    ATTRIBUTE_KEYWORDS = {"age", "salary", "bmi", "rating", "score", "temp", "temperature", "gender", "sex", "abv", "percent", "percentage"}
    DIMENSION_KEYWORDS = {"region", "country", "state", "city", "category", "department", "segment", "territory", "product", "channel", "retailer", "type", "store", "brand", "model", "group"}

    @staticmethod
    def detect_column_role(col_name: str, col_series: pd.Series) -> str:
        col_lower = str(col_name).lower().strip()
        
        # 1. Date Check (highest priority to avoid date columns matching other keywords)
        if pd.api.types.is_datetime64_any_dtype(col_series):
            return "DATE"
        if any(kw in col_lower for kw in ["date", "time", "timestamp"]):
            return "DATE"
            
        # 2. Identifier Check
        if col_lower == "id" or col_lower.endswith("_id") or col_lower.startswith("id_") or col_lower.endswith("_uuid") or col_lower.startswith("uuid_"):
            return "IDENTIFIER"
        if col_lower == "sku" or col_lower.endswith("_sku") or col_lower.startswith("sku_"):
            return "IDENTIFIER"
            
        id_kws = ["sku", "serial", "code", "batch", "invoice", "transaction", "order", "distributor", "customer", "sale", "key", "number"]
        if any(kw in col_lower for kw in id_kws):
            # Ensure it is not a business metric, attribute, or date
            metric_kws = ["revenue", "sales", "qty", "quantity", "profit", "amount", "cost", "cogs", "unit_price", "price", "margin", "discount"]
            attr_kws = ["age", "salary", "bmi", "rating", "score", "temp", "temperature", "gender", "sex", "abv", "percent", "percentage"]
            if not any(mk in col_lower for mk in metric_kws) and not any(ak in col_lower for ak in attr_kws):
                return "IDENTIFIER"

        # 3. Business Metric Check
        metric_kws = ["revenue", "sales", "units_sold", "quantity", "qty", "profit", "amount", "cost", "cogs", "unit_price", "price", "margin", "discount"]
        if any(kw in col_lower for kw in metric_kws):
            if not (col_lower.endswith("_id") or col_lower.startswith("id_")):
                return "BUSINESS_METRIC"

        # 4. Attribute Check
        attr_kws = ["age", "salary", "bmi", "rating", "score", "temp", "temperature", "gender", "sex", "abv", "percent", "percentage", "height", "weight", "income"]
        if any(kw in col_lower for kw in attr_kws):
            if pd.api.types.is_numeric_dtype(col_series) and col_series.dtype != bool:
                return "ATTRIBUTE"
            else:
                return "DIMENSION"

        # 5. Dimension Check
        dim_kws = ["region", "country", "state", "city", "category", "department", "segment", "territory", "product_type", "type", "product", "channel", "retailer", "store", "brand", "model", "group", "status", "name", "desc", "description", "industry", "location", "address", "zip", "postal"]
        if any(kw in col_lower for kw in dim_kws):
            return "DIMENSION"

        # Fallbacks based on type
        if pd.api.types.is_numeric_dtype(col_series) and not pd.api.types.is_bool_dtype(col_series):
            if col_series.nunique() < 10 and pd.api.types.is_integer_dtype(col_series):
                return "DIMENSION"
            return "BUSINESS_METRIC"

        return "DIMENSION"

    @staticmethod
    def detect_dataset_type(df: pd.DataFrame) -> str:
        col_names = [str(c).lower().strip() for c in df.columns]
        scores = {
            "Sales Dataset": 0,
            "Financial Dataset": 0,
            "Inventory Dataset": 0,
            "Healthcare Dataset": 0,
            "HR Dataset": 0,
            "Customer Dataset": 0,
            "Manufacturing Dataset": 0
        }
        
        sales_kws = ["sales", "units_sold", "retailer", "discount", "channel", "cogs", "revenue", "order", "price", "unit_price"]
        financial_kws = ["profit", "revenue", "cogs", "cost", "margin", "tax", "income", "expense", "budget", "finance"]
        inventory_kws = ["stock", "sku", "inventory", "warehouse", "batch", "supply", "quantity_on_hand", "reorder"]
        healthcare_kws = ["patient", "health", "bmi", "diagnosis", "treatment", "doctor", "clinic", "medical", "disease"]
        hr_kws = ["employee", "salary", "wage", "hire_date", "job", "department", "performance", "recruitment", "payroll"]
        customer_kws = ["customer", "gender", "age", "rating", "feedback", "satisfaction", "review", "email", "phone"]
        manufacturing_kws = ["manufacturing", "machine", "sensor", "pressure", "temperature", "temp", "defect", "operator", "line", "production"]
        
        for c in col_names:
            if any(kw in c for kw in sales_kws):
                scores["Sales Dataset"] += 1
            if any(kw in c for kw in financial_kws):
                scores["Financial Dataset"] += 1
            if any(kw in c for kw in inventory_kws):
                scores["Inventory Dataset"] += 1
            if any(kw in c for kw in healthcare_kws):
                scores["Healthcare Dataset"] += 1
            if any(kw in c for kw in hr_kws):
                scores["HR Dataset"] += 1
            if any(kw in c for kw in customer_kws):
                scores["Customer Dataset"] += 1
            if any(kw in c for kw in manufacturing_kws):
                scores["Manufacturing Dataset"] += 1
                
        max_score = 0
        best_type = "General Dataset"
        for dtype, score in scores.items():
            if score > max_score:
                max_score = score
                best_type = dtype
        return best_type

    @staticmethod
    def detect_outliers_iqr(col_series: pd.Series) -> pd.Series:
        if not pd.api.types.is_numeric_dtype(col_series) or col_series.dtype == bool:
            return pd.Series([False] * len(col_series), index=col_series.index)
        try:
            q1 = col_series.quantile(0.25)
            q3 = col_series.quantile(0.75)
            iqr = q3 - q1
            if iqr > 0:
                lower_bound = q1 - 3.0 * iqr
                upper_bound = q3 + 3.0 * iqr
                return (col_series < lower_bound) | (col_series > upper_bound)
        except Exception:
            pass
        return pd.Series([False] * len(col_series), index=col_series.index)

    @staticmethod
    def _levenshtein(s1, s2):
        if len(s1) < len(s2):
            return DataCleaner._levenshtein(s2, s1)
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
    def standardize_column_names(df):
        df.columns = [
            str(col).strip().lower().replace(" ", "_")
            for col in df.columns
        ]
        return df

    @staticmethod
    def detect_recommendations(df, dataset_type=None, column_roles=None):
        if dataset_type is None:
            dataset_type = DataCleaner.detect_dataset_type(df)
        if column_roles is None:
            column_roles = {col: DataCleaner.detect_column_role(col, df[col]) for col in df.columns}
            
        recommendations = []
        
        # 1. Missing Values Check
        for col in df.columns:
            if col in ("is_outlier", "is_derived"):
                continue
                
            null_count = int(df[col].isna().sum())
            if null_count > 0:
                role = column_roles.get(col, "DIMENSION")
                
                if role == "DIMENSION":
                    # For dimensions, offer replacement with "Unknown"
                    recommendations.append({
                        "id": f"impute_missing:{col}:Unknown",
                        "type": "impute_missing",
                        "column": col,
                        "description": f"Group missing values in dimension '{col}' under 'Unknown'.",
                        "severity": "minor",
                        "impact": f"Fills {null_count} nulls in '{col}' with 'Unknown'.",
                        "before_preview": f"Contains {null_count} missing values (NaN).",
                        "after_preview": f"All missing values labeled 'Unknown'.",
                        "reasoning": "Labeling missing dimension records as 'Unknown' avoids distorting business distributions (like regional aggregates).",
                        "affected_rows": null_count
                    })
                elif role == "ATTRIBUTE":
                    # Attributes: Median imputation allowed
                    recommendations.append({
                        "id": f"impute_missing:{col}:median",
                        "type": "impute_missing",
                        "column": col,
                        "description": f"Impute {null_count} missing values in attribute '{col}' using Median.",
                        "severity": "minor",
                        "impact": f"Fills {null_count} nulls in '{col}' with median value.",
                        "before_preview": f"Contains {null_count} missing values (NaN).",
                        "after_preview": "Missing values filled with column Median.",
                        "reasoning": "Imputing attribute nulls with the median preserves the statistical properties of the distribution.",
                        "affected_rows": null_count
                    })

        # 2. Outliers Check (IQR * 3)
        for col in df.columns:
            if col in ("is_outlier", "is_derived"):
                continue
            role = column_roles.get(col, "DIMENSION")
            if role in ("IDENTIFIER", "DATE"):
                continue
                
            if pd.api.types.is_numeric_dtype(df[col]) and df[col].dtype != bool:
                try:
                    outliers = DataCleaner.detect_outliers_iqr(df[col])
                    outlier_count = int(outliers.sum())
                    if outlier_count > 0:
                        pct = (outlier_count / len(df)) * 100
                        recommendations.append({
                            "id": f"flag_outliers:{col}",
                            "type": "flag_outliers",
                            "column": col,
                            "description": f"Flag {outlier_count} outliers ({pct:.1f}%) in '{col}' inside 'is_outlier' column.",
                            "severity": "minor",
                            "impact": f"Sets 'is_outlier' to True for extreme rows without changing original value.",
                            "before_preview": f"Values range from {df[col].min():.2f} to {df[col].max():.2f}.",
                            "after_preview": "Outliers tagged in flagging column.",
                            "reasoning": "Flagging outliers protects BI aggregations while retaining legitimate high-value transactions (e.g. bulk orders).",
                            "affected_rows": outlier_count
                        })
                except Exception:
                    pass

        # 3. Invalid Values Check
        for col in df.columns:
            if col in ("is_outlier", "is_derived"):
                continue
            role = column_roles.get(col, "DIMENSION")
            col_lower = str(col).lower()
            issues_found = []
            affected_count = 0
            
            if pd.api.types.is_numeric_dtype(df[col]) and df[col].dtype != bool:
                if any(kw in col_lower for kw in ["price", "salary", "quantity", "unit", "revenue", "sales", "cogs", "profit"]):
                    neg_count = int((df[col] < 0).sum())
                    if neg_count > 0:
                        issues_found.append(f"{neg_count} negative values")
                        affected_count += neg_count
                if "age" in col_lower:
                    age_count = int(((df[col] < 0) | (df[col] > 120)).sum())
                    if age_count > 0:
                        issues_found.append(f"{age_count} impossible age values")
                        affected_count += age_count
                if "abv" in col_lower:
                    abv_count = int(((df[col] < 0) | (df[col] > 100)).sum())
                    if abv_count > 0:
                        issues_found.append(f"{abv_count} invalid ABV values")
                        affected_count += abv_count
                        
            if role == "DATE":
                # Vectorized date parsing check (much faster!)
                parsed_dates = pd.to_datetime(df[col], errors='coerce')
                invalid_dates = int((df[col].notna() & parsed_dates.isna()).sum())
                if invalid_dates > 0:
                    issues_found.append(f"{invalid_dates} unparseable dates")
                    affected_count += invalid_dates
                    
            if issues_found:
                recommendations.append({
                    "id": f"clean_invalid_values:{col}",
                    "type": "clean_invalid_values",
                    "column": col,
                    "description": f"Null out invalid values in '{col}': {', '.join(issues_found)}.",
                    "severity": "major",
                    "impact": f"Sets {affected_count} invalid cells in '{col}' to Null.",
                    "before_preview": f"Contains {affected_count} invalid values.",
                    "after_preview": "Invalid values set to NULL for correction/recovery.",
                    "reasoning": "Replacing impossible or broken formats with Null prevents calculation error and lets formulas attempt recovery.",
                    "affected_rows": affected_count
                })

        # 4. Similar Spelling Category Check
        for col in df.columns:
            if col in ("is_outlier", "is_derived"):
                continue
            role = column_roles.get(col, "DIMENSION")
            if role != "DIMENSION":
                continue
            try:
                val_counts = df[col].dropna().value_counts()
                unique_vals = list(val_counts.index)
                if 1 < len(unique_vals) <= 100:
                    lowered_to_orig = {}
                    for orig in unique_vals:
                        lowered_to_orig.setdefault(str(orig).lower().strip(), []).append(orig)
                    distinct_lowered = list(lowered_to_orig.keys())
                    near_dup_count = 0
                    near_dup_pairs = []
                    for i in range(len(distinct_lowered)):
                        for j in range(i + 1, len(distinct_lowered)):
                            s1, s2 = distinct_lowered[i], distinct_lowered[j]
                            dist = DataCleaner._levenshtein(s1, s2)
                            max_len = max(len(s1), len(s2))
                            if dist <= 2 and dist < 0.3 * max_len:
                                orig1 = lowered_to_orig[s1][0]
                                orig2 = lowered_to_orig[s2][0]
                                near_dup_pairs.append(f"'{orig1}' ~ '{orig2}'")
                                near_dup_count += 1
                    if near_dup_count > 0:
                        recommendations.append({
                            "id": f"merge_categories:{col}",
                            "type": "merge_categories",
                            "column": col,
                            "description": f"Merge spelling variants / near-duplicates in '{col}'.",
                            "severity": "minor",
                            "impact": f"Standardizes similar names: {', '.join(near_dup_pairs[:3])}.",
                            "before_preview": f"Contains duplicate naming variants.",
                            "after_preview": "Similar names consolidated.",
                            "reasoning": "Consolidating near-duplicate strings aligns grouping variables for cleaner aggregation reports.",
                            "affected_rows": near_dup_count
                        })
            except Exception:
                pass

        return recommendations

    @staticmethod
    def recover_derived_metrics(df: pd.DataFrame):
        recovered_log = []
        if "is_derived" not in df.columns:
            df["is_derived"] = False
            
        cols = df.columns
        
        # Helper to convert a column to numeric safely for calculation
        def to_numeric_series(col_name):
            if col_name not in cols:
                return pd.Series(np.nan, index=df.index)
            s = df[col_name]
            if pd.api.types.is_string_dtype(s):
                s = s.str.strip().str.replace("$", "", regex=False).str.replace(",", "", regex=False).str.replace("%", "", regex=False)
            return pd.to_numeric(s, errors='coerce')

        # Compute safe numeric representations of columns
        rev = to_numeric_series("revenue")
        sold = to_numeric_series("units_sold")
        price = to_numeric_series("unit_price")
        profit = to_numeric_series("profit")
        cogs = to_numeric_series("cogs")

        # 1. revenue = units_sold * unit_price
        if "revenue" in cols:
            mask = df["revenue"].isna() & sold.notna() & price.notna()
            if mask.any():
                recovered_vals = sold[mask] * price[mask]
                df.loc[mask, "revenue"] = recovered_vals
                df.loc[mask, "is_derived"] = True
                rev[mask] = recovered_vals
                for idx, val in recovered_vals.items():
                    recovered_log.append({
                        "row_index": int(idx),
                        "column": "revenue",
                        "recovered_value": float(val),
                        "reason": f"Calculated using formula: units_sold ({sold[idx]}) * unit_price ({price[idx]})"
                    })

        # 2. units_sold = revenue / unit_price
        if "units_sold" in cols:
            mask = df["units_sold"].isna() & rev.notna() & price.notna() & (price != 0)
            if mask.any():
                recovered_vals = rev[mask] / price[mask]
                # round if integer-like
                recovered_vals = recovered_vals.apply(lambda x: int(round(x)) if float(x).is_integer() else x)
                df.loc[mask, "units_sold"] = recovered_vals
                df.loc[mask, "is_derived"] = True
                sold[mask] = recovered_vals
                for idx, val in recovered_vals.items():
                    recovered_log.append({
                        "row_index": int(idx),
                        "column": "units_sold",
                        "recovered_value": float(val),
                        "reason": f"Calculated using formula: revenue ({rev[idx]}) / unit_price ({price[idx]})"
                    })

        # 3. unit_price = revenue / units_sold
        if "unit_price" in cols:
            mask = df["unit_price"].isna() & rev.notna() & sold.notna() & (sold != 0)
            if mask.any():
                recovered_vals = (rev[mask] / sold[mask]).round(4)
                df.loc[mask, "unit_price"] = recovered_vals
                df.loc[mask, "is_derived"] = True
                price[mask] = recovered_vals
                for idx, val in recovered_vals.items():
                    recovered_log.append({
                        "row_index": int(idx),
                        "column": "unit_price",
                        "recovered_value": float(val),
                        "reason": f"Calculated using formula: revenue ({rev[idx]}) / units_sold ({sold[idx]})"
                    })

        # 4. profit = revenue - cogs
        if "profit" in cols:
            mask = df["profit"].isna() & rev.notna() & cogs.notna()
            if mask.any():
                recovered_vals = rev[mask] - cogs[mask]
                df.loc[mask, "profit"] = recovered_vals
                df.loc[mask, "is_derived"] = True
                profit[mask] = recovered_vals
                for idx, val in recovered_vals.items():
                    recovered_log.append({
                        "row_index": int(idx),
                        "column": "profit",
                        "recovered_value": float(val),
                        "reason": f"Calculated using formula: revenue ({rev[idx]}) - cogs ({cogs[idx]})"
                    })

        # 5. cogs = revenue - profit
        if "cogs" in cols:
            mask = df["cogs"].isna() & rev.notna() & profit.notna()
            if mask.any():
                recovered_vals = rev[mask] - profit[mask]
                df.loc[mask, "cogs"] = recovered_vals
                df.loc[mask, "is_derived"] = True
                cogs[mask] = recovered_vals
                for idx, val in recovered_vals.items():
                    recovered_log.append({
                        "row_index": int(idx),
                        "column": "cogs",
                        "recovered_value": float(val),
                        "reason": f"Calculated using formula: revenue ({rev[idx]}) - profit ({profit[idx]})"
                    })

        # 6. margin = profit / revenue
        if "margin" in cols:
            mask = df["margin"].isna() & profit.notna() & rev.notna() & (rev != 0)
            if mask.any():
                recovered_vals = (profit[mask] / rev[mask]).round(4)
                df.loc[mask, "margin"] = recovered_vals
                df.loc[mask, "is_derived"] = True
                for idx, val in recovered_vals.items():
                    recovered_log.append({
                        "row_index": int(idx),
                        "column": "margin",
                        "recovered_value": float(val),
                        "reason": f"Calculated using formula: profit ({profit[idx]}) / revenue ({rev[idx]})"
                    })

        return df, recovered_log

    @staticmethod
    def calculate_data_quality_score(df: pd.DataFrame, column_roles: dict) -> float:
        total_weight = 0
        weighted_sum = 0
        
        for col in df.columns:
            if col in ("is_outlier", "is_derived"):
                continue
            role = column_roles.get(col, "DIMENSION")
            
            # Determine weight
            col_lower = str(col).lower().strip()
            if col_lower in ["revenue", "units_sold", "profit", "transaction_date"]:
                weight = 10
            elif col_lower in ["region", "category", "department"]:
                weight = 5
            elif col_lower in ["sale_id", "customer_id", "batch_number"]:
                weight = 1
            else:
                if role == "IDENTIFIER":
                    weight = 1
                elif role == "BUSINESS_METRIC":
                    weight = 10
                elif role == "DATE":
                    weight = 10
                elif role == "DIMENSION":
                    weight = 5
                elif role == "ATTRIBUTE":
                    weight = 5
                else:
                    weight = 3
            
            col_series = df[col]
            null_count = int(col_series.isna().sum())
            
            outlier_count = 0
            if pd.api.types.is_numeric_dtype(col_series) and col_series.dtype != bool:
                outlier_count = int(DataCleaner.detect_outliers_iqr(col_series).sum())
                
            invalid_count = 0
            if pd.api.types.is_numeric_dtype(col_series) and col_series.dtype != bool:
                if any(kw in col_lower for kw in ["price", "salary", "quantity", "unit", "revenue", "sales", "cogs", "profit"]):
                    invalid_count = int((col_series < 0).sum())
                if "age" in col_lower:
                    invalid_count = int(((col_series < 0) | (col_series > 120)).sum())
                if "abv" in col_lower:
                    invalid_count = int(((col_series < 0) | (col_series > 100)).sum())
            elif role == "DATE":
                # Vectorized check
                parsed_dates = pd.to_datetime(col_series, errors='coerce')
                invalid_count = int((col_series.notna() & parsed_dates.isna()).sum())
                        
            total_issues = int(null_count + outlier_count + invalid_count)
            n_rows = len(df)
            col_score = float(max(0.0, 1.0 - (total_issues / n_rows))) if n_rows > 0 else 1.0
            
            weighted_sum += col_score * weight
            total_weight += weight
            
        return float(round((weighted_sum / total_weight) * 100, 1)) if total_weight > 0 else 100.0

    @staticmethod
    def run_analytics_integrity_check(df_before: pd.DataFrame, df_after: pd.DataFrame) -> dict:
        kpi_cols = {
            "revenue": ["revenue", "sales", "total_revenue", "amount"],
            "units_sold": ["units_sold", "units", "quantity_sold"],
            "quantity": ["quantity", "qty"],
            "profit": ["profit", "net_profit"]
        }
        
        results = {}
        warning_triggered = False
        warnings = []
        
        matched_kpi_cols = {}
        for kpi, aliases in kpi_cols.items():
            found = None
            for col in df_before.columns:
                if str(col).lower().strip() in aliases:
                    found = col
                    break
            if found:
                matched_kpi_cols[kpi] = found
                
        before_rows = len(df_before)
        after_rows = len(df_after)
        row_change = 0.0
        if before_rows != 0:
            row_change = float(abs(after_rows - before_rows) / before_rows)
        elif after_rows != 0:
            row_change = 1.0
            
        results["row_count"] = {
            "before": int(before_rows),
            "after": int(after_rows),
            "pct_change": float(round(row_change * 100, 2))
        }
        if row_change > 0.01:
            warning_triggered = True
            warnings.append(f"Row count changed by {row_change*100:.2f}% (Before: {before_rows}, After: {after_rows})")
            
        for kpi, col in matched_kpi_cols.items():
            before_sum = float(pd.to_numeric(df_before[col], errors='coerce').sum())
            after_col = col
            if col not in df_after.columns:
                for c in df_after.columns:
                    if str(c).lower().strip() == str(col).lower().strip():
                        after_col = c
                        break
            
            if after_col in df_after.columns:
                after_sum = float(pd.to_numeric(df_after[after_col], errors='coerce').sum())
            else:
                after_sum = 0.0
                
            pct_change = 0.0
            if before_sum != 0:
                pct_change = float(abs(after_sum - before_sum) / before_sum)
            elif after_sum != 0:
                pct_change = 1.0
                
            results[kpi] = {
                "before": float(before_sum),
                "after": float(after_sum),
                "pct_change": float(round(pct_change * 100, 2))
            }
            
            if pct_change > 0.01:
                warning_triggered = True
                warnings.append(f"KPI Total for '{col}' changed by {pct_change*100:.2f}% (Before: {before_sum:.2f}, After: {after_sum:.2f})")
                
        return {
            "warning_triggered": warning_triggered,
            "warning_message": "Cleaning operation significantly changed business metrics. User approval required." if warning_triggered else "No significant KPI changes detected.",
            "warnings": warnings,
            "kpi_metrics": results
        }

    @staticmethod
    def clean(df, approved_actions=None, mode="standard"):
        if approved_actions is None:
            approved_actions = []
            
        # Determine mode dynamically if actions explicitly sent
        if approved_actions:
            mode = "aggressive"
            
        stats = {
            "duplicates_removed": 0,
            "empty_rows_removed": 0,
            "empty_columns_removed": 0,
            "missing_values_filled": 0,
            "outliers_flagged": 0,
            "datatype_conversions": 0,
            "invalid_values_removed": 0,
            "categories_merged": 0
        }
        
        action_log = []
        outlier_summary = []
        missing_value_summary = {}
        
        # Keep a copy of raw df before standardizations for calculations
        df_before = df.copy()
        
        # 1. Standardize column names
        df = DataCleaner.standardize_column_names(df)
        df_before = DataCleaner.standardize_column_names(df_before)
        
        # Classification
        dataset_type = DataCleaner.detect_dataset_type(df)
        column_roles = {col: DataCleaner.detect_column_role(col, df[col]) for col in df.columns}
        
        # Log missing value counts per column
        for col in df.columns:
            missing_value_summary[col] = int(df[col].isna().sum())
            
        # Quality score before cleaning
        quality_score_before = DataCleaner.calculate_data_quality_score(df_before, column_roles)
        
        # ── STRUCTURAL SAFE TRANSFORMATIONS (Always executed) ───────────────────
        
        # Remove exact duplicate rows
        before_rows = len(df)
        df, dups = DataValidator.remove_duplicates(df)
        stats["duplicates_removed"] = int(dups)
        if dups > 0:
            action_log.append({
                "timestamp": pd.Timestamp.now().isoformat(),
                "action_type": "remove_exact_duplicates",
                "affected_columns": [],
                "affected_rows": int(dups)
            })
            
        # Standardize booleans
        for col in df.columns:
            try:
                non_null = df[col].dropna()
                if len(non_null) == 0:
                    continue
                # Vectorized match check (much faster!)
                matches = non_null.astype(str).str.strip().str.lower().isin(_BOOL_VALUES)
                if matches.mean() >= 0.95:
                    df[col] = df[col].apply(_parse_bool)
                    action_log.append({
                        "timestamp": pd.Timestamp.now().isoformat(),
                        "action_type": "standardize_boolean",
                        "affected_columns": [col],
                        "affected_rows": int(len(non_null))
                    })
            except Exception:
                pass
                
        # Standardize gender
        for col in df.columns:
            role = column_roles.get(col, "DIMENSION")
            if role in ("ATTRIBUTE", "DIMENSION"):
                col_lower = str(col).lower()
                if "gender" in col_lower or "sex" in col_lower:
                    try:
                        non_null = df[col].dropna()
                        df[col] = df[col].apply(_std_gender)
                        action_log.append({
                            "timestamp": pd.Timestamp.now().isoformat(),
                            "action_type": "standardize_gender",
                            "affected_columns": [col],
                            "affected_rows": int(len(non_null))
                        })
                    except Exception:
                        pass
                        
        # Trim whitespace
        for col in df.columns:
            if pd.api.types.is_string_dtype(df[col]):
                try:
                    df[col] = df[col].apply(lambda x: str(x).strip() if pd.notna(x) else x)
                except Exception:
                    pass
                    
        # Standardize date formats to YYYY-MM-DD
        for col in df.columns:
            role = column_roles.get(col, "DIMENSION")
            if role == "DATE":
                try:
                    df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")
                except Exception:
                    pass
                    
        # Parse currency strings
        currency_comma_pat = re.compile(r'^\s*[\$\-\+\€\£]?\s*\d{1,3}(,\d{3})*(\.\d+)?\s*[\%]?\s*$')
        for col in df.columns:
            if pd.api.types.is_string_dtype(df[col]):
                try:
                    non_null = df[col].dropna()
                    if len(non_null) > 0:
                        # Vectorized regex match check
                        match_count = non_null.astype(str).str.match(currency_comma_pat).sum()
                        if match_count > 0.5 * len(non_null):
                            def parse_val(val):
                                if pd.isna(val):
                                    return val
                                s = str(val).strip()
                                for char in ["$", "€", "£", "%", ","]:
                                    s = s.replace(char, "")
                                try:
                                    return float(s) if "." in s else int(s)
                                except ValueError:
                                    return val
                            df[col] = df[col].apply(parse_val)
                            stats["datatype_conversions"] += 1
                except Exception:
                    pass
                    
        # Standardize casing (Title Case) on non-ID text columns
        for col in df.columns:
            role = column_roles.get(col, "DIMENSION")
            if role in ("IDENTIFIER", "DATE"):
                continue
            if pd.api.types.is_string_dtype(df[col]) or isinstance(df[col].dtype, pd.CategoricalDtype):
                try:
                    non_null = df[col].dropna()
                    if len(non_null) == 0:
                        continue
                    # Vectorized numeric check
                    is_numeric_str = non_null.astype(str).str.strip().str.replace(".", "", 1, regex=False).str.lstrip("-").str.isdigit().all()
                    if is_numeric_str:
                        continue
                    if all(isinstance(x, bool) for x in non_null):
                        continue
                        
                    df[col] = df[col].apply(lambda x: _title_case_safe(str(x)) if pd.notna(x) else x)
                    action_log.append({
                        "timestamp": pd.Timestamp.now().isoformat(),
                        "action_type": "standardize_casing_title_case",
                        "affected_columns": [col],
                        "affected_rows": int(len(non_null))
                    })
                except Exception:
                    pass
                    
        # Clean empty rows/cols
        df, removed_rows = DataValidator.remove_empty_rows(df)
        stats["empty_rows_removed"] = int(removed_rows)
        df, removed_cols = DataValidator.remove_empty_columns(df)
        stats["empty_columns_removed"] = int(removed_cols)
        
        # Ensure is_outlier column exists
        df["is_outlier"] = False
        
        # ── STANDARD / AGGRESSIVE ACTIONS (Requires explicit approval) ───────────
        if mode == "aggressive" and approved_actions:
            # 1. Null out invalid values
            for col in df.columns:
                if f"clean_invalid_values:{col}" in approved_actions:
                    col_lower = str(col).lower()
                    role = column_roles.get(col, "DIMENSION")
                    invalid_count = 0
                    
                    if pd.api.types.is_numeric_dtype(df[col]) and df[col].dtype != bool:
                        if any(kw in col_lower for kw in ["price", "salary", "quantity", "unit", "revenue", "sales", "cogs", "profit"]):
                            mask = df[col] < 0
                            invalid_count = int(mask.sum())
                            if invalid_count > 0:
                                df.loc[mask, col] = np.nan
                        elif "age" in col_lower:
                            mask = (df[col] < 0) | (df[col] > 120)
                            invalid_count = int(mask.sum())
                            if invalid_count > 0:
                                df.loc[mask, col] = np.nan
                        elif "abv" in col_lower:
                            mask = (df[col] < 0) | (df[col] > 100)
                            invalid_count = int(mask.sum())
                            if invalid_count > 0:
                                df.loc[mask, col] = np.nan
                                
                    elif role == "DATE":
                        # Vectorized invalid dates cleaning (100x speedup!)
                        parsed_dates = pd.to_datetime(df[col], errors="coerce")
                        mask = df[col].notna() & parsed_dates.isna()
                        invalid_count = int(mask.sum())
                        if invalid_count > 0:
                            df.loc[mask, col] = np.nan
                            
                    if invalid_count > 0:
                        stats["invalid_values_removed"] += invalid_count
                        action_log.append({
                            "timestamp": pd.Timestamp.now().isoformat(),
                            "action_type": "null_invalid_values",
                            "affected_columns": [col],
                            "affected_rows": invalid_count
                        })

            # 2. Flag outliers without modifying values
            for col in df.columns:
                if f"flag_outliers:{col}" in approved_actions:
                    if pd.api.types.is_numeric_dtype(df[col]) and df[col].dtype != bool:
                        try:
                            outliers_mask = DataCleaner.detect_outliers_iqr(df[col])
                            outlier_count = int(outliers_mask.sum())
                            if outlier_count > 0:
                                df.loc[outliers_mask, "is_outlier"] = True
                                stats["outliers_flagged"] += outlier_count
                                # Fast vectorized iteration for outlier summary
                                outlier_rows = df.loc[outliers_mask, col]
                                for idx, val in outlier_rows.items():
                                    outlier_summary.append({
                                        "column": col,
                                        "value": float(val) if isinstance(val, (int, float)) else str(val),
                                        "row_index": int(idx),
                                        "reason": "Value is beyond 3x IQR bounds"
                                    })
                                action_log.append({
                                    "timestamp": pd.Timestamp.now().isoformat(),
                                    "action_type": "flag_outliers",
                                    "affected_columns": [col],
                                    "affected_rows": outlier_count
                                })
                        except Exception:
                            pass

            # 3. Impute missing values (Dimension: Unknown, Attribute: Median)
            for col in df.columns:
                role = column_roles.get(col, "DIMENSION")
                
                # Check Dimension Imputation
                if role == "DIMENSION" and f"impute_missing:{col}:Unknown" in approved_actions:
                    null_mask = df[col].isna()
                    null_count = int(null_mask.sum())
                    if null_count > 0:
                        df[col] = df[col].fillna("Unknown")
                        stats["missing_values_filled"] += null_count
                        action_log.append({
                            "timestamp": pd.Timestamp.now().isoformat(),
                            "action_type": "impute_dimension_unknown",
                            "affected_columns": [col],
                            "affected_rows": null_count
                        })
                        
                # Check Attribute Imputation
                elif role == "ATTRIBUTE" and f"impute_missing:{col}:median" in approved_actions:
                    null_mask = df[col].isna()
                    null_count = int(null_mask.sum())
                    if null_count > 0:
                        if pd.api.types.is_numeric_dtype(df[col]) and df[col].dtype != bool:
                            median_val = df[col].median()
                            if pd.isna(median_val):
                                median_val = 0
                            df[col] = df[col].fillna(median_val)
                        else:
                            mode_series = df[col].mode()
                            fallback_val = mode_series.iloc[0] if not mode_series.empty else "Unknown"
                            df[col] = df[col].fillna(fallback_val)
                        stats["missing_values_filled"] += null_count
                        action_log.append({
                            "timestamp": pd.Timestamp.now().isoformat(),
                            "action_type": "impute_attribute_median",
                            "affected_columns": [col],
                            "affected_rows": null_count
                        })

            # 4. Merge spelling variants
            for col in df.columns:
                if f"merge_categories:{col}" in approved_actions:
                    role = column_roles.get(col, "DIMENSION")
                    if role == "DIMENSION":
                        try:
                            val_counts = df[col].dropna().value_counts()
                            unique_vals = list(val_counts.index)
                            if 1 < len(unique_vals) <= 100:
                                lowered_to_orig = {}
                                for orig in unique_vals:
                                    lowered_to_orig.setdefault(str(orig).lower().strip(), []).append(orig)
                                distinct_lowered = list(lowered_to_orig.keys())
                                merged_count = 0
                                for i in range(len(distinct_lowered)):
                                    for j in range(i + 1, len(distinct_lowered)):
                                        s1, s2 = distinct_lowered[i], distinct_lowered[j]
                                        dist = DataCleaner._levenshtein(s1, s2)
                                        max_len = max(len(s1), len(s2))
                                        if dist <= 2 and dist < 0.3 * max_len:
                                            orig1 = lowered_to_orig[s1][0]
                                            orig2 = lowered_to_orig[s2][0]
                                            count1 = val_counts.get(orig1, 0)
                                            count2 = val_counts.get(orig2, 0)
                                            if count1 >= count2:
                                                target, source = orig1, orig2
                                                affected = count2
                                            else:
                                                target, source = orig2, orig1
                                                affected = count1
                                            mask = df[col] == source
                                            df.loc[mask, col] = target
                                            merged_count += int(affected)
                                if merged_count > 0:
                                    stats["categories_merged"] += merged_count
                                    action_log.append({
                                        "timestamp": pd.Timestamp.now().isoformat(),
                                        "action_type": "merge_similar_categories",
                                        "affected_columns": [col],
                                        "affected_rows": merged_count
                                    })
                        except Exception:
                            pass

        # ── DERIVED METRIC RECOVERY (Runs in aggressive mode, highly optimized)
        recovered_log = []
        if mode == "aggressive":
            df, recovered_log = DataCleaner.recover_derived_metrics(df)
        
        # Standardize date formats to YYYY-MM-DD once more at the end (automatic)
        for col in df.columns:
            role = column_roles.get(col, "DIMENSION")
            if role == "DATE":
                try:
                    df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d")
                except Exception:
                    pass
                    
        # Ensure numeric dtype for known numeric columns (automatic)
        for col in df.columns:
            if col in ("is_outlier", "is_derived"):
                continue
            col_lower = str(col).lower()
            if any(kw in col_lower for kw in ["age", "price", "salary", "quantity", "unit", "revenue", "sales", "amount", "total", "abv", "cogs", "profit"]):
                try:
                    df[col] = pd.to_numeric(df[col], errors="ignore")
                except Exception:
                    pass

        # Quality score after cleaning
        quality_score_after = DataCleaner.calculate_data_quality_score(df, column_roles)
        
        # Analytics Integrity Check
        integrity_check = DataCleaner.run_analytics_integrity_check(df_before, df)
        
        # Build BI Cleaning Report
        report = {
            "dataset_type": dataset_type,
            "column_roles": column_roles,
            "cleaning_actions_applied": action_log,
            "kpi_impact_analysis": integrity_check.get("kpi_metrics", {}),
            "outlier_summary": outlier_summary,
            "missing_value_summary": missing_value_summary,
            "recovered_metrics_summary": recovered_log,
            "data_quality_score": {
                "before": quality_score_before,
                "after": quality_score_after
            },
            "analytics_integrity_check": {
                "warning_triggered": integrity_check.get("warning_triggered", False),
                "warning_message": integrity_check.get("warning_message", ""),
                "warnings": integrity_check.get("warnings", [])
            }
        }
        
        # Make a summary string for backwards compatibility with reporting tools
        summary_parts = []
        for key, val in stats.items():
            if val > 0:
                name = key.replace("_", " ")
                summary_parts.append(f"{val} {name}")
        report_text = "Applied actions: " + ", ".join(summary_parts) + "." if summary_parts else "No cleaning changes applied."
        report["report"] = report_text
        report["duplicates_removed"] = stats["duplicates_removed"]
        report["empty_rows_removed"] = stats["empty_rows_removed"]
        report["empty_columns_removed"] = stats["empty_columns_removed"]
        report["missing_values_filled"] = stats["missing_values_filled"]
        report["datatype_conversions"] = stats["datatype_conversions"]
        report["outliers_removed"] = stats["outliers_flagged"]  # Backwards compatibility key
        
        # Flag integrity warning globally if triggered
        if integrity_check.get("warning_triggered"):
            print(f"\n[KPI INTEGRITY WARNING]: {integrity_check.get('warning_message')}")
            for w in integrity_check.get("warnings", []):
                print(f" - {w}")
                
        return df, report