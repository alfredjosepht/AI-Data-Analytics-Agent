from pathlib import Path
import pandas as pd


class TXTLoader:

    @staticmethod
    def load(file_path: str):

        try:

            text = Path(file_path).read_text(
                encoding="utf-8",
                errors="ignore"
            )

            lines = [
                line for line in text.splitlines()
                if line.strip()
            ]

            if len(lines) > 1:
                if "\t" in lines[0]:
                    try:
                        return pd.read_csv(
                            file_path,
                            sep="\t"
                        )
                    except Exception:
                        pass

                if "," in lines[0]:
                    try:
                        return pd.read_csv(
                            file_path,
                            sep=",")
                    except Exception:
                        pass

            return {
                "text": text
            }

        except Exception as e:

            raise Exception(
                f"TXT loading failed: {str(e)}"
            )
