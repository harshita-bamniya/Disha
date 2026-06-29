import logging
import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import AspirantProfile, PsychologicalAssessment, User
from app.modules.onboarding.schemas import (
    EducationRequest, OnboardingStatusResponse, PersonalInfoRequest,
    PreferencesRequest, ProfileResponse, PsychologicalAssessmentRequest, SkillsRequest,
    StepSavedResponse, UpscJourneyRequest, WorkExperienceRequest,
)

logger = logging.getLogger(__name__)

# ── Score lookup maps for Step 7 options ─────────────────────────────────────

_BURNOUT_MAP = {
    "fresh": 15,
    "somewhat_tired": 40,
    "exhausted": 70,
    "burnt_out": 90,
}
_CONFIDENCE_MAP = {
    "very_confident": 85,
    "reasonably_confident": 65,
    "somewhat_unsure": 40,
    "very_anxious": 20,
}
_PRESSURE_MAP = {
    "no_rush": 10,
    "some_pressure": 35,
    "significant_pressure": 65,
    "urgent": 90,
}


def _maybe_recompute_krs(user: User, profile: AspirantProfile, db: Session) -> None:
    """If onboarding is already complete, re-run KRS so scores + embedding stay current after edits."""
    if not profile.is_completed:
        return
    try:
        from app.modules.krs.service import compute_and_store
        compute_and_store(user, db)
        logger.info(f"[KRS] Re-computed after profile edit for user={user.id}")
    except Exception as exc:
        logger.warning(f"[KRS] Re-compute after profile edit failed for user={user.id}: {exc}")


def _get_or_create_profile(user: User, db: Session) -> AspirantProfile:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile:
        profile = AspirantProfile(user_id=user.id)
        db.add(profile)
        db.flush()
    return profile


def get_profile(user: User, db: Session) -> ProfileResponse:
    """Return full profile data for pre-filling the profile edit page."""
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    psych = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()

    if not profile:
        return ProfileResponse()

    # date_of_birth may be stored as a date object or a plain string depending on the DB driver
    dob = profile.date_of_birth
    if dob is None:
        dob_str = None
    elif hasattr(dob, "strftime"):
        dob_str = dob.strftime("%Y-%m-%d")
    else:
        dob_str = str(dob)

    return ProfileResponse(
        full_name=profile.full_name,
        current_status=profile.current_status,
        date_of_birth=dob_str,
        gender=profile.gender,
        city=profile.city,
        state=profile.state,
        highest_qualification=profile.highest_qualification,
        degree=profile.degree,
        field_of_study=profile.field_of_study,
        institution=profile.institution,
        graduation_year=profile.graduation_year,
        upsc_exam=profile.upsc_exam,
        years_preparing=profile.years_preparing,
        upsc_attempts=profile.upsc_attempts,
        highest_stage_cleared=profile.highest_stage_cleared,
        optional_subject=profile.optional_subject,
        has_work_experience=profile.has_work_experience,
        work_experience_years=profile.work_experience_years,
        work_experience_domain=profile.work_experience_domain,
        last_designation=profile.last_designation,
        skills=profile.skills or [],
        preferred_sectors=profile.preferred_sectors or [],
        preferred_locations=profile.preferred_locations or [],
        open_to_relocation=profile.open_to_relocation,
        expected_salary_min=profile.expected_salary_min,
        expected_salary_max=profile.expected_salary_max,
        motivation_type=psych.motivation_type if psych else None,
        risk_tolerance=psych.risk_tolerance if psych else None,
        support_system=psych.support_system if psych else None,
        disha_insight=psych.disha_insight if psych else None,
    )


def get_status(user: User, db: Session) -> OnboardingStatusResponse:
    profile = db.query(AspirantProfile).filter(AspirantProfile.user_id == user.id).first()
    if not profile:
        return OnboardingStatusResponse(current_step=1, is_completed=False)
    return OnboardingStatusResponse(
        current_step=profile.current_step,
        is_completed=profile.is_completed,
    )


