import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
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
    Fits and evaluates Scikit-Learn models on uploaded datasets.
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
            self.df = pd.read_csv(ds.file_path)

    def _get_column_types(self) -> dict[str, list]:
        """
        Classifies dataset columns into numeric and categorical features.
        """
        numeric_cols = list(self.df.select_dtypes(include=[np.number]).columns)
        categorical_cols = list(self.df.select_dtypes(exclude=[np.number]).columns)

        # Remove date-like columns from categorical list to avoid high-cardinality issues
        date_cols = [c for c in categorical_cols if "date" in c.lower() or "time" in c.lower()]
        categorical_cols = [c for c in categorical_cols if c not in date_cols]

        return {
            "numeric": numeric_cols,
            "categorical": categorical_cols,
            "date": date_cols
        }

    def train_model(self, task_type: str) -> dict[str, Any]:
        """
        Coordinates feature engineering, fitting, evaluation, and saving of ML models.
        """
        cols = self._get_column_types()
        num_cols = cols["numeric"]
        cat_cols = cols["categorical"]

        if not num_cols:
            raise ValueError("Dataset does not contain any numeric columns needed for ML modeling.")

        df = self.df.dropna().copy()
        if len(df) < 10:
            raise ValueError("Dataset contains too few records (minimum 10 rows required for training).")

        metrics = {}
        hyperparams = {}
        pipeline = None

        if task_type == "segmentation":
            # 1. Customer Segmentation using K-Means Clustering
            n_clusters = 3
            hyperparams["n_clusters"] = n_clusters

            # Feature engineering
            preprocessor = FeaturePipeline()
            X_scaled = preprocessor.fit_transform_numeric(df, num_cols)

            # Fit K-Means
            model = KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")
            model.fit(X_scaled)

            # Calculate evaluation metric
            sil = float(silhouette_score(X_scaled, model.labels_)) if len(set(model.labels_)) > 1 else 0.0
            metrics["silhouette_score"] = sil

            # Bundle into a composite pipeline object
            pipeline = {
                "preprocessor": preprocessor,
                "estimator": model,
                "features": num_cols,
                "task_type": task_type
            }

        elif task_type == "anomaly":
            # 2. Anomaly Detection using Isolation Forest
            contamination = 0.05
            hyperparams["contamination"] = contamination

            preprocessor = FeaturePipeline()
            X_scaled = preprocessor.fit_transform_numeric(df, num_cols)

            model = IsolationForest(contamination=contamination, random_state=42)
            model.fit(X_scaled)

            # Eval metric: proportion of anomalies identified
            preds = model.predict(X_scaled)
            anom_count = int((preds == -1).sum())
            metrics["anomaly_ratio"] = float(anom_count / len(df))
            metrics["anomaly_count"] = anom_count

            pipeline = {
                "preprocessor": preprocessor,
                "estimator": model,
                "features": num_cols,
                "task_type": task_type
            }

        elif task_type == "revenue_prediction":
            # 3. Regression: Predict target metric (e.g. Revenue)
            # Find target column
            target_col = None
            for c in num_cols:
                if any(x in c.lower() for x in ["revenue", "sales", "price", "amount"]):
                    target_col = c
                    break
            if not target_col:
                target_col = num_cols[0]

            # Features = numeric columns excluding target
            features_num = [c for c in num_cols if c != target_col]

            preprocessor = FeaturePipeline()
            X_num = preprocessor.fit_transform_numeric(df, features_num)
            X_cat = preprocessor.fit_transform_categorical(df, cat_cols)

            X = np.hstack([X_num, X_cat]) if cat_cols else X_num
            y = df[target_col].values

            # Train test split for evaluation
            split = int(len(X) * 0.8)
            X_train, X_test = X[:split], X[split:]
            y_train, y_test = y[:split], y[split:]

            model = RandomForestRegressor(n_estimators=50, random_state=42)
            model.fit(X_train, y_train)

            preds = model.predict(X_test)
            r2 = float(r2_score(y_test, preds))
            mse = float(mean_squared_error(y_test, preds))

            metrics["r2_score"] = r2
            metrics["mse"] = mse

            # Refit on full
            model.fit(X, y)

            hyperparams["n_estimators"] = 50
            pipeline = {
                "preprocessor": preprocessor,
                "estimator": model,
                "features_num": features_num,
                "features_cat": cat_cols,
                "target_col": target_col,
                "task_type": task_type
            }

        elif task_type == "churn":
            # 4. Classification: Churn Prediction
            # Find target column
            target_col = None
            for c in df.columns:
                if any(x in c.lower() for x in ["churn", "status", "attrition", "active"]):
                    target_col = c
                    break

            # If no churn target is found, synthesize one (revenue below 25th percentile = 1, else 0)
            is_synthetic = False
            if not target_col:
                is_synthetic = True
                rev_col = num_cols[0]
                q25 = df[rev_col].quantile(0.25)
                df["synthetic_churn"] = (df[rev_col] <= q25).astype(int)
                target_col = "synthetic_churn"
                logger.info("No churn target found, generated synthetic label based on low revenue threshold.")

            # Features
            features_num = [c for c in num_cols if c != target_col]
            features_cat = [c for c in cat_cols if c != target_col]

            preprocessor = FeaturePipeline()
            X_num = preprocessor.fit_transform_numeric(df, features_num)
            X_cat = preprocessor.fit_transform_categorical(df, features_cat)

            X = np.hstack([X_num, X_cat]) if features_cat else X_num
            y = df[target_col].values.astype(int)

            # Split
            split = int(len(X) * 0.8)
            X_train, X_test = X[:split], X[split:]
            y_train, y_test = y[:split], y[split:]

            model = RandomForestClassifier(n_estimators=50, random_state=42)
            # Handle edge case if training split contains only 1 class
            if len(set(y_train)) < 2:
                model.fit(X, y)
                preds = model.predict(X)
                acc = float(accuracy_score(y, preds))
                prec = float(precision_score(y, preds, zero_division=0))
                rec = float(recall_score(y, preds, zero_division=0))
            else:
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                acc = float(accuracy_score(y_test, preds))
                prec = float(precision_score(y_test, preds, zero_division=0))
                rec = float(recall_score(y_test, preds, zero_division=0))
                model.fit(X, y)

            metrics["accuracy"] = acc
            metrics["precision"] = prec
            metrics["recall"] = rec
            metrics["is_synthetic"] = int(is_synthetic)

            hyperparams["n_estimators"] = 50
            pipeline = {
                "preprocessor": preprocessor,
                "estimator": model,
                "features_num": features_num,
                "features_cat": features_cat,
                "target_col": target_col,
                "task_type": task_type
            }
        else:
            raise ValueError(f"Unknown ML task type: {task_type}")

        # Save model and update metrics registry
        ModelRegistry.save_model(
            dataset_id=self.dataset_id,
            task_type=task_type,
            pipeline=pipeline,
            metrics=metrics,
            hyperparams=hyperparams
        )

        # Log pipeline execution to Prometheus
        try:
            from ..monitoring import ML_PIPELINE_RUNS
            ML_PIPELINE_RUNS.labels(task_type=task_type, status="success").inc()
        except Exception:
            pass

        return {
            "status": "success",
            "task_type": task_type,
            "metrics": metrics,
            "features_used": len(num_cols) + len(cat_cols)
        }
