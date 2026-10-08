"""Rules for employer (company) verification: what each entity type must provide,
format validators for Indian registry IDs, and the cheap automatic checks shown
to reviewers. No network calls — registry lookups stay a manual reviewer step.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

ENTITY_TYPES = ("company", "proprietorship_partnership", "ngo_trust", "government", "agency")

ENTITY_LABELS = {
    "company": "Company / LLP / startup",
    "proprietorship_partnership": "Proprietorship, partnership or coaching institute",
    "ngo_trust": "NGO, trust, society or think tank",
    "government": "Government or government-adjacent body",
    "agency": "Placement agency, consultancy or freelance recruiter",
}

DOC_LABELS = {
    "gst_certificate": "GST registration certificate",
    "pan_card": "PAN card of the entity",
    "company_registration": "Certificate of incorporation / LLP registration",
    "business_email": "Proof of official email (optional)",
    "udyam_certificate": "Udyam (MSME) certificate",
    "shops_establishment": "Shops & Establishment licence",
    "partnership_deed": "Partnership deed / firm registration",
    "ngo_registration": "Trust deed / society registration certificate / NGO Darpan record",
    "tax_exemption_12a": "12A / 80G certificate (optional)",
    "signatory_authorisation": "Authorisation letter / board resolution",
    "address_proof": "Address proof (utility bill, lease or bank letter)",
    "other": "Other supporting document",
}

DECLARATIONS = {
    "info_accurate": "The information and documents I have provided are accurate and genuine.",
    "authorised": "I am authorised to represent this organisation on BeginablAI.",
    "no_candidate_fee": "This organisation will never charge candidates any fee for jobs, interviews or training.",
}

FREE_MAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in", "outlook.com", "hotmail.com",
    "live.com", "rediffmail.com", "icloud.com", "proton.me", "protonmail.com", "aol.com", "ymail.com",
    "mail.com", "zoho.com", "gmx.com",
}
GOV_DOMAIN_SUFFIXES = (".gov.in", ".nic.in", ".ac.in", ".edu.in", ".res.in")

# Reason codes a reviewer can attach to a rejection. FATAL ones block self-service resubmission.
REASON_CODES = {
    "ENTITY_NOT_FOUND": "We could not find this organisation in the government registry.",
    "REGISTRY_INACTIVE": "The registration is inactive, cancelled or struck off.",
    "NAME_MISMATCH": "Names do not match across the documents, registry and website.",
    "DOCUMENT_ILLEGIBLE_OR_ALTERED": "A document is unreadable or appears altered.",
    "DOMAIN_MISMATCH_OR_FREE_EMAIL": "The email domain does not match the organisation.",
    "NO_AUTHORISATION": "We could not confirm you are authorised to act for the organisation.",
    "UNABLE_TO_CONTACT": "We were unable to reach the organisation to confirm the details.",
    "DUPLICATE_ACCOUNT": "This organisation is already registered with another account.",
    "PROHIBITED_BUSINESS_MODEL": "The business model is not allowed (for example, fees charged to candidates).",
    "OTHER": "See the note from our review team.",
}
FATAL_REASON_CODES = {"DUPLICATE_ACCOUNT", "PROHIBITED_BUSINESS_MODEL"}
MAX_REJECTED_ATTEMPTS = 3

# ── Format validators ─────────────────────────────────────────────────────────

_GSTIN_RE = re.compile(r"^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$")
_PAN_RE = re.compile(r"^[A-Z]{5}\d{4}[A-Z]$")
_CIN_RE = re.compile(r"^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$")
_LLPIN_RE = re.compile(r"^[A-Z]{3}-\d{4}$")
_UDYAM_RE = re.compile(r"^UDYAM-[A-Z]{2}-\d{2}-\d{7}$")
_DARPAN_RE = re.compile(r"^[A-Z]{2}/\d{4}/\d{7}$")
_GST_STATE_CODES = set(range(1, 39)) | {97, 99}
_GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _gstin_checksum_ok(gstin: str) -> bool:
    total = 0
    for i, ch in enumerate(gstin[:14]):
        value = _GSTIN_CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += value // 36 + value % 36
    expected = _GSTIN_CHARS[(36 - total % 36) % 36]
    return expected == gstin[14]


def normalise(value: str | None) -> str | None:
    if value is None:
        return None
    v = re.sub(r"\s+", "", value).upper()
    return v or None


def validate_gstin(v: str) -> str | None:
    m = _GSTIN_RE.match(v)
    if not m:
        return "GSTIN must be 15 characters, e.g. 07AABCT1234A1Z5."
    if int(m.group(1)) not in _GST_STATE_CODES:
        return "GSTIN starts with an invalid state code."
    if not _gstin_checksum_ok(v):
        return "This GSTIN fails its checksum — please re-check the number."
    return None


def validate_pan(v: str) -> str | None:
    return None if _PAN_RE.match(v) else "PAN must look like ABCDE1234F."


def validate_cin(v: str) -> str | None:
    return None if _CIN_RE.match(v) else "CIN must be 21 characters, e.g. U12345DL2020PTC123456."


def validate_llpin(v: str) -> str | None:
    return None if _LLPIN_RE.match(v) else "LLPIN must look like AAA-1234."


def validate_udyam(v: str) -> str | None:
    return None if _UDYAM_RE.match(v) else "Udyam number must look like UDYAM-DL-01-1234567."


def validate_darpan(v: str) -> str | None:
    return None if _DARPAN_RE.match(v) else "NGO Darpan ID must look like DL/2020/0123456."


ID_VALIDATORS = {
    "gstin": validate_gstin, "pan": validate_pan, "cin": validate_cin,
    "llpin": validate_llpin, "udyam": validate_udyam, "darpan_id": validate_darpan,
}
ID_FIELDS = tuple(ID_VALIDATORS) + ("registration_number",)


def email_domain(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[1].strip().lower()


def website_domain(website: str | None) -> str | None:
    if not website:
        return None
    parsed = urlparse(website if "://" in website else "https://" + website)
    host = (parsed.hostname or "").lower()
    return host[4:] if host.startswith("www.") else host or None


def clean_details(raw: dict) -> tuple[dict, dict[str, str]]:
    """Normalise submitted details and return (clean, field_errors)."""
    d: dict = {}
    errors: dict[str, str] = {}
    for key in ID_FIELDS:
        val = normalise(raw.get(key))
        if key == "registration_number" and raw.get(key):
            val = re.sub(r"\s+", " ", str(raw[key]).strip())[:60]
        if val:
            d[key] = val
            validator = ID_VALIDATORS.get(key)
            err = validator(val) if validator else None
            if err:
                errors[key] = err
    for key in ("business_email", "website", "signatory_name", "signatory_designation", "registered_address"):
        val = (raw.get(key) or "").strip()
        if val:
            d[key] = val.lower() if key == "business_email" else val[:300]
    if d.get("business_email") and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", d["business_email"]):
        errors["business_email"] = "Enter a valid official email address."
    decl = raw.get("declarations") or {}
    d["declarations"] = {k: bool(decl.get(k)) for k in DECLARATIONS}
    return d, errors


# ── Requirements per entity type ──────────────────────────────────────────────

@dataclass(frozen=True)
class Requirement:
    ids_any_of: tuple[str, ...]            # at least one registry ID from this list
    always: tuple[str, ...]                # fields that must be present
    docs_all: tuple[str, ...]              # documents that must be uploaded
    docs_any_of: tuple[str, ...] = ()      # at least one of these documents
    docs_optional: tuple[str, ...] = ()


_ALWAYS = ("business_email", "signatory_name", "signatory_designation")

REQUIREMENTS: dict[str, Requirement] = {
    "company": Requirement(("cin", "llpin", "gstin"), ("pan",) + _ALWAYS, ("pan_card",),
                           ("company_registration", "gst_certificate"), ("signatory_authorisation", "address_proof")),
    "proprietorship_partnership": Requirement(("gstin", "udyam", "registration_number"), ("pan",) + _ALWAYS, ("pan_card",),
                                              ("gst_certificate", "udyam_certificate", "shops_establishment", "partnership_deed"),
                                              ("signatory_authorisation", "address_proof")),
    "ngo_trust": Requirement(("darpan_id", "registration_number"), ("pan",) + _ALWAYS, ("pan_card", "ngo_registration"),
                             (), ("tax_exemption_12a", "signatory_authorisation", "address_proof")),
    "government": Requirement((), _ALWAYS, ("signatory_authorisation",), (), ("address_proof",)),
    "agency": Requirement(("gstin", "udyam"), ("pan",) + _ALWAYS, ("pan_card",),
                          ("gst_certificate", "udyam_certificate"), ("signatory_authorisation", "address_proof")),
}

FIELD_LABELS = {
    "cin": "CIN", "llpin": "LLPIN", "gstin": "GSTIN", "udyam": "Udyam number", "darpan_id": "NGO Darpan ID",
    "registration_number": "Trust / society registration number", "pan": "PAN of the organisation",
    "business_email": "Official business email", "signatory_name": "Authorised person's name",
    "signatory_designation": "Authorised person's designation",
    "domain": "This email domain",
}


def checklist(entity_type: str | None) -> dict:
    """What the employer UI shows as 'you need to provide'."""
    req = REQUIREMENTS.get(entity_type or "")
    if not req:
        return {}
    return {
        "ids_any_of": [{"field": f, "label": FIELD_LABELS[f]} for f in req.ids_any_of],
        "fields": [{"field": f, "label": FIELD_LABELS[f]} for f in req.always],
        "documents_required": [{"doc_type": t, "label": DOC_LABELS[t]} for t in req.docs_all],
        "documents_any_of": [{"doc_type": t, "label": DOC_LABELS[t]} for t in req.docs_any_of],
        "documents_optional": [{"doc_type": t, "label": DOC_LABELS[t]} for t in req.docs_optional],
        "declarations": [{"key": k, "label": v} for k, v in DECLARATIONS.items()],
    }


def missing_items(entity_type: str | None, details: dict, uploaded_doc_types: set[str]) -> list[str]:
    """Human-readable list of what is still missing before submission."""
    req = REQUIREMENTS.get(entity_type or "")
    if not req:
        return ["Choose what kind of organisation you are."]
    d = details or {}
    out: list[str] = []
    if req.ids_any_of and not any(d.get(f) for f in req.ids_any_of):
        out.append("Enter one of: " + " / ".join(FIELD_LABELS[f] for f in req.ids_any_of) + ".")
    for f in req.always:
        if not d.get(f):
            out.append(f"{FIELD_LABELS[f]} is required.")
    for t in req.docs_all:
        if t not in uploaded_doc_types:
            out.append(f"Upload: {DOC_LABELS[t]}.")
    if req.docs_any_of and not (set(req.docs_any_of) & uploaded_doc_types):
        out.append("Upload at least one of: " + " / ".join(DOC_LABELS[t] for t in req.docs_any_of) + ".")
    decl = d.get("declarations") or {}
    for k, label in DECLARATIONS.items():
        if not decl.get(k):
            out.append(f"Please accept: {label}")
    if entity_type == "government":
        dom = email_domain(d.get("business_email"))
        if dom and not dom.endswith(GOV_DOMAIN_SUFFIXES):
            out.append("Government bodies must use an official .gov.in / .nic.in / .ac.in / .edu.in email address.")
    return out


# ── Automatic checks (shown to reviewers and, softly, to the employer) ───────

def auto_checks(entity_type: str | None, details: dict, *, account_email: str | None, email_verified: bool,
                duplicates: dict[str, int]) -> list[dict]:
    d = details or {}
    checks: list[dict] = []

    def add(code: str, level: str, message: str) -> None:
        checks.append({"code": code, "level": level, "message": message})

    add("account_email_verified", "ok" if email_verified else "fail",
        "Account email was verified by OTP." if email_verified else "The account email has not been verified yet.")

    for f in ("gstin", "pan", "cin", "llpin", "udyam", "darpan_id"):
        if d.get(f):
            err = ID_VALIDATORS[f](d[f])
            add(f"{f}_format", "fail" if err else "ok", err or f"{FIELD_LABELS[f]} format is valid.")

    gstin, pan = d.get("gstin"), d.get("pan")
    if gstin and not validate_gstin(gstin):
        if pan and not validate_pan(pan):
            same = gstin[2:12] == pan
            add("gstin_pan_match", "ok" if same else "fail",
                "PAN embedded in the GSTIN matches the PAN entered." if same else
                "The PAN inside the GSTIN does not match the PAN entered.")
        else:
            add("gstin_pan_match", "warn", "Company PAN not entered, so it could not be matched with the GSTIN.")
    if pan and not validate_pan(pan):
        fourth = pan[3]
        expected = {"company": "C", "ngo_trust": "TAC", "proprietorship_partnership": "PFHL", "agency": "PFCHL"}.get(entity_type or "")
        if expected and fourth not in expected:
            add("pan_entity_type", "warn", f"PAN 4th letter '{fourth}' is unusual for this organisation type.")
        else:
            add("pan_entity_type", "ok", "PAN type is consistent with the organisation type.")

    dom, site = email_domain(d.get("business_email")), website_domain(d.get("website"))
    if dom:
        if dom in FREE_MAIL_DOMAINS:
            add("email_domain", "warn", f"Business email uses a free-mail domain ({dom}); ask for an official-domain email or extra proof.")
        elif entity_type == "government":
            ok = dom.endswith(GOV_DOMAIN_SUFFIXES)
            add("email_domain", "ok" if ok else "fail", "Official government domain." if ok else "Not an official government/academic domain.")
        elif site:
            match = dom == site or dom.endswith("." + site) or site.endswith("." + dom)
            add("email_domain", "ok" if match else "warn",
                "Email domain matches the website." if match else f"Email domain ({dom}) does not match the website ({site}).")
        else:
            add("email_domain", "warn", "No website provided to compare with the email domain.")
        if account_email and email_domain(account_email) != dom:
            add("account_vs_business_email", "warn", "Business email differs from the login email; confirm they are the same person.")

    for field, count in duplicates.items():
        if count:
            add(f"duplicate_{field}", "fail", f"{FIELD_LABELS.get(field, field)} is already used by {count} other company account(s).")
    return checks


def has_blocking_failure(checks: list[dict]) -> bool:
    return any(c["level"] == "fail" for c in checks)
