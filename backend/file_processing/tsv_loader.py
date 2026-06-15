import pandas as pd


class TSVLoader:

    @staticmethod
    def load(file_path: str):

        try:

            df = pd.read_csv(
                file_path,
                sep="\t"
            )

            return df

        except Exception as e:

            raise Exception(
                f"TSV loading failed: {str(e)}"
            )
