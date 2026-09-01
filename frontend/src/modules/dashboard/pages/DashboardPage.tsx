import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKrsDashboard, useLiveJobs, usePrepareJob, useUnprepareJob } from '../hooks/useKrs'
import { X, ArrowUpRight, Sparkles, ChevronRight, ClipboardList, Mail } from 'lucide-react'
import { useOnboardingStatus } from '@/modules/onboarding/hooks/useOnboarding'
import type { LiveJob } from '@/api/krs'
import PageHeader from '@/shared/layouts/PageHeader'
import { NAVY, INK, INK_SFT, MUTED, CREAM, BORDER, colors } from '@/design-system/tokens'
import JobAnalysisDrawer from '@/components/JobAnalysisDrawer'
import { resumeApi } from '@/api/resume'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { getMyApplications } from '@/api/matching'
import { jobPlanApi } from '@/api/jobPlan'
import { getApiError } from '@/api/client'
import { authApi } from '@/api/auth'
import ProfileCompletionCard from '../components/ProfileCompletionCard'
import ApplyModal from '@/modules/jobs/components/ApplyModal'
import Button from '@/components/ui/Button'
import { JobSpotlight, JobModal } from '../components/JobSpotlight'
import Spinner from '@/shared/components/feedback/Spinner'
import EmptyState from '@/shared/components/feedback/EmptyState'

const ELEVATED = colors.surface.elevated

