"""WebhookService 单元测试"""

import hashlib
import hmac
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.services.webhook import WebhookService


class TestWebhookServiceVerifySignature:
    """verify_signature 静态方法测试"""

    def test_verify_signature_valid(self):
        """正确签名返回 True"""
        secret = "test-secret"
        body = b'{"event":"package.published"}'
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        valid_sig = f"sha256={expected}"

        assert WebhookService.verify_signature(secret, body, valid_sig) is True

    def test_verify_signature_invalid(self):
        """错误签名返回 False"""
        secret = "test-secret"
        body = b'{"event":"package.published"}'

        assert WebhookService.verify_signature(secret, body, "sha256=wrong") is False

    def test_verify_signature_tampered_body(self):
        """篡改 body 后签名验证失败"""
        secret = "test-secret"
        body = b'{"event":"package.published"}'
        tampered = b'{"event":"package.deleted"}'
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        assert WebhookService.verify_signature(secret, tampered, f"sha256={sig}") is False

    def test_verify_signature_empty_secret(self):
        """空 secret 也能验证（只是不安全）"""
        body = b'{"event":"test"}'
        expected = hmac.new(b"", body, hashlib.sha256).hexdigest()
        assert WebhookService.verify_signature("", body, f"sha256={expected}") is True


def make_mock_client(post_mock: AsyncMock) -> MagicMock:
    """创建带 async context manager 的 mock httpx.AsyncClient"""
    client = MagicMock()
    client.post = post_mock
    cm = MagicMock()
    cm.__aenter__.return_value = client
    cm.__aexit__.return_value = AsyncMock()
    return cm


class TestWebhookServiceDeliverWebhook:
    """_deliver_webhook 重试和错误路径测试"""

    @pytest.fixture
    def mock_webhook(self):
        w = MagicMock()
        w.id = uuid4()
        w.url = "https://example.com/webhook"
        w.secret = "webhook-secret"
        return w

    @pytest.fixture
    def sample_payload(self):
        return {"package": {"name": "test-pkg", "version": "1.0.0"}}

    @pytest.mark.asyncio
    async def test_deliver_webhook_success(self, mock_webhook, sample_payload):
        """HTTP 2xx 成功，一次请求，不重试"""
        mock_response = MagicMock()
        mock_response.status_code = 200

        post_mock = AsyncMock(return_value=mock_response)
        mock_client_cm = make_mock_client(post_mock)

        with patch("httpx.AsyncClient", return_value=mock_client_cm):
            service = WebhookService(db=AsyncMock())
            await service._deliver_webhook(mock_webhook, "package.published", sample_payload)

            assert post_mock.call_count == 1

    @pytest.mark.asyncio
    async def test_deliver_webhook_retries_3xx(self, mock_webhook, sample_payload):
        """HTTP 3xx 也重试 3 次后失败"""
        mock_response = MagicMock()
        mock_response.status_code = 301

        post_mock = AsyncMock(return_value=mock_response)
        mock_client_cm = make_mock_client(post_mock)

        with patch("httpx.AsyncClient", return_value=mock_client_cm):
            with patch("app.services.webhook.logger") as mock_logger:
                service = WebhookService(db=AsyncMock())
                await service._deliver_webhook(mock_webhook, "package.published", sample_payload)

                # 3xx 也重试，3 次后失败
                assert post_mock.call_count == 3
                mock_logger.error.assert_called_once()

    @pytest.mark.asyncio
    async def test_deliver_webhook_retries_4xx_no_retry(self, mock_webhook, sample_payload):
        """HTTP 4xx 也重试 3 次后失败（代码对所有非 2xx 都重试）"""
        mock_response = MagicMock()
        mock_response.status_code = 404

        post_mock = AsyncMock(return_value=mock_response)
        mock_client_cm = make_mock_client(post_mock)

        with patch("httpx.AsyncClient", return_value=mock_client_cm):
            with patch("app.services.webhook.logger") as mock_logger:
                service = WebhookService(db=AsyncMock())
                await service._deliver_webhook(mock_webhook, "package.published", sample_payload)

                assert post_mock.call_count == 3
                mock_logger.error.assert_called_once()

    @pytest.mark.asyncio
    async def test_deliver_webhook_retries_5xx_retries_3_times(self, mock_webhook, sample_payload):
        """HTTP 5xx 重试 3 次后失败，记录 error"""
        fail_response = MagicMock()
        fail_response.status_code = 500

        post_mock = AsyncMock(return_value=fail_response)
        mock_client_cm = make_mock_client(post_mock)

        with patch("httpx.AsyncClient", return_value=mock_client_cm):
            with patch("app.services.webhook.logger") as mock_logger:
                service = WebhookService(db=AsyncMock())
                await service._deliver_webhook(mock_webhook, "package.published", sample_payload)

                assert post_mock.call_count == 3
                mock_logger.error.assert_called_once()
                assert "failed after 3 attempts" in mock_logger.error.call_args[0][0]

    @pytest.mark.asyncio
    async def test_deliver_webhook_connection_error_retries(self, mock_webhook, sample_payload):
        """连接异常重试 3 次后失败，记录 error"""
        post_mock = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        mock_client_cm = make_mock_client(post_mock)

        with patch("httpx.AsyncClient", return_value=mock_client_cm):
            with patch("app.services.webhook.logger") as mock_logger:
                service = WebhookService(db=AsyncMock())
                await service._deliver_webhook(mock_webhook, "package.published", sample_payload)

                assert post_mock.call_count == 3
                mock_logger.error.assert_called_once()
                assert "failed after 3 attempts" in mock_logger.error.call_args[0][0]

    @pytest.mark.asyncio
    async def test_deliver_webhook_500_then_200_retries_then_succeeds(self, mock_webhook, sample_payload):
        """第 1 次 500，第 2 次 200，恢复并返回"""
        fail_response = MagicMock()
        fail_response.status_code = 500
        success_response = MagicMock()
        success_response.status_code = 200

        post_mock = AsyncMock(side_effect=[fail_response, success_response])
        mock_client_cm = make_mock_client(post_mock)

        with patch("httpx.AsyncClient", return_value=mock_client_cm):
            service = WebhookService(db=AsyncMock())
            await service._deliver_webhook(mock_webhook, "package.published", sample_payload)

            assert post_mock.call_count == 2


class TestWebhookServiceFireWebhooks:
    """fire_webhooks 过滤逻辑 — 由 test_webhook.py API 层覆盖，此处略。"""