def save_personal(user: User, data: PersonalInfoRequest, db: Session) -> StepSavedResponse:
    profile = _get_or_create_profile(user, db)
    profile.full_name = data.full_name
    profile.current_status = data.current_status
    profile.city = data.city
    # Deferred fields — only overwrite if this submission actually provided them,
    # so a later "complete your profile" pass doesn't need to resend everything.
    if data.date_of_birth is not None:
        profile.date_of_birth = data.date_of_birth
    if data.gender is not None:
        profile.gender = data.gender
    if data.state is not None:
        profile.state = data.state
    if profile.current_step < 2:
        profile.current_step = 2
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} saved step 1 (personal)")
    _maybe_recompute_krs(user, profile, db)
    return StepSavedResponse(message="Personal info saved", current_step=profile.current_step, is_completed=profile.is_completed)


def save_education(user: User, data: EducationRequest, db: Session) -> StepSavedResponse:
    profile = _get_or_create_profile(user, db)
    profile.highest_qualification = data.highest_qualification
    profile.degree = data.degree
    profile.field_of_study = data.field_of_study
    profile.institution = data.institution
    profile.graduation_year = data.graduation_year
    if profile.current_step < 3:
        profile.current_step = 3
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} saved step 2 (education)")
    _maybe_recompute_krs(user, profile, db)
    return StepSavedResponse(message="Education saved", current_step=profile.current_step, is_completed=profile.is_completed)


def save_upsc_journey(user: User, data: UpscJourneyRequest, db: Session) -> StepSavedResponse:
    profile = _get_or_create_profile(user, db)
    profile.upsc_exam = data.upsc_exam
    profile.years_preparing = data.years_preparing
    profile.upsc_attempts = data.upsc_attempts
    profile.highest_stage_cleared = data.highest_stage_cleared
    profile.optional_subject = data.optional_subject
    if profile.current_step < 4:
        profile.current_step = 4
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} saved step 3 (upsc journey)")
    _maybe_recompute_krs(user, profile, db)
    return StepSavedResponse(message="UPSC journey saved", current_step=profile.current_step, is_completed=profile.is_completed)


def save_work_experience(user: User, data: WorkExperienceRequest, db: Session) -> StepSavedResponse:
    profile = _get_or_create_profile(user, db)
    profile.has_work_experience = data.has_work_experience
    profile.work_experience_years = data.work_experience_years if data.has_work_experience else None
    profile.work_experience_domain = data.work_experience_domain if data.has_work_experience else None
    profile.last_designation = data.last_designation if data.has_work_experience else None
    if profile.current_step < 5:
        profile.current_step = 5
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} saved step 4 (work experience)")
    _maybe_recompute_krs(user, profile, db)
    return StepSavedResponse(message="Work experience saved", current_step=profile.current_step, is_completed=profile.is_completed)


def save_skills(user: User, data: SkillsRequest, db: Session) -> StepSavedResponse:
    profile = _get_or_create_profile(user, db)
    profile.skills = data.skills
    if profile.current_step < 6:
        profile.current_step = 6
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} saved step 5 (skills)")
    _maybe_recompute_krs(user, profile, db)
    # Cache embeddings for user skills so gap computation is instant at query time
    if data.skills:
        from app.tasks.worker import embed_skill_texts
        embed_skill_texts.delay(data.skills)
    return StepSavedResponse(message="Skills saved", current_step=profile.current_step, is_completed=profile.is_completed)


def save_preferences(user: User, data: PreferencesRequest, db: Session) -> StepSavedResponse:
    profile = _get_or_create_profile(user, db)
    profile.preferred_sectors = data.preferred_sectors
    profile.preferred_locations = data.preferred_locations
    profile.open_to_relocation = data.open_to_relocation
    profile.expected_salary_min = data.expected_salary_min
    profile.expected_salary_max = data.expected_salary_max
    # Advance to step 7 — psychological assessment completes onboarding
    if profile.current_step < 7:
        profile.current_step = 7
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} saved step 6 (preferences)")
    _maybe_recompute_krs(user, profile, db)
    return StepSavedResponse(message="Preferences saved", current_step=profile.current_step, is_completed=profile.is_completed)


