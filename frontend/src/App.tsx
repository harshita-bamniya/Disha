import { lazy, Suspense, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import PageLoader from '@/components/PageLoader'

// ── Global Error Boundary ─────────────────────────────────────────────────────
// Uses design-system tokens — no local magic color strings.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      const isDev = import.meta.env.DEV
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: 'var(--disha-danger-bg)',
        }}>
          <div style={{
            maxWidth: 600, width: '100%',
            background: 'var(--disha-card)',
            borderRadius: 'var(--disha-radius-2xl)',
            padding: 32,
            border: '1px solid rgba(220,38,38,0.20)',
            boxShadow: 'var(--disha-shadow-elevated)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(220,38,38,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>⚠</div>
              <h2 style={{
                fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 800,
                color: 'var(--disha-danger)', margin: 0,
              }}>Something went wrong</h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--disha-ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
              An unexpected error occurred. Please reload the page. If the problem persists,{' '}
              <a href="mailto:support@beginable.ai" style={{ color: 'var(--disha-navy)', fontWeight: 600 }}>
                contact support
              </a>.
            </p>
            {isDev && (
              <pre style={{
                fontSize: 11, color: 'var(--disha-ink)',
                background: 'var(--disha-elevated)',
                padding: 14, borderRadius: 8,
                overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                marginBottom: 16, maxHeight: 240, overflow: 'auto',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {err.message}{'\n\n'}{err.stack}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '9px 20px', background: 'var(--disha-danger)',
                  color: 'white', border: 'none',
                  borderRadius: 'var(--disha-radius-lg)',
                  cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  boxShadow: '0 4px 12px rgba(220,38,38,0.25)',
                }}
              >
                Reload page
              </button>
              <button
                onClick={() => { window.history.back() }}
                style={{
                  padding: '9px 20px', background: 'transparent',
                  color: 'var(--disha-ink-soft)',
                  border: '1.5px solid var(--disha-border-md)',
                  borderRadius: 'var(--disha-radius-lg)',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

import { useAuthStore } from '@/stores/authStore'
import { AppProviders } from '@/providers'
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
import { useOnboardingStatus } from '@/modules/onboarding/hooks/useOnboarding'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import DishaLanding from '@/pages/DishaLanding'
import ProfilePage from '@/modules/profile/pages/ProfilePage'
import AspLayout from '@/shared/layouts/AspLayout'
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
const InterviewCalibrationPage = lazy(() => import('@/modules/admin/pages/InterviewCalibrationPage'))
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
const ResumeHubPage         = lazy(() => import('@/modules/resume/pages/ResumeHubPage'))
const ResumeEditorPage      = lazy(() => import('@/modules/resume/pages/ResumeEditorPage'))
const CounsellorPage        = lazy(() => import('@/modules/counsellor/pages/CounsellorPage'))
const InterviewSetupPage      = lazy(() => import('@/modules/interview/pages/InterviewSetupPage'))
const InterviewLobbyPage      = lazy(() => import('@/modules/interview/pages/InterviewLobbyPage'))
const InterviewRoomPage       = lazy(() => import('@/modules/interview/pages/InterviewRoomPage'))
const InterviewReportPage     = lazy(() => import('@/modules/interview/pages/InterviewReportPage'))
const InterviewHomePage       = lazy(() => import('@/modules/interview/pages/InterviewHomePage'))
const RoadmapPage             = lazy(() => import('@/modules/roadmap/pages/RoadmapPage'))
const LearningSetupPage       = lazy(() => import('@/modules/roadmap/pages/LearningSetupPage'))
const RoadmapHistoryPage      = lazy(() => import('@/modules/roadmap/pages/RoadmapHistoryPage'))
const QuizPage                = lazy(() => import('@/modules/roadmap/pages/QuizPage'))
const CompanionPage           = lazy(() => import('@/modules/companion/pages/CompanionPage'))

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
    <AppProviders>
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

          <Route path="/app/skills/report" element={<Navigate to="/app/profile" replace />} />

          {/* Old interview routes — redirect directly to setup (single hop) */}
          <Route path="/app/interview" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/interview/sessions/:sessionId" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/interview/sessions/:sessionId/feedback" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/mock-interview" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/mock-interview/:jobId" element={<Navigate to="/app/interview/setup" replace />} />

          {/* Full-screen AI interview flow — intentionally has no sidebar chrome */}
          <Route path="/app/interview/setup" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewSetupPage /></Suspense></OnboardingGate>} />
          <Route path="/app/interview/lobby/:sessionId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewLobbyPage /></Suspense></OnboardingGate>} />
          <Route path="/app/interview/room/:sessionId" element={<OnboardingGate><Suspense fallback={<PageLoader />}><InterviewRoomPage /></Suspense></OnboardingGate>} />

          {/* Security settings — reachable by both aspirant and employer roles;
              builds its own sidebar shell per role, so it stays outside both
              AspLayout's and EmployerLayout's route trees. */}
          <Route path="/app/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />

          {/* Aspirant portal — all pages share the sidebar via AspLayout */}
          <Route element={<ProtectedRoute><AspLayout /></ProtectedRoute>}>
            <Route path="/app/dashboard" element={<OnboardingGate><DashboardPage /></OnboardingGate>} />
            <Route path="/app/profile" element={<OnboardingGate><ProfilePage /></OnboardingGate>} />

            {/* Resume: unified hub — build/edit structured resumes + manage uploaded files */}
            <Route path="/app/resume" element={<OnboardingGate><ResumeHubPage /></OnboardingGate>} />
            <Route path="/app/resume/:resumeId" element={<OnboardingGate><ResumeEditorPage /></OnboardingGate>} />
            <Route path="/app/resume-library" element={<Navigate to="/app/resume" replace />} />

            <Route path="/app/interview/report/:sessionId" element={<OnboardingGate><InterviewReportPage /></OnboardingGate>} />
            <Route path="/app/interview/history" element={<OnboardingGate><InterviewHomePage /></OnboardingGate>} />

            {/* Phase 3: Job marketplace (aspirant) */}
            <Route path="/app/jobs" element={<OnboardingGate><JobsPage /></OnboardingGate>} />
            <Route path="/app/jobs/applications" element={<OnboardingGate><MyApplicationsPage /></OnboardingGate>} />
            <Route path="/app/jobs/:jobId" element={<OnboardingGate><JobDetailPage /></OnboardingGate>} />
            {/* Phase 7: ATS multi-step application wizard */}
            <Route path="/app/jobs/:jobId/apply" element={<OnboardingGate><ApplyPage /></OnboardingGate>} />

            {/* Roadmap — 6-stage job-readiness system */}
            <Route path="/app/roadmap" element={<OnboardingGate><RoadmapPage /></OnboardingGate>} />
            <Route path="/app/learning-setup" element={<OnboardingGate><LearningSetupPage /></OnboardingGate>} />
            <Route path="/app/roadmap/history" element={<OnboardingGate><RoadmapHistoryPage /></OnboardingGate>} />
            <Route path="/app/quiz/:jobId/:moduleId" element={<OnboardingGate><QuizPage /></OnboardingGate>} />

            {/* Candidate support */}
            <Route path="/app/support" element={<OnboardingGate><CandidateSupportPage /></OnboardingGate>} />

            {/* MVP2: AI Counsellor */}
            <Route path="/app/counsellor" element={<OnboardingGate><CounsellorPage /></OnboardingGate>} />
            <Route path="/app/counsellor/:convId" element={<OnboardingGate><CounsellorPage /></OnboardingGate>} />

            {/* Your Companion — emotional support companion */}
            <Route path="/app/companion" element={<OnboardingGate><CompanionPage /></OnboardingGate>} />
          </Route>

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
            <Route path="interview-calibration" element={<Suspense fallback={<PageLoader />}><InterviewCalibrationPage /></Suspense>} />
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
    </AppProviders>
    </ErrorBoundary>
  )
}

export default App
