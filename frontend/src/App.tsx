import { lazy, Suspense, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import PageLoader from '@/components/PageLoader'

// ── Global Error Boundary ─────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      const isDev = import.meta.env.DEV
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FEF2F2' }}>
          <div style={{ maxWidth: 600, background: 'white', borderRadius: 16, padding: 32, border: '1px solid #FCA5A5', boxShadow: '0 4px 20px rgba(220,38,38,0.1)' }}>
            <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 800, color: '#DC2626', marginBottom: 12 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              An unexpected error occurred. Please reload the page. If the problem persists, contact support.
            </p>
            {isDev && (
              <pre style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {err.message}{'\n\n'}{err.stack}
              </pre>
            )}
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useAuthStore } from '@/stores/authStore'
import { useEmployerPermissions } from '@/modules/employer/hooks/useJobs'

// Auth pages
import LoginPage from '@/modules/auth/pages/LoginPage'
import RegisterPage from '@/modules/auth/pages/RegisterPage'
import VerifyOtpPage from '@/modules/auth/pages/VerifyOtpPage'
import VerifyEmailPage from '@/modules/auth/pages/VerifyEmailPage'
import EmployerRegisterPage from '@/modules/auth/pages/EmployerRegisterPage'
import EmployerVerifyOtpPage from '@/modules/auth/pages/EmployerVerifyOtpPage'
import EmployerPendingPage from '@/modules/auth/pages/EmployerPendingPage'
import TwoFactorChallengePage from '@/modules/auth/pages/TwoFactorChallengePage'
import SecuritySettingsPage from '@/modules/auth/pages/SecuritySettingsPage'

// Onboarding pages
import Step1Personal from '@/modules/onboarding/pages/Step1Personal'
import Step2Education from '@/modules/onboarding/pages/Step2Education'
import Step3UpscJourney from '@/modules/onboarding/pages/Step3UpscJourney'
import Step4WorkExperience from '@/modules/onboarding/pages/Step4WorkExperience'
import Step5Skills from '@/modules/onboarding/pages/Step5Skills'
import Step6Preferences from '@/modules/onboarding/pages/Step6Preferences'
import Step7Psychology from '@/modules/onboarding/pages/Step7Psychology'
import { useOnboardingStatus } from '@/modules/onboarding/hooks/useOnboarding'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import DishaLanding from '@/pages/DishaLanding'
import ProfilePage from '@/modules/profile/pages/ProfilePage'
import EmployerDashboardPage from '@/modules/employer/pages/EmployerDashboardPage'
import EmployerLayout from '@/modules/employer/components/EmployerLayout'
const EmployerJobsPage = lazy(() => import('@/modules/employer/pages/EmployerJobsPage'))
const EmployerVerificationPage = lazy(() => import('@/modules/employer/pages/EmployerVerificationPage'))
const EmployerSetupWizardPage = lazy(() => import('@/modules/employer/pages/EmployerSetupWizardPage'))
const CompanyTeamPage = lazy(() => import('@/modules/employer/pages/CompanyTeamPage'))
const EmployerAnalyticsPage = lazy(() => import('@/modules/employer/pages/EmployerAnalyticsPage'))
const TalentPoolPage = lazy(() => import('@/modules/employer/pages/TalentPoolPage'))
const EmployerCalendarPage = lazy(() => import('@/modules/employer/pages/EmployerCalendarPage'))
const SubscriptionPage = lazy(() => import('@/modules/employer/pages/SubscriptionPage'))
const DepartmentsPage = lazy(() => import('@/modules/employer/pages/DepartmentsPage'))
const DepartmentDetailPage = lazy(() => import('@/modules/employer/pages/DepartmentDetailPage'))
const JobTemplatesPage = lazy(() => import('@/modules/employer/pages/JobTemplatesPage'))
const ReferralsPage = lazy(() => import('@/modules/employer/pages/ReferralsPage'))
const EmployerApplicantsPage = lazy(() => import('@/modules/employer/pages/EmployerApplicantsPage'))
const EmployerSupportPage = lazy(() => import('@/modules/employer/pages/SupportPage'))
const CandidateSupportPage = lazy(() => import('@/modules/aspirant/pages/SupportPage'))
const EmployerInterviewsPage = lazy(() => import('@/modules/employer/pages/EmployerInterviewsPage'))
const EmployerOffersPage = lazy(() => import('@/modules/employer/pages/EmployerOffersPage'))
import ForgotPasswordPage from '@/modules/auth/pages/ForgotPasswordPage'
import { PLATFORM_ADMIN_ROLES, EMPLOYER_ROLES } from '@/types'

