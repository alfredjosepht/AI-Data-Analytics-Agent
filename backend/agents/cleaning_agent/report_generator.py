class CleaningReportGenerator:

    @staticmethod
    def generate(stats):
        summary_parts = []
        for key, val in stats.items():
            if val > 0:
                name = key.replace("_", " ")
                summary_parts.append(f"{val} {name}")
        report_text = "Applied actions: " + ", ".join(summary_parts) + "." if summary_parts else "No cleaning changes applied."

        return {
            "report": report_text,
            "duplicates_removed": int(stats.get("duplicates_removed", 0)),
            "empty_rows_removed": int(stats.get("empty_rows_removed", 0)),
            "empty_columns_removed": int(stats.get("empty_columns_removed", 0)),
            "missing_values_filled": int(stats.get("missing_values_filled", 0)),
            "datatype_conversions": int(stats.get("datatype_conversions", 0)),
            "outliers_removed": int(stats.get("outliers_removed", 0)),
            "rows_deleted": int(stats.get("rows_deleted", 0)),
            "columns_deleted": int(stats.get("columns_deleted", 0))
        }