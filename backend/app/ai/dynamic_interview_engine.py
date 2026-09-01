"""Dynamic Interview Engine — generates role-specific blueprints, questions, and job readiness reports.

This replaces static question-bank sampling with AI-generated, candidate-personalized interviews
scoped to the exact job role and experience level selected by the user.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ─── Role → Competency Matrix ──────────────────────────────────────────────────

ROLE_COMPETENCIES: dict[str, list[dict]] = {
    "AI Engineer": [
        {"skill": "Python", "weight": 15},
        {"skill": "Machine Learning", "weight": 15},
        {"skill": "Deep Learning", "weight": 10},
        {"skill": "LLMs & Prompt Engineering", "weight": 15},
        {"skill": "RAG & Vector Databases", "weight": 10},
        {"skill": "AI System Design", "weight": 15},
        {"skill": "MLOps & Deployment", "weight": 10},
        {"skill": "Problem Solving", "weight": 10},
    ],
    "Machine Learning Engineer": [
        {"skill": "Python", "weight": 15},
        {"skill": "ML Algorithms", "weight": 20},
        {"skill": "Feature Engineering", "weight": 10},
        {"skill": "Model Training & Evaluation", "weight": 15},
        {"skill": "MLOps", "weight": 15},
        {"skill": "Data Engineering", "weight": 10},
        {"skill": "Statistics", "weight": 10},
        {"skill": "System Design", "weight": 5},
    ],
    "Data Scientist": [
        {"skill": "Python/R", "weight": 15},
        {"skill": "Statistics & Probability", "weight": 20},
        {"skill": "Data Analysis & EDA", "weight": 15},
        {"skill": "ML Modeling", "weight": 15},
        {"skill": "Data Visualization", "weight": 10},
        {"skill": "SQL & Databases", "weight": 10},
        {"skill": "Business Acumen", "weight": 10},
        {"skill": "Communication", "weight": 5},
    ],
    "Frontend Developer": [
        {"skill": "HTML & CSS", "weight": 10},
        {"skill": "JavaScript", "weight": 20},
        {"skill": "React/Framework", "weight": 20},
        {"skill": "State Management", "weight": 10},
        {"skill": "Performance Optimization", "weight": 10},
        {"skill": "Accessibility", "weight": 10},
        {"skill": "API Integration", "weight": 10},
        {"skill": "UI Architecture", "weight": 10},
    ],
    "Backend Developer": [
        {"skill": "Programming Language", "weight": 15},
        {"skill": "REST APIs", "weight": 15},
        {"skill": "Databases & SQL", "weight": 15},
        {"skill": "System Design", "weight": 15},
        {"skill": "Security", "weight": 10},
        {"skill": "Scalability", "weight": 10},
        {"skill": "DevOps Basics", "weight": 10},
        {"skill": "Problem Solving", "weight": 10},
    ],
    "Full Stack Developer": [
        {"skill": "Frontend (React)", "weight": 15},
        {"skill": "Backend APIs", "weight": 15},
        {"skill": "Databases", "weight": 15},
        {"skill": "System Design", "weight": 15},
        {"skill": "DevOps & CI/CD", "weight": 10},
        {"skill": "Security", "weight": 10},
        {"skill": "Performance", "weight": 10},
        {"skill": "Problem Solving", "weight": 10},
    ],
    "DevOps Engineer": [
        {"skill": "CI/CD Pipelines", "weight": 20},
        {"skill": "Docker & Kubernetes", "weight": 20},
        {"skill": "Cloud Platforms", "weight": 15},
        {"skill": "Infrastructure as Code", "weight": 15},
        {"skill": "Monitoring & Observability", "weight": 10},
        {"skill": "Scripting (Bash/Python)", "weight": 10},
        {"skill": "Security & Compliance", "weight": 10},
    ],
    "Cloud Engineer": [
        {"skill": "AWS/GCP/Azure", "weight": 25},
        {"skill": "Networking", "weight": 15},
        {"skill": "Infrastructure as Code", "weight": 15},
        {"skill": "Containerization", "weight": 15},
        {"skill": "Security", "weight": 15},
        {"skill": "Cost Optimization", "weight": 10},
        {"skill": "Databases", "weight": 5},
    ],
    "Product Manager": [
        {"skill": "Product Strategy", "weight": 20},
        {"skill": "User Research", "weight": 15},
        {"skill": "Prioritization Frameworks", "weight": 15},
        {"skill": "Metrics & Analytics", "weight": 15},
        {"skill": "Stakeholder Management", "weight": 15},
        {"skill": "Technical Understanding", "weight": 10},
        {"skill": "Communication", "weight": 10},
    ],
    "UI/UX Designer": [
        {"skill": "Design Thinking", "weight": 20},
        {"skill": "User Research", "weight": 15},
        {"skill": "Wireframing & Prototyping", "weight": 15},
        {"skill": "Visual Design", "weight": 15},
        {"skill": "Usability Testing", "weight": 10},
        {"skill": "Design Tools", "weight": 10},
        {"skill": "Accessibility", "weight": 10},
        {"skill": "Communication", "weight": 5},
    ],
    "Cybersecurity Engineer": [
        {"skill": "Network Security", "weight": 20},
        {"skill": "Threat Analysis", "weight": 15},
        {"skill": "Penetration Testing", "weight": 15},
        {"skill": "Security Architecture", "weight": 15},
        {"skill": "Incident Response", "weight": 15},
        {"skill": "Compliance & Governance", "weight": 10},
        {"skill": "Scripting", "weight": 10},
    ],
    "Mobile App Developer": [
        {"skill": "iOS/Android/Flutter", "weight": 25},
        {"skill": "State Management", "weight": 15},
        {"skill": "API Integration", "weight": 15},
        {"skill": "Performance Optimization", "weight": 15},
        {"skill": "App Architecture", "weight": 15},
        {"skill": "Testing", "weight": 10},
        {"skill": "Publishing & CI/CD", "weight": 5},
    ],
    "Business Analyst": [
        {"skill": "Requirements Gathering", "weight": 20},
        {"skill": "Process Mapping", "weight": 15},
        {"skill": "Data Analysis", "weight": 15},
        {"skill": "Stakeholder Management", "weight": 15},
        {"skill": "Documentation", "weight": 10},
        {"skill": "SQL/Excel", "weight": 10},
        {"skill": "Communication", "weight": 15},
    ],
}

# ─── Panel simulation ───────────────────────────────────────────────────────
# A real onsite loop isn't one generalist interviewer — it's 2-3 distinct
# people, each testing a different competency with a different style. This
# maps question_type onto a fixed persona rather than asking the LLM to
# invent one per question, which would drift in name/identity across
# questions within the same session.

PANEL_PERSONAS = {
    "hiring_manager": {"name": "Priya Nair", "role": "Hiring Manager"},
    "technical_lead": {"name": "Arjun Mehta", "role": "Technical Lead"},
    "future_peer": {"name": "Zara Khan", "role": "Future Teammate"},
}

_QUESTION_TYPE_TO_PANELIST = {
    "behavioral": "hiring_manager",
    "hr": "hiring_manager",
    "technical": "technical_lead",
    "system_design": "technical_lead",
    "situational": "future_peer",
    "case": "future_peer",
}


def panelist_for_question_type(question_type: str | None) -> dict | None:
    """Deterministic question_type -> panelist mapping, so the same style of
    question always comes from the same persona within a session."""
    key = _QUESTION_TYPE_TO_PANELIST.get((question_type or "").lower())
    return PANEL_PERSONAS.get(key) if key else None


def _with_panel_intro(blueprint: dict, job_role: str) -> dict:
    """Computed deterministically from PANEL_PERSONAS rather than asked of the
    LLM — guarantees the same three names/roles every session instead of the
    model inventing slightly different ones each time."""
    hm, tl, fp = PANEL_PERSONAS["hiring_manager"], PANEL_PERSONAS["technical_lead"], PANEL_PERSONAS["future_peer"]
    blueprint["panel"] = [hm, tl, fp]
    blueprint["panel_intro"] = (
        f"Today's panel for this {job_role} interview: {hm['name']} ({hm['role']}) will cover culture "
        f"and behavioral fit, {tl['name']} ({tl['role']}) will go deep on technical questions, and "
        f"{fp['name']} ({fp['role']}) will explore how you'd handle real day-to-day situations."
    )
    return blueprint


_DEFAULT_COMPETENCIES = [
    {"skill": "Technical Knowledge", "weight": 25},
    {"skill": "Problem Solving", "weight": 25},
    {"skill": "Communication", "weight": 25},
    {"skill": "Domain Expertise", "weight": 25},
]


def get_competencies(job_role: str) -> list[dict]:
    return ROLE_COMPETENCIES.get(job_role, _DEFAULT_COMPETENCIES)


_COMPETENCY_GEN_SYSTEM = """You are a Senior Hiring Manager building a competency matrix for a job role \
that isn't in a standard taxonomy — the candidate typed it in free-text.

