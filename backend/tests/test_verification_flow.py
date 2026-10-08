"""Employer verification flow (guided details -> documents -> submit -> admin review).

Regression history: the admin dashboard's "Pending Review" KYC panel once filtered by
status 'pending', a value that never existed (cases are 'requested' once submitted), so
the panel was silently empty. These tests pin the real status values and the rules the
admin queue and the job-posting gate depend on.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core import employer_verification_rules as rules
from app.core.exceptions import BadRequestException
from app.models.employer_verification import EmployerVerificationDocument
from app.modules.admin.service.employers import (
    list_employer_verifications,
    review_employer_verification,
    review_verification_document,
)
from app.modules.jobs import verification
from app.modules.jobs.schemas import VerificationDetailsRequest

PAN = "AABCU4321K"


def _gstin(pan: str = PAN, state: str = "29") -> str:
    body = state + pan + "1Z"
    total = 0
    for i, ch in enumerate(body):
        v = rules._GSTIN_CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += v // 36 + v % 36
    return body + rules._GSTIN_CHARS[(36 - total % 36) % 36]


def _details(**over) -> VerificationDetailsRequest:
    base = dict(
        entity_type="company", gstin=_gstin(), pan=PAN, business_email="hr@uico.test", website="https://uico.test",
        signatory_name="Uma Rao", signatory_designation="Director",
        declarations={"info_accurate": True, "authorised": True, "no_candidate_fee": True},
    )
    base.update(over)
    return VerificationDetailsRequest(**base)


def _add_docs(db, case_id, *types):
    for t in types:
        db.add(EmployerVerificationDocument(verification_id=case_id, doc_type=t, file_url=f"x/{t}.png", original_filename=f"{t}.png"))
    db.commit()


def _complete_draft(db, owner_user):
    owner_user.email_verified = True
    db.commit()
    resp = verification.save_details(owner_user, _details(), db)
    _add_docs(db, resp.id, "pan_card", "gst_certificate")
    return resp


def test_gstin_checksum_and_pan_validators():
    assert rules.validate_gstin(_gstin()) is None
    assert rules.validate_gstin(_gstin()[:-1] + "0") is not None or _gstin()[-1] == "0"
    assert rules.validate_pan("bad") is not None
    assert rules.validate_pan(PAN) is None


def test_invalid_ids_are_rejected_with_field_errors(db, owner_and_company):
    owner_user, _ = owner_and_company
    with pytest.raises(verification.InvalidDetailsError) as e:
        verification.save_details(owner_user, _details(gstin="29ABCDE1234F1Z5", pan="nope"), db)
    assert set(e.value.errors) == {"gstin", "pan"}


def test_draft_is_not_in_admin_queue_and_submit_needs_everything(db, owner_and_company):
    owner_user, _ = owner_and_company
    owner_user.email_verified = True
    db.commit()
    resp = verification.save_details(owner_user, _details(declarations={}), db)
    assert resp.status == "draft" and resp.missing and not resp.can_submit
    assert all(v.id != resp.id for v in list_employer_verifications(db))        # drafts stay private
    with pytest.raises(BadRequestException):
        verification.submit(owner_user, db)


def test_submit_sets_requested_status_visible_to_admin_queue(db, owner_and_company):
    owner_user, company = owner_and_company
    draft = _complete_draft(db, owner_user)
    with patch("app.core.notifications.notify"):
        result = verification.submit(owner_user, db)

    assert result.status == "requested"
    assert any(m.id == result.id for m in list_employer_verifications(db, status="requested"))
    assert list_employer_verifications(db, status="pending") == []             # 'pending' was never a real status
    db.refresh(company)
    assert company.verification_status == "pending"
    assert draft.id == result.id


def test_approval_is_company_wide_and_state_machine_is_enforced(db, owner_and_company):
    owner_user, company = owner_and_company
    _complete_draft(db, owner_user)
    with patch("app.core.notifications.notify"):
        case = verification.submit(owner_user, db)
        admin_id = str(owner_user.id)          # actor id only needs to be a valid UUID for the audit trail

        with pytest.raises(ValueError):
            review_employer_verification(case.id, "reject", None, None, admin_id, db)            # needs a reason code
        review_employer_verification(case.id, "approve", "GST + PAN match", None, admin_id, db)

        with pytest.raises(ValueError):
            review_employer_verification(case.id, "reject", None, "x", admin_id, db, reason_code="OTHER")   # approved is final here
    db.refresh(company)
    assert company.verification_status == "verified" and company.verified_at is not None
    from app.models.user import EmployerProfile
    assert all(p.is_approved for p in db.query(EmployerProfile).filter(EmployerProfile.company_id == company.id).all())


def test_rejected_document_blocks_approval_until_replaced(db, owner_and_company):
    owner_user, _ = owner_and_company
    _complete_draft(db, owner_user)
    with patch("app.core.notifications.notify"):
        case = verification.submit(owner_user, db)
        doc = db.query(EmployerVerificationDocument).filter_by(verification_id=case.id, doc_type="pan_card").one()
        admin_id = str(owner_user.id)
        with pytest.raises(ValueError):
            review_verification_document(case.id, str(doc.id), "rejected", None, admin_id, db)   # a note is required
        review_verification_document(case.id, str(doc.id), "rejected", "Blurry", admin_id, db)
        with pytest.raises(ValueError):
            review_employer_verification(case.id, "approve", None, None, admin_id, db)
        detail = review_employer_verification(case.id, "request_info", None, None, admin_id, db, info_request="Re-upload PAN")
    assert detail.status == "needs_info"
    again = verification.get_status(owner_user, db)
    assert again.can_edit and again.info_request == "Re-upload PAN"
