from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.ai.evaluation.evaluator import AIEvaluator
from app.ai.gateway.client import OllamaClient
from app.ai.memory.vector_store import SemanticMemory, VectorStore
from app.ai.tools.database_tools import DatabaseTools, SecurityAlertException, sanitize_and_validate_sql
from app.ai.workflows.reports import ReportGenerator
from app.database import Base

# Create an in-memory SQLite database for testing Vector Store
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

# 1. Test Ollama Client fallbacks
@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_ollama_client_fallback_to_offline(mock_post):
    # Mock post to raise connection error (simulating Ollama offline)
    mock_post.side_effect = Exception("Connection refused")

    # We patch env vars to ensure no Gemini API key exists
    with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
        client = OllamaClient()
        client.ensure_model_pulled = AsyncMock(return_value=False)
        response = await client.generate(prompt="Run forecast scenario", system_prompt="Test")
        # Should fall back to rule-based offline forecast summary
        assert "Offline AI Insights & Forecast" in response
        assert "Ollama is running" in response

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
async def test_ollama_client_fallback_to_gemini(mock_post):
    # Mock post to Ollama to raise error
    mock_post.side_effect = Exception("Ollama offline")

    # Mock httpx AsyncClient post for Gemini API call
    mock_gemini_response = MagicMock()
    mock_gemini_response.status_code = 200
    mock_gemini_response.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Hello from Gemini Fallback!"}]
                }
            }
        ]
    }

    with patch.dict("os.environ", {"GEMINI_API_KEY": "valid_mock_key"}):
        client = OllamaClient()
        client.ensure_model_pulled = AsyncMock(return_value=False)
        # Patch the internal helper method so it runs reliably
        with patch.object(client, "_call_gemini_fallback", return_value="Hello from Gemini Fallback!"):
            response = await client.generate(prompt="Hello", system_prompt="Test")
            assert response == "Hello from Gemini Fallback!"


# 2. Test Vector Store & Similarity search (NumPy/SQLite fallback)
@pytest.mark.asyncio
async def test_vector_store_memory_add_and_search(db_session):
    store = VectorStore()

    # Patch get_embedding to return mocked vectors
    async def mock_embedding(text_str):
        if "sales" in text_str:
            return [1.0] + [0.0] * 383
        elif "churn" in text_str:
            return [0.0, 1.0] + [0.0] * 382
        return [0.0] * 384

    with patch.object(store, "get_embedding", side_effect=mock_embedding):
        # Add memories
        await store.add_memory(db_session, user_id=1, category="insight", content="Sales are growing by 15%", dataset_id=10)
        await store.add_memory(db_session, user_id=1, category="insight", content="Churn rate increased in Q3", dataset_id=10)

        # Verify they are added to DB
        count = db_session.query(SemanticMemory).count()
        assert count == 2

        # Search query matching "sales"
        results = await store.search_memory(db_session, user_id=1, query="sales metrics", dataset_id=10)
        assert len(results) > 0
        # The first hit should be the sales growth because of the mock embedding similarity
        assert "Sales are growing" in results[0]["content"]

# 3. Test SQL Security rules
def test_sql_security_sanitization():
    # Safe queries
    assert sanitize_and_validate_sql("SELECT * FROM users;") == "SELECT * FROM users;"
    assert sanitize_and_validate_sql("  SELECT count(id) FROM datasets; -- test comment") == "SELECT count(id) FROM datasets;"

    # Toxic queries (should raise exceptions)
    with pytest.raises(SecurityAlertException):
        sanitize_and_validate_sql("DELETE FROM users;")

    with pytest.raises(SecurityAlertException):
        sanitize_and_validate_sql("SELECT * FROM users; DROP TABLE user_dashboards;")

    with pytest.raises(SecurityAlertException):
        sanitize_and_validate_sql("INSERT INTO datasets (name) VALUES ('x');")

    with pytest.raises(SecurityAlertException):
        # Commands not starting with select
        sanitize_and_validate_sql("UPDATE users SET is_active = 0;")

# 4. Test SQL Executor Tool
def test_execute_read_only_sql(db_session):
    # Setup some test data in sqlite
    db_session.execute(text("CREATE TABLE test_users (id INTEGER PRIMARY KEY, email TEXT);"))
    db_session.execute(text("INSERT INTO test_users (email) VALUES ('test1@test.com'), ('test2@test.com');"))
    db_session.commit()

    # Try safe SELECT
    res = DatabaseTools.execute_read_only_sql(db_session, "SELECT email FROM test_users ORDER BY email ASC;")
    assert res["success"] is True
    assert res["columns"] == ["email"]
    assert res["rows"] == [["test1@test.com"], ["test2@test.com"]]

    # Try unsafe INSERT
    res_unsafe = DatabaseTools.execute_read_only_sql(db_session, "INSERT INTO test_users (email) VALUES ('toxic@test.com');")
    assert res_unsafe["success"] is False
    assert "Access Denied" in res_unsafe["error"]

# 5. Test PDF compiler
def test_markdown_to_pdf_compilation():
    markdown = """
# Phase 4 Executive Report
## Business Overview
This is a standard paragraph detailing analytics trends.
- KPI metric: $1.4M
- Monthly growth rate: +8.4%
"""
    pdf_bytes = ReportGenerator.compile_markdown_to_pdf(markdown, "Executive Report")
    assert isinstance(pdf_bytes, bytearray) or isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    # PDF signature characters %PDF
    assert pdf_bytes.startswith(b"%PDF")

# 6. Test Evaluation overlap calculation
def test_overlap_calculation():
    response = "The forecast prediction indicates a growth scenario based on statsmodels algorithms."
    context = "forecast prediction statsmodels algorithm time-series scenario projections"

    overlap = AIEvaluator.calculate_overlap_coefficient(response, context)
    assert overlap > 0.4

    # Complete non-overlap
    non_overlap = AIEvaluator.calculate_overlap_coefficient("Completely different topic of discussion.", "Sales, revenue, growth, metrics.")
    assert non_overlap == 0.0

from sqlalchemy import text
