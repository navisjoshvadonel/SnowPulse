import io
import logging
import os
from datetime import timedelta
from typing import BinaryIO

import urllib3
from minio import Minio
from minio.commonconfig import ENABLED
from minio.error import S3Error

logger = logging.getLogger("snowpulse.storage")

# Retrieve MinIO credentials from env variables
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() in ("true", "1", "t")

class StorageService:
    """
    Service layer wrapping the MinIO client for secure S3-compliant object storage,
    with local disk fallback when MinIO is unreachable.
    """
    def __init__(self):
        self.local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "local_storage"))
        os.makedirs(self.local_dir, exist_ok=True)
        try:
            # Set a connection timeout of 1.0 second to fail fast if MinIO is offline
            timeout = urllib3.Timeout(connect=1.0, read=2.0)
            retries = urllib3.Retry(total=1, backoff_factor=0.1)
            http_client = urllib3.PoolManager(timeout=timeout, retries=retries)

            self.client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE,
                http_client=http_client
            )
            self.enabled = True
            if os.getenv("ENV") != "testing":
                self.bootstrap_buckets()
        except Exception as e:
            self.client = None
            self.enabled = False
            logger.warning(f"MinIO storage client offline, using local fallback at {self.local_dir}: {e}")

    def bootstrap_buckets(self) -> None:
        """
        Creates all required platform buckets and configures versioning.
        """
        buckets = ["datasets", "reports", "exports", "models", "backups"]
        for bucket in buckets:
            try:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
                    logger.info(f"Created MinIO bucket: '{bucket}'")

                    if bucket in ("datasets", "models"):
                        self.client.set_bucket_versioning(bucket, ENABLED)
                        logger.info(f"Enabled object versioning for bucket: '{bucket}'")
            except Exception as e:
                logger.warning(f"MinIO bucket check failed for '{bucket}': {e}. Using local storage.")
                self.enabled = False
                break

    def upload_file(
        self,
        bucket_name: str,
        object_name: str,
        data: BinaryIO | bytes,
        length: int = -1,
        content_type: str = "application/octet-stream",
        metadata: dict[str, str] | None = None
    ) -> str:
        """
        Uploads an object to MinIO or saves to local storage directory.
        """
        if isinstance(data, bytes):
            data_bytes = data
        else:
            data_bytes = data.read()

        if self.enabled and self.client:
            try:
                data_stream = io.BytesIO(data_bytes)
                custom_metadata = {}
                if metadata:
                    for k, v in metadata.items():
                        custom_metadata[f"x-amz-meta-{k.lower()}"] = str(v)

                self.client.put_object(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    data=data_stream,
                    length=len(data_bytes),
                    content_type=content_type,
                    metadata=custom_metadata
                )
                logger.info(f"Successfully uploaded {object_name} to bucket {bucket_name}")
                return f"minio://{bucket_name}/{object_name}"
            except Exception as e:
                logger.warning(f"MinIO upload error, falling back to disk: {e}")

        # Local storage fallback
        target_dir = os.path.join(self.local_dir, bucket_name)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, object_name)
        with open(file_path, "wb") as f:
            f.write(data_bytes)
        logger.info(f"Successfully saved {object_name} locally to {file_path}")
        return file_path

    def get_file(self, bucket_name: str, object_name: str) -> bytes:
        """
        Retrieves object raw bytes from MinIO or local storage directory.
        """
        if self.enabled and self.client:
            try:
                response = self.client.get_object(bucket_name, object_name)
                try:
                    return response.read()
                finally:
                    response.close()
                    response.release_conn()
            except Exception as e:
                logger.warning(f"MinIO retrieve error, trying local fallback: {e}")

        # Local storage fallback
        file_path = os.path.join(self.local_dir, bucket_name, object_name)
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                return f.read()
        
        # Direct path check
        if os.path.exists(object_name):
            with open(object_name, "rb") as f:
                return f.read()

        raise RuntimeError(f"File not found in MinIO or local storage: {bucket_name}/{object_name}")

    def get_signed_url(self, bucket_name: str, object_name: str, expires_in_seconds: int = 3600) -> str:
        """
        Generates a secure presigned GET URL for sharing objects.
        """
        if not self.enabled or not self.client:
            raise RuntimeError("Storage service is offline.")

        try:
            return self.client.presigned_get_object(
                bucket_name,
                object_name,
                expires=timedelta(seconds=expires_in_seconds)
            )
        except S3Error as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise RuntimeError(f"URL generation failed: {str(e)}")

    def delete_file(self, bucket_name: str, object_name: str) -> None:
        """
        Deletes an object from the specified bucket.
        """
        if not self.enabled or not self.client:
            raise RuntimeError("Storage service is offline.")

        try:
            self.client.remove_object(bucket_name, object_name)
            logger.info(f"Deleted {object_name} from bucket {bucket_name}")
        except S3Error as e:
            logger.error(f"MinIO delete error for {bucket_name}/{object_name}: {e}")
            raise RuntimeError(f"Storage deletion failed: {str(e)}")

# Global storage service instance
storage_service = StorageService()