// Admin portal — layout + individual pages (lazy for code-splitting)
const AdminLayout            = lazy(() => import('@/modules/admin/layout/AdminLayout'))
const AdminDashboard         = lazy(() => import('@/modules/admin/pages/AdminDashboard'))
const EmployersPage          = lazy(() => import('@/modules/admin/pages/EmployersPage'))
const EmployerDetailPage     = lazy(() => import('@/modules/admin/pages/EmployerDetailPage'))
const CandidatesPage         = lazy(() => import('@/modules/admin/pages/CandidatesPage'))
const CandidateDetailPage    = lazy(() => import('@/modules/admin/pages/CandidateDetailPage'))
const KycQueuePage           = lazy(() => import('@/modules/admin/pages/KycQueuePage'))
const AdminJobsPage          = lazy(() => import('@/modules/admin/pages/JobsPage'))
const AdminJobDetailPage     = lazy(() => import('@/modules/admin/pages/JobDetailPage'))
const ApplicationsPage       = lazy(() => import('@/modules/admin/pages/ApplicationsPage'))
const CareerTracksPage       = lazy(() => import('@/modules/admin/pages/CareerTracksPage'))
const SubAdminsPage          = lazy(() => import('@/modules/admin/pages/SubAdminsPage'))
const RolesPage              = lazy(() => import('@/modules/admin/pages/RolesPage'))
const AuditLogPage           = lazy(() => import('@/modules/admin/pages/AuditLogPage'))
const BillingPage            = lazy(() => import('@/modules/admin/pages/BillingPage'))
const SubscriptionsPage      = lazy(() => import('@/modules/admin/pages/SubscriptionsPage'))
const PlatformSettingsPage   = lazy(() => import('@/modules/admin/pages/PlatformSettingsPage'))
const AiConfigPage           = lazy(() => import('@/modules/admin/pages/AiConfigPage'))
const AnalyticsPage          = lazy(() => import('@/modules/admin/pages/AnalyticsPage'))
const IntegrationsPage       = lazy(() => import('@/modules/admin/pages/IntegrationsPage'))
const SystemMonitoringPage   = lazy(() => import('@/modules/admin/pages/SystemMonitoringPage'))
const NotificationsPage      = lazy(() => import('@/modules/admin/pages/NotificationsPage'))
const ReportsPage            = lazy(() => import('@/modules/admin/pages/ReportsPage'))
const EmployerReportsPage    = lazy(() => import('@/modules/admin/pages/EmployerReportsPage'))
const JobReportsPage         = lazy(() => import('@/modules/admin/pages/JobReportsPage'))
const CandidateReportsPage   = lazy(() => import('@/modules/admin/pages/CandidateReportsPage'))
const FinancialReportsPage   = lazy(() => import('@/modules/admin/pages/FinancialReportsPage'))
const SupportPage            = lazy(() => import('@/modules/admin/pages/SupportPage'))
const TicketDetailPage       = lazy(() => import('@/modules/admin/pages/TicketDetailPage'))

// Phase 3 lazy pages — employer matching
const JobsPage              = lazy(() => import('@/modules/jobs/pages/JobsPage'))
const JobDetailPage         = lazy(() => import('@/modules/jobs/pages/JobDetailPage'))
const MyApplicationsPage    = lazy(() => import('@/modules/jobs/pages/MyApplicationsPage'))
const CandidatePipelinePage = lazy(() => import('@/modules/employer/pages/CandidatePipelinePage'))
// Phase 7 — ATS application wizard
const ApplyPage             = lazy(() => import('@/modules/jobs/pages/ApplyPage'))
// Phase 8 — Employer Form Builder
const FormBuilderPage       = lazy(() => import('@/modules/employer/pages/FormBuilderPage'))

