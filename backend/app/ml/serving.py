import logging
from typing import Any

import numpy as np
import pandas as pd

from .registry import ModelRegistry

logger = logging.getLogger("snowpulse.ml.serving")

class MLServing:
    """
    Serves inferences from registered machine learning pipelines.
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

    def predict(self, input_records: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Executes prediction on input dictionary records.
        """
        if not self.loaded:
            raise RuntimeError("Model pipeline is offline or not registered.")

        df = pd.DataFrame(input_records)

        preprocessor = self.pipeline["preprocessor"]
        estimator = self.pipeline["estimator"]

        try:
            if self.task_type in ("segmentation", "anomaly"):
                features = self.pipeline["features"]
                # Align and preprocess
                X_scaled = preprocessor.transform_numeric(df, features)
                predictions = estimator.predict(X_scaled).tolist()

                if self.task_type == "segmentation":
                    return {
                        "task_type": self.task_type,
                        "predictions": [{"row_index": idx, "segment_cluster": int(p)} for idx, p in enumerate(predictions)]
                    }
                else: # anomaly
                    # Isolation Forest returns 1 for normal, -1 for anomaly
                    return {
                        "task_type": self.task_type,
                        "predictions": [{"row_index": idx, "is_anomaly": bool(p == -1)} for idx, p in enumerate(predictions)]
                    }

            elif self.task_type in ("revenue_prediction", "churn"):
                features_num = self.pipeline["features_num"]
                features_cat = self.pipeline["features_cat"]

                # Check for missing columns in input records and fill with dummy if needed
                for col in features_num:
                    if col not in df.columns:
                        df[col] = 0.0
                for col in features_cat:
                    if col not in df.columns:
                        df[col] = "unknown"

                X_num = preprocessor.transform_numeric(df, features_num)
                X_cat = preprocessor.transform_categorical(df, features_cat)
                X = np.hstack([X_num, X_cat]) if features_cat else X_num

                if self.task_type == "revenue_prediction":
                    predictions = estimator.predict(X).tolist()
                    return {
                        "task_type": self.task_type,
                        "predictions": [{"row_index": idx, "predicted_revenue": float(p)} for idx, p in enumerate(predictions)]
                    }
                else: # churn
                    predictions = estimator.predict(X).tolist()
                    try:
                        # Random Forest Classifier supports predict_proba
                        proba = estimator.predict_proba(X)[:, 1].tolist()
                    except Exception:
                        proba = [float(p) for p in predictions]

                    return {
                        "task_type": self.task_type,
                        "predictions": [
                            {"row_index": idx, "is_churned": bool(p == 1), "churn_probability": float(pr)}
                            for idx, (p, pr) in enumerate(zip(predictions, proba, strict=False))
                        ]
                    }

        except Exception as e:
            logger.error(f"Inference execution failed: {e}")
            raise RuntimeError(f"Prediction failed: {str(e)}")

        return {"predictions": []}
