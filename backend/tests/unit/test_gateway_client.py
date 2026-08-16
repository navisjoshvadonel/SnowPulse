"""Tests for backend.app.ai.gateway.client — OllamaClient."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock, patch

import pytest

from backend.app.ai.gateway.client import OllamaClient


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
        mock_response.json.return_value = {"models": [{"name": "llama2"}]}
        mock_response.text = "Ollama is running"
        mock_get.return_value = mock_response

        client = OllamaClient()
        result = await client.check_health()
        assert result["status"] == "healthy"
        assert result["ollama_connected"] is True

    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.get")
    @pytest.mark.asyncio
    async def test_check_health_failure(self, mock_get):
        mock_get.side_effect = Exception("Connection error")

        client = OllamaClient()
        result = await client.check_health()
        assert result["status"] == "degraded"
        assert result["ollama_connected"] is False

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

    @patch.object(OllamaClient, "ensure_model_pulled", return_value=True)
    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.post")
    @pytest.mark.asyncio
    async def test_generate_text_success(self, mock_post, mock_pull):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Mocked LLM reply"}
        mock_post.return_value = mock_response

        client = OllamaClient()
        reply = await client.generate_text("Hello")
        assert reply == "Mocked LLM reply"

    @patch.object(OllamaClient, "ensure_model_pulled", return_value=False)
    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.post")
    @pytest.mark.asyncio
    async def test_generate_text_failure(self, mock_post, mock_pull):
        mock_post.side_effect = Exception("Connection error")
        client = OllamaClient()
        reply = await client.generate_text("Hello")
        assert "degraded" in reply.lower() or "offline" in reply.lower()

    @patch.object(OllamaClient, "ensure_model_pulled", return_value=True)
    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.post")
    @pytest.mark.asyncio
    async def test_chat_success(self, mock_post, mock_pull):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": {"content": "Hello from Chat!"}}
        mock_post.return_value = mock_response

        client = OllamaClient()
        reply = await client.chat([{"role": "user", "content": "Hi"}])
        assert reply == {"content": "Hello from Chat!"}

    @patch.object(OllamaClient, "ensure_model_pulled", return_value=True)
    @patch("backend.app.ai.gateway.client.httpx.AsyncClient.post")
    @pytest.mark.asyncio
    async def test_chat_failure(self, mock_post, mock_pull):
        mock_post.side_effect = Exception("Connection error")
        client = OllamaClient()
        with pytest.raises(Exception, match="All local models failed for chat completion."):
            await client.chat([{"role": "user", "content": "Hi"}])
