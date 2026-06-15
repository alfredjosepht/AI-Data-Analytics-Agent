from pathlib import Path

from backend.file_processing.csv_loader import CSVLoader
from backend.file_processing.excel_loader import ExcelLoader
from backend.file_processing.pdf_loader import PDFLoader
from backend.file_processing.json_loader import JSONLoader
from backend.file_processing.parquet_loader import ParquetLoader
from backend.file_processing.tsv_loader import TSVLoader
from backend.file_processing.txt_loader import TXTLoader
from backend.file_processing.docx_loader import DOCXLoader


class ParserFactory:

    @staticmethod
    def parse(file_path: str):

        extension = (
            Path(file_path)
            .suffix
            .lower()
        )

        if extension == ".csv":

            return CSVLoader.load(
                file_path
            )

        elif extension in [
            ".xlsx",
            ".xls"
        ]:

            return ExcelLoader.load(
                file_path
            )

        elif extension == ".tsv":

            return TSVLoader.load(
                file_path
            )

        elif extension == ".json":

            return JSONLoader.load(
                file_path
            )

        elif extension == ".parquet":

            return ParquetLoader.load(
                file_path
            )

        elif extension == ".txt":

            return TXTLoader.load(
                file_path
            )

        elif extension == ".docx":

            return DOCXLoader.load(
                file_path
            )

        elif extension == ".pdf":

            return {
                "text": PDFLoader.extract_text(
                    file_path
                ),
                "tables": PDFLoader.extract_tables(
                    file_path
                )
            }

        else:

            raise ValueError(
                f"Unsupported file type: {extension}"
            )