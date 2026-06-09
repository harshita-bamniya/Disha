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
)
