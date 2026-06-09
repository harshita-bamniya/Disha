"""Tests for SMS provider abstraction."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.sms import ConsoleSMSProvider, MSG91SMSProvider, get_sms_provider


class TestConsoleSMSProvider:
    @pytest.mark.asyncio
    async def test_send_logs_otp(self, caplog):
        provider = ConsoleSMSProvider()
        import logging
        with caplog.at_level(logging.INFO, logger="app.core.sms"):
            await provider.send("+919876543210", "123456")
        assert "123456" in caplog.text

    @pytest.mark.asyncio
    async def test_send_does_not_raise(self):
        provider = ConsoleSMSProvider()
        # Should not raise even with unusual phone format
        await provider.send("9876543210", "000000")


class TestMSG91Provider:
    @pytest.mark.asyncio
    async def test_raises_when_api_key_missing(self):
        with patch("app.core.sms.settings") as mock_settings:
            mock_settings.msg91_api_key = ""
            mock_settings.msg91_template_id = "tmpl123"
            provider = MSG91SMSProvider()
            with pytest.raises(RuntimeError, match="MSG91_API_KEY"):
                await provider.send("9876543210", "123456")

    @pytest.mark.asyncio
    async def test_raises_when_template_missing(self):
        with patch("app.core.sms.settings") as mock_settings:
            mock_settings.msg91_api_key = "real_key"
            mock_settings.msg91_template_id = ""
            provider = MSG91SMSProvider()
            with pytest.raises(RuntimeError, match="MSG91_TEMPLATE_ID"):
                await provider.send("9876543210", "123456")

    @pytest.mark.asyncio
    async def test_10_digit_number_gets_91_prefix(self):
        with patch("app.core.sms.settings") as mock_settings:
            mock_settings.msg91_api_key = "key"
            mock_settings.msg91_template_id = "tmpl"
            mock_settings.msg91_sender_id = "DISHA"
            provider = MSG91SMSProvider()

            captured_payload = {}

            async def mock_post(url, json, **kwargs):
                captured_payload.update(json)
                resp = MagicMock()
                resp.status_code = 200
                resp.json.return_value = {"type": "success"}
                return resp

            with patch("httpx.AsyncClient") as MockClient:
                mock_ctx = AsyncMock()
                mock_ctx.__aenter__.return_value.post = mock_post
                MockClient.return_value = mock_ctx
                await provider.send("9876543210", "654321")

            assert captured_payload.get("mobile", "").startswith("91")


class TestGetProvider:
    def test_local_env_returns_console(self):
        with patch("app.core.sms.settings") as mock:
            mock.environment = "local"
            provider = get_sms_provider()
            assert isinstance(provider, ConsoleSMSProvider)

    def test_production_env_returns_msg91(self):
        with patch("app.core.sms.settings") as mock:
            mock.environment = "production"
            provider = get_sms_provider()
            assert isinstance(provider, MSG91SMSProvider)
