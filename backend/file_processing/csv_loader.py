import pandas as pd


class CSVLoader:

    @staticmethod
    def load(file_path: str):

        try:

            return pd.read_csv(file_path)

        except Exception as e:

            try:
                return pd.read_csv(
                    file_path,
                    engine="python",
                    on_bad_lines="warn",
                    encoding="utf-8"
                )
            except Exception as fallback_error:
                raise Exception(
                    f"CSV loading failed: {str(e)}; fallback failed: {str(fallback_error)}"
                )
  