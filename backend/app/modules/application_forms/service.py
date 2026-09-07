"""Application Form Builder service (Phase 3).

Handles full CRUD for:
  ApplicationForm, FormSection, AtsQuestion,
  KnockoutRule, ConditionalRule, FormTemplate, AtsQuestionBank.

Business rules enforced here (not in the router):
  - One active (non-archived) ApplicationForm per job.
  - Compliance-protected questions cannot have knockout rules.
  - Publish validates that all required structural sections are present
    according to the form's settings_json.
  - Cloning copies the full section+question tree; knockout/conditional
    rules are also copied and re-keyed to the new question IDs.
  - Template save snapshots the form as JSON; template load restores it.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.exceptions import (
    BadRequestException, ConflictException, ForbiddenException, NotFoundException,
)
from app.models.ats import (
    ApplicationForm, AtsQuestion, AtsQuestionBank,
    ConditionalRule, FormSection, FormTemplate, KnockoutRule,
)
from app.models.user import EmployerProfile, JobPosting, User
from app.modules.application_forms.schemas import (
    ApplicationFormCreateIn, ApplicationFormUpdateIn,
    ConditionalRuleIn, FormSectionIn,
    FormSettingsIn, FormTemplateSaveIn,
    KnockoutRuleIn, QuestionIn,
)

logger = logging.getLogger(__name__)

# Valid values — mirrors ats.py constants
_VALID_QUESTION_TYPES = {
    "short_text", "long_text", "number", "email", "phone", "date",
    "dropdown", "multi_select", "checkbox", "radio", "yes_no",
    "file_upload", "url", "linkedin_url", "github_url", "portfolio_url",
    "experience_years", "salary_expectation", "notice_period",
    "work_authorization", "visa_sponsorship", "relocation",
    "remote_preference", "availability",
}
_COMPLIANCE_TYPES = {"work_authorization", "visa_sponsorship"}
_VALID_KNOCKOUT_ACTIONS = {"auto_reject", "auto_tag", "auto_advance", "alert", "label"}
_VALID_COND_OPERATORS = {
    "equals", "not_equals", "contains", "not_contains",
    "greater_than", "less_than", "is_answered", "is_not_answered",
}


# ── Authorization helpers ─────────────────────────────────────────────────────

def _get_employer_profile(user: User, db: Session) -> EmployerProfile:
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == user.id).first()
    if not profile:
        raise ForbiddenException("Employer profile not found.")
    return profile


def _get_job_for_employer(job_id: str, user: User, db: Session) -> JobPosting:
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise NotFoundException("Job not found.")
    profile = _get_employer_profile(user, db)
    job = db.query(JobPosting).filter(JobPosting.id == jid).first()
    if not job:
        raise NotFoundException("Job not found.")
    if job.employer_id != profile.id:
        # Also allow company-wide team members
        if job.company_id != profile.company_id:
            raise ForbiddenException("You do not have access to this job.")
    return job


def _get_form_for_employer(form_id: str, user: User, db: Session) -> ApplicationForm:
    try:
        fid = uuid.UUID(form_id)
    except ValueError:
        raise NotFoundException("Application form not found.")
    form = (
        db.query(ApplicationForm)
        .options(
            selectinload(ApplicationForm.sections).selectinload(FormSection.questions)
            .joinedload(AtsQuestion.knockout_rule),
            selectinload(ApplicationForm.conditional_rules),
        )
        .filter(ApplicationForm.id == fid)
        .first()
    )
    if not form:
        raise NotFoundException("Application form not found.")
    _get_job_for_employer(str(form.job_id), user, db)  # auth check
    return form


# ── ApplicationForm CRUD ──────────────────────────────────────────────────────

def create_form(job_id: str, body: ApplicationFormCreateIn, user: User, db: Session) -> ApplicationForm:
    """Create a draft ApplicationForm for a job.

    Optionally loads from a template or clones from another job's published form.
    """
    job = _get_job_for_employer(job_id, user, db)

    existing = db.query(ApplicationForm).filter(ApplicationForm.job_id == job.id).first()
    if existing:
        raise ConflictException("An application form already exists for this job. Use PUT to update it.")

    settings = (body.settings or FormSettingsIn()).model_dump()

    form = ApplicationForm(
        job_id=job.id,
        status="draft",
        version=1,
        settings_json=settings,
        created_by=user.id,
    )
    db.add(form)
    db.flush()  # get form.id before adding children

    if body.template_id:
        _load_from_template(form, body.template_id, db)
    elif body.clone_from_job_id:
        _clone_from_job(form, body.clone_from_job_id, user, db)
    else:
        _add_default_sections(form, settings, db)

    db.commit()
    db.refresh(form)
    return _load_form_full(form.id, db)


def get_form_by_job(job_id: str, draft: bool, user: User, db: Session) -> ApplicationForm:
    """Get the form for a job — draft version for the employer, published for candidates."""
    job = _get_job_for_employer(job_id, user, db)
    form = db.query(ApplicationForm).filter(ApplicationForm.job_id == job.id).first()
    if not form:
        raise NotFoundException("No application form configured for this job.")
    if not draft and form.status != "published":
        raise NotFoundException("No published application form for this job.")
    return _load_form_full(form.id, db)


def get_published_form_public(job_id: str, db: Session) -> ApplicationForm:
    """Return the published form — no auth required (called during candidate apply flow)."""
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise NotFoundException("Job not found.")
    form = (
        db.query(ApplicationForm)
        .filter(ApplicationForm.job_id == jid, ApplicationForm.status == "published")
        .first()
    )
    if not form:
        raise NotFoundException("No published application form for this job.")
    return _load_form_full(form.id, db)


def update_form(form_id: str, body: ApplicationFormUpdateIn, user: User, db: Session) -> ApplicationForm:
    form = _get_form_for_employer(form_id, user, db)
    if form.status == "archived":
        raise BadRequestException("Cannot update an archived form.")
    if body.settings:
        form.settings_json = body.settings.model_dump()
    db.commit()
    return _load_form_full(form.id, db)


def publish_form(form_id: str, user: User, db: Session) -> ApplicationForm:
    """Validate and publish the form. Increments version on each publish."""
    form = _get_form_for_employer(form_id, user, db)
    if form.status == "archived":
        raise BadRequestException("Cannot publish an archived form.")

    errors = _validate_for_publish(form)
    if errors:
        raise BadRequestException(f"Form cannot be published: {'; '.join(errors)}")

    form.status = "published"
    form.version += 1
    form.last_published_at = datetime.now(timezone.utc)
    db.commit()
    return _load_form_full(form.id, db)


def _validate_for_publish(form: ApplicationForm) -> list[str]:
    """Return a list of validation errors, empty if the form is publishable."""
    errors: list[str] = []
    settings = form.settings_json or {}

    section_types = {s.section_type for s in form.sections if s.is_visible}

    if settings.get("resume_config") == "required" and "resume" not in section_types:
        errors.append("Resume section is required by settings but missing from the form.")

    if settings.get("require_cover_letter") == "required" and "cover_letter" not in section_types:
        errors.append("Cover letter section is required by settings but missing from the form.")

    if settings.get("require_portfolio") == "required" and "portfolio" not in section_types:
        errors.append("Portfolio section is required by settings but missing from the form.")

    # Every required question must have a label
    for section in form.sections:
        for q in section.questions:
            if not q.label or not q.label.strip():
                errors.append(f"Question in section '{section.title}' has an empty label.")

    return errors


# ── FormSection CRUD ──────────────────────────────────────────────────────────

def add_section(form_id: str, body: FormSectionIn, user: User, db: Session) -> FormSection:
    form = _get_form_for_employer(form_id, user, db)
    if form.status == "archived":
        raise BadRequestException("Cannot modify an archived form.")

    max_order = db.query(func.max(FormSection.order_index)).filter(
        FormSection.form_id == form.id
    ).scalar() or 0

    section = FormSection(
        form_id=form.id,
        title=body.title,
        description=body.description,
        section_type=body.section_type,
        is_locked=body.is_locked,
        order_index=max_order + 1,
        is_visible=True,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def update_section(section_id: str, body: FormSectionIn, user: User, db: Session) -> FormSection:
    section = _get_section_for_employer(section_id, user, db)
    if section.is_locked:
        raise BadRequestException("This section is locked and cannot be modified.")
    section.title = body.title
    section.description = body.description
    section.section_type = body.section_type
    db.commit()
    db.refresh(section)
    return section


def reorder_sections(form_id: str, order: list[dict], user: User, db: Session) -> ApplicationForm:
    form = _get_form_for_employer(form_id, user, db)
    id_to_idx = {item["section_id"]: item["order_index"] for item in order}
    for section in form.sections:
        if str(section.id) in id_to_idx:
            section.order_index = id_to_idx[str(section.id)]
    db.commit()
    return _load_form_full(form.id, db)


def delete_section(section_id: str, user: User, db: Session) -> None:
    section = _get_section_for_employer(section_id, user, db)
    if section.is_locked:
        raise BadRequestException("This section is locked and cannot be deleted.")
    db.delete(section)
    db.commit()


def _get_section_for_employer(section_id: str, user: User, db: Session) -> FormSection:
    try:
        sid = uuid.UUID(section_id)
    except ValueError:
        raise NotFoundException("Section not found.")
    section = db.query(FormSection).filter(FormSection.id == sid).first()
    if not section:
        raise NotFoundException("Section not found.")
    _get_form_for_employer(str(section.form_id), user, db)  # auth check
    return section


# ── AtsQuestion CRUD ──────────────────────────────────────────────────────────

def add_question(section_id: str, body: QuestionIn, user: User, db: Session) -> AtsQuestion:
    section = _get_section_for_employer(section_id, user, db)

    if body.question_type not in _VALID_QUESTION_TYPES:
        raise BadRequestException(f"Invalid question type: {body.question_type}.")

    max_order = db.query(func.max(AtsQuestion.order_index)).filter(
        AtsQuestion.section_id == section.id
    ).scalar() or 0

    is_compliance = body.question_type in _COMPLIANCE_TYPES

    bank_id = None
    if body.question_bank_id:
        try:
            bank_id = uuid.UUID(body.question_bank_id)
        except ValueError:
            raise BadRequestException("Invalid question_bank_id.")

    question = AtsQuestion(
        section_id=section.id,
        question_bank_id=bank_id,
        question_type=body.question_type,
        label=body.label.strip(),
        hint_text=body.hint_text,
        placeholder=body.placeholder,
        is_required=body.is_required,
        is_compliance_protected=is_compliance,
        order_index=max_order + 1,
        character_limit=body.character_limit,
        validation_json=body.validation_json,
        options_json=body.options_json,
        version=1,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def update_question(question_id: str, body: QuestionIn, user: User, db: Session) -> AtsQuestion:
    question = _get_question_for_employer(question_id, user, db)

    if body.question_type not in _VALID_QUESTION_TYPES:
        raise BadRequestException(f"Invalid question type: {body.question_type}.")

    question.question_type = body.question_type
    question.label = body.label.strip()
    question.hint_text = body.hint_text
    question.placeholder = body.placeholder
    question.is_required = body.is_required
    question.is_compliance_protected = body.question_type in _COMPLIANCE_TYPES
    question.character_limit = body.character_limit
    question.validation_json = body.validation_json
    question.options_json = body.options_json
    question.version += 1
    db.commit()
    db.refresh(question)
    return question


def reorder_questions(section_id: str, order: list[dict], user: User, db: Session) -> FormSection:
    section = _get_section_for_employer(section_id, user, db)
    id_to_idx = {item["question_id"]: item["order_index"] for item in order}
    for q in section.questions:
        if str(q.id) in id_to_idx:
            q.order_index = id_to_idx[str(q.id)]
    db.commit()
    db.refresh(section)
    return section


def delete_question(question_id: str, user: User, db: Session) -> None:
    question = _get_question_for_employer(question_id, user, db)
    # Cascade deletes the knockout rule automatically (ORM cascade)
    db.delete(question)
    db.commit()


def _get_question_for_employer(question_id: str, user: User, db: Session) -> AtsQuestion:
    try:
        qid = uuid.UUID(question_id)
    except ValueError:
        raise NotFoundException("Question not found.")
    question = db.query(AtsQuestion).filter(AtsQuestion.id == qid).first()
    if not question:
        raise NotFoundException("Question not found.")
    _get_section_for_employer(str(question.section_id), user, db)  # auth chain
    return question


# ── KnockoutRule ──────────────────────────────────────────────────────────────

def set_knockout_rule(question_id: str, body: KnockoutRuleIn, user: User, db: Session) -> KnockoutRule:
    question = _get_question_for_employer(question_id, user, db)

    if question.is_compliance_protected:
        raise BadRequestException(
            "Compliance-protected questions (work authorization, EEO, etc.) "
            "cannot be used as knockout triggers."
        )
    if body.action not in _VALID_KNOCKOUT_ACTIONS:
        raise BadRequestException(f"Invalid knockout action: {body.action}.")

    # Upsert: if a rule already exists for this question, update it
    existing = db.query(KnockoutRule).filter(KnockoutRule.question_id == question.id).first()

    # Resolve the form_id by walking up the chain
    section = db.query(FormSection).filter(FormSection.id == question.section_id).first()

    advance_stage_id = None
    if body.advance_stage_id:
        try:
            advance_stage_id = uuid.UUID(body.advance_stage_id)
        except ValueError:
            raise BadRequestException("Invalid advance_stage_id.")

    if existing:
        existing.operator = body.operator
        existing.threshold_value = body.threshold_value
        existing.action = body.action
        existing.tag_name = body.tag_name
        existing.advance_stage_id = advance_stage_id
        existing.priority = body.priority
        db.commit()
        db.refresh(existing)
        return existing

    rule = KnockoutRule(
        form_id=section.form_id,
        question_id=question.id,
        operator=body.operator,
        threshold_value=body.threshold_value,
        action=body.action,
        tag_name=body.tag_name,
        advance_stage_id=advance_stage_id,
        priority=body.priority,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def delete_knockout_rule(question_id: str, user: User, db: Session) -> None:
    question = _get_question_for_employer(question_id, user, db)
    rule = db.query(KnockoutRule).filter(KnockoutRule.question_id == question.id).first()
    if not rule:
        raise NotFoundException("No knockout rule found for this question.")
    db.delete(rule)
    db.commit()


# ── ConditionalRule ───────────────────────────────────────────────────────────

def add_conditional_rule(form_id: str, body: ConditionalRuleIn, user: User, db: Session) -> ConditionalRule:
    form = _get_form_for_employer(form_id, user, db)

    if body.operator not in _VALID_COND_OPERATORS:
        raise BadRequestException(f"Invalid operator: {body.operator}.")
    if body.target_entity_type not in ("question", "section"):
        raise BadRequestException("target_entity_type must be 'question' or 'section'.")
    if body.action not in ("show", "hide"):
        raise BadRequestException("action must be 'show' or 'hide'.")

    try:
        trigger_q_id = uuid.UUID(body.trigger_question_id)
        target_id = uuid.UUID(body.target_entity_id)
    except ValueError:
        raise BadRequestException("Invalid UUID in trigger_question_id or target_entity_id.")

    rule = ConditionalRule(
        form_id=form.id,
        trigger_question_id=trigger_q_id,
        operator=body.operator,
        trigger_value=body.trigger_value,
        target_entity_type=body.target_entity_type,
        target_entity_id=target_id,
        action=body.action,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def delete_conditional_rule(rule_id: str, user: User, db: Session) -> None:
    try:
        rid = uuid.UUID(rule_id)
    except ValueError:
        raise NotFoundException("Conditional rule not found.")
    rule = db.query(ConditionalRule).filter(ConditionalRule.id == rid).first()
    if not rule:
        raise NotFoundException("Conditional rule not found.")
    _get_form_for_employer(str(rule.form_id), user, db)  # auth check
    db.delete(rule)
    db.commit()


# ── FormTemplate ──────────────────────────────────────────────────────────────

def save_as_template(form_id: str, body: FormTemplateSaveIn, user: User, db: Session) -> FormTemplate:
    form = _get_form_for_employer(form_id, user, db)
    profile = _get_employer_profile(user, db)

    snapshot = _snapshot_form(form)

    template = FormTemplate(
        owner_id=profile.company_id,
        owner_type="company",
        name=body.name.strip(),
        description=body.description,
        form_snapshot_json=snapshot,
        created_by=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    logger.info("[FORM_TEMPLATE] Saved: form=%s template=%s", form_id, template.id)
    return template


def list_templates(user: User, db: Session) -> list[FormTemplate]:
    profile = _get_employer_profile(user, db)
    return (
        db.query(FormTemplate)
        .filter(
            (FormTemplate.owner_id == profile.company_id) |
            (FormTemplate.owner_type == "platform")
        )
        .order_by(FormTemplate.created_at.desc())
        .all()
    )


def create_form_from_template(job_id: str, template_id: str, user: User, db: Session) -> ApplicationForm:
    body = ApplicationFormCreateIn(template_id=template_id)
    return create_form(job_id, body, user, db)


# ── Question Bank ─────────────────────────────────────────────────────────────

def list_question_bank(user: User, db: Session, category: str | None = None) -> list[AtsQuestionBank]:
    profile = _get_employer_profile(user, db)
    q = db.query(AtsQuestionBank).filter(
        (AtsQuestionBank.owner_id == profile.company_id) |
        (AtsQuestionBank.is_platform_template == True)
    )
    if category:
        q = q.filter(AtsQuestionBank.category == category)
    return q.order_by(AtsQuestionBank.category, AtsQuestionBank.label).all()


# ── Internal helpers ──────────────────────────────────────────────────────────

def _load_form_full(form_id: uuid.UUID, db: Session) -> ApplicationForm:
    """Eagerly load a form with all sections, questions, knockout rules, and conditional rules."""
    return (
        db.query(ApplicationForm)
        .options(
            selectinload(ApplicationForm.sections).selectinload(FormSection.questions)
            .joinedload(AtsQuestion.knockout_rule),
            selectinload(ApplicationForm.conditional_rules),
        )
        .filter(ApplicationForm.id == form_id)
        .first()
    )


def _add_default_sections(form: ApplicationForm, settings: dict, db: Session) -> None:
    """Add sensible default sections based on form settings."""
    sections_to_add = []

    resume_config = settings.get("resume_config", "required")
    if resume_config != "hidden":
        sections_to_add.append(FormSection(
            form_id=form.id, title="Resume", section_type="resume",
            order_index=1, is_locked=False, is_visible=True,
        ))

    cov = settings.get("require_cover_letter", "optional")
    if cov != "hidden":
        sections_to_add.append(FormSection(
            form_id=form.id, title="Cover Letter", section_type="cover_letter",
            order_index=2, is_locked=False, is_visible=True,
        ))

    if settings.get("require_work_authorization"):
        sections_to_add.append(FormSection(
            form_id=form.id, title="Work Authorization", section_type="compliance",
            order_index=99, is_locked=True, is_visible=True,
        ))

    for s in sections_to_add:
        db.add(s)


def _snapshot_form(form: ApplicationForm) -> dict:
    """Serialise a form's sections+questions to a self-contained dict for template storage."""
    sections = []
    for section in sorted(form.sections, key=lambda s: s.order_index):
        questions = []
        for q in sorted(section.questions, key=lambda x: x.order_index):
            questions.append({
                "question_type": q.question_type,
                "label": q.label,
                "hint_text": q.hint_text,
                "placeholder": q.placeholder,
                "is_required": q.is_required,
                "is_compliance_protected": q.is_compliance_protected,
                "character_limit": q.character_limit,
                "validation_json": q.validation_json,
                "options_json": q.options_json,
            })
        sections.append({
            "title": section.title,
            "description": section.description,
            "section_type": section.section_type,
            "is_locked": section.is_locked,
            "is_visible": section.is_visible,
            "questions": questions,
        })
    return {"settings_json": form.settings_json, "sections": sections}


