"""Employer verification: what blocks submission, document reading, business-email proof.

Each test pins a mistake that actually happened while building this flow:
  * a dummy GSTIN built on a different PAN than the one typed (the message hid which PANs clashed),
  * a bank statement accepted as a PAN card with nothing flagging it,
  * submitting a case whose own details contradict each other,
  * business-email proof that survived the address being changed.

No network: the AI reader and the email sender are always patched.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.ai import document_check
from app.core import employer_verification_rules as rules
from app.core.exceptions import BadRequestException, OtpExpiredException, OtpInvalidException
from app.core.security import create_access_token, hash_otp
from app.models.employer_verification import EmployerVerification, EmployerVerificationDocument
from app.models.user import OtpVerification
from app.modules.jobs import verification
from tests.test_verification_flow import PAN, _details, _gstin

REAL_PAN = "GIQPB2788L"


def _ready_user(db, owner_user):
    owner_user.email_verified = True
    db.commit()
    return owner_user


def _case(db, case_id) -> EmployerVerification:
    return db.get(EmployerVerification, case_id)


def _prove_email(db, case_id, email="hr@uico.test"):
    _case(db, case_id).business_email_verified = email
    db.commit()


# ── Format helpers ────────────────────────────────────────────────────────────

def test_dummy_gstin_helper_builds_a_valid_gstin_around_the_given_pan():
    g = _gstin(REAL_PAN, "22")
    assert g == "22GIQPB2788L1ZR"
    assert rules.validate_gstin(g) is None
    assert g[2:12] == REAL_PAN


def test_the_documented_gstin_example_is_itself_valid():
    # The error text used to show an example that failed its own checksum.
    example = rules.validate_gstin("x")  # message for a malformed value
    sample = example.split("e.g. ")[1].rstrip(".")
    assert rules.validate_gstin(sample) is None


# ── Hard blocks vs. reviewer-only signals ─────────────────────────────────────

def test_gstin_pan_mismatch_names_both_pans_and_blocks_submit(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    # the exact mistake: a GSTIN built on one PAN while another PAN is typed in the PAN field
    resp = verification.save_details(user, _details(gstin=_gstin("AAAAA0000A", "22"), pan=REAL_PAN), db)

    clash = [m for m in resp.missing if "GSTIN" in m]
    assert clash, "the mismatch must be listed under 'still needed before you can submit'"
    assert "AAAAA0000A" in clash[0] and REAL_PAN in clash[0]       # says WHICH values clash
    assert not resp.can_submit
    with pytest.raises(BadRequestException) as e:
        verification.submit(user, db)
    assert REAL_PAN in e.value.detail


def test_fixing_the_mismatch_unblocks_the_check(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    resp = verification.save_details(user, _details(gstin=_gstin(REAL_PAN, "22"), pan=REAL_PAN), db)
    assert not [m for m in resp.missing if "GSTIN" in m]
    assert any(c["code"] == "gstin_pan_match" and c["level"] == "ok" for c in resp.auto_checks)


def test_only_employer_fixable_failures_block():
    mismatch = {"code": "gstin_pan_match", "level": "fail", "message": "clash"}
    bad_format = {"code": "pan_format", "level": "fail", "message": "bad pan"}
    duplicate = {"code": "duplicate_gstin", "level": "fail", "message": "already used"}
    warning = {"code": "email_domain", "level": "warn", "message": "free mail"}
    assert rules.blocking_failures([mismatch, bad_format, duplicate, warning]) == ["clash", "bad pan"]
    assert rules.blocking_failures([duplicate, warning]) == []     # reviewer decides these


# ── Business email proof ──────────────────────────────────────────────────────

def test_submit_needs_business_email_proof(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    resp = verification.save_details(user, _details(), db)
    assert resp.business_email_proven is False
    assert any("business email" in m.lower() for m in resp.missing)

    _prove_email(db, resp.id)
    assert verification.get_status(user, db).business_email_proven is True


def test_changing_the_address_withdraws_the_proof(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    resp = verification.save_details(user, _details(), db)
    _prove_email(db, resp.id)
    assert verification.get_status(user, db).business_email_proven

    changed = verification.save_details(user, _details(business_email="someone.else@uico.test"), db)
    assert changed.business_email_proven is False


def test_the_verified_login_email_counts_as_proof(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    resp = verification.save_details(user, _details(business_email=user.email), db)
    assert resp.business_email_proven is True


@pytest.mark.asyncio
async def test_business_email_code_flow(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    resp = verification.save_details(user, _details(), db)

    def active_code():
        return (db.query(OtpVerification)
                .filter_by(user_id=user.id, target="hr@uico.test", purpose="verify", used_at=None)
                .order_by(OtpVerification.created_at.desc()).first())

    with patch("app.core.email.send_business_email_otp", new=AsyncMock()) as send:
        await verification.send_business_email_code(user, db)
        send.assert_awaited_once()
        assert send.await_args.args[0] == "hr@uico.test"

        active_code().otp_hash = hash_otp("111111")
        db.commit()
        with pytest.raises(OtpInvalidException):
            verification.verify_business_email_code(user, "222222", db)
        assert not verification.get_status(user, db).business_email_proven

        # a newer code replaces the older one: only the newest ever works
        await verification.send_business_email_code(user, db)
        with pytest.raises(OtpInvalidException):
            verification.verify_business_email_code(user, "111111", db)

        active_code().otp_hash = hash_otp("333333")
        db.commit()
        assert verification.verify_business_email_code(user, "333333", db).business_email_proven

        with pytest.raises(BadRequestException):                # already confirmed
            await verification.send_business_email_code(user, db)
    assert _case(db, resp.id).business_email_verified == "hr@uico.test"


@pytest.mark.asyncio
async def test_expired_and_reused_codes_are_rejected(db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    verification.save_details(user, _details(), db)
    with patch("app.core.email.send_business_email_otp", new=AsyncMock()):
        await verification.send_business_email_code(user, db)
    rec = db.query(OtpVerification).filter_by(user_id=user.id, target="hr@uico.test", purpose="verify", used_at=None).one()
    rec.otp_hash = hash_otp("444444")
    rec.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    with pytest.raises(OtpExpiredException):
        verification.verify_business_email_code(user, "444444", db)


# ── Document reading ──────────────────────────────────────────────────────────

async def _upload_async(db, user, doc_type, ai_result, tmp_path):
    f = tmp_path / "doc.png"
    f.write_bytes(b"x")
    upload = SimpleNamespace(content_type="image/png")
    with patch("app.core.storage.save_upload", new=AsyncMock(return_value=("employer_verification/doc.png", "doc.png"))), \
         patch("app.core.storage.get_path", return_value=f), \
         patch("app.ai.document_check.analyse", new=AsyncMock(return_value=ai_result)):
        return await verification.upload_document(user, doc_type, upload, db)


@pytest.mark.asyncio
async def test_wrong_kind_of_document_is_flagged_but_still_uploaded(db, owner_and_company, tmp_path):
    user = _ready_user(db, owner_and_company[0])
    bank = {"status": "ok", "detected_type": "bank_statement", "legible": True, "fields": {}}
    resp = await _upload_async(db, user, "pan_card", bank, tmp_path)

    assert [d.doc_type for d in resp.documents] == ["pan_card"]          # the upload itself is not refused
    flagged = [c for c in resp.auto_checks if c["code"] == "doc_pan_card_type"]
    assert flagged and flagged[0]["level"] == "warn" and "bank statement" in flagged[0]["message"]
    assert rules.blocking_failures(resp.auto_checks) == []                # a doc warning never blocks submission
    assert not any("looks like" in m for m in resp.missing)


@pytest.mark.asyncio
async def test_pan_on_the_document_is_compared_with_the_pan_entered(db, owner_and_company, tmp_path):
    user = _ready_user(db, owner_and_company[0])
    verification.save_details(user, _details(gstin=_gstin(REAL_PAN, "22"), pan=REAL_PAN), db)

    other = {"status": "ok", "detected_type": "pan_card", "legible": True, "fields": {"pan": "ZZZZZ9999Z"}}
    resp = await _upload_async(db, user, "pan_card", other, tmp_path)
    mismatch = next(c for c in resp.auto_checks if c["code"] == "doc_pan_card_pan")
    assert mismatch["level"] == "warn" and "ZZZZZ9999Z" in mismatch["message"] and REAL_PAN in mismatch["message"]

    same = {"status": "ok", "detected_type": "pan_card", "legible": True, "fields": {"pan": REAL_PAN}}
    resp = await _upload_async(db, user, "pan_card", same, tmp_path)     # replaces the earlier file
    assert next(c for c in resp.auto_checks if c["code"] == "doc_pan_card_pan")["level"] == "ok"
    assert len([d for d in resp.documents if d.doc_type == "pan_card"]) == 1


@pytest.mark.asyncio
async def test_unreadable_by_ai_never_blocks_or_adds_checks(db, owner_and_company, tmp_path):
    user = _ready_user(db, owner_and_company[0])
    resp = await _upload_async(db, user, "pan_card", {"status": "unavailable"}, tmp_path)
    assert len(resp.documents) == 1
    assert not any(c["code"].startswith("doc_") for c in resp.auto_checks)
    stored = db.query(EmployerVerificationDocument).filter_by(verification_id=resp.id).one()
    assert stored.ai_check == {"status": "unavailable"}


def test_free_form_documents_only_get_a_legibility_check():
    # an authorisation letter has no fixed format, so a "wrong type" verdict would be noise
    docs = [("signatory_authorisation", {"status": "ok", "detected_type": "other", "legible": True, "fields": {}})]
    assert rules.doc_checks({}, docs) == []
    blurry = [("signatory_authorisation", {"status": "ok", "detected_type": "other", "legible": False, "fields": {}})]
    assert rules.doc_checks({}, blurry)[0]["code"] == "doc_signatory_authorisation_legible"


# ── The AI reader itself ──────────────────────────────────────────────────────

def test_reader_keeps_only_well_formed_ids_and_known_types():
    out = document_check.parse_result({
        "detected_type": "pan_card", "legible": True,
        "pan": " aaaaa 0000 a ", "gstin": "NOT-A-GSTIN", "cin": "", "name": "  ACME   PRIVATE  LIMITED ",
    })
    assert out == {"status": "ok", "detected_type": "pan_card", "legible": True,
                   "fields": {"pan": "AAAAA0000A", "name": "ACME PRIVATE LIMITED"}}
    assert document_check.parse_result({"detected_type": "made_up", "legible": 1})["detected_type"] == "other"


def test_reader_output_cannot_carry_extra_instructions_through():
    # text inside a document must not be able to add fields or change decisions
    out = document_check.parse_result({"detected_type": "other", "legible": True, "approve": True, "status": "approved"})
    assert set(out) == {"status", "detected_type", "legible", "fields"} and out["status"] == "ok"


@pytest.mark.asyncio
async def test_reader_degrades_quietly_without_a_key_or_when_the_call_fails():
    with patch("app.ai.document_check.get_settings", return_value=SimpleNamespace(gemini_api_key="", gemini_model="m")):
        assert await document_check.analyse(b"x", "image/png") == {"status": "unavailable"}
    with patch("app.ai.document_check.get_settings", return_value=SimpleNamespace(gemini_api_key="k", gemini_model="m")), \
         patch("app.ai.document_check.httpx.AsyncClient", side_effect=RuntimeError("network down")):
        assert await document_check.analyse(b"x", "image/png") == {"status": "unavailable"}


# ── Over HTTP (routes, auth, validation, response shape) ──────────────────────

def _auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}


def test_http_flow_blocks_mismatch_and_confirms_business_email(client, db, owner_and_company):
    user = _ready_user(db, owner_and_company[0])
    h = _auth(user)
    body = _details(gstin=_gstin("AAAAA0000A", "22"), pan=REAL_PAN).model_dump()

    r = client.put("/api/employer/verification/details", json=body, headers=h)
    assert r.status_code == 200, r.text
    assert any(REAL_PAN in m for m in r.json()["missing"])
    assert client.post("/api/employer/verification/submit", headers=h).status_code == 400

    with patch("app.core.email.send_business_email_otp", new=AsyncMock()):
        assert client.post("/api/employer/verification/business-email/send", headers=h).status_code == 200
    bad = client.post("/api/employer/verification/business-email/verify", json={"otp": "000000"}, headers=h)
    assert bad.status_code == 400
    assert client.post("/api/employer/verification/business-email/verify", json={"otp": "12"}, headers=h).status_code == 422
    assert client.post("/api/employer/verification/business-email/verify", json={"otp": "000000"}).status_code in (401, 403)


# ── Wording the reviewer relies on ────────────────────────────────────────────

def _proof_message(resp):
    return next(c["message"] for c in resp.auto_checks if c["code"] == "business_email_proof")


def test_proof_message_says_how_the_email_was_confirmed(db, owner_and_company):
    # It once claimed "code entered" even when the business email was simply the verified login email.
    user = _ready_user(db, owner_and_company[0])
    same_as_login = verification.save_details(user, _details(business_email=user.email), db)
    assert "verified login email" in _proof_message(same_as_login)
    assert "code" not in _proof_message(same_as_login).lower()

    other = verification.save_details(user, _details(business_email="hr@uico.test"), db)
    assert "not been confirmed" in _proof_message(other)
    _prove_email(db, other.id)
    confirmed = verification.save_details(user, _details(business_email="hr@uico.test"), db)
    assert "entering the code" in _proof_message(confirmed)
