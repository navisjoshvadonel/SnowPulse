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

from ..models import Dataset
from ..storage.service import storage_service
from .features import FeaturePipeline
from .registry import ModelRegistry

logger = logging.getLogger("snowpulse.ml.trainer")


class MLTrainer:
    """
    Universal AutoML Trainer that ingests any dataset, performs complex feature engineering,
    runs model tournaments across candidate algorithms, computes explainability metrics,
    and registers champion models.
    """
    def __init__(self, db, dataset_id: int):
        self.db = db
        self.dataset_id = dataset_id

        # Retrieve dataset
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            raise ValueError(f"Dataset with ID {dataset_id} not found.")

        if ds.file_path.startswith("minio://"):
            parts = ds.file_path.replace("minio://", "").split("/", 1)
            file_bytes = storage_service.get_file(parts[0], parts[1])
            from ..validation.quality.quality_scorer import DataQualityScorer
            self.df = DataQualityScorer.read_file_to_pandas(file_bytes, parts[1])
        else:
            resolved_path = ds.file_path
            if not os.path.exists(resolved_path):
                backend_path = os.path.join("backend", ds.file_path)
                if os.path.exists(backend_path):
                    resolved_path = backend_path
                else:
                    raise FileNotFoundError(f"Dataset file not found at {ds.file_path}")
            self.df = pd.read_csv(resolved_path)

    def _get_column_types(self) -> dict[str, list[str]]:
        """
        Classifies dataset columns into numeric, categorical, datetime, and text features.
        """
        numeric_cols = list(self.df.select_dtypes(include=[np.number]).columns)
        non_numeric_cols = list(self.df.select_dtypes(exclude=[np.number]).columns)

        date_cols = [c for c in non_numeric_cols if any(k in c.lower() for k in ["date", "time", "dt", "year", "timestamp"])]
        remaining = [c for c in non_numeric_cols if c not in date_cols]

        text_cols = [c for c in remaining if self.df[c].astype(str).str.len().mean() > 50]
        categorical_cols = [c for c in remaining if c not in text_cols]

        return {
            "numeric": numeric_cols,
            "categorical": categorical_cols,
            "date": date_cols,
            "text": text_cols,
        }

    def _infer_target_col(self, target_col: str | None = None) -> str | None:
        """
        Detects or validates target column for supervised tasks.
        """
        if target_col and target_col in self.df.columns:
            return target_col

        keywords = ["revenue", "sales", "price", "amount", "target", "label", "churn", "status", "active", "y", "score"]
        for col in self.df.columns:
            if any(k in col.lower() for k in keywords):
                return col

        num_cols = list(self.df.select_dtypes(include=[np.number]).columns)
        if num_cols:
            return num_cols[0]

        return None

    def _infer_task_type(self, requested_task: str, target_col: str | None) -> str:
        """
        Automatically infers task type if requested_task is 'auto' or unspecified.
        """
        if requested_task and requested_task != "auto":
            return requested_task

        if not target_col or target_col not in self.df.columns:
            return "segmentation"

        series = self.df[target_col].dropna()
        n_unique = series.nunique()
        n_total = len(series)

        if str(series.dtype) == "object" or n_unique <= 15 or (n_unique / n_total) < 0.05:
            return "classification"
        elif np.issubdtype(series.dtype, np.number):
            return "regression"
        else:
            return "segmentation"

    def _compute_feature_importances(self, estimator: Any, feature_names: list[str]) -> list[dict[str, Any]]:
        """
        Extracts and normalizes feature importances for explainability.
        """
        importances = np.zeros(len(feature_names))

        if hasattr(estimator, "feature_importances_"):
            importances = estimator.feature_importances_
        elif hasattr(estimator, "coef_"):
            coef = estimator.coef_
            if coef.ndim > 1:
                importances = np.mean(np.abs(coef), axis=0)
            else:
                importances = np.abs(coef)

        if len(importances) != len(feature_names):
            # Fallback uniform if dimension mismatch
            importances = np.ones(len(feature_names)) / max(1, len(feature_names))
        else:
            total = np.sum(importances)
            if total > 0:
                importances = importances / total

        importance_list = [
            {"feature": name, "importance": round(float(imp), 4)}
            for name, imp in zip(feature_names, importances, strict=False)
        ]
        importance_list.sort(key=lambda x: x["importance"], reverse=True)
        return importance_list[:10]  # Top 10 features

    def _run_regression_tournament(
        self,
        X_train: np.ndarray,
        X_test: np.ndarray,
        y_train: np.ndarray,
        y_test: np.ndarray,
        X: np.ndarray,
        y: np.ndarray
    ) -> tuple[Any, dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        candidates = {
            "RandomForestRegressor": RandomForestRegressor(n_estimators=50, random_state=42),
            "ExtraTreesRegressor": ExtraTreesRegressor(n_estimators=50, random_state=42),
            "GradientBoostingRegressor": GradientBoostingRegressor(n_estimators=50, random_state=42),
            "HistGradientBoostingRegressor": HistGradientBoostingRegressor(random_state=42),
            "Ridge": Ridge(),
        }
        best_score = -float("inf")
        champion_estimator = None
        metrics: dict[str, Any] = {}
        hyperparams: dict[str, Any] = {}
        leaderboard: list[dict[str, Any]] = []

        for name, model in candidates.items():
            try:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                r2 = float(r2_score(y_test, preds))
                mse = float(mean_squared_error(y_test, preds))
                rmse = float(np.sqrt(mse))

                leaderboard.append({"model": name, "r2_score": round(r2, 4), "rmse": round(rmse, 4)})

                if r2 > best_score:
                    best_score = r2
                    champion_estimator = model
                    metrics["r2_score"] = round(r2, 4)
                    metrics["rmse"] = round(rmse, 4)
                    metrics["mse"] = round(mse, 4)
                    hyperparams["champion_model"] = name
            except Exception as e:
                logger.warning(f"Candidate {name} failed: {e}")

        if champion_estimator is None:
            champion_estimator = candidates["RandomForestRegressor"]
            champion_estimator.fit(X_train, y_train)

        champion_estimator.fit(X, y)
        return champion_estimator, metrics, hyperparams, leaderboard

    def _run_classification_tournament(
        self,
        X_train: np.ndarray,
        X_test: np.ndarray,
        y_train: np.ndarray,
        y_test: np.ndarray,
        X: np.ndarray,
        y: np.ndarray
    ) -> tuple[Any, dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        candidates = {
            "RandomForestClassifier": RandomForestClassifier(n_estimators=50, random_state=42),
            "ExtraTreesClassifier": ExtraTreesClassifier(n_estimators=50, random_state=42),
            "GradientBoostingClassifier": GradientBoostingClassifier(n_estimators=50, random_state=42),
            "HistGradientBoostingClassifier": HistGradientBoostingClassifier(random_state=42),
            "LogisticRegression": LogisticRegression(max_iter=500),
        }
        best_acc = -1.0
        champion_estimator = None
        metrics: dict[str, Any] = {}
        hyperparams: dict[str, Any] = {}
        leaderboard: list[dict[str, Any]] = []

        for name, model in candidates.items():
            try:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                acc = float(accuracy_score(y_test, preds))
                f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))

                leaderboard.append({"model": name, "accuracy": round(acc, 4), "f1_score": round(f1, 4)})

                if acc > best_acc:
                    best_acc = acc
                    champion_estimator = model
                    metrics["accuracy"] = round(acc, 4)
                    metrics["f1_score"] = round(f1, 4)
                    metrics["precision"] = round(float(precision_score(y_test, preds, average="weighted", zero_division=0)), 4)
                    metrics["recall"] = round(float(recall_score(y_test, preds, average="weighted", zero_division=0)), 4)
                    hyperparams["champion_model"] = name
            except Exception as e:
                logger.warning(f"Candidate {name} failed: {e}")

        if champion_estimator is None:
            champion_estimator = candidates["RandomForestClassifier"]
            champion_estimator.fit(X_train, y_train)

        champion_estimator.fit(X, y)
        return champion_estimator, metrics, hyperparams, leaderboard

    def train_model(self, task_type: str = "auto", target_col: str | None = None) -> dict[str, Any]:
        """
        Coordinates feature engineering, multi-model AutoML tournament, evaluation, feature importances, and model registration.
        """
        resolved_target = self._infer_target_col(target_col)
        resolved_task = self._infer_task_type(task_type, resolved_target)

        if resolved_task == "revenue_prediction":
            resolved_task = "regression"
        elif resolved_task == "churn":
            resolved_task = "classification"

        cols = self._get_column_types()
        num_cols = cols["numeric"]
        cat_cols = cols["categorical"]
        date_cols = cols["date"]
        text_cols = cols["text"]

        df = self.df.dropna(subset=[resolved_target] if resolved_target and resolved_target in self.df.columns else None).copy()
        if len(df) < 10:
            raise ValueError("Dataset contains too few records (minimum 10 rows required for training).")

        preprocessor = FeaturePipeline()
        metrics: dict[str, Any] = {}
        hyperparams: dict[str, Any] = {}
        tournament_leaderboard: list[dict[str, Any]] = []

        feature_num_cols = [c for c in num_cols if c != resolved_target]
        feature_cat_cols = [c for c in cat_cols if c != resolved_target]
        feature_date_cols = [c for c in date_cols if c != resolved_target]
        feature_text_cols = [c for c in text_cols if c != resolved_target]

        X_num = preprocessor.fit_transform_numeric(df, feature_num_cols)
        X_cat = preprocessor.fit_transform_categorical(df, feature_cat_cols)
        X_dt, dt_feature_names = preprocessor.fit_transform_datetime(df, feature_date_cols)
        X_txt, txt_feature_names = preprocessor.fit_transform_text(df, feature_text_cols)

        feature_matrices = [m for m in [X_num, X_cat, X_dt, X_txt] if m.shape[1] > 0]
        if not feature_matrices:
            raise ValueError("Dataset does not contain sufficient numeric, categorical, or temporal features.")

        X = np.hstack(feature_matrices)
        all_feature_names = feature_num_cols + feature_cat_cols + dt_feature_names + txt_feature_names

        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]

        champion_estimator = None

        if resolved_task == "regression":
            if not resolved_target or resolved_target not in df.columns:
                raise ValueError("Regression task requires a target column.")

            y = df[resolved_target].values
            y_train, y_test = y[:split], y[split:]
            champion_estimator, metrics, hyperparams, tournament_leaderboard = self._run_regression_tournament(
                X_train, X_test, y_train, y_test, X, y
            )

        elif resolved_task == "classification":
            if not resolved_target or resolved_target not in df.columns:
                rev_col = num_cols[0] if num_cols else df.columns[0]
                q25 = df[rev_col].quantile(0.25)
                df["target_class"] = (df[rev_col] <= q25).astype(int)
                resolved_target = "target_class"

            y = df[resolved_target].astype(str).values
            y_train, y_test = y[:split], y[split:]
            champion_estimator, metrics, hyperparams, tournament_leaderboard = self._run_classification_tournament(
                X_train, X_test, y_train, y_test, X, y
            )

        elif resolved_task == "segmentation":
            n_clusters = 3
            model = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
            model.fit(X)
            sil = float(silhouette_score(X, model.labels_)) if len(set(model.labels_)) > 1 else 0.0

            champion_estimator = model
            metrics["silhouette_score"] = round(sil, 4)
            hyperparams["n_clusters"] = n_clusters
            hyperparams["champion_model"] = "KMeans"
            tournament_leaderboard.append({"model": "KMeans", "silhouette_score": round(sil, 4)})

        elif resolved_task == "anomaly":
            contamination = 0.05
            model = IsolationForest(contamination=contamination, random_state=42)
            model.fit(X)
            preds = model.predict(X)
            anom_count = int((preds == -1).sum())

            champion_estimator = model
            metrics["anomaly_ratio"] = round(float(anom_count / len(df)), 4)
            metrics["anomaly_count"] = anom_count
            hyperparams["contamination"] = contamination
            hyperparams["champion_model"] = "IsolationForest"
            tournament_leaderboard.append({"model": "IsolationForest", "anomaly_ratio": round(float(anom_count / len(df)), 4)})

        else:
            raise ValueError(f"Unknown ML task type: {resolved_task}")

        # Compute explainability feature importances
        feature_importances = self._compute_feature_importances(champion_estimator, all_feature_names)
        metrics["feature_importances"] = feature_importances

        pipeline = {
            "preprocessor": preprocessor,
            "estimator": champion_estimator,
            "features_num": feature_num_cols,
            "features_cat": feature_cat_cols,
            "features_date": feature_date_cols,
            "features_text": feature_text_cols,
            "all_feature_names": all_feature_names,
            "target_col": resolved_target,
            "task_type": resolved_task,
            "tournament_leaderboard": tournament_leaderboard,
        }

        # Save model and update registry
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