export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, error } = useKrsDashboard()
  const { data: liveJobs, isLoading: jobsLoading } = useLiveJobs()
  const { data: onboarding } = useOnboardingStatus()
  const { data: myApps } = useQuery({ queryKey: ['my-applications'], queryFn: getMyApplications })
  const appliedJobIds = new Set((myApps ?? []).map(a => a.job_id))
  const { data: jobPlans } = useQuery({ queryKey: ['job-plans-all'], queryFn: jobPlanApi.getAllMine })
  const roadmapStatusByJobId: Record<string, 'generating' | 'ready' | 'failed'> = {}
  for (const p of jobPlans ?? []) roadmapStatusByJobId[p.job_id] = p.status
  const prepareJob   = usePrepareJob()
  const unprepareJob = useUnprepareJob()
  const { startPrep } = useActivePrepJob()

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 5 * 60 * 1000 })
  const [emailVerifSent, setEmailVerifSent] = useState(false)
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false)
  const sendVerifMutation = useMutation({ mutationFn: authApi.sendEmailVerification, onSuccess: () => setEmailVerifSent(true) })
  const showEmailBanner = !emailBannerDismissed && !!currentUser?.email && !currentUser.email_verified

  const [applyJob,        setApplyJob]        = useState<LiveJob | null>(null)
  const [selectedJob,     setSelectedJob]     = useState<LiveJob | null>(null)
  const [preparingJobId,  setPreparingJobId]  = useState<string | null>(null)
  const [skillGapJob,     setSkillGapJob]     = useState<LiveJob | null>(null)
  const [jobPage,         setJobPage]         = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const JOBS_PER_PAGE = 1

  const onboardingStep = onboarding?.current_step ?? 1
  const onboardingDone = onboarding?.is_completed ?? false
  const showOnboardingBanner = !bannerDismissed && !onboardingDone && onboardingStep >= 2 && onboardingStep < 7
  const onboardingPct = Math.round(((onboardingStep - 1) / 6) * 100)

  const handlePrepare = async (job: LiveJob) => {
    setPreparingJobId(job.id)
    try { if (job.is_prepared) await unprepareJob.mutateAsync(job.id); else await prepareJob.mutateAsync(job.id) }
    finally { setPreparingJobId(null) }
  }

  const handleGenerateResume = (job: LiveJob) => {
    setSelectedJob(null)
    startPrep(job.id, { onSuccess: () => { jobPlanApi.generate(job.id).catch(() => {}); qc.invalidateQueries({ queryKey: ['job-plans-all'] }); navigate('/app/roadmap') } })
  }

  const handleViewRoadmap = (job: LiveJob) => {
    setSelectedJob(null)
    startPrep(job.id, { onSuccess: () => navigate('/app/roadmap') })
  }

  const handleMockInterview = (job: LiveJob) => {
    navigate('/app/interview/setup', { state: { jobContext: { job_title: job.title, company_name: job.company_name, required_skills: job.required_skills, skills_to_develop: job.skills_to_develop } } })
  }

  const [tailoringResumeJobId, setTailoringResumeJobId] = useState<string | null>(null)
  const [tailorResumeError,    setTailorResumeError]    = useState<string | null>(null)
  const handleTailoredResume = async (job: LiveJob) => {
    setTailoringResumeJobId(job.id); setTailorResumeError(null)
    try {
      const newResume = await resumeApi.createResume({ title: `${job.title} — ${job.company_name}` })
      await resumeApi.aiGenerateResume(newResume.id, { job_title: job.title, company_name: job.company_name, required_skills: job.required_skills, job_description: job.description })
      navigate(`/app/resume/${newResume.id}`)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined
      setTailorResumeError(msg ?? 'Failed to generate resume. Please try again.')
    } finally { setTailoringResumeJobId(null) }
  }

  const recommendedJobs = [...(liveJobs ?? [])].sort((a, b) => b.match_score - a.match_score).slice(0, 10)
  const totalJobPages   = Math.max(1, Math.ceil(recommendedJobs.length / JOBS_PER_PAGE))
  const safeJobPage     = Math.min(jobPage, totalJobPages - 1)
  const pageJobs        = recommendedJobs.slice(safeJobPage * JOBS_PER_PAGE, safeJobPage * JOBS_PER_PAGE + JOBS_PER_PAGE)

  return (
    <>
      <PageHeader
        title="Dashboard"
        icon={<Sparkles size={15} color={NAVY} />}
        actions={
          <Button size="sm" onClick={() => navigate('/app/profile')}>
            Edit profile <ArrowUpRight size={12} />
          </Button>
        }
      />

      <main style={{ padding: '20px 24px 32px', flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {isLoading && <Spinner size="lg" />}

        {error && (
          getApiError(error).toLowerCase().includes('onboarding incomplete') ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
              <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 18, padding: '32px 28px', textAlign: 'center' }}>
                <Sparkles size={28} color={NAVY} style={{ marginBottom: 10 }} />
                <p style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 6 }}>Complete your profile to unlock job matches</p>
                <p style={{ fontSize: 13, color: INK_SFT, maxWidth: 380, margin: '0 auto' }}>Your KRS score and tailored job recommendations need a bit more info.</p>
              </div>
              <ProfileCompletionCard />
            </div>
          ) : (
            <div style={{ background: colors.state.dangerBg, border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', color: colors.state.danger, fontSize: 14 }}>Could not load. Please refresh.</div>
          )
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Email verification banner */}
            {showEmailBanner && (
              <div style={{ background: colors.state.warningBg, border: '1px solid #FDE68A', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Mail size={18} color={colors.state.warning} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  {emailVerifSent
                    ? <p style={{ fontSize: 13, color: '#92400E', margin: 0, fontWeight: 600 }}>Verification email sent to <strong>{currentUser?.email}</strong> — check your inbox.</p>
                    : <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}><strong>Verify your email</strong> — {currentUser?.email} is unverified. Some notifications won't reach you until this is done.</p>}
                </div>
                {!emailVerifSent && (
                  <Button
                    size="sm"
                    onClick={() => sendVerifMutation.mutate()}
                    loading={sendVerifMutation.isPending}
                    style={{ flexShrink: 0, background: colors.state.warning, boxShadow: 'none' }}
                  >
                    Send link
                  </Button>
                )}
                <button onClick={() => setEmailBannerDismissed(true)} aria-label="Dismiss email verification banner" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.state.warning, padding: 2, flexShrink: 0, display: 'flex' }}><X size={14} /></button>
              </div>
            )}

            {/* Onboarding progress banner */}
            {showOnboardingBanner && (
              <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClipboardList size={16} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Your profile is {onboardingPct}% complete</p>
                  <div style={{ height: 5, borderRadius: 5, background: ELEVATED, overflow: 'hidden', maxWidth: 240 }}>
                    <div style={{ height: '100%', width: `${onboardingPct}%`, background: NAVY, borderRadius: 5, transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 0' }}>Complete your profile to unlock better job matches and your KRS score.</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/app/onboarding/step/${onboardingStep}`)} style={{ flexShrink: 0 }}>
                  Continue <ChevronRight size={13} />
                </Button>
                <button onClick={() => setBannerDismissed(true)} aria-label="Dismiss onboarding banner" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, flexShrink: 0, display: 'flex' }}><X size={16} /></button>
              </div>
            )}

            {/* Jobs carousel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760, margin: '0 auto', width: '100%' }}>

              {/* Left arrow */}
              {!jobsLoading && pageJobs.length > 0 && (
                <button
                  onClick={() => setJobPage(p => Math.max(0, p - 1))}
                  disabled={safeJobPage === 0}
                  aria-label="Previous job"
                  style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: `1px solid ${BORDER}`, background: safeJobPage === 0 ? CREAM : 'white', boxShadow: safeJobPage === 0 ? 'none' : '0 8px 20px rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: safeJobPage === 0 ? 'default' : 'pointer', color: safeJobPage === 0 ? ELEVATED : NAVY, transition: 'all 0.2s' }}
                >
                  <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
              )}

              {/* Single card column */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: INK, margin: 0 }}>Top matches for you</p>
                  {!jobsLoading && recommendedJobs.length > 0 && <span style={{ fontSize: 12, color: MUTED }}>{recommendedJobs.length} roles found</span>}
                </div>

                {tailorResumeError && <div style={{ background: colors.state.dangerBg, border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', color: colors.state.danger, fontSize: 12, marginBottom: 14 }}>{tailorResumeError}</div>}

                {jobsLoading && (
                  <div style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <div style={{ height: 90, background: ELEVATED, animation: 'pulse 1.5s infinite' }} />
                    <div style={{ height: 260, background: 'white', padding: 22 }}>
                      {[40, 70, 50].map((w, i) => <div key={i} style={{ height: i === 1 ? 16 : 10, background: CREAM, borderRadius: 6, marginBottom: 12, width: `${w}%`, animation: 'pulse 1.5s infinite' }} />)}
                    </div>
                  </div>
                )}

                {!jobsLoading && pageJobs.map(job => (
                  <JobSpotlight key={job.id} job={job}
                    onOpen={() => setSelectedJob(job)}
                    onApply={() => setApplyJob(job)}
                    onPrepare={() => handlePrepare(job)}
                    onGenerateResume={() => handleGenerateResume(job)}
                    onViewRoadmap={() => handleViewRoadmap(job)}
                    roadmapStatus={roadmapStatusByJobId[job.id]}
                    onMockInterview={() => handleMockInterview(job)}
                    onOpenResume={() => handleTailoredResume(job)}
                    onOpenSkillReport={() => setSkillGapJob(job)}
                    isPreparing={preparingJobId === job.id}
                    isApplied={appliedJobIds.has(job.id)}
                    isTailoringResume={tailoringResumeJobId === job.id}
                  />
                ))}

                {!jobsLoading && recommendedJobs.length === 0 && (
                  <EmptyState
                    icon={<ClipboardList size={24} />}
                    title="No openings yet"
                    description="Employers are posting roles — check back soon."
                  />
                )}
              </div>

              {/* Right arrow */}
              {!jobsLoading && pageJobs.length > 0 && (
                <button
                  onClick={() => setJobPage(p => Math.min(totalJobPages - 1, p + 1))}
                  disabled={safeJobPage >= totalJobPages - 1}
                  aria-label="Next job"
                  style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: `1px solid ${BORDER}`, background: safeJobPage >= totalJobPages - 1 ? CREAM : 'white', boxShadow: safeJobPage >= totalJobPages - 1 ? 'none' : '0 8px 20px rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: safeJobPage >= totalJobPages - 1 ? 'default' : 'pointer', color: safeJobPage >= totalJobPages - 1 ? ELEVATED : NAVY, transition: 'all 0.2s' }}
                >
                  <ChevronRight size={16} />
                </button>
              )}

            </div>
          </div>
        )}
      </main>

      {selectedJob && (
        <JobModal job={selectedJob} onClose={() => setSelectedJob(null)}
          onApply={() => { setSelectedJob(null); setApplyJob(selectedJob) }}
          onPrepare={() => { setSelectedJob(null); handlePrepare(selectedJob).catch(() => {}) }}
          onGenerateResume={() => handleGenerateResume(selectedJob)}
          onViewRoadmap={() => handleViewRoadmap(selectedJob)}
          roadmapStatus={roadmapStatusByJobId[selectedJob.id]}
          isPreparing={preparingJobId === selectedJob?.id}
          isApplied={appliedJobIds.has(selectedJob.id)}
        />
      )}
      {skillGapJob && (
        <JobAnalysisDrawer job={skillGapJob} kScore={data?.krs.k_score ?? 0} onClose={() => setSkillGapJob(null)} onApply={() => setSkillGapJob(null)} />
      )}
      {applyJob && (
        <ApplyModal jobId={applyJob.id} jobTitle={`${applyJob.title} · ${applyJob.company_name}`} onClose={() => setApplyJob(null)} />
      )}

    </>
  )
}
