import pytest

from backend.app.connectors.service import ConnectorConfig, ConnectorService


def test_get_sqlalchemy_uri_with_connection_string():
    config = ConnectorConfig(connector_type="postgres", connection_string="postgresql://user:pass@localhost:5432/db")
    uri = ConnectorService.get_sqlalchemy_uri(config)
    assert uri == "postgresql://user:pass@localhost:5432/db"

def test_get_sqlalchemy_uri_with_postgres_parts():
    config = ConnectorConfig(
        connector_type="postgres",
        username="user",
        password="password",
        host="localhost",
        port=5432,
        database="db"
    )
    uri = ConnectorService.get_sqlalchemy_uri(config)
    assert uri == "postgresql://user:password@localhost:5432/db"

def test_get_sqlalchemy_uri_with_postgres_no_port():
    config = ConnectorConfig(
        connector_type="postgres",
        username="user",
        password="password",
        host="localhost",
        database="db"
    )
    uri = ConnectorService.get_sqlalchemy_uri(config)
    assert uri == "postgresql://user:password@localhost:5432/db"

def test_get_sqlalchemy_uri_unsupported():
    config = ConnectorConfig(connector_type="mysql")
    with pytest.raises(ValueError, match="Unsupported connector type: mysql"):
        ConnectorService.get_sqlalchemy_uri(config)

def test_test_connection_error():
    config = ConnectorConfig(connector_type="postgres")
    res = ConnectorService.test_connection(config)
    assert res["status"] == "error"
    assert "Connection failed" in res["message"]

def test_sync_table_no_table_name():
    config = ConnectorConfig(connector_type="postgres")
    with pytest.raises(ValueError, match="table_name is required for syncing"):
        ConnectorService.sync_table_to_storage(config)
