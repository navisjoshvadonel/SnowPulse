import json
import logging
import uuid
from typing import Any, Dict, Optional, List
from arq.connections import ArqRedis
from arq.jobs import Job
from ..queues.connection import get_redis_pool
from ..cache.cache_service import cache_service

logger = logging.getLogger("snowpulse.jobs")

class JobManager:
    """
    Manages background jobs via ARQ and custom progress/metadata tracking in Redis.
    """
    
    @staticmethod
    def _get_job_key(job_id: str) -> str:
        return f"snowpulse:job_tracker:{job_id}"

    @classmethod
    async def create_job_tracker(cls, job_id: str, task_name: str, queue_name: str) -> None:
        """
        Initializes job tracking information in Redis.
        """
        if not cache_service.enabled or not cache_service.client:
            return
        
        tracker_data = {
            "job_id": job_id,
            "task_name": task_name,
            "queue_name": queue_name,
            "status": "queued",
            "progress": 0,
            "message": "Job queued and waiting for worker.",
            "error": "",
            "result": ""
        }
        cache_service.client.hset(cls._get_job_key(job_id), mapping=tracker_data)
        # Expire tracking data after 24 hours
        cache_service.client.expire(cls._get_job_key(job_id), 86400)

    @classmethod
    def update_progress(cls, job_id: str, progress: int, message: str, status: str = "running") -> None:
        """
        Updates progress percentage and status message of a running job.
        Can be called from inside asynchronous tasks.
        """
        if not cache_service.enabled or not cache_service.client:
            return
        
        logger.info(f"Job {job_id} progress: {progress}% - {message}")
        key = cls._get_job_key(job_id)
        if cache_service.client.exists(key):
            cache_service.client.hset(key, mapping={
                "progress": progress,
                "message": message,
                "status": status
            })

    @classmethod
    def mark_completed(cls, job_id: str, result: Any = None) -> None:
        """
        Marks a job as successfully completed and stores the result.
        """
        if not cache_service.enabled or not cache_service.client:
            return
        
        logger.info(f"Job {job_id} completed.")
        serialized_result = json.dumps(result) if result is not None else ""
        cache_service.client.hset(cls._get_job_key(job_id), mapping={
            "progress": 100,
            "message": "Job completed successfully.",
            "status": "completed",
            "result": serialized_result
        })

    @classmethod
    def mark_failed(cls, job_id: str, error: str) -> None:
        """
        Marks a job as failed, records the error, and logs to the dead-letter archive.
        """
        if not cache_service.enabled or not cache_service.client:
            return
        
        logger.error(f"Job {job_id} failed: {error}")
        key = cls._get_job_key(job_id)
        cache_service.client.hset(key, mapping={
            "status": "failed",
            "message": "Job failed.",
            "error": error
        })
        
        # Log to Dead Letter Queue (DLQ) list
        try:
            dlq_item = {
                "job_id": job_id,
                "error": error,
                "timestamp": cache_service.client.time()[0] if cache_service.client else 0
            }
            cache_service.client.lpush("snowpulse:dlq", json.dumps(dlq_item))
        except Exception as e:
            logger.error(f"Failed to record DLQ item: {e}")

    @classmethod
    async def submit_job(cls, task_name: str, *args, queue: str = "default", **kwargs) -> str:
        """
        Enqueues an async task via ARQ.
        """
        job_id = str(uuid.uuid4())
        await cls.create_job_tracker(job_id, task_name, queue)
        
        arq_redis: ArqRedis = await get_redis_pool()
        try:
            # Enqueue task. Pass job_id as standard keyword argument so the task can use it to report progress
            await arq_redis.enqueue_job(task_name, *args, _job_id=job_id, _queue_name=queue, **kwargs)
            logger.info(f"Enqueued job {job_id} on queue {queue}")
        except Exception as e:
            logger.error(f"Failed to enqueue job {job_id}: {e}")
            cls.mark_failed(job_id, f"Enqueue error: {str(e)}")
        finally:
            await arq_redis.close()
            
        return job_id

    @classmethod
    def get_job_status(cls, job_id: str) -> Dict[str, Any]:
        """
        Returns full tracking details for a job.
        """
        if not cache_service.enabled or not cache_service.client:
            return {"job_id": job_id, "status": "unknown", "message": "Caching service offline"}
        
        key = cls._get_job_key(job_id)
        data = cache_service.client.hgetall(key)
        if not data:
            return {"job_id": job_id, "status": "not_found", "message": "No tracking record exists."}
        
        # Parse result if exists
        res = data.get("result", "")
        if res:
            try:
                data["result"] = json.loads(res)
            except Exception:
                pass
                
        # Parse progress to int
        if "progress" in data:
            data["progress"] = int(data["progress"])
            
        return data

    @classmethod
    def get_all_jobs_status(cls) -> List[Dict[str, Any]]:
        """
        Retrieve statuses of all tracked jobs.
        """
        if not cache_service.enabled or not cache_service.client:
            return []
        
        keys = cache_service.client.keys("snowpulse:job_tracker:*")
        jobs = []
        for key in keys:
            data = cache_service.client.hgetall(key)
            if data:
                res = data.get("result", "")
                if res:
                    try:
                        data["result"] = json.loads(res)
                    except Exception:
                        pass
                if "progress" in data:
                    data["progress"] = int(data["progress"])
                jobs.append(data)
        return jobs