def save_psychology(user: User, data: PsychologicalAssessmentRequest, db: Session) -> StepSavedResponse:
    """Step 7: save psychological assessment, generate Groq insight, trigger KRS."""
    profile = _get_or_create_profile(user, db)

    burnout = _BURNOUT_MAP[data.burnout_level]
    confidence = _CONFIDENCE_MAP[data.confidence_level]
    pressure = _PRESSURE_MAP[data.financial_pressure]

    # Upsert psychological assessment — commit BEFORE calling Groq so data is
    # never lost if the AI call times out or fails.
    assessment = db.query(PsychologicalAssessment).filter(PsychologicalAssessment.user_id == user.id).first()
    if not assessment:
        assessment = PsychologicalAssessment(
            user_id=user.id,
            burnout_score=burnout,
            confidence_index=confidence,
            financial_pressure_score=pressure,
            risk_tolerance=data.risk_tolerance,
            motivation_type=data.motivation_type,
            identity_attachment=data.identity_attachment,
            support_system=data.support_system,
            disha_insight=None,
        )
        db.add(assessment)
    else:
        assessment.burnout_score = burnout
        assessment.confidence_index = confidence
        assessment.financial_pressure_score = pressure
        assessment.risk_tolerance = data.risk_tolerance
        assessment.motivation_type = data.motivation_type
        assessment.identity_attachment = data.identity_attachment
        assessment.support_system = data.support_system
        assessment.disha_insight = None

    profile.current_step = 7
    profile.is_completed = True
    db.commit()
    logger.info(f"[ONBOARDING] user={user.id} completed onboarding (step 7 psychology)")

    # Auto-trigger KRS scoring with psychological data
    try:
        from app.modules.krs.service import compute_and_store
        compute_and_store(user, db)
    except Exception as exc:
        logger.warning(f"[KRS] Auto-compute failed for user={user.id}: {exc}")

    # Attempt Groq insight AFTER the commit — if it times out the user still
    # lands on the dashboard; they just don't see the personalised message.
    insight = _call_groq_insight(profile, burnout, confidence, pressure, data)
    if insight:
        assessment.disha_insight = insight
        db.commit()

    return StepSavedResponse(
        message="Onboarding complete!",
        current_step=7,
        is_completed=True,
        disha_insight=insight or None,
    )


# ── Groq helper ───────────────────────────────────────────────────────────────

def _call_groq_insight(
    profile: AspirantProfile,
    burnout: int,
    confidence: int,
    pressure: int,
    data: PsychologicalAssessmentRequest,
) -> str:
    settings = get_settings()
    if not settings.groq_api_key:
        return ""

    # Build a concise, context-rich prompt
    work_line = (
        f"{profile.work_experience_years or 0} years in {profile.work_experience_domain or 'an unspecified sector'}"
        if profile.has_work_experience
        else "no prior work experience"
    )
    skills_line = ", ".join((profile.skills or [])[:3]) or "not specified"
    sectors_line = ", ".join((profile.preferred_sectors or [])[:2]) or "not specified"

    burnout_label = {15: "fresh", 40: "somewhat tired", 70: "exhausted", 90: "burnt out"}[burnout]
    confidence_label = {85: "very confident", 65: "reasonably confident", 40: "somewhat unsure", 20: "very anxious"}[confidence]
    pressure_label = {10: "no financial rush", 35: "some financial pressure", 65: "significant financial pressure", 90: "urgent financial need"}[pressure]

    prompt = (
        "You are BeginablAI — a compassionate, deeply human career counsellor for UPSC aspirants "
        "transitioning into private sector roles. You understand the psychological weight of this journey.\n\n"
        "A user has just completed their onboarding. Write a warm, grounding, personalised 2–3 sentence "
        "welcome message. Be specific to their journey — not generic. No bullet points. Second person only.\n\n"
        f"UPSC: {profile.upsc_exam or 'CSE'}, {profile.upsc_attempts or 0} attempt(s), "
        f"highest stage: {profile.highest_stage_cleared or 'none'}, "
        f"prepared for {profile.years_preparing or 0} year(s).\n"
        f"Education: {profile.highest_qualification or 'graduate'} in {profile.field_of_study or 'unspecified'}.\n"
        f"Work: {work_line}.\n"
        f"Skills: {skills_line}.\n"
        f"Interested in: {sectors_line}.\n"
        f"Psychological state: {burnout_label} burnout, {confidence_label} about transition, {pressure_label}.\n"
        f"Motivation: {data.motivation_type}. Support system: {data.support_system}.\n\n"
        "Write the message now:"
    )

    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 180,
                "temperature": 0.75,
            },
            timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=2.0),
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"[GROQ] Insight generation failed for user={profile.user_id}: {exc}")
        return ""
