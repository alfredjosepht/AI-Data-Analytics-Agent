class CleaningReportGenerator:

    @staticmethod
    def generate(stats):

        return {

            "duplicates_removed": int(
                stats.get(
                    "duplicates_removed",
                    0
                )
            ),

            "empty_rows_removed": int(
                stats.get(
                    "empty_rows_removed",
                    0
                )
            ),

            "empty_columns_removed": int(
                stats.get(
                    "empty_columns_removed",
                    0
                )
            ),

            "missing_values_filled": int(
                stats.get(
                    "missing_values_filled",
                    0
                )
            ),

            "datatype_conversions": int(
                stats.get(
                    "datatype_conversions",
                    0
                )
            )
        }