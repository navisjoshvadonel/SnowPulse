"""
MLTrainer — Universal AutoML trainer.

Column classification is read exclusively from a stored DatasetProfile;
no column-name keyword matching is performed here.
Falls back to inline profiling (with a warning log) when profile_json is NULL.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    IsolationForest,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    silhouette_score,
)

from ..analytics.profiler import DatasetProfile, DatasetProfiler
from ..models import Dataset
from ..storage.service import storage_service
from .features import FeaturePipeline
from .registry import ModelRegistry

logger = logging.getLogger("snowpulse.ml.trainer")


def _read_pandas(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Delegate to the quality scorer reader for file-type detection."""
    from ..validation.quality.quality_scorer import DataQualityScorer
    return DataQualityScorer.read_file_to_pandas(file_bytes, filename)


class MLTrainer:
    """
    Universal AutoML Trainer.

    Column roles are derived from the dataset's stored DatasetProfile.
    No keyword-based column-name matching is performed.
    """

    def __init__(self, db, dataset_id: int):
        self.db = db
        self.dataset_id = dataset_id

        ds: Dataset | None = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            raise ValueError(f"Dataset with ID {dataset_id} not found.")

        # Load raw dataframe
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

        # Load or compute DatasetProfile
        if ds.profile_json:
            self._profile = DatasetProfile.model_validate(ds.profile_json)
        else:
            logger.warning(
                "ml.trainer.fallback_profile dataset_id=%d — "
                "no stored profile; computing inline. "
                "Run /api/datasets/%d/reprofile to persist.",
                dataset_id, dataset_id,
            )
            import polars as pl, io as _io
            if ds.file_path.startswith("minio://"):
                parts = ds.file_path.replace("minio://", "").split("/", 1)
                fb = storage_service.get_file(parts[0], parts[1])
                pl_df = pl.read_csv(_io.BytesIO(fb))
            else:
                pl_df = pl.read_csv(resolved if not ds.file_path.startswith("minio://") else ds.file_path)
            self._profile = DatasetProfiler.profile_full(pl_df)

        # Derive column buckets from profile roles (structural, not name-based)
        self._num_cols: list[str] = [
            c.name for c in self._profile.columns
            if c.dtype_category == "numeric" and c.inferred_role != "identifier"
            and c.name in self.df.columns
        ]
        self._cat_cols: list[str] = [
            c.name for c in self._profile.columns
            if c.dtype_category in ("categorical", "boolean") and c.inferred_role not in ("identifier",)
            and c.name in self.df.columns
        ]
        self._date_cols: list[str] = [
            c.name for c in self._profile.columns
            if c.inferred_role == "temporal" and c.name in self.df.columns
        ]
        self._text_cols: list[str] = [
            c.name for c in self._profile.columns
            if c.inferred_role == "text" and c.name in self.df.columns
        ]
        # Primary target candidate from profile
        self._profile_target: str | None = next(
            (c.name for c in self._profile.columns if c.is_primary_metric), None
        )

    # ------------------------------------------------------------------
    # Target / task resolution
    # ------------------------------------------------------------------

    def _resolve_target(self, requested_target: str | None) -> str | None:
        """
        Validates a user-supplied target, or falls back to the profile's
        primary metric. Never guesses from column names.
        """
        if requested_target and requested_target in self.df.columns:
            return requested_target
        if self._profile_target and self._profile_target in self.df.columns:
            return self._profile_target
        # Final fallback: first target-role column, then first numeric
        for c in self._profile.columns:
            if c.inferred_role == "target" and c.name in self.df.columns:
                return c.name
        return self._num_cols[0] if self._num_cols else None

    def _infer_task_type(self, requested_task: str, target_col: str | None) -> str:
        if requested_task and requested_task != "auto":
            return requested_task

        if not target_col or target_col not in self.df.columns:
            return "segmentation"

        # Use profile cardinality_ratio for classification vs regression decision
        profile_col = next((c for c in self._profile.columns if c.name == target_col), None)
        if profile_col:
            if profile_col.inferred_role == "target":
                # Explicit target label → classification unless float metric
                if profile_col.dtype_category == "numeric" and profile_col.cardinality_ratio > 0.05:
                    return "regression"
                return "classification"
            if profile_col.dtype_category == "categorical" or profile_col.cardinality_ratio < 0.05:
                return "classification"
            if profile_col.dtype_category == "numeric":
                return "regression"

        # Structural fallback (no name keywords)
        series = self.df[target_col].dropna()
        n_unique = series.nunique()
        n_total  = len(series)
        if str(series.dtype) == "object" or n_unique <= 15 or (n_unique / max(n_total, 1)) < 0.05:
            return "classification"
        if np.issubdtype(series.dtype, np.number):
            return "regression"
        return "segmentation"

    # ------------------------------------------------------------------
    # Feature importance
    # ------------------------------------------------------------------

    def _compute_feature_importances(
        self, estimator: Any, feature_names: list[str]
    ) -> list[dict[str, Any]]:
        importances = np.zeros(len(feature_names))

        if hasattr(estimator, "feature_importances_"):
            importances = estimator.feature_importances_
        elif hasattr(estimator, "coef_"):
            coef = estimator.coef_
            importances = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)

        if len(importances) != len(feature_names):
            importances = np.ones(len(feature_names)) / max(1, len(feature_names))
        else:
            total = np.sum(importances)
            if total > 0:
                importances = importances / total

        result = [
            {"feature": name, "importance": round(float(imp), 4)}
            for name, imp in zip(feature_names, importances, strict=False)
        ]
        result.sort(key=lambda x: x["importance"], reverse=True)
        return result[:10]

    # ------------------------------------------------------------------
    # Model tournaments
    # ------------------------------------------------------------------

    def _run_regression_tournament(
        self, X_train, X_test, y_train, y_test, X, y
    ) -> tuple[Any, dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        candidates = {
            "RandomForestRegressor": RandomForestRegressor(n_estimators=50, random_state=42),
            "ExtraTreesRegressor": ExtraTreesRegressor(n_estimators=50, random_state=42),
            "GradientBoostingRegressor": GradientBoostingRegressor(n_estimators=50, random_state=42),
            "HistGradientBoostingRegressor": HistGradientBoostingRegressor(random_state=42),
            "Ridge": Ridge(),
        }
        best_score = -float("inf")
        champion = None
        metrics: dict[str, Any] = {}
        hyperparams: dict[str, Any] = {}
        leaderboard: list[dict[str, Any]] = []

        for name, model in candidates.items():
            try:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                r2   = float(r2_score(y_test, preds))
                mse  = float(mean_squared_error(y_test, preds))
                rmse = float(np.sqrt(mse))
                leaderboard.append({"model": name, "r2_score": round(r2, 4), "rmse": round(rmse, 4)})
                if r2 > best_score:
                    best_score = r2
                    champion   = model
                    metrics    = {"r2_score": round(r2, 4), "rmse": round(rmse, 4), "mse": round(mse, 4)}
                    hyperparams = {"champion_model": name}
            except Exception as e:
                logger.warning("Candidate %s failed: %s", name, e)

        if champion is None:
            champion = candidates["RandomForestRegressor"]
            champion.fit(X_train, y_train)

        champion.fit(X, y)
        return champion, metrics, hyperparams, leaderboard

    def _run_classification_tournament(
        self, X_train, X_test, y_train, y_test, X, y
    ) -> tuple[Any, dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        candidates = {
            "RandomForestClassifier": RandomForestClassifier(n_estimators=50, random_state=42),
            "ExtraTreesClassifier": ExtraTreesClassifier(n_estimators=50, random_state=42),
            "GradientBoostingClassifier": GradientBoostingClassifier(n_estimators=50, random_state=42),
            "HistGradientBoostingClassifier": HistGradientBoostingClassifier(random_state=42),
            "LogisticRegression": LogisticRegression(max_iter=500),
        }
        best_acc = -1.0
        champion = None
        metrics: dict[str, Any] = {}
        hyperparams: dict[str, Any] = {}
        leaderboard: list[dict[str, Any]] = []

        for name, model in candidates.items():
            try:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                acc   = float(accuracy_score(y_test, preds))
                f1    = float(f1_score(y_test, preds, average="weighted", zero_division=0))
                leaderboard.append({"model": name, "accuracy": round(acc, 4), "f1_score": round(f1, 4)})
                if acc > best_acc:
                    best_acc    = acc
                    champion    = model
                    metrics     = {
                        "accuracy":  round(acc, 4),
                        "f1_score":  round(f1, 4),
                        "precision": round(float(precision_score(y_test, preds, average="weighted", zero_division=0)), 4),
                        "recall":    round(float(recall_score(y_test, preds, average="weighted", zero_division=0)), 4),
                    }
                    hyperparams = {"champion_model": name}
            except Exception as e:
                logger.warning("Candidate %s failed: %s", name, e)

        if champion is None:
            champion = candidates["RandomForestClassifier"]
            champion.fit(X_train, y_train)

        champion.fit(X, y)
        return champion, metrics, hyperparams, leaderboard

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def train_model(self, task_type: str = "auto", target_col: str | None = None) -> dict[str, Any]:
        resolved_target = self._resolve_target(target_col)
        resolved_task   = self._infer_task_type(task_type, resolved_target)

        # Normalise alias task names
        _ALIASES = {"revenue_prediction": "regression", "churn": "classification"}
        resolved_task = _ALIASES.get(resolved_task, resolved_task)

        df = self.df.dropna(
            subset=[resolved_target] if resolved_target and resolved_target in self.df.columns else None
        ).copy()
        if len(df) < 10:
            raise ValueError("Dataset contains too few records (minimum 10 rows required).")

        # Build feature column lists (exclude target)
        feature_num  = [c for c in self._num_cols  if c != resolved_target]
        feature_cat  = [c for c in self._cat_cols  if c != resolved_target]
        feature_date = [c for c in self._date_cols if c != resolved_target]
        feature_text = [c for c in self._text_cols if c != resolved_target]

        preprocessor = FeaturePipeline()
        X_num = preprocessor.fit_transform_numeric(df, feature_num)
        X_cat = preprocessor.fit_transform_categorical(df, feature_cat)
        X_dt, dt_names = preprocessor.fit_transform_datetime(df, feature_date)
        X_txt, txt_names = preprocessor.fit_transform_text(df, feature_text)

        feature_matrices = [m for m in [X_num, X_cat, X_dt, X_txt] if m.shape[1] > 0]
        if not feature_matrices:
            raise ValueError("Dataset does not contain sufficient features for training.")

        X = np.hstack(feature_matrices)
        all_feature_names = feature_num + feature_cat + dt_names + txt_names

        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]

        metrics: dict[str, Any] = {}
        hyperparams: dict[str, Any] = {}
        tournament_leaderboard: list[dict[str, Any]] = []
        champion_estimator: Any = None

        if resolved_task == "regression":
            if not resolved_target or resolved_target not in df.columns:
                raise ValueError("Regression task requires a target column.")
            y = df[resolved_target].values
            y_train, y_test = y[:split], y[split:]
            champion_estimator, metrics, hyperparams, tournament_leaderboard = (
                self._run_regression_tournament(X_train, X_test, y_train, y_test, X, y)
            )

        elif resolved_task == "classification":
            if not resolved_target or resolved_target not in df.columns:
                # Build binary class from first metric
                ref_col = feature_num[0] if feature_num else df.columns[0]
                q25 = df[ref_col].quantile(0.25)
                df["_target_class"] = (df[ref_col] <= q25).astype(int)
                resolved_target = "_target_class"
            y = df[resolved_target].astype(str).values
            y_train, y_test = y[:split], y[split:]
            champion_estimator, metrics, hyperparams, tournament_leaderboard = (
                self._run_classification_tournament(X_train, X_test, y_train, y_test, X, y)
            )

        elif resolved_task == "segmentation":
            n_clusters = 3
            model = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
            model.fit(X)
            sil = float(silhouette_score(X, model.labels_)) if len(set(model.labels_)) > 1 else 0.0
            champion_estimator = model
            metrics    = {"silhouette_score": round(sil, 4)}
            hyperparams = {"n_clusters": n_clusters, "champion_model": "KMeans"}
            tournament_leaderboard = [{"model": "KMeans", "silhouette_score": round(sil, 4)}]

        elif resolved_task == "anomaly":
            contamination = 0.05
            model = IsolationForest(contamination=contamination, random_state=42)
            model.fit(X)
            preds = model.predict(X)
            anom_count = int((preds == -1).sum())
            champion_estimator = model
            metrics    = {"anomaly_ratio": round(float(anom_count / len(df)), 4), "anomaly_count": anom_count}
            hyperparams = {"contamination": contamination, "champion_model": "IsolationForest"}
            tournament_leaderboard = [{"model": "IsolationForest", "anomaly_ratio": metrics["anomaly_ratio"]}]

        else:
            raise ValueError(f"Unknown ML task type: {resolved_task}")

        feature_importances = self._compute_feature_importances(champion_estimator, all_feature_names)
        metrics["feature_importances"] = feature_importances

        pipeline = {
            "preprocessor": preprocessor,
            "estimator": champion_estimator,
            "features_num": feature_num,
            "features_cat": feature_cat,
            "features_date": feature_date,
            "features_text": feature_text,
            "all_feature_names": all_feature_names,
            "target_col": resolved_target,
            "task_type": resolved_task,
            "tournament_leaderboard": tournament_leaderboard,
        }

        ModelRegistry.save_model(
            dataset_id=self.dataset_id,
            task_type=resolved_task,
            pipeline=pipeline,
            metrics=metrics,
            hyperparams=hyperparams,
        )

        try:
            from ..monitoring import ML_PIPELINE_RUNS
            ML_PIPELINE_RUNS.labels(task_type=resolved_task, status="success").inc()
        except Exception:
            pass

        return {
            "status": "success",
            "task_type": resolved_task,
            "target_col": resolved_target,
            "champion_model": hyperparams.get("champion_model", "Unknown"),
            "metrics": metrics,
            "tournament_leaderboard": tournament_leaderboard,
            "feature_importances": feature_importances,
            "features_used": len(all_feature_names),
        }
