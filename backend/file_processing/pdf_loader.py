import pdfplumber
import pandas as pd


class PDFLoader:

    @staticmethod
    def extract_text(file_path: str):

        text = ""

        with pdfplumber.open(file_path) as pdf:

            for page in pdf.pages:

                extracted = page.extract_text()

                if extracted:
                    text += extracted + "\n"

        return text

    @staticmethod
    def extract_tables(file_path: str):

        tables = []

        with pdfplumber.open(file_path) as pdf:

            for page in pdf.pages:

                page_tables = page.extract_tables()

                for table in page_tables:

                    if len(table) > 1:

                        df = pd.DataFrame(
                            table[1:],
                            columns=table[0]
                        )

                        tables.append(df)

        return tables