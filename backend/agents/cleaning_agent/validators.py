import pandas as pd


class DataValidator:

    @staticmethod
    def remove_empty_rows(df):

        before = len(df)

        df = df.dropna(how="all")

        removed = before - len(df)

        return df, removed

    @staticmethod
    def remove_empty_columns(df):

        before = len(df.columns)

        df = df.dropna(axis=1, how="all")

        removed = before - len(df.columns)

        return df, removed

    @staticmethod
    def remove_duplicates(df):

        before = len(df)

        df = df.drop_duplicates()

        removed = before - len(df)

        return df, removed