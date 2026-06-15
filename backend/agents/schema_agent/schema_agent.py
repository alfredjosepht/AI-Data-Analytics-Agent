class SchemaAgent:

    @staticmethod
    def generate_schema(df):

        schema = {}

        for column in df.columns:

            schema[
                str(column)
            ] = {

                "dtype": str(
                    df[column].dtype
                ),

                "null_count": int(
                    df[column]
                    .isnull()
                    .sum()
                ),

                "unique_values": int(
                    df[column]
                    .nunique()
                )
            }

        return schema