"""Application Form Builder API (Phase 3).

Employer-facing endpoints for creating and managing per-job application forms.
All mutation endpoints require an authenticated employer user.
The GET /jobs/{job_id}/application-form endpoint is public (candidate apply flow).
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.exceptions import (
    AuthException, BadRequestException, ConflictException,
    ForbiddenException, NotFoundException,
)
from app.core.rbac import get_current_verified_user, require_employer
from app.database import get_db
from app.models.user import User
from app.modules.application_forms import service
from app.modules.application_forms.schemas import (
    ApplicationFormCreateIn, ApplicationFormOut, ApplicationFormSummaryOut,
    ApplicationFormUpdateIn,
    AtsQuestionBankOut,
    ConditionalRuleIn, ConditionalRuleOut,
    FormSectionIn, FormSectionOut,
    FormTemplateSaveIn, FormTemplateOut,
    KnockoutRuleIn, KnockoutRuleOut,
    QuestionIn, QuestionOut,
    QuestionReorderItem, SectionReorderItem,
)

router = APIRouter(tags=["Application Form Builder"])


def _exc(e: Exception) -> HTTPException:
    if isinstance(e, NotFoundException):
        return HTTPException(status_code=404, detail=str(e.detail))
    if isinstance(e, ConflictException):
        return HTTPException(status_code=409, detail=str(e.detail))
    if isinstance(e, (BadRequestException, ForbiddenException, AuthException)):
        return HTTPException(status_code=e.status_code, detail=str(e.detail))
    logger.exception("Unhandled exception in application_forms router: %s", e)
    return HTTPException(status_code=500, detail="Unexpected error.")


# ═══════════════════════════════════════════════════════════════════════════════
# APPLICATION FORM — top-level CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/jobs/{job_id}/application-form", response_model=ApplicationFormOut, status_code=201)
def create_form(
    job_id: str,
    body: ApplicationFormCreateIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Create a draft application form for a job. Optionally load from a template or clone."""
    try:
        form = service.create_form(job_id, body, current_user, db)
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


