import pandas as pd


class ExcelLoader:

    @staticmethod
    def load(file_path: str):

        try:

            df = pd.read_excel(
                file_path,
                engine="openpyxl"
            )

            return df

        except Exception as e:

            raise Exception(
                f"Excel loading failed: {str(e)}"
            )