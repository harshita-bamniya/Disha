import { lazy, Suspense, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'

// ── Global Error Boundary ─────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FEF2F2' }}>
          <div style={{ maxWidth: 600, background: 'white', borderRadius: 16, padding: 32, border: '1px solid #FCA5A5', boxShadow: '0 4px 20px rgba(220,38,38,0.1)' }}>
            <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 800, color: '#DC2626', marginBottom: 12 }}>App Error — please report this</h2>
            <pre style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {err.message}{'\n\n'}{err.stack}
            </pre>
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

// Auth pages
import LoginPage from '@/modules/auth/pages/LoginPage'
import RegisterPage from '@/modules/auth/pages/RegisterPage'
import VerifyOtpPage from '@/modules/auth/pages/VerifyOtpPage'
import EmployerRegisterPage from '@/modules/auth/pages/EmployerRegisterPage'
import EmployerVerifyOtpPage from '@/modules/auth/pages/EmployerVerifyOtpPage'
import EmployerPendingPage from '@/modules/auth/pages/EmployerPendingPage'

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
import ForgotPasswordPage from '@/modules/auth/pages/ForgotPasswordPage'

// Lazy-loaded pages
const AdminDashboardPage = lazy(() => import('@/modules/admin/pages/AdminDashboardPage'))
const SkillsReportPage   = lazy(() => import('@/modules/skills/pages/SkillsReportPage'))

// Phase 3 lazy pages — employer matching
const JobsPage              = lazy(() => import('@/modules/jobs/pages/JobsPage'))
const JobDetailPage         = lazy(() => import('@/modules/jobs/pages/JobDetailPage'))
const MyApplicationsPage    = lazy(() => import('@/modules/jobs/pages/MyApplicationsPage'))
const CandidatePipelinePage = lazy(() => import('@/modules/employer/pages/CandidatePipelinePage'))

// MVP2 lazy pages
const ResumeListPage        = lazy(() => import('@/modules/resume/pages/ResumeListPage'))
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

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <>{children}</>
  if (user?.role === 'employer') return <Navigate to="/app/employer/dashboard" replace />
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/app/dashboard" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

/** Ensures aspirants complete onboarding before reaching the dashboard */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const { data: status, isLoading } = useOnboardingStatus()

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  // Employers skip onboarding — they land on a pending/different page
  if (user?.role === 'employer') return <>{children}</>
  if (isLoading) return null
  if (status && !status.is_completed) {
    return <Navigate to={`/app/onboarding/step/${status.current_step}`} replace />
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
          <Route path="/auth/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

          {/* Employer auth routes */}
          <Route path="/auth/register/employer" element={<GuestRoute><EmployerRegisterPage /></GuestRoute>} />
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

          {/* Employer dashboard */}
          <Route path="/app/employer/dashboard" element={<ProtectedRoute><EmployerDashboardPage /></ProtectedRoute>} />

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

          {/* Skills Report (Module 03 frontend) */}
          <Route path="/app/skills/report" element={
            <OnboardingGate>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <SkillsReportPage />
              </Suspense>
            </OnboardingGate>
          } />


          {/* MVP2: Resume Builder */}
          <Route path="/app/resume" element={<OnboardingGate><Suspense fallback={null}><ResumeListPage /></Suspense></OnboardingGate>} />
          <Route path="/app/resume/:resumeId" element={<OnboardingGate><Suspense fallback={null}><ResumeEditorPage /></Suspense></OnboardingGate>} />

          {/* Old interview routes — redirect to new mock interview */}
          <Route path="/app/interview" element={<Navigate to="/app/mock-interview" replace />} />
          <Route path="/app/interview/sessions/:sessionId" element={<Navigate to="/app/mock-interview" replace />} />
          <Route path="/app/interview/sessions/:sessionId/feedback" element={<Navigate to="/app/mock-interview" replace />} />

          {/* ── Production AI Interview Platform ── */}
          <Route path="/app/interview/setup" element={
            <OnboardingGate>
              <Suspense fallback={null}><InterviewSetupPage /></Suspense>
            </OnboardingGate>
          } />
          <Route path="/app/interview/lobby/:sessionId" element={
            <OnboardingGate>
              <Suspense fallback={null}><InterviewLobbyPage /></Suspense>
            </OnboardingGate>
          } />
          <Route path="/app/interview/room/:sessionId" element={
            <OnboardingGate>
              <Suspense fallback={null}><InterviewRoomPage /></Suspense>
            </OnboardingGate>
          } />
          <Route path="/app/interview/report/:sessionId" element={
            <OnboardingGate>
              <Suspense fallback={null}><InterviewReportPage /></Suspense>
            </OnboardingGate>
          } />

          {/* Phase 3: Job marketplace (aspirant) */}
          <Route path="/app/jobs" element={<OnboardingGate><Suspense fallback={null}><JobsPage /></Suspense></OnboardingGate>} />
          <Route path="/app/jobs/applications" element={<OnboardingGate><Suspense fallback={null}><MyApplicationsPage /></Suspense></OnboardingGate>} />
          <Route path="/app/jobs/:jobId" element={<OnboardingGate><Suspense fallback={null}><JobDetailPage /></Suspense></OnboardingGate>} />

          {/* Phase 3: Employer candidate pipeline */}
          <Route path="/app/employer/pipeline/:jobId" element={<ProtectedRoute><Suspense fallback={null}><CandidatePipelinePage /></Suspense></ProtectedRoute>} />

          {/* Mock Interview — redirect to new AI Interview Platform */}
          <Route path="/app/mock-interview/:jobId" element={<Navigate to="/app/interview/setup" replace />} />
          <Route path="/app/mock-interview" element={<Navigate to="/app/interview/setup" replace />} />
          {/* Structured Interview with AI-adaptive questioning */}
          <Route path="/app/interview/structured" element={<OnboardingGate><Suspense fallback={null}><StructuredInterviewPage /></Suspense></OnboardingGate>} />

          {/* Roadmap — 6-stage job-readiness system */}
          <Route path="/app/roadmap" element={<OnboardingGate><Suspense fallback={null}><RoadmapPage /></Suspense></OnboardingGate>} />
          <Route path="/app/roadmap/history" element={<OnboardingGate><Suspense fallback={null}><RoadmapHistoryPage /></Suspense></OnboardingGate>} />
          <Route path="/app/quiz/:jobId/:moduleId" element={<OnboardingGate><Suspense fallback={null}><QuizPage /></Suspense></OnboardingGate>} />

          {/* MVP2: AI Counsellor */}
          <Route path="/app/counsellor" element={<OnboardingGate><Suspense fallback={null}><CounsellorPage /></Suspense></OnboardingGate>} />
          <Route path="/app/counsellor/:convId" element={<OnboardingGate><Suspense fallback={null}><CounsellorPage /></Suspense></OnboardingGate>} />

          {/* Your Companion — emotional support companion */}
          <Route path="/app/companion" element={<OnboardingGate><Suspense fallback={null}><CompanionPage /></Suspense></OnboardingGate>} />

          {/* Admin dashboard */}
          <Route path="/admin" element={
            <AdminRoute>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <AdminDashboardPage />
              </Suspense>
            </AdminRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </GoogleOAuthProvider>
    </ErrorBoundary>
  )
}

export default App
