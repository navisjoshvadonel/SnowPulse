import pandas as pd
import numpy as np
from typing import List, Tuple
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer

class FeaturePipeline:
    """
    Standard preprocessor for machine learning pipelines.
    Extracts, scales, imputes, and encodes dataset columns.
    """
    def __init__(self):
        self.scaler = StandardScaler()
        self.imputer_num = SimpleImputer(strategy="median")
        self.imputer_cat = SimpleImputer(strategy="most_frequent")
        self.label_encoders = {}

    def fit_transform_numeric(self, df: pd.DataFrame, cols: List[str]) -> np.ndarray:
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

    def transform_numeric(self, df: pd.DataFrame, cols: List[str]) -> np.ndarray:
        """
        Applies learned scaling on new data.
        """
        if not cols:
            return np.empty((len(df), 0))
        imputed = self.imputer_num.transform(df[cols])
        return self.scaler.transform(imputed)

    def fit_transform_categorical(self, df: pd.DataFrame, cols: List[str]) -> np.ndarray:
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

    def transform_categorical(self, df: pd.DataFrame, cols: List[str]) -> np.ndarray:
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
                # Fallback to simple category mapping
                encoded_data[:, idx] = 0
                continue
            
            # Map unseen categories to default class 0
            classes = set(le.classes_)
            mapped_series = imputed_df[col].apply(lambda x: x if x in classes else le.classes_[0])
            encoded_data[:, idx] = le.transform(mapped_series.astype(str))
            
        return encoded_data

    @staticmethod
    def create_lag_features(series: pd.Series, lags: List[int] = [1, 2, 3, 7]) -> pd.DataFrame:
        """
        Helper to generate temporal lag columns for time-series ML (e.g. demand forecasting).
        """
        df = pd.DataFrame(series)
        col_name = series.name or "value"
        
        for lag in lags:
            df[f"{col_name}_lag_{lag}"] = series.shift(lag)
            
        # Drop rows with NaN caused by shifting
        return df.dropna()