Generate 6-8 competencies that a real interview panel would assess for this exact role. Weights must
be integers that sum to 100.

Return ONLY valid JSON:
{
  "competencies": [
    {"skill": "<specific, named competency — not a vague catch-all>", "weight": <integer>},
    ...
  ]
}"""


async def generate_dynamic_competencies(job_role: str) -> list[dict]:
    """LLM-generated competency matrix for a role that isn't in ROLE_COMPETENCIES
    (i.e. the candidate free-typed a role instead of picking from the picklist).

    Falls back to _DEFAULT_COMPETENCIES on any failure — a generic-but-present
    matrix beats a broken interview.
    """
    try:
        from app.ai.providers import create_provider
        from app.ai.providers.groq import LIGHT_MODEL
        provider = create_provider(model=LIGHT_MODEL, reasoning_effort="low")
        result = await provider.complete(
            system=_COMPETENCY_GEN_SYSTEM,
            messages=[{"role": "user", "content": f"Job Role: {job_role}\n\nGenerate the competency matrix."}],
            max_tokens=500,
            temperature=0.4,
        )
        raw = _strip_json(result.content)
        parsed = json.loads(raw)
        competencies = parsed.get("competencies")
        if isinstance(competencies, list) and competencies and all(
            isinstance(c, dict) and c.get("skill") and isinstance(c.get("weight"), (int, float))
            for c in competencies
        ):
            return competencies
        raise ValueError("Malformed competency matrix from LLM")
    except Exception as exc:
        logger.warning("[DYNAMIC_ENGINE] Competency generation failed for role=%r: %s", job_role, exc)
        return _DEFAULT_COMPETENCIES


async def resolve_competencies(job_role: str) -> list[dict]:
    """Single source of truth for a session's competency matrix: known roles use
    the fixed taxonomy, novel (free-typed) roles get an LLM-generated one.
    """
    if job_role in ROLE_COMPETENCIES:
        return ROLE_COMPETENCIES[job_role]
    return await generate_dynamic_competencies(job_role)


def _canonicalize_skill(name: str, canonical_names: list[str]) -> str:
    """Snap a free-text skill name onto the role's fixed competency taxonomy
    when it's an exact match once case/whitespace differences are ignored.

    Prompts are told to use only the canonical names, but a model can still
    drift — this is the defense-in-depth backstop, not the primary fix. It's
    deliberately a plain exact-match snap, not fuzzy/embedding matching:
    the goal is convergence for genuinely-the-same name, not guessing at
    genuinely-different ones.
    """
    if not name:
        return name
    norm = name.strip().casefold()
    for canonical in canonical_names:
        if canonical.strip().casefold() == norm:
            return canonical
    return name


# ─── Prompts ──────────────────────────────────────────────────────────────────

_BLUEPRINT_SYSTEM = """You are a Senior Technical Interviewer and Hiring Manager with 15 years experience.

