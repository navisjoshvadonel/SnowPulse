import io
import json
import logging
from typing import Any

import joblib

from ..cache.cache_service import cache_service
from ..storage.service import storage_service

logger = logging.getLogger("snowpulse.ml.registry")

class ModelRegistry:
    """
    Registry management to archive trained Scikit-Learn pipelines in MinIO,
    version models, and preserve experiment metadata in Redis.
    """

    @staticmethod
    def _get_history_key(dataset_id: int, task_type: str) -> str:
        return f"snowpulse:ml_history:{dataset_id}:{task_type}"

    _local_models: dict[str, bytes] = {}

    @classmethod
    def save_model(
        cls,
        dataset_id: int,
        task_type: str,
        pipeline: Any,
        metrics: dict[str, float],
        hyperparams: dict[str, Any]
    ) -> str:
        """
        Saves the complete model pipeline (preprocessors + estimator) to MinIO or local fallback,
        and logs the metrics/hyperparameters into the registry history.
        """
        object_name = f"ml_{dataset_id}_{task_type}.joblib"

        # Serialize model pipeline
        buffer = io.BytesIO()
        joblib.dump(pipeline, buffer)
        data_bytes = buffer.getvalue()

        # Cache locally in memory
        cls._local_models[object_name] = data_bytes

        storage_uri = f"minio://models/{object_name}"
        try:
            storage_uri = storage_service.upload_file(
                bucket_name="models",
                object_name=object_name,
                data=data_bytes,
                content_type="application/octet-stream"
            )
        except Exception as se:
            logger.warning(f"MinIO storage connection failed, using local model cache for {object_name}: {se}")

        # Increment version and update history in Redis
        version = 1
        history = []

        if cache_service.enabled and cache_service.client:
            try:
                history_key = cls._get_history_key(dataset_id, task_type)
                existing_history_json = cache_service.client.get(history_key)
                if existing_history_json:
                    try:
                        history = json.loads(existing_history_json)
                        version = len(history) + 1
                    except Exception:
                        history = []

                run_metadata = {
                    "version": version,
                    "metrics": metrics,
                    "hyperparams": hyperparams,
                    "uri": storage_uri,
                    "timestamp": cache_service.client.time()[0] if cache_service.client else 0
                }
                history.append(run_metadata)
                cache_service.client.set(history_key, json.dumps(history))

                # Update Prometheus accuracy gauge
                if metrics:
                    from ..monitoring import ML_MODEL_ACCURACY
                    primary_metric = next(iter(metrics))
                    ML_MODEL_ACCURACY.labels(
                        task_type=task_type,
                        metric_name=primary_metric
                    ).set(float(metrics.get(primary_metric, 0.0)))
            except Exception as ce:
                logger.warning(f"Cache service history update skipped: {ce}")

        logger.info(f"Registered model v{version} for dataset {dataset_id} task {task_type}")
        return storage_uri

    @classmethod
    def load_model(cls, dataset_id: int, task_type: str) -> Any:
        """
        Loads the latest version of the model pipeline from MinIO or local memory cache.
        """
        object_name = f"ml_{dataset_id}_{task_type}.joblib"
        try:
            model_bytes = storage_service.get_file("models", object_name)
            return joblib.load(io.BytesIO(model_bytes))
        except Exception as e:
            if object_name in cls._local_models:
                logger.info(f"Loaded model {object_name} from local memory cache fallback.")
                return joblib.load(io.BytesIO(cls._local_models[object_name]))
            logger.error(f"Failed to retrieve model {object_name} from registry: {e}")
            raise RuntimeError(f"Model not found in registry: {object_name}")

    @classmethod
    def get_training_history(cls, dataset_id: int, task_type: str) -> list:
        """
        Returns the experiment logs for a specific model configuration.
        """
        if cache_service.enabled and cache_service.client:
            history_key = cls._get_history_key(dataset_id, task_type)
            val = cache_service.client.get(history_key)
            if val:
                return json.loads(val)
        return []
