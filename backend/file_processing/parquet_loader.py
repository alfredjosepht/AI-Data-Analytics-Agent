import pandas as pd


class ParquetLoader:

    @staticmethod
    def load(file_path: str):

        try:

            df = pd.read_parquet(file_path)

            return df

        except Exception as e:

            raise Exception(
                f"Parquet loading failed: {str(e)}"
            )
