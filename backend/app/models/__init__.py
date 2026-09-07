# Import all models so Alembic can detect them for migrations
from app.models.analytics import UserEvent  # noqa: F401
from app.models.applications import (  # noqa: F401
    Application,
    ApplicationStatusHistory,
    CandidateEmailLog,
    CandidateInterviewFeedback,
    CandidateNote,
    CandidateRating,
    EmployerTask,
    OfferLetter,
    SavedCandidate,
)
from app.models.ats import (  # noqa: F401
    ApplicationDocument,
    ApplicationDraft,
    ApplicationForm,
    ApplicationResponse,
    AtsQuestion,
    AtsQuestionBank,
    CandidateResumeFile,
    ConditionalRule,
    FormSection,
    FormTemplate,
    KnockoutRule,
)
from app.models.companion import CompanionMilestone, CompanionMoodEntry  # noqa: F401
from app.models.company import Company, CompanyInvite  # noqa: F401
from app.models.counsellor import (  # noqa: F401
    Conversation,
    CounsellorMemory,
    CounsellorMemoryEmbedding,
    Message,
    SafetyFlag,
)
from app.models.employer_verification import (  # noqa: F401
    EmployerVerification,
    EmployerVerificationDocument,
    EmployerVerificationEvent,
)
from app.models.integrations import GoogleCalendarToken  # noqa: F401
from app.models.interview import (  # noqa: F401
    InterviewFeedback,
    InterviewHumanReview,
    InterviewOutcome,
    InterviewSession,
    QuestionBank,
    SessionResponse,
)
from app.models.job_plan import JobLearningPlan  # noqa: F401
from app.models.jobs import JobTemplate  # noqa: F401
from app.models.learning import (  # noqa: F401
    LearningPath,
    Lesson,
    LessonCompletion,
    PathModule,
    UserLearningEnrollment,
    UserStreak,
)
from app.models.notifications import AdminAnnouncement, Notification  # noqa: F401
from app.models.pipeline import CompanyPipelineTemplate, JobPipelineStage  # noqa: F401
from app.models.platform import FeatureFlag, PlatformSetting  # noqa: F401
from app.models.prompts import PromptTemplate  # noqa: F401
from app.models.resume import (  # noqa: F401
    Resume,
    ResumeSection,
    ResumeTemplate,
    ResumeVersion,
)
from app.models.roadmap import (  # noqa: F401
    StageGateEvaluation,
    TicketSubmission,
    TicketTemplate,
    UserRoadmap,
    UserSkillCompetence,
)
from app.models.skill_vectors import SkillVector  # noqa: F401
from app.models.subscription import CompanySubscription, SubscriptionPlan  # noqa: F401
from app.models.support import (  # noqa: F401
    SupportTicket,
    TicketAttachment,
    TicketMessage,
)
from app.models.user import (  # noqa: F401
    AspirantProfile,
    AuditLog,
    CareerMatch,
    CareerTrack,
    EmployerProfile,
    JobPosting,
    KrsScore,
    OtpVerification,
    Permission,
    PsychologicalAssessment,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserCareerSelection,
    UserJobPreparation,
)
from app.models.xp import UserXP, XPTransaction  # noqa: F401
