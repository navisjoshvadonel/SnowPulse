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
    Service layer wrapping the MinIO client for secure S3-compliant object storage.
    """
    def __init__(self):
        try:
            # Set a connection timeout of 2 seconds to fail fast if MinIO is offline
            timeout = urllib3.Timeout(connect=2.0, read=5.0)
            retries = urllib3.Retry(total=2, backoff_factor=0.2)
            http_client = urllib3.PoolManager(timeout=timeout, retries=retries)

            self.client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE,
                http_client=http_client
            )
            self.enabled = True
            logger.info(f"MinIO storage client connected to endpoint: {MINIO_ENDPOINT}")
            if os.getenv("ENV") != "testing":
                self.bootstrap_buckets()
        except Exception as e:
            self.client = None
            self.enabled = False
            logger.error(f"Failed to initialize MinIO storage client: {e}")

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

                    # Enable versioning on datasets and models
                    if bucket in ("datasets", "models"):
                        self.client.set_bucket_versioning(bucket, ENABLED)
                        logger.info(f"Enabled object versioning for bucket: '{bucket}'")
            except S3Error as e:
                logger.error(f"Error bootstrapping bucket '{bucket}': {e}")

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
        Uploads an object to the specified bucket and returns its path key.
        """
        if not self.enabled or not self.client:
            raise RuntimeError("Storage service is offline.")

        if isinstance(data, bytes):
            data_stream = io.BytesIO(data)
            length = len(data)
        else:
            data_stream = data

        try:
            # Add prefix/custom headers to metadata
            custom_metadata = {}
            if metadata:
                for k, v in metadata.items():
                    custom_metadata[f"x-amz-meta-{k.lower()}"] = str(v)

            self.client.put_object(
                bucket_name=bucket_name,
                object_name=object_name,
                data=data_stream,
                length=length if length >= 0 else -1,
                part_size=10 * 1024 * 1024 if length < 0 else 0, # 10MB parts for streams
                content_type=content_type,
                metadata=custom_metadata
            )
            logger.info(f"Successfully uploaded {object_name} to bucket {bucket_name}")
            return f"minio://{bucket_name}/{object_name}"
        except S3Error as e:
            logger.error(f"MinIO upload error for {object_name}: {e}")
            raise RuntimeError(f"Storage upload failed: {str(e)}")

    def get_file(self, bucket_name: str, object_name: str) -> bytes:
        """
        Retrieves object raw bytes from S3.
        """
        if not self.enabled or not self.client:
            raise RuntimeError("Storage service is offline.")

        try:
            response = self.client.get_object(bucket_name, object_name)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except S3Error as e:
            logger.error(f"MinIO retrieve error for {bucket_name}/{object_name}: {e}")
            raise RuntimeError(f"Storage download failed: {str(e)}")

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