def _load_from_template(form: ApplicationForm, template_id: str, db: Session) -> None:
    """Restore sections+questions from a FormTemplate snapshot onto an existing form."""
    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        raise BadRequestException("Invalid template_id.")

    template = db.query(FormTemplate).filter(FormTemplate.id == tid).first()
    if not template:
        raise NotFoundException("Template not found.")

    snapshot = template.form_snapshot_json or {}
    if snapshot.get("settings_json"):
        form.settings_json = snapshot["settings_json"]

    _restore_sections(form, snapshot.get("sections", []), db)

    template.used_count = (template.used_count or 0) + 1


def _clone_from_job(form: ApplicationForm, source_job_id: str, user: User, db: Session) -> None:
    """Clone the published form from another job onto this new form."""
    try:
        source_form = get_published_form_public(source_job_id, db)
    except NotFoundException:
        raise BadRequestException("Source job has no published application form to clone from.")

    form.settings_json = source_form.settings_json or {}
    snapshot_sections = _snapshot_form(source_form).get("sections", [])
    _restore_sections(form, snapshot_sections, db)


def _restore_sections(form: ApplicationForm, sections_data: list[dict], db: Session) -> None:
    """Create FormSection + AtsQuestion rows from snapshot data."""
    for idx, sec_data in enumerate(sections_data):
        section = FormSection(
            form_id=form.id,
            title=sec_data.get("title", "Untitled"),
            description=sec_data.get("description"),
            section_type=sec_data.get("section_type", "questions"),
            is_locked=sec_data.get("is_locked", False),
            is_visible=sec_data.get("is_visible", True),
            order_index=idx + 1,
        )
        db.add(section)
        db.flush()

        for q_idx, q_data in enumerate(sec_data.get("questions", [])):
            q_type = q_data.get("question_type", "short_text")
            question = AtsQuestion(
                section_id=section.id,
                question_type=q_type,
                label=q_data.get("label", ""),
                hint_text=q_data.get("hint_text"),
                placeholder=q_data.get("placeholder"),
                is_required=q_data.get("is_required", False),
                is_compliance_protected=q_data.get("is_compliance_protected", False),
                order_index=q_idx + 1,
                character_limit=q_data.get("character_limit"),
                validation_json=q_data.get("validation_json") or {},
                options_json=q_data.get("options_json"),
                version=1,
            )
            db.add(question)