@router.get("/jobs/{job_id}/application-form", response_model=ApplicationFormOut)
def get_published_form(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Return the published application form for a job — public (used by candidates)."""
    try:
        form = service.get_published_form_public(job_id, db)
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


@router.get("/jobs/{job_id}/application-form/draft", response_model=ApplicationFormOut)
def get_draft_form(
    job_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Return the draft (or published) form for the employer form builder."""
    try:
        form = service.get_form_by_job(job_id, draft=True, user=current_user, db=db)
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


@router.put("/application-forms/{form_id}", response_model=ApplicationFormOut)
def update_form(
    form_id: str,
    body: ApplicationFormUpdateIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Update form-level settings (resume config, cover letter requirement, etc.)."""
    try:
        form = service.update_form(form_id, body, current_user, db)
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


@router.post("/application-forms/{form_id}/publish", response_model=ApplicationFormOut)
def publish_form(
    form_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Validate and publish the form. Increments version. Returns the published form."""
    try:
        form = service.publish_form(form_id, current_user, db)
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/application-forms/{form_id}/sections", response_model=FormSectionOut, status_code=201)
def add_section(
    form_id: str,
    body: FormSectionIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Add a new section to the form."""
    try:
        section = service.add_section(form_id, body, current_user, db)
        return FormSectionOut.model_validate(section)
    except Exception as e:
        raise _exc(e)


@router.put("/form-sections/{section_id}", response_model=FormSectionOut)
def update_section(
    section_id: str,
    body: FormSectionIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Update a section's title, description, or type."""
    try:
        section = service.update_section(section_id, body, current_user, db)
        return FormSectionOut.model_validate(section)
    except Exception as e:
        raise _exc(e)


@router.post("/application-forms/{form_id}/sections/reorder", response_model=ApplicationFormOut)
def reorder_sections(
    form_id: str,
    order: list[SectionReorderItem],
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Reorder sections by supplying each section_id with its new order_index."""
    try:
        form = service.reorder_sections(
            form_id, [i.model_dump() for i in order], current_user, db
        )
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


@router.delete("/form-sections/{section_id}", status_code=204)
def delete_section(
    section_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Delete a section and all its questions."""
    try:
        service.delete_section(section_id, current_user, db)
    except Exception as e:
        raise _exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# QUESTIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/form-sections/{section_id}/questions", response_model=QuestionOut, status_code=201)
def add_question(
    section_id: str,
    body: QuestionIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Add a question to a section."""
    try:
        question = service.add_question(section_id, body, current_user, db)
        return QuestionOut.model_validate(question)
    except Exception as e:
        raise _exc(e)


@router.put("/questions/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: str,
    body: QuestionIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Update a question. Increments the question version."""
    try:
        question = service.update_question(question_id, body, current_user, db)
        return QuestionOut.model_validate(question)
    except Exception as e:
        raise _exc(e)


@router.post("/form-sections/{section_id}/questions/reorder", response_model=FormSectionOut)
def reorder_questions(
    section_id: str,
    order: list[QuestionReorderItem],
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Reorder questions within a section."""
    try:
        section = service.reorder_questions(
            section_id, [i.model_dump() for i in order], current_user, db
        )
        return FormSectionOut.model_validate(section)
    except Exception as e:
        raise _exc(e)


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(
    question_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Delete a question (and its knockout rule if one exists)."""
    try:
        service.delete_question(question_id, current_user, db)
    except Exception as e:
        raise _exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# KNOCKOUT RULES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/questions/{question_id}/knockout-rule", response_model=KnockoutRuleOut)
def set_knockout_rule(
    question_id: str,
    body: KnockoutRuleIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Set (create or update) a knockout rule for a question. Compliance questions are blocked."""
    try:
        rule = service.set_knockout_rule(question_id, body, current_user, db)
        return KnockoutRuleOut.model_validate(rule)
    except Exception as e:
        raise _exc(e)


@router.delete("/questions/{question_id}/knockout-rule", status_code=204)
def delete_knockout_rule(
    question_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Remove the knockout rule from a question."""
    try:
        service.delete_knockout_rule(question_id, current_user, db)
    except Exception as e:
        raise _exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# CONDITIONAL RULES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/application-forms/{form_id}/conditional-rule", response_model=ConditionalRuleOut, status_code=201)
def add_conditional_rule(
    form_id: str,
    body: ConditionalRuleIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Add a conditional show/hide rule to the form."""
    try:
        rule = service.add_conditional_rule(form_id, body, current_user, db)
        return ConditionalRuleOut.model_validate(rule)
    except Exception as e:
        raise _exc(e)


@router.delete("/conditional-rules/{rule_id}", status_code=204)
def delete_conditional_rule(
    rule_id: str,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Remove a conditional rule."""
    try:
        service.delete_conditional_rule(rule_id, current_user, db)
    except Exception as e:
        raise _exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# FORM TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/application-forms/{form_id}/save-as-template", response_model=FormTemplateOut, status_code=201)
def save_as_template(
    form_id: str,
    body: FormTemplateSaveIn,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Save the current form configuration as a reusable template."""
    try:
        template = service.save_as_template(form_id, body, current_user, db)
        return FormTemplateOut.model_validate(template)
    except Exception as e:
        raise _exc(e)


@router.get("/application-forms/templates", response_model=list[FormTemplateOut])
def list_templates(
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """List saved templates available to this employer (company + platform templates)."""
    try:
        templates = service.list_templates(current_user, db)
        return [FormTemplateOut.model_validate(t) for t in templates]
    except Exception as e:
        raise _exc(e)


@router.post("/application-forms/from-template", response_model=ApplicationFormOut, status_code=201)
def create_form_from_template(
    job_id: str = Query(...),
    template_id: str = Query(...),
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Create a new application form for a job by loading a saved template."""
    try:
        form = service.create_form_from_template(job_id, template_id, current_user, db)
        return ApplicationFormOut.model_validate(form)
    except Exception as e:
        raise _exc(e)


# ═══════════════════════════════════════════════════════════════════════════════
# QUESTION BANK
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/application-forms/question-bank", response_model=list[AtsQuestionBankOut])
def list_question_bank(
    category: str | None = Query(None),
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Browse the reusable question library (company + platform questions)."""
    try:
        questions = service.list_question_bank(current_user, db, category=category)
        return [AtsQuestionBankOut.model_validate(q) for q in questions]
    except Exception as e:
        raise _exc(e)
