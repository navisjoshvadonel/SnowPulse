"""Tests for backend.app.ai.gateway.client — OllamaClient."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest
from unittest.mock import patch, MagicMock

from backend.app.ai.gateway.client import OllamaClient, ollama_client


class TestOllamaClient:
    def test_singleton_initialization(self):
        client = OllamaClient()
        assert client.base_url is not None
        assert client.default_model == "llama2"

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.get")
    @pytest.mark.asyncio
    async def test_check_health_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok"}
        mock_get.return_value = mock_response

        client = OllamaClient()
        result = await client.check_health()
        assert result["status"] == "ok"
        assert result["is_online"] is True

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.get")
    @pytest.mark.asyncio
    async def test_check_health_failure(self, mock_get):
        mock_get.side_effect = Exception("Connection error")

        client = OllamaClient()
        result = await client.check_health()
        assert result["status"] == "error"
        assert result["is_online"] is False

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.get")
    @pytest.mark.asyncio
    async def test_get_available_models_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"models": [{"name": "llama2"}, {"name": "mistral"}]}
        mock_get.return_value = mock_response

        client = OllamaClient()
        models = await client.get_available_models()
        assert "llama2" in models
        assert "mistral" in models

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.get")
    @pytest.mark.asyncio
    async def test_get_available_models_failure(self, mock_get):
        mock_get.side_effect = Exception("Connection error")
        client = OllamaClient()
        models = await client.get_available_models()
        assert models == []

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.post")
    @pytest.mark.asyncio
    async def test_generate_text_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Mocked LLM reply"}
        mock_post.return_value = mock_response

        client = OllamaClient()
        reply = await client.generate_text("Hello")
        assert reply == "Mocked LLM reply"

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.post")
    @pytest.mark.asyncio
    async def test_generate_text_failure(self, mock_post):
        mock_post.side_effect = Exception("Connection error")
        client = OllamaClient()
        reply = await client.generate_text("Hello")
        assert "I am currently running in offline mode" in reply
