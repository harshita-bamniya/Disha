import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, String, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.database import Base

GENDER_ENUM = Enum("male", "female", "other", "prefer_not_to_say", name="gender_enum")
QUALIFICATION_ENUM = Enum("graduate", "post_graduate", "doctorate", "diploma", "other", name="qualification_enum")
UPSC_EXAM_ENUM = Enum("cse", "capf", "cds", "ies", "cms", "state_pcs", "other", name="upsc_exam_enum")
UPSC_STAGE_ENUM = Enum("none", "prelims", "mains", "interview", name="upsc_stage_enum")
RISK_TOLERANCE_ENUM = Enum("low", "medium", "high", name="risk_tolerance_enum")
MOTIVATION_TYPE_ENUM = Enum("intrinsic", "extrinsic", "mixed", name="motivation_type_enum")
IDENTITY_ATTACHMENT_ENUM = Enum("low", "medium", "high", name="identity_attachment_enum")
SUPPORT_SYSTEM_ENUM = Enum("strong", "moderate", "weak", name="support_system_enum")
COMPANY_SIZE_ENUM = Enum(
    "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+",
    name="company_size_enum",
)


def utcnow():
    return datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="role")
    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)
    description = Column(Text)

    __table_args__ = (UniqueConstraint("resource", "action", name="uq_permission_resource_action"),)

    role_permissions = relationship("RolePermission", back_populates="permission")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(Text, nullable=False)
    phone_verified = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    preferred_language = Column(Enum("en", "hi", name="language_enum"), default="hi", nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    role = relationship("Role", back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    otp_verifications = relationship("OtpVerification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    employer_profile = relationship("EmployerProfile", back_populates="user", uselist=False, foreign_keys="EmployerProfile.user_id")
    aspirant_profile = relationship("AspirantProfile", back_populates="user", uselist=False)
    psychological_assessment = relationship("PsychologicalAssessment", back_populates="user", uselist=False)
    krs_score = relationship("KrsScore", back_populates="user", uselist=False)
    career_matches = relationship("CareerMatch", back_populates="user", order_by="CareerMatch.match_score.desc()")
    career_selections = relationship("UserCareerSelection", back_populates="user", cascade="all, delete-orphan")
    job_preparations = relationship("UserJobPreparation", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(Text, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    issued_ip = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at.replace(tzinfo=timezone.utc)

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_valid(self) -> bool:
        return not self.is_expired and not self.is_revoked


class OtpVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    target = Column(String(255), nullable=False, index=True)
    otp_hash = Column(Text, nullable=False)
    purpose = Column(
        Enum("register", "login", "reset", "verify", name="otp_purpose_enum"),
        nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="otp_verifications")

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at.replace(tzinfo=timezone.utc)

    @property
    def is_used(self) -> bool:
        return self.used_at is not None


class AspirantProfile(Base):
    __tablename__ = "aspirant_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # ── Step 1: Personal ──────────────────────────────────────────────────────
    full_name = Column(String(150), nullable=True)
    date_of_birth = Column(String(10), nullable=True)      # stored as YYYY-MM-DD string
    gender = Column(GENDER_ENUM, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)

    # ── Step 2: Education ─────────────────────────────────────────────────────
    highest_qualification = Column(QUALIFICATION_ENUM, nullable=True)
    degree = Column(String(150), nullable=True)
    field_of_study = Column(String(150), nullable=True)
    institution = Column(String(255), nullable=True)
    graduation_year = Column(Integer, nullable=True)

    # ── Step 3: UPSC Journey ──────────────────────────────────────────────────
    upsc_exam = Column(UPSC_EXAM_ENUM, nullable=True)
    years_preparing = Column(Integer, nullable=True)
    upsc_attempts = Column(Integer, nullable=True, default=0)
    highest_stage_cleared = Column(UPSC_STAGE_ENUM, nullable=True, default="none")
    optional_subject = Column(String(100), nullable=True)

    # ── Step 4: Work Experience ───────────────────────────────────────────────
    has_work_experience = Column(Boolean, nullable=True)
    work_experience_years = Column(Integer, nullable=True)
    work_experience_domain = Column(String(150), nullable=True)
    last_designation = Column(String(150), nullable=True)

    # ── Step 5: Skills ────────────────────────────────────────────────────────
    skills = Column(JSONB, nullable=True)                  # list[str]

    # ── Step 6: Career Preferences ───────────────────────────────────────────
    preferred_sectors = Column(JSONB, nullable=True)       # list[str]
    preferred_locations = Column(JSONB, nullable=True)     # list[str]
    open_to_relocation = Column(Boolean, nullable=True)
    expected_salary_min = Column(Integer, nullable=True)   # LPA
    expected_salary_max = Column(Integer, nullable=True)   # LPA

    # ── Completion tracking ───────────────────────────────────────────────────
    current_step = Column(Integer, nullable=False, default=1)
    is_completed = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="aspirant_profile")


class PsychologicalAssessment(Base):
    """Step 7 of onboarding — captures psychological state for KRS R-score."""
    __tablename__ = "psychological_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Numeric scores (0-100) — derived from option selections in Step 7
    burnout_score = Column(Integer, nullable=False)             # 0=fresh, 100=burnt out
    confidence_index = Column(Integer, nullable=False)          # 0=very anxious, 100=very confident
    financial_pressure_score = Column(Integer, nullable=False)  # 0=no rush, 100=urgent

    # Enum dimensions
    risk_tolerance = Column(RISK_TOLERANCE_ENUM, nullable=False)
    motivation_type = Column(MOTIVATION_TYPE_ENUM, nullable=False)
    identity_attachment = Column(IDENTITY_ATTACHMENT_ENUM, nullable=False)
    support_system = Column(SUPPORT_SYSTEM_ENUM, nullable=False)

    # Groq-generated personalized first message
    disha_insight = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="psychological_assessment")


class EmployerProfile(Base):
    __tablename__ = "employer_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100), nullable=False)
    company_size = Column(COMPANY_SIZE_ENUM, nullable=False)
    website = Column(String(500), nullable=True)
    gst_number = Column(String(20), nullable=True)
    contact_person = Column(String(150), nullable=False)
    designation = Column(String(100), nullable=True)
    city = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Admin approval workflow
    is_approved = Column(Boolean, default=False, nullable=False, index=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="employer_profile", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
    job_postings = relationship("JobPosting", back_populates="employer", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(100), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    log_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", back_populates="audit_logs")


# ── Module 03: KRS Intelligence Engine ───────────────────────────────────────

class CareerTrack(Base):
    """Pre-seeded career paths that aspirants can be matched against."""
    __tablename__ = "career_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    sector = Column(String(100), nullable=False)
    required_skills = Column(JSONB, nullable=False)        # list[str] — from skill master list
    min_k_score = Column(Integer, nullable=False, default=0)   # minimum K score recommended
    salary_range = Column(String(50), nullable=True)       # e.g. "8–20 LPA"
    growth_outlook = Column(String(20), nullable=True)     # "high", "medium", "low"
    example_roles = Column(JSONB, nullable=True)           # list[str]
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    matches = relationship("CareerMatch", back_populates="track")
    selections = relationship("UserCareerSelection", back_populates="track")


class KrsScore(Base):
    """Computed KRS score for an aspirant — recalculated on each profile update."""
    __tablename__ = "krs_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    k_score = Column(Integer, nullable=False)              # Knowledge  0-100
    r_score = Column(Integer, nullable=False)              # Readiness  0-100
    s_score = Column(Integer, nullable=False)              # Skills     0-100
    composite = Column(Integer, nullable=False)            # Weighted composite 0-100
    profile_embedding = Column(Vector(384), nullable=True) # sentence-transformers profile vector
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="krs_score")


class CareerMatch(Base):
    """Top career track matches for an aspirant, scored 0-100."""
    __tablename__ = "career_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="CASCADE"), nullable=False)
    match_score = Column(Integer, nullable=False)          # 0-100
    skill_overlap = Column(Integer, nullable=False)        # % of required skills the user has
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="career_matches")
    track = relationship("CareerTrack", back_populates="matches")

    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_career_match_user_track"),)


# ── Module 04 prep: Employer Job Postings ────────────────────────────────────

class JobPosting(Base):
    """Live job postings created by approved employers."""
    __tablename__ = "job_postings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    sector = Column(String(100), nullable=False)
    required_skills = Column(JSONB, nullable=False)        # list[str] — same master list
    min_k_score = Column(Integer, nullable=False, default=0)
    salary_min = Column(Integer, nullable=True)            # LPA e.g. 10
    salary_max = Column(Integer, nullable=True)            # LPA e.g. 18
    growth_outlook = Column(String(20), nullable=True)     # "high" | "medium" | "low"
    job_type = Column(String(20), nullable=True)           # "remote" | "pan_india" | "hybrid" | "onsite"
    location = Column(String(200), nullable=True)          # city/cities e.g. "New Delhi, Mumbai"
    employment_type = Column(String(30), nullable=True)    # "full_time" | "part_time" | "internship" | "contract" | "freelance"
    expires_at = Column(Date, nullable=True)               # date the posting closes
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    description_embedding = Column(Vector(384), nullable=True)  # sentence-transformers job vector

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employer = relationship("EmployerProfile", back_populates="job_postings")
    preparations = relationship("UserJobPreparation", back_populates="job", cascade="all, delete-orphan")


# ── Module 04: Career Mapping ─────────────────────────────────────────────────

class UserCareerSelection(Base):
    """Aspirant-chosen career tracks to pursue (max 2 per user)."""
    __tablename__ = "user_career_selections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = Column(UUID(as_uuid=True), ForeignKey("career_tracks.id", ondelete="CASCADE"), nullable=False)
    selected_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="career_selections")
    track = relationship("CareerTrack", back_populates="selections")

    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_career_selection_user_track"),)


class UserJobPreparation(Base):
    """Jobs an aspirant has chosen to prepare for (via dashboard)."""
    __tablename__ = "user_job_preparations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    prepared_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="job_preparations")
    job = relationship("JobPosting", back_populates="preparations")

    __table_args__ = (UniqueConstraint("user_id", "job_id", name="uq_job_preparation_user_job"),)
