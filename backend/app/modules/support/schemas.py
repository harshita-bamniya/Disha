from typing import Optional
from pydantic import BaseModel, Field


class UserCreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=300)
    body: Optional[str] = None
    priority: str = "normal"
    category: str = "general"
    context_job_id: Optional[str] = None
    context_application_id: Optional[str] = None


class UserAddMessageRequest(BaseModel):
    body: str = Field(..., min_length=1)
