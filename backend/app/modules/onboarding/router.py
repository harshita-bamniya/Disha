from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.rbac import get_current_verified_user
from app.database import get_db
from app.models.user import User
from app.modules.onboarding import service
from app.modules.onboarding.schemas import (
    EducationRequest, OnboardingStatusResponse, PersonalInfoRequest,
    PreferencesRequest, ProfileResponse, PsychologicalAssessmentRequest, SkillsRequest,
    StepSavedResponse, UpscJourneyRequest, WorkExperienceRequest,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.get_profile(current_user, db)


@router.get("/status", response_model=OnboardingStatusResponse)
def get_status(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.get_status(current_user, db)


@router.put("/personal", response_model=StepSavedResponse)
def save_personal(
    body: PersonalInfoRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_personal(current_user, body, db)


@router.put("/education", response_model=StepSavedResponse)
def save_education(
    body: EducationRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_education(current_user, body, db)


@router.put("/upsc-journey", response_model=StepSavedResponse)
def save_upsc_journey(
    body: UpscJourneyRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_upsc_journey(current_user, body, db)


@router.put("/work-experience", response_model=StepSavedResponse)
def save_work_experience(
    body: WorkExperienceRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_work_experience(current_user, body, db)


@router.put("/skills", response_model=StepSavedResponse)
def save_skills(
    body: SkillsRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_skills(current_user, body, db)


@router.put("/preferences", response_model=StepSavedResponse)
def save_preferences(
    body: PreferencesRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_preferences(current_user, body, db)


@router.put("/psychology", response_model=StepSavedResponse)
def save_psychology(
    body: PsychologicalAssessmentRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    return service.save_psychology(current_user, body, db)
