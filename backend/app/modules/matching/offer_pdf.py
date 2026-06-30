"""Offer letter PDF generator — uses reportlab (already a project dependency).

Produces a professional, print-ready A4 offer letter.
No external API required — runs entirely in-process.
"""
from __future__ import annotations

import io
from datetime import date


def generate_offer_letter_pdf(
    *,
    candidate_name: str,
    candidate_email: str,
    role_title: str,
    company_name: str,
    company_address: str,
    hiring_manager_name: str,
    hiring_manager_designation: str,
    salary_ctc: str,
    start_date: str,
    work_location: str,
    employment_type: str,
    offer_date: str | None = None,
    extra_clauses: str | None = None,
) -> bytes:
    """Return raw PDF bytes for a signed offer letter."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
        )
    except ImportError as exc:
        raise RuntimeError("reportlab is not installed.") from exc

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Offer Letter — {candidate_name}",
        author=company_name,
    )

    NAVY  = colors.HexColor("#1E3A5F")
    TEAL  = colors.HexColor("#0EA5E9")
    GREY  = colors.HexColor("#374151")
    LGREY = colors.HexColor("#6B7280")
    LIGHT = colors.HexColor("#F0F6FF")
    WHITE = colors.white

    def sty(name, **kw):
        return ParagraphStyle(name, **kw)

    CO_NAME = sty("CoName", fontName="Helvetica-Bold", fontSize=18, textColor=NAVY, alignment=TA_CENTER, spaceAfter=1)
    CO_ADDR = sty("CoAddr", fontName="Helvetica", fontSize=8, textColor=LGREY, alignment=TA_CENTER, spaceAfter=0)
    HEADING = sty("Heading", fontName="Helvetica-Bold", fontSize=13, textColor=NAVY, alignment=TA_CENTER, spaceBefore=6, spaceAfter=4)
    LABEL   = sty("Label",   fontName="Helvetica-Bold", fontSize=9,  textColor=NAVY)
    VALUE   = sty("Value",   fontName="Helvetica",      fontSize=9,  textColor=GREY)
    BODY    = sty("Body",    fontName="Helvetica",      fontSize=9,  textColor=GREY,  leading=14, spaceAfter=6, alignment=TA_JUSTIFY)
    SIG_L   = sty("SigL",   fontName="Helvetica-Bold", fontSize=9,  textColor=NAVY)
    SIG_S   = sty("SigS",   fontName="Helvetica",      fontSize=8,  textColor=LGREY)
    FOOTER  = sty("Footer",  fontName="Helvetica-Oblique", fontSize=7, textColor=LGREY, alignment=TA_CENTER)

    issued = offer_date or date.today().strftime("%d %B %Y")
    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph(company_name, CO_NAME))
    if company_address:
        story.append(Paragraph(company_address, CO_ADDR))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=TEAL, spaceAfter=4))

    story.append(Paragraph("OFFER OF EMPLOYMENT", HEADING))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceAfter=6))

    # ── Key details table ─────────────────────────────────────────────────────
    details = [
        ("Date of Offer",        issued),
        ("Candidate Name",       candidate_name),
        ("Email",                candidate_email),
        ("Position Offered",     role_title),
        ("Employment Type",      employment_type),
        ("Work Location",        work_location),
        ("Proposed Start Date",  start_date),
        ("Annual CTC",           salary_ctc),
    ]
    tdata = [[Paragraph(k, LABEL), Paragraph(v, VALUE)] for k, v in details]
    t = Table(tdata, colWidths=[50 * mm, None])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), WHITE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
        ("BOX",         (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("INNERGRID",   (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 6 * mm))

    # ── Body paragraphs ───────────────────────────────────────────────────────
    story.append(Paragraph(f"Dear {candidate_name},", BODY))
    story.append(Paragraph(
        f"We are pleased to extend this offer of employment to you for the position of "
        f"<b>{role_title}</b> at <b>{company_name}</b>. This offer is contingent upon the "
        f"successful completion of reference checks and any other pre-employment screening "
        f"required by company policy.",
        BODY,
    ))
    story.append(Paragraph(
        f"Your employment is proposed to commence on <b>{start_date}</b> and will be based "
        f"at <b>{work_location}</b> on a <b>{employment_type}</b> basis. "
        f"Your total annual Cost to Company (CTC) will be <b>{salary_ctc}</b>, "
        f"subject to applicable statutory deductions.",
        BODY,
    ))
    story.append(Paragraph(
        "This offer remains valid for <b>7 days</b> from the date above. To accept, please "
        "sign and return a copy of this letter. Failure to respond within this period will "
        "be treated as a non-acceptance of the offer.",
        BODY,
    ))

    if extra_clauses and extra_clauses.strip():
        story.append(Paragraph("Additional Terms &amp; Conditions", sty("AT", fontName="Helvetica-Bold", fontSize=9, textColor=NAVY, spaceBefore=4, spaceAfter=2)))
        for line in extra_clauses.strip().split("\n"):
            if line.strip():
                story.append(Paragraph(f"• {line.strip()}", BODY))

    story.append(Paragraph(
        "We look forward to welcoming you to the team and are excited about the contributions "
        "you will bring. Please do not hesitate to reach out if you have any questions.",
        BODY,
    ))
    story.append(Spacer(1, 8 * mm))

    # ── Signature block ───────────────────────────────────────────────────────
    sig_data = [
        [
            Paragraph("For " + company_name, SIG_L),
            Paragraph("Candidate Acceptance", SIG_L),
        ],
        [
            Spacer(1, 12 * mm),
            Spacer(1, 12 * mm),
        ],
        [
            HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1")),
            HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1")),
        ],
        [
            Paragraph(hiring_manager_name, SIG_L),
            Paragraph(candidate_name, SIG_L),
        ],
        [
            Paragraph(hiring_manager_designation, SIG_S),
            Paragraph("Date: ___________________", SIG_S),
        ],
    ]
    sig_t = Table(sig_data, colWidths=["50%", "50%"], hAlign="LEFT")
    sig_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_t)
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceAfter=3))
    story.append(Paragraph(
        f"This document is confidential and intended solely for {candidate_name}. "
        f"Generated by {company_name} via Disha AI Platform.",
        FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()
