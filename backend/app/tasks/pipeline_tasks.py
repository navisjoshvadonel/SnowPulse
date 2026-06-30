import asyncio
import logging
import traceback
from typing import Any

from ..jobs.manager import JobManager

logger = logging.getLogger("snowpulse.tasks")

async def run_forecast_task(ctx: dict[str, Any], dataset_id: int, target_col: str, steps: int = 30) -> dict[str, Any]:
    """
    Background job to run Statsmodels forecasting models and persist results.
    """
    job_id = ctx.get("job_id", "local")
    JobManager.update_progress(job_id, 10, "Initializing statsmodels forecasting engine...")
    await asyncio.sleep(0.5) # Simulate workload startup

    try:
        from ..database import SessionLocal
        from ..forecasting.trainer import ForecastingTrainer

        db = SessionLocal()
        try:
            JobManager.update_progress(job_id, 30, "Fitting ARIMA, SARIMA, and ETS models...")
            trainer = ForecastingTrainer(db=db, dataset_id=dataset_id)
            best_model_results = trainer.train_and_evaluate(target_col=target_col, steps=steps)

            JobManager.update_progress(job_id, 80, "Persisting forecasts and models to MinIO storage...")
            # Model details are saved during execution inside trainer

            JobManager.mark_completed(job_id, best_model_results)
            return best_model_results
        finally:
            db.close()

    except Exception as e:
        error_msg = f"Forecasting task failed: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        JobManager.mark_failed(job_id, error_msg)
        raise e

async def run_ml_training_task(ctx: dict[str, Any], dataset_id: int, task_type: str) -> dict[str, Any]:
    """
    Background job to train scikit-learn models (classification, regression, clustering, anomaly).
    """
    job_id = ctx.get("job_id", "local")
    JobManager.update_progress(job_id, 10, f"Initializing Scikit-Learn ML trainer for task: {task_type}...")
    await asyncio.sleep(0.5)

    try:
        from ..database import SessionLocal
        from ..ml.trainer import MLTrainer

        db = SessionLocal()
        try:
            JobManager.update_progress(job_id, 35, "Running feature engineering and fitting models...")
            trainer = MLTrainer(db=db, dataset_id=dataset_id)
            metrics = trainer.train_model(task_type=task_type)

            JobManager.update_progress(job_id, 80, "Saving trained model metadata and weights to MinIO model registry...")
            JobManager.mark_completed(job_id, metrics)
            return metrics
        finally:
            db.close()
    except Exception as e:
        error_msg = f"ML task failed: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        JobManager.mark_failed(job_id, error_msg)
        raise e

async def run_insight_generation_task(ctx: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """
    Background job to scan for anomalies, evaluate forecast deviations, and score actionable recommendations.
    """
    job_id = ctx.get("job_id", "local")
    JobManager.update_progress(job_id, 15, "Scanning dataset for statistical anomalies & behavior shifts...")
    await asyncio.sleep(0.5)

    try:
        from ..database import SessionLocal
        from ..insights.automation import InsightAutomationEngine

        db = SessionLocal()
        try:
            JobManager.update_progress(job_id, 50, "Calculating priority rankings and severity scores...")
            engine = InsightAutomationEngine(db=db, dataset_id=dataset_id)
            insights = engine.run_detection()

            JobManager.update_progress(job_id, 90, "Saving generated insights and caching dashboards...")
            JobManager.mark_completed(job_id, {"insights_generated": len(insights)})
            return {"insights_generated": len(insights)}
        finally:
            db.close()
    except Exception as e:
        error_msg = f"Insight task failed: {str(e)}"
        JobManager.mark_failed(job_id, error_msg)
        raise e

async def run_search_indexing_task(ctx: dict[str, Any], action: str, resource_type: str, data: dict[str, Any]) -> dict[str, Any]:
    """
    Syncs documents to Meilisearch search index.
    """
    job_id = ctx.get("job_id", "local")
    try:
        from ..search.service import search_service
        JobManager.update_progress(job_id, 30, f"Syncing {resource_type} index in Meilisearch...")

        if action == "upsert":
            search_service.index_document(resource_type, data)
        elif action == "delete":
            search_service.delete_document(resource_type, str(data.get("id")))

        JobManager.mark_completed(job_id, {"status": "synced"})
        return {"status": "synced"}
    except Exception as e:
        error_msg = f"Search sync task failed: {str(e)}"
        JobManager.mark_failed(job_id, error_msg)
        raise e

async def process_pipeline_task(ctx: dict[str, Any], dataset_id: int, file_key: str, original_filename: str) -> dict[str, Any]:
    """
    Unified Ingestion & Analytics Pipeline.
    Coordination: Pandera validation -> Polars clean -> Save -> Index -> Forecast -> ML -> Insights.
    """
    job_id = ctx.get("job_id", "local")
    JobManager.update_progress(job_id, 5, "Starting Unified Analytics Pipeline...")

    try:
        from ..database import SessionLocal
        from ..pipeline.coordinator import PipelineCoordinator

        db = SessionLocal()
        try:
            coordinator = PipelineCoordinator(
                db=db,
                dataset_id=dataset_id,
                file_key=file_key,
                original_filename=original_filename,
                job_id=job_id
            )
            result = await coordinator.execute_pipeline()
            JobManager.mark_completed(job_id, result)
            return result
        finally:
            db.close()
    except Exception as e:
        error_msg = f"Pipeline execution failed: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        JobManager.mark_failed(job_id, error_msg)
        raise e