// MVP2 lazy pages
const ResumeListPage        = lazy(() => import('@/modules/resume/pages/ResumeListPage'))
const ResumeLibraryPage     = lazy(() => import('@/modules/resume/pages/ResumeLibraryPage'))
const ResumeEditorPage      = lazy(() => import('@/modules/resume/pages/ResumeEditorPage'))
const CounsellorPage        = lazy(() => import('@/modules/counsellor/pages/CounsellorPage'))
const MockInterviewPage       = lazy(() => import('@/modules/interview/pages/MockInterviewPage'))
const StructuredInterviewPage = lazy(() => import('@/modules/interview/pages/StructuredInterviewPage'))
const InterviewSetupPage      = lazy(() => import('@/modules/interview/pages/InterviewSetupPage'))
const InterviewLobbyPage      = lazy(() => import('@/modules/interview/pages/InterviewLobbyPage'))
const InterviewRoomPage       = lazy(() => import('@/modules/interview/pages/InterviewRoomPage'))
const InterviewReportPage     = lazy(() => import('@/modules/interview/pages/InterviewReportPage'))
const RoadmapPage             = lazy(() => import('@/modules/roadmap/pages/RoadmapPage'))
const RoadmapHistoryPage      = lazy(() => import('@/modules/roadmap/pages/RoadmapHistoryPage'))
const QuizPage                = lazy(() => import('@/modules/roadmap/pages/QuizPage'))
const CompanionPage           = lazy(() => import('@/modules/companion/pages/CompanionPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" replace />
}

function GuestRoute({ children, employerRedirect = '/app/employer/dashboard' }: { children: React.ReactNode; employerRedirect?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <>{children}</>
  if (user && EMPLOYER_ROLES.includes(user.role)) return <Navigate to={employerRedirect} replace />
  if (user && PLATFORM_ADMIN_ROLES.includes(user.role)) return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/app/dashboard" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  if (!user || !PLATFORM_ADMIN_ROLES.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user || !roles.includes(user.role)) return <Navigate to="/admin/dashboard" replace />
  return <>{children}</>
}

/** Redirects dept-scoped users (recruiter / department_head with a department_id)
 * away from the company-wide Departments list to their own department workspace. */
function DeptScopeGuard({ children }: { children: React.ReactNode }) {
  const { data: perms, isLoading } = useEmployerPermissions()
  if (isLoading) return null
  if (perms && !perms.is_company_wide && perms.department_id) {
    return <Navigate to={`/app/employer/departments/${perms.department_id}`} replace />
  }
  return <>{children}</>
}

/** Only blocks the dashboard until the quick-start step (name/status/city,
 * current_step 1) is done — the rest of onboarding (education, skills, etc.)
 * is optional and completed later from the dashboard's profile-completion card. */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const { data: status, isLoading } = useOnboardingStatus()

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  // Employers skip onboarding — they land on a pending/different page
  if (user?.role === 'employer') return <>{children}</>
  if (isLoading) return null
  if (status && status.current_step < 2) {
    return <Navigate to="/app/onboarding/step/1" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Landing — authenticated users are redirected to their dashboard */}
          <Route
            path="/"
            element={
              <GuestRoute>
                <DishaLanding />
              </GuestRoute>
            }
          />

          {/* Auth routes — guest only */}
          <Route path="/auth/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/auth/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/auth/verify" element={<VerifyOtpPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/auth/2fa-challenge" element={<TwoFactorChallengePage />} />

          {/* Employer auth routes */}
          <Route path="/auth/register/employer" element={<GuestRoute employerRedirect="/app/employer/setup"><EmployerRegisterPage /></GuestRoute>} />
          <Route path="/auth/verify-employer" element={<EmployerVerifyOtpPage />} />
          <Route path="/auth/employer-pending" element={<GuestRoute><EmployerPendingPage /></GuestRoute>} />

          {/* Onboarding wizard — aspirants only */}
          <Route path="/app/onboarding/step/1" element={<ProtectedRoute><Step1Personal /></ProtectedRoute>} />
          <Route path="/app/onboarding/step/2" element={<ProtectedRoute><Step2Education /></ProtectedRoute>} />
          <Route path="/app/onboarding/step/3" element={<ProtectedRoute><Step3UpscJourney /></ProtectedRoute>} />
          <Route path="/app/onboarding/step/4" element={<ProtectedRoute><Step4WorkExperience /></ProtectedRoute>} />
          <Route path="/app/onboarding/step/5" element={<ProtectedRoute><Step5Skills /></ProtectedRoute>} />
          <Route path="/app/onboarding/step/6" element={<ProtectedRoute><Step6Preferences /></ProtectedRoute>} />
          <Route path="/app/onboarding/step/7" element={<ProtectedRoute><Step7Psychology /></ProtectedRoute>} />
          {/* Redirect bare /app/onboarding to step 1 */}
          <Route path="/app/onboarding" element={<Navigate to="/app/onboarding/step/1" replace />} />

          {/* Employer portal — all pages share the sidebar via EmployerLayout */}
          <Route element={<ProtectedRoute><EmployerLayout /></ProtectedRoute>}>
            <Route path="/app/employer/dashboard" element={<EmployerDashboardPage />} />
            <Route path="/app/employer/jobs" element={<Suspense fallback={<PageLoader />}><EmployerJobsPage /></Suspense>} />
            <Route path="/app/employer/verification" element={<Suspense fallback={<PageLoader />}><EmployerVerificationPage /></Suspense>} />
            <Route path="/app/employer/company" element={<Suspense fallback={<PageLoader />}><CompanyTeamPage /></Suspense>} />
            <Route path="/app/employer/analytics" element={<Suspense fallback={<PageLoader />}><EmployerAnalyticsPage /></Suspense>} />
            <Route path="/app/employer/talent-pool" element={<Suspense fallback={<PageLoader />}><TalentPoolPage /></Suspense>} />
            <Route path="/app/employer/calendar" element={<Suspense fallback={<PageLoader />}><EmployerCalendarPage /></Suspense>} />
            <Route path="/app/employer/subscription" element={<Suspense fallback={<PageLoader />}><SubscriptionPage /></Suspense>} />
            <Route path="/app/employer/referrals" element={<Suspense fallback={<PageLoader />}><ReferralsPage /></Suspense>} />
            <Route path="/app/employer/templates" element={<Suspense fallback={<PageLoader />}><JobTemplatesPage /></Suspense>} />
            <Route path="/app/employer/departments" element={<DeptScopeGuard><Suspense fallback={<PageLoader />}><DepartmentsPage /></Suspense></DeptScopeGuard>} />
            <Route path="/app/employer/departments/:id" element={<Suspense fallback={<PageLoader />}><DepartmentDetailPage /></Suspense>} />
            <Route path="/app/employer/applicants" element={<Suspense fallback={<PageLoader />}><EmployerApplicantsPage /></Suspense>} />
            <Route path="/app/employer/interviews" element={<Suspense fallback={<PageLoader />}><EmployerInterviewsPage /></Suspense>} />
            <Route path="/app/employer/offers" element={<Suspense fallback={<PageLoader />}><EmployerOffersPage /></Suspense>} />
            <Route path="/app/employer/pipeline/:jobId" element={<Suspense fallback={<PageLoader />}><CandidatePipelinePage /></Suspense>} />
            <Route path="/app/employer/jobs/:jobId/form-builder" element={<Suspense fallback={<PageLoader />}><FormBuilderPage /></Suspense>} />
            <Route path="/app/employer/support" element={<Suspense fallback={<PageLoader />}><EmployerSupportPage /></Suspense>} />
          </Route>

          {/* Employer setup wizard — standalone, no sidebar */}
          <Route path="/app/employer/setup" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><EmployerSetupWizardPage /></Suspense></ProtectedRoute>} />

          {/* Protected dashboard — gated behind onboarding completion */}
          <Route
            path="/app/dashboard"
            element={
              <OnboardingGate>
                <DashboardPage />
              </OnboardingGate>
            }
          />

          {/* Profile edit page */}
          <Route
            path="/app/profile"
            element={
              <OnboardingGate>
                <ProfilePage />
              </OnboardingGate>
            }
          />

          {/* Security settings (2FA) — any authenticated role, no onboarding gate */}
          <Route path="/app/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />

          <Route path="/app/skills/report" element={<Navigate to="/app/profile" replace />} />

          {/* MVP2: Resume Builder */}
          <Route path="/app/resume" element={<OnboardingGate><Suspense fallback={<PageLoader />}><ResumeListPage /></Suspense></OnboardingGate>} />
          <Route path="/app/resume/:resumeId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><ResumeEditorPage /></Suspense></OnboardingGate>} />

          {/* Phase 6: Resume Library (uploaded PDF/DOCX files for job applications) */}
          <Route path="/app/resume-library" element={<OnboardingGate><Suspense fallback={<PageLoader />}><ResumeLibraryPage /></Suspense></OnboardingGate>} />

          {/* Old interview routes — redirect directly to setup (single hop) */}
          <Route path="/app/interview" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/interview/sessions/:sessionId" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/interview/sessions/:sessionId/feedback" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/mock-interview" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/mock-interview/:jobId" element={<Navigate to="/app/interview/setup" replace />} />

          {/* ── Production AI Interview Platform ── */}
          <Route path="/app/interview/setup" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewSetupPage /></Suspense></OnboardingGate>} />
          <Route path="/app/interview/lobby/:sessionId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewLobbyPage /></Suspense></OnboardingGate>} />
          <Route path="/app/interview/room/:sessionId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewRoomPage /></Suspense></OnboardingGate>} />
          <Route path="/app/interview/report/:sessionId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewReportPage /></Suspense></OnboardingGate>} />
          {/* Structured Interview with AI-adaptive questioning */}
          <Route path="/app/interview/structured" element={<OnboardingGate><Suspense fallback={<PageLoader />}><StructuredInterviewPage /></Suspense></OnboardingGate>} />

          {/* Phase 3: Job marketplace (aspirant) */}
          <Route path="/app/jobs" element={<OnboardingGate><Suspense fallback={<PageLoader />}><JobsPage /></Suspense></OnboardingGate>} />
          <Route path="/app/jobs/applications" element={<OnboardingGate><Suspense fallback={<PageLoader />}><MyApplicationsPage /></Suspense></OnboardingGate>} />
          <Route path="/app/jobs/:jobId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><JobDetailPage /></Suspense></OnboardingGate>} />
          {/* Phase 7: ATS multi-step application wizard */}
          <Route path="/app/jobs/:jobId/apply" element={<OnboardingGate><Suspense fallback={<PageLoader />}><ApplyPage /></Suspense></OnboardingGate>} />


          {/* Roadmap — 6-stage job-readiness system */}
          <Route path="/app/roadmap" element={<OnboardingGate><Suspense fallback={<PageLoader />}><RoadmapPage /></Suspense></OnboardingGate>} />
          <Route path="/app/roadmap/history" element={<OnboardingGate><Suspense fallback={<PageLoader />}><RoadmapHistoryPage /></Suspense></OnboardingGate>} />
          <Route path="/app/quiz/:jobId/:moduleId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><QuizPage /></Suspense></OnboardingGate>} />

          {/* Candidate support */}
          <Route path="/app/support" element={<OnboardingGate><Suspense fallback={<PageLoader />}><CandidateSupportPage /></Suspense></OnboardingGate>} />

          {/* MVP2: AI Counsellor */}
          <Route path="/app/counsellor" element={<OnboardingGate><Suspense fallback={<PageLoader />}><CounsellorPage /></Suspense></OnboardingGate>} />
          <Route path="/app/counsellor/:convId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><CounsellorPage /></Suspense></OnboardingGate>} />

          {/* Your Companion — emotional support companion */}
          <Route path="/app/companion" element={<OnboardingGate><Suspense fallback={<PageLoader />}><CompanionPage /></Suspense></OnboardingGate>} />

          {/* Admin portal — route-based, role-aware sidebar */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Suspense fallback={<PageLoader />}>
                  <AdminLayout />
                </Suspense>
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"        element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />

            {/* Employers */}
            <Route path="employers"        element={<Suspense fallback={<PageLoader />}><EmployersPage /></Suspense>} />
            <Route path="employers/:id"    element={<Suspense fallback={<PageLoader />}><EmployerDetailPage /></Suspense>} />

            {/* Jobs */}
            <Route path="jobs"             element={<Suspense fallback={<PageLoader />}><AdminJobsPage /></Suspense>} />
            <Route path="jobs/:id"         element={<Suspense fallback={<PageLoader />}><AdminJobDetailPage /></Suspense>} />

            {/* Candidates (primary) + Users (legacy alias) */}
            <Route path="candidates"       element={<Suspense fallback={<PageLoader />}><CandidatesPage /></Suspense>} />
            <Route path="candidates/:id"   element={<Suspense fallback={<PageLoader />}><CandidateDetailPage /></Suspense>} />
            <Route path="users"            element={<Navigate to="/admin/candidates" replace />} />

            {/* Support */}
            <Route path="support"          element={<Suspense fallback={<PageLoader />}><SupportPage /></Suspense>} />
            <Route path="support/:id"      element={<Suspense fallback={<PageLoader />}><TicketDetailPage /></Suspense>} />

            {/* Reports hub + sub-report pages */}
            <Route path="reports"                    element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
            <Route path="reports/employers"          element={<Suspense fallback={<PageLoader />}><EmployerReportsPage /></Suspense>} />
            <Route path="reports/jobs"               element={<Suspense fallback={<PageLoader />}><JobReportsPage /></Suspense>} />
            <Route path="reports/candidates"         element={<Suspense fallback={<PageLoader />}><CandidateReportsPage /></Suspense>} />
            <Route path="reports/financial"          element={<Suspense fallback={<PageLoader />}><FinancialReportsPage /></Suspense>} />

            {/* Legacy / existing pages */}
            <Route path="kyc"              element={<Suspense fallback={<PageLoader />}><KycQueuePage /></Suspense>} />
            <Route path="applications"     element={<Suspense fallback={<PageLoader />}><ApplicationsPage /></Suspense>} />
            <Route path="analytics"        element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
            <Route path="career-tracks"    element={<Suspense fallback={<PageLoader />}><CareerTracksPage /></Suspense>} />
            <Route path="sub-admins"       element={<RoleRoute roles={['super_admin']}><Suspense fallback={<PageLoader />}><SubAdminsPage /></Suspense></RoleRoute>} />
            <Route path="roles"            element={<RoleRoute roles={['super_admin']}><Suspense fallback={<PageLoader />}><RolesPage /></Suspense></RoleRoute>} />
            <Route path="audit-log"        element={<Suspense fallback={<PageLoader />}><AuditLogPage /></Suspense>} />
            <Route path="billing"          element={<Suspense fallback={<PageLoader />}><BillingPage /></Suspense>} />
            <Route path="subscriptions"    element={<Suspense fallback={<PageLoader />}><SubscriptionsPage /></Suspense>} />
            <Route path="notifications"    element={<RoleRoute roles={['admin', 'super_admin']}><Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense></RoleRoute>} />
            <Route path="integrations"     element={<RoleRoute roles={['super_admin']}><Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense></RoleRoute>} />
            <Route path="system"           element={<RoleRoute roles={['super_admin']}><Suspense fallback={<PageLoader />}><SystemMonitoringPage /></Suspense></RoleRoute>} />
            <Route path="ai-config"        element={<RoleRoute roles={['super_admin']}><Suspense fallback={<PageLoader />}><AiConfigPage /></Suspense></RoleRoute>} />
            <Route path="settings"         element={<RoleRoute roles={['super_admin']}><Suspense fallback={<PageLoader />}><PlatformSettingsPage /></Suspense></RoleRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </GoogleOAuthProvider>
    </ErrorBoundary>
  )
}

export default App
