# Import all models so Alembic can detect them for migrations
from app.models.user import (  # noqa: F401
    Role, Permission, RolePermission, User, RefreshToken,
    OtpVerification, AspirantProfile, PsychologicalAssessment,
    EmployerProfile, AuditLog, CareerTrack, KrsScore, CareerMatch,
    JobPosting, UserCareerSelection, UserJobPreparation,
)
from app.models.mvp2 import (  # noqa: F401
    LearningPath, PathModule, Lesson, UserLearningEnrollment,
    LessonCompletion, UserStreak,
    ResumeTemplate, Resume, ResumeSection, ResumeVersion,
    QuestionBank, InterviewSession, SessionResponse, InterviewFeedback,
    Conversation, Message, CounsellorMemory, CounsellorMemoryEmbedding, SafetyFlag,
)
from app.models.mvp3 import (  # noqa: F401
    Application, ApplicationStatusHistory,
    PromptTemplate,
    PlatformSetting, FeatureFlag,
    UserEvent,
    OAuthProvider,
    CandidateNote, CandidateRating, CandidateInterviewFeedback,
)
from app.models.roadmap import (  # noqa: F401
    TicketTemplate, UserRoadmap, UserSkillCompetence,
    StageGateEvaluation, TicketSubmission,
)
from app.models.xp import UserXP, XPTransaction  # noqa: F401
from app.models.job_plan import JobLearningPlan  # noqa: F401
from app.models.companion import CompanionMoodEntry, CompanionMilestone  # noqa: F401
from app.models.company import Company, CompanyInvite  # noqa: F401
from app.models.employer_verification import (  # noqa: F401
    EmployerVerification, EmployerVerificationDocument, EmployerVerificationEvent,
)
from app.models.subscription import SubscriptionPlan, CompanySubscription  # noqa: F401
from app.models.support import SupportTicket, TicketMessage, TicketAttachment  # noqa: F401
from app.models.ats import (  # noqa: F401
    ApplicationForm, FormSection, AtsQuestion, AtsQuestionBank,
    KnockoutRule, ConditionalRule, FormTemplate,
    CandidateResumeFile, ApplicationDraft,
    ApplicationResponse, ApplicationDocument,
)
