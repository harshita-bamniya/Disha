from datetime import datetime
from typing import Annotated, Optional
from pydantic import BaseModel, BeforeValidator, Field

UUIDStr = Annotated[str, BeforeValidator(str)]


class ResumeFileOut(BaseModel):
    id: UUIDStr
    filename: str
    label: Optional[str]
    format: str
    file_size_bytes: int
    source: str
    last_used_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ResumeLibraryOut(BaseModel):
    resumes: list[ResumeFileOut]
    total: int


class ResumeRenameRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)


class ResumeRecommendation(BaseModel):
    resume_id: str
    filename: str
    label: Optional[str]
    relevance_score: int = Field(..., ge=0, le=100)
    reason: str


class ResumeRecommendationOut(BaseModel):
    recommendations: list[ResumeRecommendation]
    job_id: str
