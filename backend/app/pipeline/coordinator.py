import time
import logging
import io
import polars as pl
from typing import Any, Dict
from sqlalchemy.orm import Session

from ..jobs.manager import JobManager
from ..storage.service import storage_service
from ..search.service import search_service
from ..validation.quality.quality_scorer import DataQualityScorer
from ..forecasting.trainer import ForecastingTrainer
from ..ml.trainer import MLTrainer
from ..insights.automation import InsightAutomationEngine
from ..models import Dataset
from ..cache.cache_service import cache_service

logger = logging.getLogger("snowpulse.pipeline.coordinator")

class PipelineCoordinator:
    """
    Orchestrates the entire analytics ingestion and processing pipeline.
    Ensures observability, progressive status tracking, and step recovery.
    """
    def __init__(self, db: Session, dataset_id: int, file_key: str, original_filename: str, job_id: str):
        self.db = db
        self.dataset_id = dataset_id
        self.file_key = file_key
        self.original_filename = original_filename
        self.job_id = job_id
        self.start_time = time.time()

    async def execute_pipeline(self) -> Dict[str, Any]:
        """
        Runs the stages of the pipeline sequentially, reporting progress to Redis.
        """
        logger.info(f"Pipeline coordinator starting for dataset {self.dataset_id}, file key: {self.file_key}")
        stages_completed = {}
        
        try:
            # Stage 1: File Retrieval from MinIO
            JobManager.update_progress(self.job_id, 10, "Stage 1: Downloading source file from MinIO Storage...")
            t_start = time.time()
            file_bytes = storage_service.get_file(bucket_name="datasets", object_name=self.file_key)
            stages_completed["file_retrieval_ms"] = int((time.time() - t_start) * 1000)

            # Stage 2: Pandera Schema and Type Validation
            JobManager.update_progress(self.job_id, 25, "Stage 2: Initiating Pandera validation schemas...")
            t_start = time.time()
            is_valid, validation_out = DataQualityScorer.validate_and_score(file_bytes, self.original_filename)
            stages_completed["validation"] = {
                "schema_type": validation_out.get("schema_type"),
                "quality_score": validation_out.get("quality_score"),
                "total_records": validation_out.get("total_records"),
                "anomalies_count": len(validation_out.get("anomalies", [])),
                "duration_ms": int((time.time() - t_start) * 1000)
            }
            
            # Even if schema validation failed (is_valid = False), we proceed with a quality rating warning,
            # but raise error if parsing failed completely.
            if "error" in validation_out and validation_out["quality_score"] == 0:
                raise ValueError(f"Spreadsheet parsing failed: {validation_out['error']}")

            # Stage 3: Polars Cleaning & Ingestion into DB
            JobManager.update_progress(self.job_id, 40, "Stage 3: Running Polars data aggregation...")
            t_start = time.time()
            
            # Load into Polars DataFrame for fast analytics processing
            df_polars = pl.read_csv(io.BytesIO(file_bytes), ignore_errors=True)
            row_count = df_polars.height
            stages_completed["polars_processing"] = {
                "rows_processed": row_count,
                "duration_ms": int((time.time() - t_start) * 1000)
            }

            # Update Dataset description with quality rating details
            dataset = self.db.query(Dataset).filter(Dataset.id == self.dataset_id).first()
            if dataset:
                dataset.description = (
                    f"Uploaded dataset. Status: {'Validated' if is_valid else 'Warning - Validation Flags'}. "
                    f"Rows: {row_count}. Quality rating: {validation_out.get('quality_score')}%."
                )
                self.db.commit()

            # Stage 4: Indexing in Meilisearch
            JobManager.update_progress(self.job_id, 55, "Stage 4: Syncing search index documents...")
            t_start = time.time()
            if dataset:
                search_service.index_document(
                    resource_type="dataset",
                    document={
                        "id": dataset.id,
                        "name": dataset.name,
                        "description": dataset.description,
                        "content": f"File columns: {', '.join(df_polars.columns)}",
                        "created_at": dataset.created_at.isoformat() if dataset.created_at else None
                    }
                )
            stages_completed["search_indexing_ms"] = int((time.time() - t_start) * 1000)

            # Stage 5: Statsmodels Forecasting Engine Training
            JobManager.update_progress(self.job_id, 70, "Stage 5: Executing time series forecasting models...")
            t_start = time.time()
            
            # Try parsing a target metric for forecasting
            numeric_cols = [c for c in df_polars.columns if df_polars[c].dtype in (pl.Int64, pl.Float64)]
            target_metric = None
            for c in numeric_cols:
                if any(x in c.lower() for x in ["revenue", "sales", "price", "amount"]):
                    target_metric = c
                    break
            if not target_metric and numeric_cols:
                target_metric = numeric_cols[0]

            if target_metric and row_count >= 10:
                try:
                    trainer = ForecastingTrainer(db=self.db, dataset_id=self.dataset_id)
                    forecast_metrics = trainer.train_and_evaluate(target_col=target_metric)
                    stages_completed["forecasting"] = forecast_metrics
                except Exception as fe:
                    logger.warning(f"Forecasting step failed (skipped): {fe}")
                    stages_completed["forecasting"] = {"status": "skipped", "reason": str(fe)}
            else:
                stages_completed["forecasting"] = {"status": "skipped", "reason": "Insufficient numeric data"}

            # Stage 6: Scikit-Learn ML Pipelines Training
            JobManager.update_progress(self.job_id, 80, "Stage 6: Fitting ML classification & clustering pipelines...")
            t_start = time.time()
            if row_count >= 10:
                try:
                    ml_trainer = MLTrainer(db=self.db, dataset_id=self.dataset_id)
                    # Train segmentation (clustering) and anomaly models as standard platform steps
                    seg_metrics = ml_trainer.train_model(task_type="segmentation")
                    anom_metrics = ml_trainer.train_model(task_type="anomaly")
                    
                    stages_completed["machine_learning"] = {
                        "segmentation": seg_metrics,
                        "anomaly": anom_metrics
                    }
                except Exception as mle:
                    logger.warning(f"ML pipelines step failed (skipped): {mle}")
                    stages_completed["machine_learning"] = {"status": "failed", "reason": str(mle)}
            else:
                stages_completed["machine_learning"] = {"status": "skipped", "reason": "Insufficient numeric data"}

            # Stage 7: Automated Scored Insights Scanners
            JobManager.update_progress(self.job_id, 90, "Stage 7: Triggering AI recommendation scorer...")
            t_start = time.time()
            try:
                insights_engine = InsightAutomationEngine(db=self.db, dataset_id=self.dataset_id)
                insights = insights_engine.run_detection()
                stages_completed["insights"] = {"count": len(insights)}
            except Exception as ie:
                logger.warning(f"Insight generator failed (skipped): {ie}")
                stages_completed["insights"] = {"status": "failed", "reason": str(ie)}

            # Stage 8: Cache Invalidation
            JobManager.update_progress(self.job_id, 95, "Stage 8: Purging stale dashboard caches...")
            if cache_service.enabled:
                # Invalidate keys relating to this dataset
                cache_service.invalidate(f"kpis:{self.dataset_id}")
                cache_service.invalidate(f"trends:{self.dataset_id}")
                cache_service.invalidate(f"geo:{self.dataset_id}")
                cache_service.invalidate(f"anomalies:{self.dataset_id}")
                cache_service.invalidate(f"correlations:{self.dataset_id}")
                cache_service.invalidate(f"insights:{self.dataset_id}")
                
            stages_completed["duration_total_ms"] = int((time.time() - self.start_time) * 1000)
            
            logger.info(f"Pipeline executed successfully in {stages_completed['duration_total_ms']}ms.")
            return {
                "status": "success",
                "dataset_id": self.dataset_id,
                "stages": stages_completed
            }
            
        except Exception as e:
            logger.error(f"Pipeline execution halted on error: {str(e)}")
            raise e
