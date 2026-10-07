"""Unit tests for Razorpay recurring billing gating logic:
  - Aspirant free-tier feature credits (3 lifetime uses, then 402)
  - Webhook signature verification + idempotency
  - Employer dashboard paywall dependency
  - The upgrade_subscription() loophole closed for paid plans (must go through checkout)

These are pure unit tests against MagicMock'd DB sessions (no live Postgres
required) — same style as tests/test_qa_failures.py.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.core.exceptions import BadRequestException, PaymentRequiredException


def _make_user(role_name="aspirant"):
    user = MagicMock()
    user.id = uuid.uuid4()
    user.role_name = role_name
    return user


class TestConsumeFeatureCredit:
    def _db_with_usage(self, used_count: int | None, is_premium: bool):
        from app.models.payment import FeatureUsage

        db = MagicMock()

        def query_side_effect(model):
            mock_q = MagicMock()
            if model is FeatureUsage:
                usage = None
                if used_count is not None:
                    usage = MagicMock(used_count=used_count)
                mock_q.filter.return_value.first.return_value = usage
            else:
                # AspirantSubscription join query used by _aspirant_is_premium
                chain = mock_q.join.return_value.filter.return_value.filter.return_value.filter.return_value
                chain.first.return_value = MagicMock() if is_premium else None
            return mock_q

        db.query.side_effect = query_side_effect
        return db

    def test_allows_use_under_limit(self):
        from app.modules.payments.service import consume_feature_credit

        user = _make_user()
        db = self._db_with_usage(used_count=1, is_premium=False)

        consume_feature_credit(user, "roadmap", db)   # should not raise
        db.commit.assert_called()

    def test_blocks_fourth_use(self):
        from app.modules.payments.service import consume_feature_credit

        user = _make_user()
        db = self._db_with_usage(used_count=3, is_premium=False)

        with pytest.raises(PaymentRequiredException):
            consume_feature_credit(user, "roadmap", db)

    def test_unlimited_once_premium(self):
        from app.modules.payments.service import consume_feature_credit

        user = _make_user()
        db = self._db_with_usage(used_count=99, is_premium=True)

        consume_feature_credit(user, "roadmap", db)   # should not raise despite high usage
        db.commit.assert_not_called()   # premium path is a no-op, no counter mutation

    def test_rejects_unknown_feature_key(self):
        from app.modules.payments.service import consume_feature_credit

        user = _make_user()
        db = MagicMock()
        with pytest.raises(ValueError):
            consume_feature_credit(user, "not_a_real_feature", db)


class TestWebhookSignatureVerification:
    def test_valid_signature_passes(self):
        from app.modules.payments.service import _verify_webhook_signature

        secret = "test_webhook_secret"
        body = b'{"event": "subscription.activated"}'
        signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        with patch("app.modules.payments.service.get_settings") as mock_settings:
            mock_settings.return_value.razorpay_webhook_secret = secret
            _verify_webhook_signature(body, signature)   # should not raise

    def test_invalid_signature_rejected(self):
        from app.modules.payments.service import _verify_webhook_signature

        with patch("app.modules.payments.service.get_settings") as mock_settings:
            mock_settings.return_value.razorpay_webhook_secret = "test_webhook_secret"
            with pytest.raises(BadRequestException):
                _verify_webhook_signature(b'{"event": "x"}', "not-the-right-signature")


class TestWebhookIdempotency:
    def test_replayed_event_is_skipped(self):
        from app.modules.payments.service import handle_webhook
        from app.models.payment import RazorpayWebhookEvent

        secret = "test_webhook_secret"
        body = json.dumps({"id": "evt_123", "event": "subscription.charged", "payload": {}}).encode()
        signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = MagicMock(spec=RazorpayWebhookEvent)

        with patch("app.modules.payments.service.get_settings") as mock_settings:
            mock_settings.return_value.razorpay_webhook_secret = secret
            handle_webhook(body, signature, db)

        # Already-seen event: no new webhook-event row logged, no commit for processing.
        db.add.assert_not_called()


class TestRequirePaidEmployerSubscription:
    def _db_for(self, has_company: bool = True):
        from app.models.user import EmployerProfile

        db = MagicMock()
        profile = MagicMock(company_id=uuid.uuid4() if has_company else None)

        def query_side_effect(model):
            mock_q = MagicMock()
            if model is EmployerProfile:
                mock_q.filter.return_value.first.return_value = profile
            return mock_q

        db.query.side_effect = query_side_effect
        return db

    def test_blocks_without_company(self):
        from app.modules.payments.service import require_active_employer_subscription

        user = _make_user(role_name="employer_owner")
        db = self._db_for(has_company=False)

        with pytest.raises(PaymentRequiredException):
            require_active_employer_subscription(current_user=user, db=db)

    def test_blocks_with_inactive_subscription(self):
        from app.modules.payments.service import require_active_employer_subscription

        user = _make_user(role_name="employer_owner")
        db = self._db_for()

        with patch(
            "app.modules.payments.service._get_or_create_company_subscription",
            return_value=MagicMock(status="canceled"),
        ):
            with pytest.raises(PaymentRequiredException):
                require_active_employer_subscription(current_user=user, db=db)

    def test_allows_with_active_free_subscription(self):
        """Free-tier companies get real access — capped by the plan's own
        limits (max_active_jobs etc.), not by an all-or-nothing paywall."""
        from app.modules.payments.service import require_active_employer_subscription

        user = _make_user(role_name="employer_owner")
        db = self._db_for()

        with patch(
            "app.modules.payments.service._get_or_create_company_subscription",
            return_value=MagicMock(status="active"),
        ):
            result = require_active_employer_subscription(current_user=user, db=db)
        assert result is user

    def test_allows_with_active_paid_subscription(self):
        from app.modules.payments.service import require_active_employer_subscription

        user = _make_user(role_name="employer_owner")
        db = self._db_for()

        with patch(
            "app.modules.payments.service._get_or_create_company_subscription",
            return_value=MagicMock(status="active"),
        ):
            result = require_active_employer_subscription(current_user=user, db=db)
        assert result is user


class TestUpgradeSubscriptionLoophole:
    def test_rejects_direct_upgrade_to_paid_plan(self):
        from app.modules.companies.service import upgrade_subscription
        from app.models.subscription import SubscriptionPlan

        user = _make_user(role_name="employer_owner")
        profile = MagicMock(is_owner=True, company_id=uuid.uuid4())
        paid_plan = MagicMock(spec=SubscriptionPlan, price_monthly=199900)

        db = MagicMock()
        with patch("app.modules.companies.service._get_own_profile", return_value=profile), \
             patch("app.modules.companies.service._get_company_or_404", return_value=MagicMock(id=profile.company_id)):
            db.query.return_value.filter.return_value.first.return_value = paid_plan
            with pytest.raises(BadRequestException):
                upgrade_subscription(user, str(uuid.uuid4()), db)
