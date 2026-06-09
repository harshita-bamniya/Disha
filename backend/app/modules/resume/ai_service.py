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
    """
    Heuristic ATS score 0-100 based on:
    - Presence of key section types (40 pts)
    - Power verb usage in experience bullets (30 pts)
    - Quantification presence (20 pts)
    - Length balance (10 pts)
    """
    full_text = " ".join(json.dumps(s.get("content", {})) for s in sections).lower()
    words = set(full_text.split())

    section_types = {s.get("section_type") for s in sections}
    required_sections = {"summary", "experience", "education", "skills"}
    section_score = len(required_sections & section_types) * 10

    verb_count = len(_ATS_POWER_VERBS & words)
    verb_score = min(30, verb_count * 3)

    quant_matches = len(re.findall(r'\d+[\s%]', full_text))
    quant_score = min(20, quant_matches * 4)

    total_chars = len(full_text)
    length_score = 10 if 800 <= total_chars <= 4000 else 5

    return min(100, section_score + verb_score + quant_score + length_score)


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
) -> tuple[str, str]:
    """Build system + user prompt for full resume generation."""

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

    # ── Target role ────────────────────────────────────────────────────────────
    if job_context and job_context.job_title:
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
{jd_hint}

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
  }}
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
