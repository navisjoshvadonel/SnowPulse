"""
SnowPulse AI - Native AutoML & Forecasting Engine.
Trains classification, regression, and forecasting pipelines directly on Ubuntu.
"""

from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd
import polars as pl
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ..analytics.profiler import DatasetProfiler


class NativeAutoMLEngine:
    def __init__(self, df: pl.DataFrame, target_col: str):
        self.df_pl = df
        self.target_col = target_col
        self.profile = DatasetProfiler.profile_full(df)
        self.pdf = df.to_pandas()

        if target_col not in self.pdf.columns:
            raise ValueError(f"Target column '{target_col}' not found in dataset columns: {list(self.pdf.columns)}")

        # Detect task type
        target_series = self.pdf[target_col].dropna()
        n_unique = target_series.nunique()
        is_num = pd.api.types.is_numeric_dtype(target_series.dtype)

        if not is_num or (n_unique <= 10 and n_unique / max(len(target_series), 1) < 0.05):
            self.task_type = "classification"
        else:
            self.task_type = "regression"

    def run_training(self) -> dict[str, Any]:
        """
        Executes automated feature engineering, model selection, and evaluation.
        """
        # Drop rows where target is null
        clean_df = self.pdf.dropna(subset=[self.target_col]).copy()
        y = clean_df[self.target_col]
        X = clean_df.drop(columns=[self.target_col])

        # Exclude identifiers, keys, and near-unique columns
        ignored_cols = {
            col.name for col in self.profile.columns
            if col.inferred_role in ["identifier", "temporal"] or col.dtype_category in ["id_like", "datetime"] or col.cardinality_ratio > 0.6
        }
        candidate_cols = [c for c in X.columns if c not in ignored_cols]
        if not candidate_cols:
            candidate_cols = list(X.columns)
        X = X[candidate_cols]

        # Separate numeric and categorical features
        numeric_cols = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c].dtype)]
        categorical_cols = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c].dtype)]

        # Preprocess features
        X_num = None
        num_feature_names = []
        if numeric_cols:
            num_imputer = SimpleImputer(strategy="median")
            scaler = StandardScaler()
            X_num = scaler.fit_transform(num_imputer.fit_transform(X[numeric_cols]))
            num_feature_names = numeric_cols

        X_cat = None
        cat_feature_names = []
        if categorical_cols:
            cat_imputer = SimpleImputer(strategy="most_frequent")
            encoder = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
            filled_cat = cat_imputer.fit_transform(X[categorical_cols].astype(str))
            X_cat = encoder.fit_transform(filled_cat)
            cat_feature_names = list(encoder.get_feature_names_out(categorical_cols))

        if X_num is not None and X_cat is not None:
            X_processed = np.hstack([X_num, X_cat])
            all_feature_names = num_feature_names + cat_feature_names
        elif X_num is not None:
            X_processed = X_num
            all_feature_names = num_feature_names
        elif X_cat is not None:
            X_processed = X_cat
            all_feature_names = cat_feature_names
        else:
            raise ValueError("No valid features found for modeling.")

        # Train / Test split
        X_train, X_test, y_train, y_test = train_test_split(X_processed, y, test_size=0.2, random_state=42)

        # Train candidate models
        models = {}
        if self.task_type == "classification":
            models["RandomForest"] = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
            models["GradientBoosting"] = GradientBoostingClassifier(n_estimators=80, max_depth=5, random_state=42)
            models["LogisticRegression"] = LogisticRegression(max_iter=500, random_state=42)
        else:
            models["RandomForest"] = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
            models["GradientBoosting"] = GradientBoostingRegressor(n_estimators=80, max_depth=5, random_state=42)
            models["Ridge"] = Ridge(alpha=1.0)

        best_model_name = None
        best_model = None
        best_score = -float("inf")
        model_scores = {}

        for name, model in models.items():
            try:
                cv_scores = cross_val_score(model, X_train, y_train, cv=min(3, len(X_train)), scoring="accuracy" if self.task_type == "classification" else "r2")
                mean_cv = float(np.mean(cv_scores))
                model_scores[name] = round(mean_cv, 4)
                if mean_cv > best_score:
                    best_score = mean_cv
                    best_model_name = name
                    best_model = model
            except Exception:
                continue

        if best_model is None:
            best_model_name = list(models.keys())[0]
            best_model = models[best_model_name]

        # Fit best model
        best_model.fit(X_train, y_train)
        preds = best_model.predict(X_test)

        metrics = {}
        if self.task_type == "classification":
            metrics["accuracy"] = round(float(accuracy_score(y_test, preds)), 4)
            metrics["f1_macro"] = round(float(f1_score(y_test, preds, average="macro")), 4)
        else:
            metrics["r2_score"] = round(float(r2_score(y_test, preds)), 4)
            metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, preds))), 4)

        # Feature importances
        feature_importances = []
        importances = None
        if hasattr(best_model, "feature_importances_"):
            importances = best_model.feature_importances_
        elif hasattr(best_model, "coef_"):
            coef = best_model.coef_
            if coef.ndim > 1:
                importances = np.mean(np.abs(coef), axis=0)
            else:
                importances = np.abs(coef)

        if importances is not None and len(importances) > 0:
            sorted_idx = np.argsort(importances)[::-1][:10]
            for idx in sorted_idx:
                feature_importances.append({
                    "feature": all_feature_names[idx] if idx < len(all_feature_names) else f"feature_{idx}",
                    "importance": round(float(importances[idx]), 4)
                })

        return {
            "task_type": self.task_type,
            "target_col": self.target_col,
            "best_model": best_model_name,
            "model_comparison": model_scores,
            "metrics": metrics,
            "top_features": feature_importances,
            "sample_count": len(clean_df),
        }