Given a job role, experience level, and optional job description, generate a structured interview blueprint.

CRITICAL: "skills_to_assess" MUST be chosen only from the "Canonical Skills" list provided in the
user message, using the exact spelling given. Do not invent new skill names, rephrase them, or
split one canonical skill into several — this list is the fixed taxonomy this role is always
assessed against, so consistent naming across every interview for this role matters more than
covering every nuance of the job description.

Return ONLY valid JSON:
{
  "skills_to_assess": ["skill1", "skill2", ...],
  "question_breakdown": {
    "behavioral": 2,
    "technical": 4,
    "situational": 2,
    "system_design": 1,
    "culture_fit": 1
  },
  "difficulty_ramp": "start_easy_increase" | "consistent_medium" | "start_hard",
  "focus_areas": ["area1", "area2"],
  "interview_style": "conversational" | "technical_deep_dive" | "case_study",
  "opening_greeting": "A professional 2-sentence greeting the AI interviewer will say to open the interview",
  "ice_breaker_question": "A warm, professional opening question to ease the candidate"
}"""

_QUESTIONS_SYSTEM = """You are a Senior Technical Interviewer generating interview questions.

Generate exactly {count} interview questions for the specified role, experience level, and skills.

Return ONLY a JSON array:
[
  {{
    "question_text": "The full question text",
    "question_type": "behavioral" | "technical" | "situational" | "system_design" | "hr",
    "difficulty": "easy" | "medium" | "hard",
    "skill_assessed": "name of skill being assessed",
    "expected_answer_hints": "brief guide on what a good answer covers (internal use)"
  }},
  ...
]

