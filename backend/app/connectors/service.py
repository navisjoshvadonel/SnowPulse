import io
from typing import Any

import pandas as pd
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.sql import text

class ConnectorConfig(BaseModel):
    connector_type: str  # postgres, mysql, snowflake, bigquery, s3, google_sheets
    connection_string: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    table_name: str | None = None
    bucket_url: str | None = None
    sheet_id: str | None = None
    sync_frequency: str = "daily"  # hourly, daily, weekly, manual


class ConnectorService:
    @classmethod
    def get_sqlalchemy_uri(cls, config: ConnectorConfig) -> str:
        if config.connection_string:
            return config.connection_string
        if config.connector_type == "postgres":
            return f"postgresql://{config.username}:{config.password}@{config.host}:{config.port or 5432}/{config.database}"
        raise ValueError(f"Unsupported connector type: {config.connector_type}")

    @classmethod
    def test_connection(cls, config: ConnectorConfig) -> dict[str, Any]:
        """
        Validates connectivity to external data source and lists tables.
        """
        try:
            uri = cls.get_sqlalchemy_uri(config)
            engine = create_engine(uri, connect_args={"connect_timeout": 5})
            with engine.connect() as conn:
                tables = []
                if config.connector_type == "postgres":
                    result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
                    tables = [row[0] for row in result]
                return {
                    "status": "success",
                    "message": f"Successfully authenticated connector: {config.connector_type.upper()}",
                    "tables_found": tables,
                }
        except Exception as e:
             return {
                "status": "error",
                "message": f"Connection failed: {str(e)}",
            }

    @classmethod
    def sync_table_to_storage(cls, config: ConnectorConfig) -> bytes:
        """
        Connects to the external source, downloads the table as CSV, and returns the bytes.
        """
        if not config.table_name:
            raise ValueError("table_name is required for syncing")
            
        uri = cls.get_sqlalchemy_uri(config)
        engine = create_engine(uri)
        
        # Read the table directly into a pandas DataFrame
        df = pd.read_sql_table(config.table_name, engine)
        
        # Convert to CSV bytes
        csv_buffer = io.BytesIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue()
