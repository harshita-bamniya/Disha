"""
Resume PDF export — Module 06.

Converts resume section JSON into a polished, ATS-safe PDF using reportlab's
Platypus layout engine.  reportlab is imported lazily inside generate_pdf() so
the module is safe to import at server startup even before the package is
installed in the Docker image.  The 500 in the export endpoint handles the case
where reportlab is truly missing.

Section JSON shapes handled:
  summary      → { text, contact: { email, phone, location, linkedin } }
  experience   → { items: [ { title, company, start_date, end_date, bullets } ] }
  education    → { items: [ { degree, field, institution, year } ] }
  skills       → { technical: [], soft: [], domain: [] }
  achievements → { items: [] }
  projects     → { items: [ { name, description, technologies, url } ] }
  certifications → { items: [ { name, issuer, year } ] }
  languages    → { items: [] }
"""
from __future__ import annotations

import io
import logging
from typing import Any

logger = logging.getLogger(__name__)

_SECTION_LABELS = {
    "summary":        "Professional Summary",
    "experience":     "Work Experience",
    "education":      "Education",
    "skills":         "Skills",
    "achievements":   "Achievements",
    "projects":       "Projects",
    "certifications": "Certifications",
    "languages":      "Languages",
}


def _safe_str(v: Any, default: str = "") -> str:
    return str(v).strip() if v else default