Rules:
- Make questions specific to the role, NOT generic
- For senior levels: include system design and architecture questions
- For junior/fresher: focus on fundamentals and project discussions
- Questions should feel like a real interview, not a quiz
- Mix behavioral (STAR format expected) with technical
- Never repeat similar questions
- Each question should assess a different competency
- CRITICAL: "skill_assessed" MUST be exactly one of the strings listed under "Skills to Assess"
  below, spelled exactly as given — never invent a new name or rephrase one, even if a question
  only partially touches that skill. Consistent naming across sessions matters more than precision.
- If a "Candidate Background" section is provided and names a specific project, employer, or tool,
  make at least one question reference it by name (e.g. "You used <tool> on <project> — walk me
  through that decision"). Only reference things actually present in that background — never
  fabricate a specific that isn't there."""

_READINESS_SYSTEM = """You are a strict, unbiased Senior Hiring Manager generating a post-interview assessment.
Your job is to give ACCURATE scores — not encouraging ones. Candidates need to know the truth.

SCORING CALIBRATION (follow this exactly):
- 0–30:   Poor. Candidate struggled badly, gave vague or irrelevant answers.
- 31–50:  Below average. Basic understanding but significant gaps. Not ready for the role.
- 51–65:  Average. Some relevant knowledge but lacks depth or experience.
- 66–80:  Good. Solid answers with minor gaps. Close to hire-ready.
- 81–90:  Strong. Clear expertise, well-structured answers, few gaps.
- 91–100: Exceptional. Would impress any hiring panel.

COMPLETENESS RULE (critical):
- You will be told how many questions were answered vs. planned.
- If the candidate answered < 50% of planned questions, cap overall_readiness_score at 45.
- If the candidate answered < 70% of planned questions, cap overall_readiness_score at 60.
- An incomplete interview is a signal of poor preparation or disengagement.

ANSWER QUALITY MAPPING:
- AI per-answer overall_score of 0–4/10 → that skill scores 0–40 in readiness
- AI per-answer overall_score of 5/10 → that skill scores ~50 in readiness (average)
- AI per-answer overall_score of 6–7/10 → that skill scores 55–70
- AI per-answer overall_score of 8–9/10 → that skill scores 75–90
- AI per-answer overall_score of 10/10 → that skill scores 95–100

Return ONLY valid JSON — no commentary, no markdown:
{
  "overall_readiness_score": <integer 0-100>,
  "technical_readiness_score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "confidence_score": <integer 0-100>,
  "hiring_recommendation": "Strong Hire" | "Hire" | "Maybe" | "No Hire",
  "hiring_recommendation_reason": "2-3 sentence explanation referencing specific answers",
  "strengths": ["specific strength observed in answers", ...],
  "critical_gaps": ["specific gap observed in answers", ...],
  "skill_scores": {
    "skill_name": <integer 0-100>,
    ...
  },
  "candidate_summary": "3-4 sentence factual summary for a recruiter, citing actual answer quality",
  "roadmap": [
    {
      "week_range": "Week 1-2",
      "focus": "Topic/Skill",
      "action": "Specific, actionable step the candidate should take",
      "resource_type": "project" | "course" | "practice" | "reading"
    }
  ],
  "readiness_message": "Direct 2-sentence message to the candidate. Honest, not sugarcoated.",
  "consistency_notes": ["specific contradiction or near-verbatim repeat found across the transcript, quoting both instances, e.g. 'In Q2 you said X; in Q4 you said Y — these conflict'", ...]
}

Rules:
- Roadmap must have 4–6 entries targeting actual gaps found in the answers.
- skill_scores must cover every competency listed under Expected Competencies.
- Strengths and gaps must reference specific things said (or not said) in the answers.
- Do NOT inflate scores to be kind. A weak answer is a weak answer.
- consistency_notes: read the full transcript for contradictions (e.g. stated years of experience,
  technologies used, or team size that don't match between two answers) or answers that just repeat
  an earlier answer. Return an empty list if you find none — do not invent one that isn't really there."""


async def generate_blueprint(
    job_role: str,
    experience_level: str,
    job_description: str | None,
    total_questions: int,
    candidate_context: str | None = None,
    prior_weak_areas: list[str] | None = None,
    competencies: list[dict] | None = None,
) -> dict:
    """Generate an interview blueprint for a given role and experience level."""
    candidate_section = (
        f"\nCandidate Background:\n{candidate_context}\n"
        f"Use this to calibrate difficulty_ramp and focus_areas appropriately.\n"
        if candidate_context else ""
    )
    weak_section = (
        f"\nPrior Weak Competencies (from the candidate's last session — allocate MORE questions here):\n"
        + ", ".join(prior_weak_areas) + "\n"
        if prior_weak_areas else ""
    )
    canonical_names = [c["skill"] for c in (competencies or get_competencies(job_role))]
    user_msg = f"""Job Role: {job_role}
Experience Level: {experience_level}
Total Questions Planned: {total_questions}
Job Description: {job_description or 'Not provided'}
Canonical Skills (skills_to_assess must be chosen only from this list, exact spelling): {", ".join(canonical_names)}
{candidate_section}{weak_section}
Generate the interview blueprint."""

    try:
        from app.ai.providers import create_provider
        from app.ai.providers.groq import LIGHT_MODEL
        provider = create_provider(model=LIGHT_MODEL, reasoning_effort="low")
        result = await provider.complete(
            system=_BLUEPRINT_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=800,
            temperature=0.4,
        )
        raw = _strip_json(result.content)
        blueprint = json.loads(raw)
        if isinstance(blueprint.get("skills_to_assess"), list):
            blueprint["skills_to_assess"] = [
                _canonicalize_skill(s, canonical_names) for s in blueprint["skills_to_assess"]
            ]
        return _with_panel_intro(blueprint, job_role)
    except Exception as exc:
        logger.warning("[DYNAMIC_ENGINE] Blueprint generation failed: %s", exc)
        return _default_blueprint(job_role, experience_level)


async def generate_questions(
    job_role: str,
    experience_level: str,
    blueprint: dict,
    count: int,
    competencies: list[dict] | None = None,
    candidate_context: str | None = None,
) -> list[dict]:
    """Generate dynamic, role-specific interview questions."""
    canonical_names = [c["skill"] for c in (competencies or get_competencies(job_role))]
    skills_focus = ", ".join(blueprint.get("skills_to_assess", [])[:6])
    breakdown = blueprint.get("question_breakdown", {})
    breakdown_str = ", ".join(f"{k}: {v}" for k, v in breakdown.items())
    candidate_section = (
        f"\nCandidate Background (weave at least one question that references a specific "
        f"named project, employer, or tool from this background, if present — never invent "
        f"specifics that aren't actually in it):\n{candidate_context}\n"
        if candidate_context else ""
    )

    user_msg = f"""Job Role: {job_role}
Experience Level: {experience_level}
Skills to Assess: {skills_focus}
Question Breakdown: {breakdown_str}
Focus Areas: {", ".join(blueprint.get("focus_areas", []))}
{candidate_section}
Generate exactly {count} questions."""

    prompt = _QUESTIONS_SYSTEM.replace("{count}", str(count))

    try:
        from app.ai.providers import create_provider
        from app.ai.providers.groq import LIGHT_MODEL
        provider = create_provider(model=LIGHT_MODEL, reasoning_effort="low")
        result = await provider.complete(
            system=prompt,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=2000,
            temperature=0.5,
        )
        raw = _strip_json(result.content)
        questions = json.loads(raw)
        if isinstance(questions, list):
            for q in questions[:count]:
                if isinstance(q, dict) and q.get("skill_assessed"):
                    q["skill_assessed"] = _canonicalize_skill(q["skill_assessed"], canonical_names)
            return questions[:count]
        return _fallback_questions(job_role, count)
    except Exception as exc:
        logger.warning("[DYNAMIC_ENGINE] Question generation failed: %s", exc)
        return _fallback_questions(job_role, count)


async def generate_job_readiness_report(
    job_role: str,
    experience_level: str,
    competencies: list[dict],
    transcript: list[dict],
    total_questions_planned: int = 0,
    temperature: float = 0.3,
) -> dict:
    """Generate a comprehensive job readiness report from interview transcript.

    transcript: list of { question, question_type, skill_assessed, response, clarity, impact, overall }
    total_questions_planned: how many questions the session was supposed to have
    """
    answers_given = len(transcript)
    planned = total_questions_planned or answers_given  # avoid division by zero
    completion_pct = round((answers_given / planned) * 100) if planned else 100

    transcript_text = "\n\n".join(
        f"Q{i+1} [{t.get('question_type','').upper()}] (Skill: {t.get('skill_assessed','General')})\n"
        f"Question: {t['question']}\n"
        f"Answer: {t['response'] or '[No answer provided]'}\n"
        f"AI Scores → clarity={t.get('clarity', 0)}/10, impact={t.get('impact', 0)}/10, overall={t.get('overall', 0)}/10"
        for i, t in enumerate(transcript)
    )

    competency_list = "\n".join(f"- {c['skill']} ({c['weight']}% weight)" for c in competencies)

    user_msg = f"""Role: {job_role}
Experience Level: {experience_level}
Interview Completeness: {answers_given} of {planned} questions answered ({completion_pct}% complete)

Expected Competencies:
{competency_list}

Interview Transcript:
{transcript_text}

IMPORTANT: Apply the completeness cap rule from your instructions if {completion_pct}% < 70%.
Generate the job readiness report based strictly on what was actually demonstrated above."""

    # Audit finding (2026-08-24): this was the one LLM call site in the whole
    # feature missing reasoning_effort="low" — every other call (competencies,
    # blueprint, questions, judges) already sets it specifically because a
    # gpt-oss reasoning model can burn its whole max_tokens budget on reasoning
    # before writing the actual JSON. This schema is the largest of any call
    # site (skill_scores per competency, a 4-6 entry roadmap, several string
    # lists), so it was also the most exposed to exactly that failure mode —
    # confirmed live: truncated/malformed JSON on ~83% of test completions.
    from app.ai.providers import create_provider
    # Deliberately keep the full DEFAULT_MODEL here (unlike the lighter-tier
    # calls elsewhere) — this is the one score a candidate treats as the
    # verdict. Only reasoning_effort changes, to fix the truncation above.
    provider = create_provider(reasoning_effort="low")

    async def _attempt() -> dict:
        result = await provider.complete(
            system=_READINESS_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=3000,
            temperature=temperature,
        )
        raw = _strip_json(result.content)
        return json.loads(raw)

    try:
        try:
            report = await _attempt()
        except Exception as first_exc:
            logger.warning("[DYNAMIC_ENGINE] Readiness report attempt 1 failed: %s — retrying once", first_exc)
            report = await _attempt()
        report = _enforce_completeness_cap(report, completion_pct)
        report["job_role"] = job_role
        report["experience_level"] = experience_level
        report["competencies"] = competencies
        return report
    except Exception as exc:
        logger.warning("[DYNAMIC_ENGINE] Readiness report failed after retry: %s", exc)
        return _default_readiness_report(job_role, experience_level, competencies)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _strip_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


_REC_ORDER = ["No Hire", "Maybe", "Hire", "Strong Hire"]


def _enforce_completeness_cap(report: dict, completion_pct: float) -> dict:
    """Code-level enforcement of the completeness rule the prompt only *asks*
    the model to follow, and a defensive clamp on every numeric field.

    The prompt tells the model to cap overall_readiness_score when completion
    is low, but nothing previously checked the model actually did that — an
    LLM-stated rule is not a guarantee. This mirrors the clamp-and-validate
    pattern feedback_ai.parse_feedback_response already applies to per-answer
    scores.
    """
    cap = 45 if completion_pct < 50 else 60 if completion_pct < 70 else None

    numeric_fields = (
        "overall_readiness_score", "technical_readiness_score",
        "communication_score", "confidence_score",
    )
    for key in numeric_fields:
        val = report.get(key)
        if isinstance(val, (int, float)):
            val = max(0, min(100, val))
            if key == "overall_readiness_score" and cap is not None:
                val = min(val, cap)
            report[key] = val

    if isinstance(report.get("skill_scores"), dict):
        report["skill_scores"] = {
            k: max(0, min(100, v)) for k, v in report["skill_scores"].items()
            if isinstance(v, (int, float))
        }

    score = report.get("overall_readiness_score")
    if isinstance(score, (int, float)):
        max_allowed_rec = "No Hire" if score <= 45 else "Maybe" if score <= 65 else None
        current_rec = report.get("hiring_recommendation")
        # Normalize before matching — an LLM returning a differently-cased or
        # whitespace-padded label shouldn't silently escape the downgrade.
        normalized = current_rec.strip().casefold() if isinstance(current_rec, str) else ""
        rec_by_normalized = {r.casefold(): r for r in _REC_ORDER}
        matched_rec = rec_by_normalized.get(normalized)
        if max_allowed_rec is not None and matched_rec is not None:
            if _REC_ORDER.index(matched_rec) > _REC_ORDER.index(max_allowed_rec):
                report["hiring_recommendation"] = max_allowed_rec
        elif max_allowed_rec is not None and matched_rec is None and current_rec:
            # Unrecognized label entirely — fail closed to the strictest
            # allowed tier rather than leaving an unvalidated string in place.
            report["hiring_recommendation"] = max_allowed_rec

    return report


def _default_blueprint(job_role: str, experience_level: str) -> dict:
    return _with_panel_intro({
        "skills_to_assess": [c["skill"] for c in get_competencies(job_role)[:6]],
        "question_breakdown": {"behavioral": 2, "technical": 4, "situational": 2, "hr": 2},
        "difficulty_ramp": "start_easy_increase",
        "focus_areas": ["Technical depth", "Problem solving", "Communication"],
        "interview_style": "conversational",
        "opening_greeting": f"Welcome! I'm your AI interviewer for the {job_role} position. I'm excited to learn about your experience and skills today.",
        "ice_breaker_question": "To get us started, could you walk me through your background and what drew you to the field of " + job_role + "?",
    }, job_role)


def _fallback_questions(job_role: str, count: int) -> list[dict]:
    base = [
        {
            "question_text": f"Tell me about your experience relevant to the {job_role} role.",
            "question_type": "behavioral",
            "difficulty": "easy",
            "skill_assessed": "Experience",
            "expected_answer_hints": "Should mention relevant projects and skills",
        },
        {
            "question_text": "Describe a challenging technical problem you solved. Walk me through your approach.",
            "question_type": "technical",
            "difficulty": "medium",
            "skill_assessed": "Problem Solving",
            "expected_answer_hints": "Should demonstrate structured thinking",
        },
        {
            "question_text": "How do you stay updated with the latest developments in your field?",
            "question_type": "behavioral",
            "difficulty": "easy",
            "skill_assessed": "Learning Agility",
            "expected_answer_hints": "Should show continuous learning mindset",
        },
        {
            "question_text": "Describe a situation where you had to work under tight deadlines. How did you manage it?",
            "question_type": "situational",
            "difficulty": "medium",
            "skill_assessed": "Time Management",
            "expected_answer_hints": "STAR format expected",
        },
        {
            "question_text": "Where do you see yourself in 3 years, and how does this role fit into that vision?",
            "question_type": "hr",
            "difficulty": "easy",
            "skill_assessed": "Career Goals",
            "expected_answer_hints": "Should show alignment with role",
        },
    ]
    return (base * ((count // len(base)) + 1))[:count]


def _default_readiness_report(job_role: str, experience_level: str, competencies: list[dict]) -> dict:
    """Fallback used only when the AI call fails. Uses 0 scores, not 60, so
    we don't mislead the candidate with false averages."""
    return {
        "job_role": job_role,
        "experience_level": experience_level,
        "overall_readiness_score": 0,
        "technical_readiness_score": 0,
        "communication_score": 0,
        "confidence_score": 0,
        "hiring_recommendation": "No Hire",
        "hiring_recommendation_reason": "Report generation failed — no scores could be computed. Please retake the interview.",
        "strengths": [],
        "critical_gaps": ["Report generation failed. Retake the interview to get a full evaluation."],
        "skill_scores": {c["skill"]: 0 for c in competencies},
        "candidate_summary": "Report generation failed. Manual review required.",
        "roadmap": [],
        "readiness_message": "We couldn't generate your report due to a technical issue. Please try again.",
        "consistency_notes": [],
        "competencies": competencies,
        "error": True,
    }
