import logging
from typing import Any

import numpy as np
import pandas as pd

from .registry import ModelRegistry

logger = logging.getLogger("snowpulse.ml.serving")


class MLServing:
    """
    Serves inferences from registered machine learning pipelines across any task type.
    """
    def __init__(self, dataset_id: int, task_type: str):
        self.dataset_id = dataset_id
        self.task_type = task_type
        try:
            self.pipeline = ModelRegistry.load_model(dataset_id, task_type)
            self.loaded = True
        except Exception as e:
            logger.error(f"Inference serving failed to initialize for dataset {dataset_id} task {task_type}: {e}")
            self.loaded = False

    def _format_predictions(self, X: np.ndarray, estimator: Any) -> dict[str, Any]:
        task = self.task_type
        if task in ("segmentation",):
            predictions = estimator.predict(X).tolist()
            return {
                "task_type": task,
                "predictions": [{"row_index": idx, "segment_cluster": int(p)} for idx, p in enumerate(predictions)],
            }
        elif task in ("anomaly",):
            predictions = estimator.predict(X).tolist()
            return {
                "task_type": task,
                "predictions": [{"row_index": idx, "is_anomaly": bool(p == -1)} for idx, p in enumerate(predictions)],
            }
        elif task in ("regression", "revenue_prediction"):
            predictions = estimator.predict(X).tolist()
            target_name = self.pipeline.get("target_col", "prediction")
            return {
                "task_type": task,
                "target_column": target_name,
                "predictions": [{"row_index": idx, "predicted_value": float(p)} for idx, p in enumerate(predictions)],
            }
        elif task in ("classification", "churn"):
            predictions = estimator.predict(X).tolist()
            probas = []
            if hasattr(estimator, "predict_proba"):
                try:
                    raw_probas = estimator.predict_proba(X)
                    probas = [float(np.max(p)) for p in raw_probas]
                except Exception:
                    probas = [1.0] * len(predictions)
            else:
                probas = [1.0] * len(predictions)

            target_name = self.pipeline.get("target_col", "class")
            return {
                "task_type": task,
                "target_column": target_name,
                "predictions": [
                    {"row_index": idx, "predicted_class": str(p), "confidence": float(pr)}
                    for idx, (p, pr) in enumerate(zip(predictions, probas, strict=False))
                ],
            }
        return {"predictions": []}

    def predict(self, input_records: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Executes prediction on input dictionary records.
        """
        if not self.loaded:
            raise RuntimeError(f"Model pipeline for task '{self.task_type}' on dataset {self.dataset_id} is offline or not registered.")

        df = pd.DataFrame(input_records)
        preprocessor = self.pipeline["preprocessor"]
        estimator = self.pipeline["estimator"]

        features_num = self.pipeline.get("features_num", self.pipeline.get("features", []))
        features_cat = self.pipeline.get("features_cat", [])
        features_date = self.pipeline.get("features_date", [])
        features_text = self.pipeline.get("features_text", [])

        for col in features_num:
            if col not in df.columns:
                df[col] = 0.0
        for col in features_cat:
            if col not in df.columns:
                df[col] = "unknown"
        for col in features_date:
            if col not in df.columns:
                df[col] = "2025-01-01"
        for col in features_text:
            if col not in df.columns:
                df[col] = ""

        try:
            X_num = preprocessor.transform_numeric(df, features_num)
            X_cat = preprocessor.transform_categorical(df, features_cat)
            X_dt, _ = preprocessor.transform_datetime(df, features_date)
            X_txt, _ = preprocessor.transform_text(df, features_text)

            matrices = [m for m in [X_num, X_cat, X_dt, X_txt] if m.shape[1] > 0]
            if not matrices:
                raise ValueError("No feature data could be extracted from input records.")

            X = np.hstack(matrices)
            return self._format_predictions(X, estimator)

        except Exception as e:
            logger.error(f"Inference execution failed: {e}")
            raise RuntimeError(f"Prediction failed: {str(e)}")