def generate_pdf(
    candidate_name: str,
    resume_title: str,
    sections: list[dict],
) -> bytes:
    """
    Build and return a PDF resume as bytes.

    Args:
        candidate_name: User's full name — shown in the header.
        resume_title:   Resume title (e.g. "Policy Analyst Resume").
        sections:       List of dicts with keys: section_type, title, content, sort_order.

    Returns:
        Raw PDF bytes (starts with b'%PDF').

    Raises:
        RuntimeError: if reportlab is not installed.
    """
    # ── Lazy import — safe at startup, fails only when actually called ─────────
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
        )
    except ImportError as exc:
        raise RuntimeError(
            "reportlab is not installed. Run: pip install reportlab==4.2.5"
        ) from exc

    # ── Colour palette ─────────────────────────────────────────────────────────
    NAVY  = colors.HexColor("#1a3557")
    TEAL  = colors.HexColor("#2a7d7b")
    GREY  = colors.HexColor("#555555")
    LIGHT = colors.HexColor("#f0f4f8")
    WHITE = colors.white

    # ── Styles ─────────────────────────────────────────────────────────────────
    H1 = ParagraphStyle(
        "H1", fontName="Helvetica-Bold", fontSize=20, textColor=NAVY,
        alignment=TA_CENTER, spaceAfter=2,
    )
    H1_SUB = ParagraphStyle(
        "H1Sub", fontName="Helvetica", fontSize=9, textColor=TEAL,
        alignment=TA_CENTER, spaceAfter=0,
    )
    SEC_TITLE = ParagraphStyle(
        "SecTitle", fontName="Helvetica-Bold", fontSize=10, textColor=NAVY,
        spaceBefore=10, spaceAfter=2, leading=14,
    )
    JOB_TITLE = ParagraphStyle(
        "JobTitle", fontName="Helvetica-Bold", fontSize=9.5, textColor=GREY,
        spaceAfter=0, leading=13,
    )
    DATE_ST = ParagraphStyle(
        "Date", fontName="Helvetica-Oblique", fontSize=8.5, textColor=TEAL,
        alignment=TA_LEFT, spaceAfter=1,
    )
    BODY = ParagraphStyle(
        "Body", fontName="Helvetica", fontSize=9, textColor=GREY,
        leading=13, spaceAfter=3,
    )
    BULLET = ParagraphStyle(
        "Bullet", fontName="Helvetica", fontSize=9, textColor=GREY,
        leading=12, spaceAfter=1, leftIndent=10,
    )
    FOOTER = ParagraphStyle(
        "Footer", fontName="Helvetica-Oblique", fontSize=7,
        textColor=colors.grey, alignment=TA_CENTER,
    )

    # ── Inner helpers (close over style names) ─────────────────────────────────

    def hr(width: float = 1):
        return HRFlowable(width="100%", thickness=width, color=NAVY, spaceAfter=4, spaceBefore=2)

    def section_heading(title: str) -> list:
        return [Paragraph(title.upper(), SEC_TITLE), hr(0.8)]

    def bullet_para(text: str):
        return Paragraph(f"• {text}", BULLET)

    def two_col(left_text: str, right_text: str):
        """Left-heavy two-column table row."""
        tbl = Table(
            [[Paragraph(left_text, JOB_TITLE), Paragraph(right_text, DATE_ST)]],
            colWidths=["70%", "30%"],
        )
        tbl.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (0,  0),  0),
            ("RIGHTPADDING",  (1, 0), (1,  0),  0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        return tbl

    # ── Section renderers ──────────────────────────────────────────────────────

    def render_summary(content: dict) -> list:
        story = []
        text = _safe_str(content.get("text")).replace("\n", "<br/>")
        if text:
            story.append(Paragraph(text, BODY))
        contact = content.get("contact") or {}
        parts = [_safe_str(contact.get(k)) for k in ("email", "phone", "location", "linkedin") if contact.get(k)]
        if parts:
            story.append(Paragraph(" · ".join(parts), H1_SUB))
        return story

    def render_experience(content: dict) -> list:
        story = []
        items = content.get("items") or content.get("entries") or []
        for idx, item in enumerate(items):
            title   = _safe_str(item.get("title") or item.get("role"))
            company = _safe_str(item.get("company") or item.get("organisation"))
            start   = _safe_str(item.get("start_date") or item.get("from"))
            end     = _safe_str(item.get("end_date") or item.get("to"), "Present")
            bullets = item.get("bullets") or item.get("responsibilities") or []
            story.append(two_col(f"<b>{title}</b> — {company}", f"{start} – {end}"))
            for b in bullets:
                if b:
                    story.append(bullet_para(_safe_str(b)))
            if idx < len(items) - 1:
                story.append(Spacer(1, 4))
        return story

    def render_education(content: dict) -> list:
        story = []
        for item in (content.get("items") or content.get("entries") or []):
            degree = _safe_str(item.get("degree"))
            field  = _safe_str(item.get("field") or item.get("field_of_study"))
            inst   = _safe_str(item.get("institution") or item.get("university"))
            year   = _safe_str(item.get("year") or item.get("graduation_year"))
            label  = f"{degree}{' in ' + field if field else ''}" if degree else field
            story.append(two_col(f"<b>{label}</b> — {inst}", year))
        return story

    def render_skills(content: dict) -> list:
        story = []
        rows = []
        for cat, key in [("Technical", "technical"), ("Domain", "domain"), ("Soft", "soft")]:
            skills = content.get(key) or []
            if skills:
                rows.append([
                    Paragraph(f"<b>{cat}</b>", BODY),
                    Paragraph(" · ".join(_safe_str(s) for s in skills if s), BODY),
                ])
        if not rows:
            flat = content.get("items") or []
            if flat:
                story.append(Paragraph(" · ".join(_safe_str(s) for s in flat), BODY))
            return story
        tbl = Table(rows, colWidths=["22%", "78%"])
        tbl.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (0,  -1), 0),
            ("ROWBACKGROUNDS",(0, 0), (-1, -1), [LIGHT, WHITE]),
        ]))
        story.append(tbl)
        return story

    def render_achievements(content: dict) -> list:
        return [bullet_para(_safe_str(i)) for i in (content.get("items") or []) if i]

    def render_projects(content: dict) -> list:
        story = []
        for item in (content.get("items") or content.get("entries") or []):
            name = _safe_str(item.get("name") or item.get("title"))
            desc = _safe_str(item.get("description") or item.get("summary"))
            tech = item.get("technologies") or item.get("tech_stack") or []
            if name:
                story.append(Paragraph(f"<b>{name}</b>", JOB_TITLE))
            if desc:
                story.append(Paragraph(desc, BODY))
            if tech:
                story.append(Paragraph("Tech: " + ", ".join(_safe_str(t) for t in tech), BODY))
            story.append(Spacer(1, 3))
        return story

    def render_certifications(content: dict) -> list:
        story = []
        for item in (content.get("items") or content.get("entries") or []):
            if isinstance(item, str):
                story.append(bullet_para(item))
            else:
                name   = _safe_str(item.get("name") or item.get("title"))
                issuer = _safe_str(item.get("issuer") or item.get("organization"))
                year   = _safe_str(item.get("year") or item.get("date"))
                line   = name + (f" — {issuer}" if issuer else "") + (f" ({year})" if year else "")
                story.append(bullet_para(line))
        return story

    def render_languages(content: dict) -> list:
        story = []
        for item in (content.get("items") or []):
            if isinstance(item, str):
                story.append(bullet_para(item))
            elif isinstance(item, dict):
                lang  = _safe_str(item.get("language") or item.get("name"))
                prof  = _safe_str(item.get("proficiency") or item.get("level"))
                story.append(bullet_para(f"{lang} — {prof}" if prof else lang))
        return story

    RENDERERS = {
        "summary":        render_summary,
        "experience":     render_experience,
        "education":      render_education,
        "skills":         render_skills,
        "achievements":   render_achievements,
        "projects":       render_projects,
        "certifications": render_certifications,
        "languages":      render_languages,
    }

    # ── Build document ─────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
        title=resume_title, author=candidate_name,
        subject="Resume — DISHA AI",
    )

    story: list = []

    # Header
    story.append(Paragraph(candidate_name or "Candidate", H1))
    if resume_title:
        story.append(Paragraph(resume_title, H1_SUB))
    story.append(hr(1.5))
    story.append(Spacer(1, 2))

    # Sections
    for sec in sorted(sections, key=lambda s: s.get("sort_order", 99)):
        sec_type = sec.get("section_type", "")
        content  = sec.get("content") or {}
        label    = _SECTION_LABELS.get(sec_type, sec.get("title") or sec_type.capitalize())
        renderer = RENDERERS.get(sec_type)

        if not renderer:
            logger.warning("[PDF] Unknown section type '%s' — skipping", sec_type)
            continue

        rendered = renderer(content)
        if not rendered:
            continue

        story.extend(section_heading(label))
        story.extend(rendered)
        story.append(Spacer(1, 4))

    # Footer
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<i>Generated with DISHA AI — Career Relaunch Platform</i>", FOOTER,
    ))

    try:
        doc.build(story)
    except Exception as exc:
        logger.exception("[PDF] Build failed: %s", exc)
        raise

    return buf.getvalue()
