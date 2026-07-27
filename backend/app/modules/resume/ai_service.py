"""AI services for the Resume Builder — skill translation and ATS optimization."""
from __future__ import annotations

import json
import logging
import re

from app.models.user import AspirantProfile, User, KrsScore, CareerTrack
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── ATS keyword scoring ──────────────────────────────────────────────────────

_ATS_POWER_VERBS = {
    "led", "managed", "developed", "implemented", "designed", "analysed",
    "coordinated", "established", "executed", "improved", "increased",
    "optimised", "achieved", "delivered", "built", "created", "launched",
    "negotiated", "drove", "reduced", "streamlined",
}


def compute_ats_score(sections: list[dict]) -> int:
    """Retained for backwards compatibility — delegates to compute_score_breakdown."""
    breakdown = compute_score_breakdown(sections)
    return breakdown["overall"]


def compute_score_breakdown(
    sections: list[dict],
    job_description: str | None = None,
) -> dict:
    """
    Structured score breakdown with 6 criteria, each 0-100 with a one-line explanation.
    Returns:
      { ats_compatibility, keyword_coverage, impact, completeness, readability, formatting, overall }
    keyword_coverage is 0/N/A when no job_description is provided.
    """
    full_text = " ".join(json.dumps(s.get("content", {})) for s in sections)
    full_lower = full_text.lower()
    words = full_lower.split()
    word_set = set(words)
    section_types = {s.get("section_type") for s in sections}

    # ── ATS Compatibility: standard sections present, no tables/graphics indicators ──
    required = {"summary", "experience", "education", "skills"}
    bonus = {"achievements", "certifications"}
    present_req = required & section_types
    ats_score = len(present_req) * 22
    ats_score += len(bonus & section_types) * 5
    ats_score = min(100, ats_score)
    missing_req = required - section_types
    if missing_req:
        ats_explanation = f"Missing required sections: {', '.join(sorted(missing_req))}."
    else:
        ats_explanation = "All core sections present — good ATS structure."

    # ── Keyword Coverage: match against job description ────────────────────────
    if not job_description:
        kw_score = 0
        kw_explanation = "No job target set — add one to see keyword match."
    else:
        jd_words = set(re.findall(r'\b[a-z]{3,}\b', job_description.lower()))
        stopwords = {"and", "the", "for", "with", "this", "that", "are", "you",
                     "will", "have", "from", "our", "your", "all", "has", "been"}
        jd_keywords = jd_words - stopwords
        if jd_keywords:
            matched = jd_keywords & word_set
            ratio = len(matched) / len(jd_keywords)
            kw_score = min(100, int(ratio * 120))
            kw_explanation = (
                f"{len(matched)} of {len(jd_keywords)} JD keywords matched."
                if kw_score < 80
                else f"Strong keyword alignment ({len(matched)}/{len(jd_keywords)})."
            )
        else:
            kw_score = 50
            kw_explanation = "Job description processed — keyword extraction found no distinct terms."

    # ── Impact: power verbs + quantified metrics ───────────────────────────────
    verb_count = len(_ATS_POWER_VERBS & word_set)
    quant_count = len(re.findall(r'\b\d[\d,.]*\s*(?:%|lakh|crore|million|billion|k\b|\+)?', full_lower))
    impact_score = min(100, verb_count * 8 + quant_count * 6)
    if impact_score < 40:
        impact_explanation = "Add more action verbs (Led, Built, Reduced…) and quantified outcomes."
    elif impact_score < 70:
        impact_explanation = "Good use of action verbs; add metrics to strengthen bullet impact."
    else:
        impact_explanation = "Strong impact language with quantified achievements."

    # ── Completeness: section content depth ───────────────────────────────────
    completeness = 0
    for s in sections:
        content = s.get("content", {})
        text_len = len(json.dumps(content))
        completeness += min(20, text_len // 50)
    completeness_score = min(100, completeness)
    if completeness_score < 50:
        completeness_explanation = "Some sections are thin — add more details and bullets."
    elif completeness_score < 80:
        completeness_explanation = "Decent coverage; expand experience bullets for depth."
    else:
        completeness_explanation = "Resume is well-populated across all sections."

    # ── Readability: sentence length, no passive voice indicators ─────────────
    passive_indicators = {"was", "were", "been", "being", "by the", "being managed", "being led"}
    passive_count = sum(1 for p in passive_indicators if p in full_lower)
    avg_word_len = (sum(len(w) for w in words) / len(words)) if words else 5
    readability_score = max(0, 100 - passive_count * 8 - max(0, avg_word_len - 6) * 10)
    readability_score = min(100, readability_score)
    if passive_count > 3:
        readability_explanation = "Rewrite passive constructions to active voice."
    elif avg_word_len > 7:
        readability_explanation = "Some sentences use complex vocabulary — simplify for clarity."
    else:
        readability_explanation = "Clear, direct language — good readability."

    # ── Formatting: consistent structure signals ───────────────────────────────
    has_contact = any(
        "email" in json.dumps(s.get("content", {})).lower()
        for s in sections if s.get("section_type") == "summary"
    )
    has_dates = bool(re.search(r'\b(20\d{2}|Present|present)\b', full_text))
    formatting_score = (40 if has_contact else 0) + (40 if has_dates else 0) + (20 if len(sections) >= 4 else 0)
    if not has_contact:
        formatting_explanation = "Add contact information to the summary section."
    elif not has_dates:
        formatting_explanation = "Add date ranges to experience/education entries."
    else:
        formatting_explanation = "Good structure with contact info and dated entries."

    overall = int(
        ats_score * 0.20
        + (kw_score or 0) * 0.20
        + impact_score * 0.25
        + completeness_score * 0.15
        + readability_score * 0.10
        + formatting_score * 0.10
    )
    # When no job description, redistribute keyword weight to other criteria
    if not job_description:
        overall = int(
            ats_score * 0.25
            + impact_score * 0.30
            + completeness_score * 0.20
            + readability_score * 0.15
            + formatting_score * 0.10
        )
    overall = max(0, min(100, overall))

    return {
        "ats_compatibility":  {"score": ats_score,          "explanation": ats_explanation},
        "keyword_coverage":   {"score": kw_score,           "explanation": kw_explanation},
        "impact":             {"score": impact_score,        "explanation": impact_explanation},
        "completeness":       {"score": completeness_score,  "explanation": completeness_explanation},
        "readability":        {"score": readability_score,   "explanation": readability_explanation},
        "formatting":         {"score": formatting_score,    "explanation": formatting_explanation},
        "overall":            overall,
    }


# ─── Interactive co-pilot: missing-info detection ─────────────────────────────

def get_next_question(
    profile: AspirantProfile | None,
    career_track: CareerTrack | None,
    job_context=None,
    answers: dict | None = None,
) -> dict | None:
    """
    Deterministically decide the next clarifying question to ask before
    generating the resume, or None if we have enough to proceed.

    Only asks about information that materially changes resume quality —
    target role, work-experience specifics, and a project to showcase.
    """
    answers = answers or {}

    has_target = bool(job_context and job_context.job_title) or bool(career_track)
    if not has_target and not answers.get("target_role"):
        return {
            "id": "target_role",
            "section": "summary",
            "question": "Which role are you applying for, and which industry are you targeting? "
                         "(e.g. \"Data Analyst in fintech\")",
        }

    if profile and profile.has_work_experience and not answers.get("work_experience_detail"):
        role = profile.last_designation or "a professional"
        domain = profile.work_experience_domain or "your previous role"
        return {
            "id": "work_experience_detail",
            "section": "experience",
            "question": f"While building your experience section — what were your primary "
                        f"responsibilities, key achievements, and technologies used as {role} "
                        f"in {domain}?",
        }

    if not answers.get("project_detail") and not answers.get("project_detail_skip"):
        return {
            "id": "project_detail",
            "section": "projects",
            "question": "Do you have a project you'd like to showcase? Tell me the tech stack, "
                        "the problem it solved, and the outcome — or reply \"skip\" if you don't "
                        "have one.",
        }

    return None


# ─── AI resume generation ─────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an expert resume writer who specialises in helping UPSC civil services \
aspirants transition to private-sector careers in India.

TASK: Write a complete, personalised professional resume in JSON format using \
ONLY the real candidate data provided. Every field must contain genuine content — \
no placeholders, no template text, no "e.g." examples.

RULES:
1. Use ONLY the candidate's actual name, degree, institution, skills, and UPSC stage.
2. Translate UPSC preparation into concrete corporate skills with specifics.
3. All bullet points must start with a strong action verb (Led, Analysed, Developed…).
4. Include at least one number or metric per experience bullet where plausible.
5. Return ONLY valid minified JSON — no markdown, no code fences, no explanation.
6. All arrays use the key "items" (never "entries").
7. NEVER use these phrases anywhere in the resume: "dedicated", "passionate", "leveraging", "poised to", "aspiring", "eager to", "looking to", "seeking a role", "with a strong foundation in", "honed", "dynamic professional". These are meaningless filler — replace them with specific facts.\
"""


def build_generation_prompt(
    profile: AspirantProfile | None,
    career_track: CareerTrack | None,
    job_context=None,  # AiGenerateJobContext | None — avoids circular import
    answers: dict | None = None,
) -> tuple[str, str]:
    """Build system + user prompt for full resume generation."""
    answers = answers or {}

    # ── Candidate facts ────────────────────────────────────────────────────────
    name            = (profile.full_name          if profile else None) or "Candidate"
    degree          = (profile.degree              if profile else None) or "Bachelor's"
    field           = (profile.field_of_study      if profile else None) or "Arts"
    institution     = (profile.institution         if profile else None) or "University"
    grad_year       = (profile.graduation_year     if profile else None) or "N/A"
    years_prep      = (profile.years_preparing     if profile else None) or 1
    attempts        = (profile.upsc_attempts       if profile else None) or 0
    stage           = (profile.highest_stage_cleared if profile else None) or "Prelims"
    optional_subj   = (profile.optional_subject    if profile else None) or "General Studies"
    profile_skills  = (profile.skills              if profile else None) or []

    work_exp_str = "No prior work experience"
    if profile and profile.has_work_experience and profile.work_experience_years:
        work_exp_str = (
            f"{profile.work_experience_years} years as "
            f"{profile.last_designation or 'professional'} in "
            f"{profile.work_experience_domain or 'unspecified domain'}"
        )
    if answers.get("work_experience_detail"):
        work_exp_str += f". Candidate's own description: {answers['work_experience_detail']}"

    project_str = ""
    if answers.get("project_detail"):
        project_str = f"\n\nPROJECT TO INCLUDE (candidate's own description): {answers['project_detail']}"

    # ── Target role ────────────────────────────────────────────────────────────
    if answers.get("target_role"):
        target_role = answers["target_role"]
    elif job_context and job_context.job_title:
        target_role = f"{job_context.job_title} at {job_context.company_name or 'the company'}"
    else:
        target_role = career_track.title if career_track else "private sector"

    # ── Skills list — boost job-required skills to front ──────────────────────
    all_skills = list(profile_skills)
    if job_context and job_context.required_skills:
        extra = [s for s in job_context.required_skills if s not in all_skills]
        all_skills = all_skills + extra[:5]
    skills_str = ", ".join(all_skills) if all_skills else "Research, Analysis, Communication"

    # ── Job description hint ───────────────────────────────────────────────────
    jd_hint = ""
    if job_context and job_context.job_description:
        jd_hint = f"\n\nJOB DESCRIPTION TO TAILOR FOR:\n{job_context.job_description[:800]}"

    user_prompt = f"""\
Write a complete professional resume for this candidate. Use their REAL data — \
replace nothing with placeholders.

=== CANDIDATE PROFILE ===
Name: {name}
Education: {degree} in {field}, {institution} ({grad_year})
UPSC: {years_prep} years preparing, {attempts} attempt(s), highest stage: {stage}
Optional Subject: {optional_subj}
Work Experience: {work_exp_str}
Skills: {skills_str}
Target Role: {target_role}
{jd_hint}{project_str}

=== OUTPUT FORMAT (return this exact JSON structure, fully filled) ===
{{
  "summary": {{
    "text": "<Write exactly 2 sentences in FIRST-PERSON IMPLIED style — no 'I', no 'my', and DO NOT start with the candidate's name (the name is already in the header). This is how the candidate describes themselves on their own resume. SENTENCE 1: Start with a noun phrase describing what they are or what they bring — e.g. 'Analytical professional with...' or 'B.Tech Computer Science graduate with 3 years of...' — draw from their {degree} in {field} and {years_prep} years of UPSC prep. SENTENCE 2: One specific past achievement or transferable skill that directly applies to the {target_role} — use action verbs in past tense. BANNED: starting with the candidate's name, 'I', 'my', 'dedicated', 'passionate', 'leveraging', 'poised to', 'aspiring', 'eager to', 'looking to', 'with a strong foundation in'.>",
    "contact": {{
      "email": "",
      "phone": "",
      "location": "",
      "linkedin": ""
    }}
  }},
  "experience": {{
    "items": [
      {{
        "title": "UPSC Civil Services Aspirant",
        "company": "Self-directed Full-time Preparation",
        "start_date": "<year they started — {years_prep} years ago>",
        "end_date": "Present",
        "bullets": [
          "<Action verb + specific task from {optional_subj} study + quantified outcome>",
          "<Action verb + governance/policy skill demonstrated + metric>",
          "<Action verb + competitive achievement — e.g. cleared {stage} out of how many candidates>",
          "<Action verb + transferable skill relevant to {target_role}>"
        ]
      }}
    ]
  }},
  "education": {{
    "items": [
      {{
        "degree": "{degree}",
        "field": "{field}",
        "institution": "{institution}",
        "year": "{grad_year}"
      }}
    ]
  }},
  "skills": {{
    "technical": [<list technical skills from: {skills_str}>],
    "soft": ["Research & Analysis", "Report Writing", "Critical Thinking", "Public Speaking", "Time Management"],
    "domain": [<list 3-4 domain skills relevant to {target_role} from the profile>]
  }},
  "achievements": {{
    "items": [
      "<Third-person factual statement: Cleared UPSC {stage} — add percentile or competitive context e.g. top X% of Y lakh candidates>",
      "<Third-person factual statement: one concrete achievement from their study or work — NO first-person 'me/my/I', NO 'making me an ideal candidate' phrases>"
    ]
  }}{",\n  \"projects\": {{\n    \"items\": [\n      {{\n        \"name\": \"<short project name based on the candidate's description below>\",\n        \"description\": \"<1-2 sentences: the problem it solved, using the candidate's own description>\",\n        \"technologies\": [<tech stack mentioned by the candidate>],\n        \"url\": \"\"\n      }}\n    ]\n  }}" if project_str else ""}
}}

CRITICAL: Replace every <…> placeholder with real personalised content. \
The bullets array must have exactly 4 strings — each starting with a strong action verb, \
each specific to this candidate's {optional_subj} background and {target_role} target.\
"""

    return _SYSTEM_PROMPT, user_prompt


def parse_ai_resume_response(raw: str) -> dict:
    """Parse AI JSON response, handling markdown code fences."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", cleaned)
        if match:
            return json.loads(match.group(0))
        raise ValueError("AI response did not contain valid JSON")


def ai_response_to_sections(parsed: dict) -> list[dict]:
    """Convert parsed AI JSON into resume section records."""
    sections = []
    order = 0

    section_map = {
        "summary":      "summary",
        "experience":   "experience",
        "education":    "education",
        "skills":       "skills",
        "achievements": "achievements",
        "projects":     "projects",
    }

    for key, sec_type in section_map.items():
        if key in parsed:
            sections.append({
                "section_type": sec_type,
                "title": key.capitalize(),
                "content": parsed[key],
                "sort_order": order,
                "ai_improved": True,
            })
            order += 1

    return sections


# ─── Resume file parsing ─────────────────────────────────────────────────────

_PARSE_SYSTEM = """\
You are a resume parsing engine. Extract structured data from the provided resume text.
Return ONLY valid JSON matching the schema below — no markdown, no explanation.
If a field is not present in the resume, use null for strings and [] for arrays.
Never fabricate information — only extract what is explicitly stated.\
"""

_PARSE_SCHEMA = """{
  "personal_info": {
    "name": "<full name>",
    "email": "<email address or null>",
    "phone": "<phone number or null>",
    "location": "<city/state/country or null>",
    "linkedin": "<linkedin URL or null>",
    "website": "<portfolio/website URL or null>"
  },
  "summary": "<professional summary paragraph or null>",
  "experience": [
    {
      "title": "<job title>",
      "company": "<company/organisation name>",
      "start_date": "<start month/year>",
      "end_date": "<end month/year or Present>",
      "location": "<city or null>",
      "bullets": ["<bullet point 1>", "<bullet point 2>"]
    }
  ],
  "education": [
    {
      "degree": "<degree name>",
      "field": "<field of study>",
      "institution": "<institution name>",
      "year": "<graduation year>",
      "grade": "<grade/GPA if present or null>"
    }
  ],
  "skills": {
    "technical": ["<skill 1>"],
    "soft": ["<skill 1>"],
    "domain": ["<skill 1>"],
    "tools": ["<tool 1>"]
  },
  "projects": [
    {
      "name": "<project name>",
      "description": "<brief description>",
      "tech": ["<technology 1>"],
      "url": "<URL or null>"
    }
  ],
  "certifications": [
    {
      "name": "<certification name>",
      "issuer": "<issuing organisation or null>",
      "year": "<year or null>"
    }
  ],
  "achievements": ["<achievement 1>"],
  "languages": [
    {
      "language": "<language name>",
      "proficiency": "<Native|Fluent|Professional|Intermediate|Basic>"
    }
  ]
}"""


def build_parse_prompt(resume_text: str) -> tuple[str, str]:
    """Build system + user prompt to parse raw resume text into structured JSON."""
    user_msg = (
        f"Parse the following resume text into the JSON schema below.\n\n"
        f"=== RESUME TEXT ===\n{resume_text[:8000]}\n\n"
        f"=== OUTPUT SCHEMA ===\n{_PARSE_SCHEMA}"
    )
    return _PARSE_SYSTEM, user_msg


def parsed_resume_to_sections(parsed: dict) -> list[dict]:
    """Convert parsed resume JSON into section records for the DB."""
    sections = []
    order = 0

    personal = parsed.get("personal_info", {}) or {}
    summary_text = parsed.get("summary") or ""
    contact = {
        "email":    personal.get("email") or "",
        "phone":    personal.get("phone") or "",
        "location": personal.get("location") or "",
        "linkedin": personal.get("linkedin") or "",
    }
    if summary_text or any(contact.values()):
        sections.append({
            "section_type": "summary",
            "title": "Summary",
            "content": {"text": summary_text, "contact": contact},
            "sort_order": order,
        })
        order += 1

    exp = parsed.get("experience") or []
    if exp:
        sections.append({
            "section_type": "experience",
            "title": "Experience",
            "content": {"items": exp},
            "sort_order": order,
        })
        order += 1

    edu = parsed.get("education") or []
    if edu:
        sections.append({
            "section_type": "education",
            "title": "Education",
            "content": {"items": edu},
            "sort_order": order,
        })
        order += 1

    skills = parsed.get("skills") or {}
    if skills and any(v for v in skills.values() if v):
        sections.append({
            "section_type": "skills",
            "title": "Skills",
            "content": skills,
            "sort_order": order,
        })
        order += 1

    projects = parsed.get("projects") or []
    if projects:
        sections.append({
            "section_type": "projects",
            "title": "Projects",
            "content": {"items": projects},
            "sort_order": order,
        })
        order += 1

    certs = parsed.get("certifications") or []
    if certs:
        sections.append({
            "section_type": "certifications",
            "title": "Certifications",
            "content": {"items": certs},
            "sort_order": order,
        })
        order += 1

    achievements = parsed.get("achievements") or []
    if achievements:
        sections.append({
            "section_type": "achievements",
            "title": "Achievements",
            "content": {"items": achievements},
            "sort_order": order,
        })
        order += 1

    languages = parsed.get("languages") or []
    if languages:
        sections.append({
            "section_type": "languages",
            "title": "Languages",
            "content": {"items": languages},
            "sort_order": order,
        })
        order += 1

    return sections


# ─── AI section improvement ───────────────────────────────────────────────────

_IMPROVE_SYSTEM = """\
You are a professional resume editor. Improve the given resume section to be:
- More impact-driven and quantified
- ATS-friendly with strong action verbs
- Concise and corporate-appropriate
- Free of bureaucratic or overly academic language

Return ONLY the improved JSON in the exact same structure as the input. No explanation.\
"""


def build_improve_prompt(section_type: str, content: dict, career_context: str | None) -> tuple[str, str]:
    ctx = f"\nThe candidate is targeting: {career_context}" if career_context else ""
    user_msg = f"Improve this {section_type} section:{ctx}\n\n{json.dumps(content, indent=2)}"
    return _IMPROVE_SYSTEM, user_msg
