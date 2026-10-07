"""Regression test for the employer-audit request: "check and verify the
[KYC] verification flow completely."

Found while auditing: the admin dashboard's "Pending Review" KYC panel
(frontend/src/modules/admin/pages/AdminDashboard.tsx) called
useEmployerVerifications('pending') — but request_verification() below has
only ever set status="requested", never "pending". The filter is an exact
string match (admin/service/employers.py::list_employer_verifications), so
that panel silently returned zero rows forever, even with real pending
requests sitting in the queue. This test pins the actual status value so a
future rename doesn't silently reintroduce the mismatch.
"""
from __future__ import annotations

from unittest.mock import patch

from app.modules.admin.service.employers import list_employer_verifications
from app.modules.jobs.service import request_verification


def test_request_verification_sets_requested_status(db, owner_and_company):
    owner_user, _company = owner_and_company

    with patch("app.core.notifications.notify"):
        result = request_verification(owner_user, db)

    assert result.status == "requested"

    # The exact string the admin dashboard's "pending" panel must filter by.
    matches = list_employer_verifications(db, status="requested")
    assert any(m.id == result.id for m in matches)

    # Confirms the historical bug: "pending" was never a real status value.
    assert list_employer_verifications(db, status="pending") == []
