class MetadataAgent:

    @staticmethod
    def generate_metadata(df):

        metadata = {

            "row_count": int(
                len(df)
            ),

            "column_count": int(
                len(df.columns)
            ),

            "columns": [
                str(col)
                for col in df.columns
            ],

            "numeric_columns": [],

            "categorical_columns": [],

            "date_columns": []
        }

        for column in df.columns:

            dtype = str(
                df[column].dtype
            )

            if (
                "int" in dtype or
                "float" in dtype
            ):

                metadata[
                    "numeric_columns"
                ].append(
                    str(column)
                )

            elif (
                "datetime" in dtype
            ):

                metadata[
                    "date_columns"
                ].append(
                    str(column)
                )

            else:

                metadata[
                    "categorical_columns"
                ].append(
                    str(column)
                )

        return metadata