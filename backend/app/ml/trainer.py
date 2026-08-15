"""
MLTrainer — Universal AutoML trainer driven strictly by DatasetProfile.

No keyword-based column matching is performed here.
Features & target selection, task inference, preprocessing pipelines, model tournaments,
and feature importance collapse are dynamically built from the stored DatasetProfile.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import (
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

from ..analytics.profiler import DatasetProfile, DatasetProfiler
from ..models import Dataset
from ..storage.service import storage_service
from .registry import ModelRegistry

logger = logging.getLogger("snowpulse.ml.trainer")


def _read_pandas(file_bytes: bytes, filename: str) -> pd.DataFrame:
    from ..validation.quality.quality_scorer import DataQualityScorer
    return DataQualityScorer.read_file_to_pandas(file_bytes, filename)


class DatetimeExtractor(BaseEstimator, TransformerMixin):
    """Transformer that expands datetime columns into numeric date parts."""
    def __init__(self, cols: list[str]):
        self.cols = cols
        self.feature_names_: list[str] = []

    def fit(self, X: pd.DataFrame, y=None):
        feature_names = []
        for col in self.cols:
            feature_names.extend([
                f"{col}_year", f"{col}_month", f"{col}_day", f"{col}_dayofweek", f"{col}_is_weekend"
            ])
        self.feature_names_ = feature_names
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        parts = []
        for col in self.cols:
            parsed = pd.to_datetime(X[col], errors="coerce")
            part = np.column_stack([
                parsed.dt.year.fillna(2000).values,
                parsed.dt.month.fillna(1).values,
                parsed.dt.day.fillna(1).values,
                parsed.dt.dayofweek.fillna(0).values,
                (parsed.dt.dayofweek >= 5).astype(int).values,
            ])
            parts.append(part)
        return np.hstack(parts) if parts else np.empty((len(X), 0))

    def get_feature_names_out(self, input_features=None):
        return np.array(self.feature_names_)


class MLTrainer:
    """
    Universal AutoML Trainer.
    Column roles and types are derived exclusively from DatasetProfile.
    """

    def __init__(self, db, dataset_id: int):
        self.db = db
        self.dataset_id = dataset_id

        ds: Dataset | None = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            raise ValueError(f"Dataset with ID {dataset_id} not found.")

        if ds.file_path.startswith("minio://"):
            parts = ds.file_path.replace("minio://", "").split("/", 1)
            file_bytes = storage_service.get_file(parts[0], parts[1])
            self.df = _read_pandas(file_bytes, parts[1])
        else:
            resolved = ds.file_path
            if not os.path.exists(resolved):
                backend_path = os.path.join("backend", ds.file_path)
                if os.path.exists(backend_path):
                    resolved = backend_path
                else:
                    raise FileNotFoundError(f"Dataset file not found at {ds.file_path}")
            self.df = pd.read_csv(resolved)

        if ds.profile_json:
            self._profile = DatasetProfile.model_validate(ds.profile_json)
        else:
            logger.warning("ml.trainer.fallback_profile dataset_id=%d", dataset_id)
            import io as _io

            import polars as pl
            if ds.file_path.startswith("minio://"):
                parts = ds.file_path.replace("minio://", "").split("/", 1)
                fb = storage_service.get_file(parts[0], parts[1])
                pl_df = pl.read_csv(_io.BytesIO(fb))
            else:
                pl_df = pl.read_csv(resolved if not ds.file_path.startswith("minio://") else ds.file_path)
            self._profile = DatasetProfiler.profile_full(pl_df)

        self._profile_target: str | None = next(
            (c.name for c in self._profile.columns if c.is_primary_metric), None
        )

    # ------------------------------------------------------------------
    # 1. Target Selection & Suggestions
    # ------------------------------------------------------------------

    def suggest_target_candidates(self) -> list[dict[str, Any]]:
        """
        Auto-suggest target candidates:
        - Exclude ID-like columns (cardinality / row_count > 0.95)
        - Exclude columns with > 50% missingness
        - Rank remaining by interestingness (numeric variance, categorical 2-20)
        Returns top 3 candidates.
        """
        total_rows = self._profile.total_rows or len(self.df)
        candidates = []

        for col in self._profile.columns:
            if col.name not in self.df.columns:
                continue

            card_ratio = getattr(col, "cardinality_ratio", 0.0)
            if card_ratio > 0.95 or (col.cardinality and col.cardinality / max(total_rows, 1) > 0.95):
                continue

            missing_pct = getattr(col, "null_percentage", 0.0)
            if missing_pct > 0.5:
                continue

            score = 0.0
            reason = ""

            if col.is_primary_metric:
                score += 0.5
                reason += "Primary metric; "

            if col.dtype_category == "numeric":
                series = self.df[col.name].dropna()
                std_val = float(series.std()) if len(series) > 1 and series.std() is not None else 0.0
                mean_val = float(series.mean()) if len(series) > 0 else 1.0
                cv = abs(std_val / (mean_val + 1e-6))
                if cv > 0.01:
                    score += min(cv * 0.3, 0.4) + 0.3
                    reason += f"Numeric metric (std={std_val:.2f}); "
            elif col.dtype_category in ("categorical", "boolean"):
                card = col.cardinality if hasattr(col, "cardinality") and col.cardinality else self.df[col.name].nunique()
                if 2 <= card <= 20:
                    score += 0.6
                    reason += f"Categorical target with {card} classes; "
                elif card > 20:
                    score += 0.2
                    reason += f"High cardinality categorical ({card} classes); "

            if score > 0:
                candidates.append({
                    "name": col.name,
                    "score": round(score, 3),
                    "dtype_category": col.dtype_category,
                    "inferred_role": col.inferred_role,
                    "cardinality": col.cardinality,
                    "reason": reason.strip("; ")
                })

        candidates.sort(key=lambda x: float(x["score"]), reverse=True)
        return candidates[:3]

    def _resolve_target(self, requested_target: str | None) -> tuple[str, list[dict[str, Any]]]:
        candidates = self.suggest_target_candidates()

        if requested_target and requested_target in self.df.columns:
            return requested_target, candidates

        if candidates:
            return candidates[0]["name"], candidates

        if self._profile_target and self._profile_target in self.df.columns:
            return self._profile_target, candidates

        for c in self._profile.columns:
            if c.name in self.df.columns and getattr(c, "cardinality_ratio", 0.0) <= 0.95:
                return c.name, candidates

        return self.df.columns[0], candidates

    # ------------------------------------------------------------------
    # 2. Target Guard & Task Inference
    # ------------------------------------------------------------------

    def _validate_target(self, target_col: str) -> None:
        """
        Guard: if target cardinality == 1 or > 95% missing -> reject.
        """
        if not target_col or target_col not in self.df.columns:
            raise ValueError("No valid target column selected.")

        series = self.df[target_col].dropna()
        total_len = len(self.df)
        missing_pct = (total_len - len(series)) / max(total_len, 1)

        if len(series) == 0 or missing_pct > 0.95:
            raise ValueError(f"Column '{target_col}' is not a valid target (>95% missing values).")

        n_unique = series.nunique()
        if n_unique <= 1:
            raise ValueError(f"Column '{target_col}' is not a valid target (cardinality=1; all values are identical).")

    def _infer_task_type(self, requested_task: str, target_col: str) -> str:
        """
        Task inference decision tree:
        1. Explicit task if provided
        2. Datetime column present & numeric target -> forecasting
        3. Categorical dtype OR numeric with cardinality <= 10 -> classification
        4. Numeric continuous -> regression
        """
        if requested_task and requested_task not in ("auto", "auto_detect"):
            return requested_task

        self._validate_target(target_col)

        series = self.df[target_col].dropna()
        total_len = len(self.df)
        n_unique = series.nunique()
        card_ratio = n_unique / max(total_len, 1)

        profile_col = next((c for c in self._profile.columns if c.name == target_col), None)
        dtype_cat = profile_col.dtype_category if profile_col else ("numeric" if np.issubdtype(series.dtype, np.number) else "categorical")

        has_datetime = any(
            c.inferred_role == "temporal" or c.dtype_category == "datetime"
            for c in self._profile.columns if c.name != target_col and c.name in self.df.columns
        )
        if has_datetime and dtype_cat == "numeric":
            return "forecasting"

        is_cat_dtype = dtype_cat in ("categorical", "boolean") or str(series.dtype) in ("object", "category", "bool")
        is_low_card_num = (dtype_cat == "numeric") and (n_unique <= 10) and (card_ratio < 0.05)

        if is_cat_dtype or is_low_card_num:
            return "classification"

        if dtype_cat == "numeric" or np.issubdtype(series.dtype, np.number):
            return "regression"

        return "classification"

    # ------------------------------------------------------------------
    # 3. Dynamic ColumnTransformer Construction
    # ------------------------------------------------------------------

    def _build_preprocessor(self, target_col: str) -> tuple[ColumnTransformer, list[str]]:
        """
        Builds dynamic sklearn ColumnTransformer from profile:
        - Drops target, ID-like (>0.95), and >50% missing columns
        - Numeric -> median imputer + StandardScaler
        - Low-cardinality categorical (<=20) -> most-frequent imputer + OneHotEncoder
        - High-cardinality categorical (>20) -> most-frequent imputer + OrdinalEncoder
        - Datetime -> DatetimeExtractor
        """
        num_cols = []
        cat_low_cols = []
        cat_high_cols = []
        date_cols = []

        feature_cols = []

        for col in self._profile.columns:
            if col.name == target_col or col.name not in self.df.columns:
                continue

            card_ratio = getattr(col, "cardinality_ratio", 0.0)
            if card_ratio > 0.95:
                continue

            missing_pct = getattr(col, "null_percentage", 0.0)
            if missing_pct > 0.5:
                continue

            feature_cols.append(col.name)

            if col.inferred_role == "temporal" or col.dtype_category == "datetime":
                date_cols.append(col.name)
            elif col.dtype_category in ("categorical", "boolean") or str(self.df[col.name].dtype) in ("object", "category", "bool"):
                card = col.cardinality if hasattr(col, "cardinality") and col.cardinality else self.df[col.name].nunique()
                if card <= 20:
                    cat_low_cols.append(col.name)
                else:
                    cat_high_cols.append(col.name)
            elif col.dtype_category == "numeric" or np.issubdtype(self.df[col.name].dtype, np.number):
                num_cols.append(col.name)

        transformers = []
        if num_cols:
            num_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ])
            transformers.append(("num", num_pipe, num_cols))

        if cat_low_cols:
            cat_low_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ])
            transformers.append(("cat_low", cat_low_pipe, cat_low_cols))

        if cat_high_cols:
            cat_high_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("ordinal", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
            ])
            transformers.append(("cat_high", cat_high_pipe, cat_high_cols))

        if date_cols:
            transformers.append(("date", DatetimeExtractor(date_cols), date_cols))

        if not transformers:
            fallback_cols = [c for c in self.df.columns if c != target_col]
            transformers.append(("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), fallback_cols))

        ct = ColumnTransformer(transformers=transformers, remainder="drop")
        return ct, feature_cols

    # ------------------------------------------------------------------
    # 4. Feature Importance Collapse Mapping
    # ------------------------------------------------------------------

    def _collapse_feature_importances(
        self, estimator: Any, preprocessor: ColumnTransformer, original_features: list[str]
    ) -> list[dict[str, Any]]:
        """
        Extracts feature importances, maps transformed feature names out of ColumnTransformer
        back to original source columns (summing one-hot importances), and normalizes.
        """
        try:
            transformed_names = preprocessor.get_feature_names_out()
        except Exception:
            transformed_names = np.array([f"feat_{i}" for i in range(100)])

        importances = np.zeros(len(transformed_names))

        if hasattr(estimator, "feature_importances_"):
            importances = estimator.feature_importances_
        elif hasattr(estimator, "coef_"):
            coef = estimator.coef_
            importances = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)

        if len(importances) != len(transformed_names):
            importances = np.ones(len(transformed_names)) / max(1, len(transformed_names))

        orig_importance_map: dict[str, float] = {f: 0.0 for f in original_features}

        for t_name, imp in zip(transformed_names, importances, strict=False):
            matched = False
            for orig in original_features:
                if f"__{orig}_" in t_name or t_name.endswith(f"__{orig}") or f"__{orig}" in t_name:
                    orig_importance_map[orig] += float(imp)
                    matched = True
                    break
            if not matched and original_features:
                orig_importance_map[original_features[0]] += float(imp)

        total = sum(orig_importance_map.values())
        result = []
        for feat, imp in orig_importance_map.items():
            norm_imp = round(imp / total, 4) if total > 0 else 0.0
            result.append({"feature": feat, "importance": norm_imp})

        result.sort(key=lambda x: x["importance"], reverse=True)
        return result[:10]

    # ------------------------------------------------------------------
    # 5. Tournaments & Evaluation
    # ------------------------------------------------------------------

    def train_model(self, task_type: str = "auto", target_col: str | None = None) -> dict[str, Any]:
        resolved_target, target_candidates = self._resolve_target(target_col)
        resolved_task = self._infer_task_type(task_type, resolved_target)

        df = self.df.dropna(subset=[resolved_target]).copy()
        if len(df) < 10:
            raise ValueError("Dataset contains too few records (minimum 10 rows required).")

        preprocessor, original_feature_cols = self._build_preprocessor(resolved_target)

        X_transformed = preprocessor.fit_transform(df)
        y = df[resolved_target].values

        n_samples = len(df)
        n_splits = 5 if n_samples >= 200 else 3

        leaderboard = []
        champion_model = None
        champion_name = ""
        best_score = -float("inf")
        baseline_score = 0.0
        metrics: dict[str, Any] = {}

        if resolved_task == "regression":
            baseline_model = DummyRegressor(strategy="mean")
            kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)

            b_scores = []
            for train_idx, val_idx in kf.split(X_transformed):
                baseline_model.fit(X_transformed[train_idx], y[train_idx])
                preds = baseline_model.predict(X_transformed[val_idx])
                b_scores.append(r2_score(y[val_idx], preds))
            baseline_score = float(np.mean(b_scores))

            candidates = {
                "DummyRegressor (Baseline)": baseline_model,
                "LinearRegression": LinearRegression(),
                "Ridge": Ridge(alpha=1.0),
                "RandomForestRegressor": RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42),
            }
            if n_samples < 20000:
                candidates["GradientBoostingRegressor"] = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)

            for name, model in candidates.items():
                r2_list, rmse_list = [], []
                for train_idx, val_idx in kf.split(X_transformed):
                    model.fit(X_transformed[train_idx], y[train_idx])
                    preds = model.predict(X_transformed[val_idx])
                    r2_list.append(r2_score(y[val_idx], preds))
                    rmse_list.append(np.sqrt(mean_squared_error(y[val_idx], preds)))

                avg_r2 = float(np.mean(r2_list))
                avg_rmse = float(np.mean(rmse_list))
                leaderboard.append({"model": name, "r2_score": round(avg_r2, 4), "rmse": round(avg_rmse, 4)})

                if name != "DummyRegressor (Baseline)" and avg_r2 > best_score:
                    best_score = avg_r2
                    champion_name = name
                    champion_model = model
                    metrics = {"r2_score": round(avg_r2, 4), "rmse": round(avg_rmse, 4)}

            if champion_model is None:
                champion_name = "Ridge"
                champion_model = candidates["Ridge"]

            champion_model.fit(X_transformed, y)

        elif resolved_task in ("classification", "binary_classification", "multiclass_classification"):
            baseline_model = DummyClassifier(strategy="stratified", random_state=42)
            skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

            b_scores = []
            for train_idx, val_idx in skf.split(X_transformed, y):
                baseline_model.fit(X_transformed[train_idx], y[train_idx])
                preds = baseline_model.predict(X_transformed[val_idx])
                b_scores.append(f1_score(y[val_idx], preds, average="weighted", zero_division=0))
            baseline_score = float(np.mean(b_scores))

            candidates = {
                "DummyClassifier (Baseline)": baseline_model,
                "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
                "RandomForestClassifier": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
                "GaussianNB": GaussianNB(),
            }

            for name, model in candidates.items():
                f1_list, acc_list = [], []
                for train_idx, val_idx in skf.split(X_transformed, y):
                    model.fit(X_transformed[train_idx], y[train_idx])
                    preds = model.predict(X_transformed[val_idx])
                    f1_list.append(f1_score(y[val_idx], preds, average="weighted", zero_division=0))
                    acc_list.append(accuracy_score(y[val_idx], preds))

                avg_f1 = float(np.mean(f1_list))
                avg_acc = float(np.mean(acc_list))
                leaderboard.append({"model": name, "f1_score": round(avg_f1, 4), "accuracy": round(avg_acc, 4)})

                if name != "DummyClassifier (Baseline)" and avg_f1 > best_score:
                    best_score = avg_f1
                    champion_name = name
                    champion_model = model
                    metrics = {"f1_score": round(avg_f1, 4), "accuracy": round(avg_acc, 4)}

            if champion_model is None:
                champion_name = "RandomForestClassifier"
                champion_model = candidates["RandomForestClassifier"]

            champion_model.fit(X_transformed, y)

        elif resolved_task == "forecasting":
            split = int(n_samples * 0.8)
            X_train, X_test = X_transformed[:split], X_transformed[split:]
            y_train, y_test = y[:split], y[split:]

            naive_preds = np.full_like(y_test, y_train[-1] if len(y_train) > 0 else 0)
            baseline_rmse = float(np.sqrt(mean_squared_error(y_test, naive_preds)))
            baseline_score = -baseline_rmse

            model = Ridge(alpha=1.0)
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            r2 = float(r2_score(y_test, preds))
            rmse = float(np.sqrt(mean_squared_error(y_test, preds)))

            champion_name = "Ridge Trend Forecaster"
            champion_model = model
            champion_model.fit(X_transformed, y)

            best_score = r2
            metrics = {"r2_score": round(r2, 4), "rmse": round(rmse, 4)}
            leaderboard = [
                {"model": "Naive Baseline", "rmse": round(baseline_rmse, 4)},
                {"model": champion_name, "r2_score": round(r2, 4), "rmse": round(rmse, 4)}
            ]

        else:
            raise ValueError(f"Unsupported ML task type: {resolved_task}")

        improvement_pct = round(((best_score - baseline_score) / max(abs(baseline_score), 1e-6)) * 100, 2)

        feature_importances = self._collapse_feature_importances(champion_model, preprocessor, original_feature_cols)

        pipeline_obj = {
            "preprocessor": preprocessor,
            "estimator": champion_model,
            "original_features": original_feature_cols,
            "target_col": resolved_target,
            "task_type": resolved_task,
            "champion_model": champion_name,
        }

        ModelRegistry.save_model(
            dataset_id=self.dataset_id,
            task_type=resolved_task,
            pipeline=pipeline_obj,
            metrics=metrics,
            hyperparams={
                "champion_model": champion_name,
                "baseline_score": round(baseline_score, 4),
                "best_score": round(best_score, 4),
                "improvement_pct": improvement_pct,
            },
        )

        return {
            "status": "success",
            "task_type": resolved_task,
            "target_col": resolved_target,
            "champion_model": champion_name,
            "baseline_score": round(baseline_score, 4),
            "best_score": round(best_score, 4),
            "improvement_pct": improvement_pct,
            "improvement_narrative": f"Champion model {champion_name} scored {round(best_score, 4)}, performing {improvement_pct}% better than mandatory baseline.",
            "metrics": metrics,
            "tournament_leaderboard": leaderboard,
            "feature_importances": feature_importances,
            "target_candidates": target_candidates,
            "features_used": len(original_feature_cols),
        }
