
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder, RobustScaler, StandardScaler


class FeaturePipeline:
    """
    Standard and complex feature engineering preprocessor for machine learning pipelines.
    Extracts, scales, imputes, encodes, and vectorizes numerical, categorical, datetime, and text features.
    """
    def __init__(self, use_robust_scaler: bool = False):
        self.use_robust_scaler = use_robust_scaler
        self.scaler = RobustScaler() if use_robust_scaler else StandardScaler()
        self.imputer_num = SimpleImputer(strategy="median")
        self.imputer_cat = SimpleImputer(strategy="most_frequent")
        self.label_encoders: dict[str, LabelEncoder] = {}
        self.tfidf_vectorizers: dict[str, TfidfVectorizer] = {}
        self.transformed_feature_names: list[str] = []

    def fit_transform_numeric(self, df: pd.DataFrame, cols: list[str]) -> np.ndarray:
        """
        Imputes and scales numeric columns.
        """
        if not cols:
            return np.empty((len(df), 0))

        # Fill missing values
        imputed = self.imputer_num.fit_transform(df[cols])
        # Scale values
        scaled = self.scaler.fit_transform(imputed)
        return scaled

    def transform_numeric(self, df: pd.DataFrame, cols: list[str]) -> np.ndarray:
        """
        Applies learned scaling on new data.
        """
        if not cols:
            return np.empty((len(df), 0))
        imputed = self.imputer_num.transform(df[cols])
        return self.scaler.transform(imputed)

    def fit_transform_categorical(self, df: pd.DataFrame, cols: list[str]) -> np.ndarray:
        """
        Imputes and label encodes categorical columns.
        """
        if not cols:
            return np.empty((len(df), 0))

        imputed_df = pd.DataFrame(self.imputer_cat.fit_transform(df[cols]), columns=cols)
        encoded_data = np.zeros((len(df), len(cols)))

        for idx, col in enumerate(cols):
            le = LabelEncoder()
            # Handle unseen labels by mapping them during transform if needed
            encoded_data[:, idx] = le.fit_transform(imputed_df[col].astype(str))
            self.label_encoders[col] = le

        return encoded_data

    def transform_categorical(self, df: pd.DataFrame, cols: list[str]) -> np.ndarray:
        """
        Applies label encoding on new data, handling unseen categories.
        """
        if not cols:
            return np.empty((len(df), 0))

        imputed_df = pd.DataFrame(self.imputer_cat.transform(df[cols]), columns=cols)
        encoded_data = np.zeros((len(df), len(cols)))

        for idx, col in enumerate(cols):
            le = self.label_encoders.get(col)
            if not le:
                encoded_data[:, idx] = 0
                continue

            classes = set(le.classes_)
            mapped_series = imputed_df[col].apply(lambda x, classes=classes, le=le: x if x in classes else le.classes_[0])
            encoded_data[:, idx] = le.transform(mapped_series.astype(str))

        return encoded_data

    def fit_transform_datetime(self, df: pd.DataFrame, cols: list[str]) -> tuple[np.ndarray, list[str]]:
        """
        Extracts temporal components (year, month, day, dayofweek, hour, is_weekend, cyclical sine/cosine) from date columns.
        """
        if not cols:
            return np.empty((len(df), 0)), []

        extracted_df_list = []
        feature_names = []

        for col in cols:
            parsed_dates = pd.to_datetime(df[col], errors="coerce")
            dt_df = pd.DataFrame()
            dt_df[f"{col}_year"] = parsed_dates.dt.year.fillna(2000)
            dt_df[f"{col}_month"] = parsed_dates.dt.month.fillna(1)
            dt_df[f"{col}_day"] = parsed_dates.dt.day.fillna(1)
            dt_df[f"{col}_dayofweek"] = parsed_dates.dt.dayofweek.fillna(0)
            dt_df[f"{col}_is_weekend"] = (parsed_dates.dt.dayofweek >= 5).astype(int)

            # Cyclical encoding for month
            month_rad = 2 * np.pi * dt_df[f"{col}_month"] / 12.0
            dt_df[f"{col}_month_sin"] = np.sin(month_rad)
            dt_df[f"{col}_month_cos"] = np.cos(month_rad)

            extracted_df_list.append(dt_df)
            feature_names.extend(dt_df.columns.tolist())

        combined_dt = pd.concat(extracted_df_list, axis=1)
        scaler = StandardScaler()
        scaled_dt = scaler.fit_transform(combined_dt)
        return scaled_dt, feature_names

    def transform_datetime(self, df: pd.DataFrame, cols: list[str]) -> tuple[np.ndarray, list[str]]:
        """
        Transforms date columns on inference dataset.
        """
        if not cols:
            return np.empty((len(df), 0)), []

        extracted_df_list = []
        feature_names = []

        for col in cols:
            val = df[col] if col in df.columns else pd.Series(["2025-01-01"] * len(df))
            parsed_dates = pd.to_datetime(val, errors="coerce")
            dt_df = pd.DataFrame()
            dt_df[f"{col}_year"] = parsed_dates.dt.year.fillna(2000)
            dt_df[f"{col}_month"] = parsed_dates.dt.month.fillna(1)
            dt_df[f"{col}_day"] = parsed_dates.dt.day.fillna(1)
            dt_df[f"{col}_dayofweek"] = parsed_dates.dt.dayofweek.fillna(0)
            dt_df[f"{col}_is_weekend"] = (parsed_dates.dt.dayofweek >= 5).astype(int)

            month_rad = 2 * np.pi * dt_df[f"{col}_month"] / 12.0
            dt_df[f"{col}_month_sin"] = np.sin(month_rad)
            dt_df[f"{col}_month_cos"] = np.cos(month_rad)

            extracted_df_list.append(dt_df)
            feature_names.extend(dt_df.columns.tolist())

        combined_dt = pd.concat(extracted_df_list, axis=1)
        scaler = StandardScaler()
        scaled_dt = scaler.fit_transform(combined_dt)
        return scaled_dt, feature_names

    def fit_transform_text(self, df: pd.DataFrame, cols: list[str]) -> tuple[np.ndarray, list[str]]:
        """
        Extracts TF-IDF features from text columns.
        """
        if not cols:
            return np.empty((len(df), 0)), []

        tfidf_arrays = []
        feature_names = []

        for col in cols:
            text_series = df[col].fillna("").astype(str)
            vectorizer = TfidfVectorizer(max_features=5, stop_words="english")
            transformed = vectorizer.fit_transform(text_series).toarray()
            self.tfidf_vectorizers[col] = vectorizer
            vocab = [f"{col}_tfidf_{word}" for word in vectorizer.get_feature_names_out()]
            tfidf_arrays.append(transformed)
            feature_names.extend(vocab)

        if not tfidf_arrays:
            return np.empty((len(df), 0)), []

        return np.hstack(tfidf_arrays), feature_names

    def transform_text(self, df: pd.DataFrame, cols: list[str]) -> tuple[np.ndarray, list[str]]:
        """
        Applies TF-IDF vectorization on new text data.
        """
        if not cols:
            return np.empty((len(df), 0)), []

        tfidf_arrays = []
        feature_names = []

        for col in cols:
            text_series = df[col].fillna("").astype(str) if col in df.columns else pd.Series([""] * len(df))
            vectorizer = self.tfidf_vectorizers.get(col)
            if not vectorizer:
                continue
            transformed = vectorizer.transform(text_series).toarray()
            vocab = [f"{col}_tfidf_{word}" for word in vectorizer.get_feature_names_out()]
            tfidf_arrays.append(transformed)
            feature_names.extend(vocab)

        if not tfidf_arrays:
            return np.empty((len(df), 0)), []

        return np.hstack(tfidf_arrays), feature_names

    @staticmethod
    def create_lag_features(series: pd.Series, lags: list[int] | None = None) -> pd.DataFrame:
        """
        Helper to generate temporal lag columns for time-series ML (e.g. demand forecasting).
        """
        if lags is None:
            lags = [1, 2, 3, 7]
        df = pd.DataFrame(series)
        col_name = series.name or "value"

        for lag in lags:
            df[f"{col_name}_lag_{lag}"] = series.shift(lag)

        # Drop rows with NaN caused by shifting
        return df.dropna()

