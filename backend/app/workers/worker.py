import logging
from typing import Any, Dict
from ..queues.connection import get_redis_settings
from ..tasks.pipeline_tasks import (
    run_forecast_task,
    run_ml_training_task,
    run_insight_generation_task,
    run_search_indexing_task,
    process_pipeline_task
)
from ..logging_config import configure_logging

logger = logging.getLogger("snowpulse.worker")

async def startup(ctx: Dict[str, Any]) -> None:
    """
    Worker startup hook: Setup connections, models init, logging configuration.
    """
    configure_logging()
    logger.info("ARQ Worker starting up. Ready to process background jobs.")

async def shutdown(ctx: Dict[str, Any]) -> None:
    """
    Worker shutdown hook: Gracefully close connections.
    """
    logger.info("ARQ Worker shutting down. Cleaning up connections.")

class WorkerSettings:
    """
    ARQ Worker Settings Configuration.
    """
    # Redis connection settings
    redis_settings = get_redis_settings()
    
    # List of worker functions
    functions = [
        run_forecast_task,
        run_ml_training_task,
        run_insight_generation_task,
        run_search_indexing_task,
        process_pipeline_task
    ]
    
    # Hooks
    on_startup = startup
    on_shutdown = shutdown
    
    # Queue settings
    # We can listen to multiple priority queues
    queue_name = "default"
    
    # Job execution bounds
    job_timeout = 600       # 10 minutes maximum job duration
    keep_result = 86400     # Keep results in Redis for 24 hours
    max_jobs = 10           # Max concurrent jobs to run on one worker
    
    # Retry configurations
    max_tries = 3           # Default try count before job is permanently marked failed
