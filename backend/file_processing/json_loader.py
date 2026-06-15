import pandas as pd


class JSONLoader:

    @staticmethod
    def load(file_path: str):

        try:

            df = pd.read_json(file_path)

            return df

        except Exception as e:

            raise Exception(
                f"JSON loading failed: {str(e)}"
            )
