import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKrsDashboard, useLiveJobs, usePrepareJob, useUnprepareJob } from '../hooks/useKrs'
import { MapPin, Map, BookOpen, ExternalLink, X, CheckCircle2, TrendingUp, Zap, Target, ArrowUpRight, Sparkles, ChevronRight, Mic, FileText, ClipboardList, Mail } from 'lucide-react'
import { useOnboardingStatus } from '@/modules/onboarding/hooks/useOnboarding'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import AspLayout from '@/shared/layouts/AspLayout'
import JobAnalysisDrawer from '@/components/JobAnalysisDrawer'
import { resumeApi } from '@/api/resume'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { getMyApplications } from '@/api/matching'
import { jobPlanApi } from '@/api/jobPlan'
import { getApiError } from '@/api/client'
import { authApi } from '@/api/auth'
import ProfileCompletionCard from '../components/ProfileCompletionCard'
import JobSpotlight from '../components/JobSpotlight'
import JobRow from '../components/JobRow'
import JobModal from '../components/JobModal'
import ApplyModal from '@/modules/jobs/components/ApplyModal'
import { tokens } from '@/design-system'

// Landing-page palette
const NAVY     = tokens.color.brand.navy
const NAVY_SFT = '#243359'
const INK      = tokens.color.brand.ink
const INK_SFT  = '#475569'
const CREAM    = tokens.color.surface.bg
const CREAM_DK = tokens.color.surface.elevated
const MUTED    = tokens.color.brand.muted
const BORDER   = tokens.color.brand.border

// ── Main ──────────────────────────────────────────────────────────────────────
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

  const [applyJob,       setApplyJob]       = useState<LiveJob | null>(null)
  const [selectedJob,    setSelectedJob]    = useState<LiveJob | null>(null)
  const [preparingJobId, setPreparingJobId] = useState<string | null>(null)
  const [skillGapJob,    setSkillGapJob]    = useState<LiveJob | null>(null)
  const [jobPage,        setJobPage]        = useState(0)
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
  const [tailorResumeError, setTailorResumeError] = useState<string | null>(null)
  const handleTailoredResume = async (job: LiveJob) => {
    setTailoringResumeJobId(job.id); setTailorResumeError(null)
    try {
      const newResume = await resumeApi.createResume({ title: `${job.title} — ${job.company_name}` })
      await resumeApi.aiGenerateResume(newResume.id, { job_title: job.title, company_name: job.company_name, required_skills: job.required_skills, job_description: job.description })
      navigate(`/app/resume/${newResume.id}`)
    } catch (err: any) {
      setTailorResumeError(err?.response?.data?.detail ?? 'Failed to generate resume. Please try again.')
    } finally { setTailoringResumeJobId(null) }
  }

  const recommendedJobs = [...(liveJobs ?? [])].sort((a, b) => b.match_score - a.match_score).slice(0, 10)
  const totalJobPages   = Math.max(1, Math.ceil(recommendedJobs.length / JOBS_PER_PAGE))
  const safeJobPage     = Math.min(jobPage, totalJobPages - 1)
  const pageJobs        = recommendedJobs.slice(safeJobPage * JOBS_PER_PAGE, safeJobPage * JOBS_PER_PAGE + JOBS_PER_PAGE)
  const currentViewedJob = recommendedJobs[safeJobPage] ?? null
  const topGaps  = (currentViewedJob?.skills_to_develop ?? []).slice(0, 5)
  const skillPct = currentViewedJob?.skill_overlap ?? 0

  return (
    <AspLayout activePath="/app/dashboard" scroll="contained">
        {/* Topbar */}
        <header style={{ background: 'white', borderBottom: `1px solid ${BORDER}`, padding: '0 32px', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: CREAM_DK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={15} color={NAVY} />
            </div>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: INK }}>Dashboard</span>
          </div>
          <button onClick={() => navigate('/app/profile')} style={{ background: NAVY, border: 'none', padding: '8px 16px', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.18s' }}
            onMouseOver={e => { e.currentTarget.style.background = NAVY_SFT }}
            onMouseOut={e => { e.currentTarget.style.background = NAVY }}
          >
            Edit profile <ArrowUpRight size={12} />
          </button>
        </header>

        <main style={{ padding: '20px 24px 32px', flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${CREAM_DK}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

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
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', color: '#DC2626', fontSize: 14 }}>Could not load. Please refresh.</div>
            )
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Email banner — amber stays semantic */}
              {showEmailBanner && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Mail size={18} color="#D97706" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {emailVerifSent
                      ? <p style={{ fontSize: 13, color: '#92400E', margin: 0, fontWeight: 600 }}>Verification email sent to <strong>{currentUser?.email}</strong> — check your inbox.</p>
                      : <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}><strong>Verify your email</strong> — {currentUser?.email} is unverified. Some notifications won't reach you until this is done.</p>}
                  </div>
                  {!emailVerifSent && <button onClick={() => sendVerifMutation.mutate()} disabled={sendVerifMutation.isPending} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#D97706', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: sendVerifMutation.isPending ? 'not-allowed' : 'pointer', opacity: sendVerifMutation.isPending ? 0.7 : 1 }}>{sendVerifMutation.isPending ? 'Sending…' : 'Send link'}</button>}
                  <button onClick={() => setEmailBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D97706', padding: 2, flexShrink: 0, display: 'flex' }}><X size={14} /></button>
                </div>
              )}

              {/* Onboarding banner */}
              {showOnboardingBanner && (
                <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={16} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Your profile is {onboardingPct}% complete</p>
                    <div style={{ height: 5, borderRadius: 5, background: CREAM_DK, overflow: 'hidden', maxWidth: 240 }}>
                      <div style={{ height: '100%', width: `${onboardingPct}%`, background: NAVY, borderRadius: 5, transition: 'width 0.6s ease' }} />
                    </div>
                    <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 0' }}>Complete your profile to unlock better job matches and your KRS score.</p>
                  </div>
                  <button onClick={() => navigate(`/app/onboarding/step/${onboardingStep}`)} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: NAVY, color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Continue <ChevronRight size={13} />
                  </button>
                  <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, flexShrink: 0, display: 'flex' }}><X size={16} /></button>
                </div>
              )}

              {/* Jobs grid — flex wrapper so arrows flank the whole card+sidebar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 1020, margin: '0 auto', width: '100%' }}>

                {/* Left arrow */}
                {!jobsLoading && pageJobs.length > 0 && (
                  <button
                    onClick={() => setJobPage(p => Math.max(0, p - 1))}
                    disabled={safeJobPage === 0}
                    aria-label="Previous job"
                    style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: `1px solid ${BORDER}`, background: safeJobPage === 0 ? CREAM : 'white', boxShadow: safeJobPage === 0 ? 'none' : '0 8px 20px rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: safeJobPage === 0 ? 'default' : 'pointer', color: safeJobPage === 0 ? CREAM_DK : NAVY, transition: 'all 0.2s' }}
                  >
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                )}

                {/* Inner grid: job card + gap analysis */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,620px) 280px', gap: 20, alignItems: 'start', flex: 1, minWidth: 0 }}>

                  {/* Left column */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: INK, margin: 0 }}>Top matches for you</p>
                      {!jobsLoading && recommendedJobs.length > 0 && <span style={{ fontSize: 12, color: MUTED }}>{recommendedJobs.length} roles found</span>}
                    </div>

                    {tailorResumeError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', color: '#DC2626', fontSize: 12, marginBottom: 14 }}>{tailorResumeError}</div>}

                    {jobsLoading && (
                      <div style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                        <div style={{ height: 90, background: CREAM_DK, animation: 'pulse 1.5s infinite' }} />
                        <div style={{ height: 260, background: 'white', padding: 22 }}>
                          {[40, 70, 50].map((w, i) => <div key={i} style={{ height: i === 1 ? 16 : 10, background: CREAM, borderRadius: 6, marginBottom: 12, width: `${w}%`, animation: 'pulse 1.5s infinite' }} />)}
                        </div>
                      </div>
                    )}

                    {!jobsLoading && pageJobs.length > 0 && pageJobs.map(job => (
                      <JobSpotlight key={job.id} job={job}
                        onOpen={() => setSelectedJob(job)}
                        onApply={() => setApplyJob(job)}
                        onPrepare={() => handlePrepare(job)}
                        onGenerateResume={() => handleGenerateResume(job)}
                        onViewRoadmap={() => handleViewRoadmap(job)}
                        roadmapStatus={roadmapStatusByJobId[job.id]}
                        onMockInterview={() => handleMockInterview(job)}
                        onOpenResume={() => handleTailoredResume(job)}
                        isPreparing={preparingJobId === job.id}
                        isApplied={appliedJobIds.has(job.id)}
                        isTailoringResume={tailoringResumeJobId === job.id}
                      />
                    ))}

                    {!jobsLoading && recommendedJobs.length === 0 && (
                      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center', background: 'white' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4 }}>No openings yet</p>
                        <p style={{ fontSize: 12, color: MUTED }}>Employers are posting roles — check back soon.</p>
                      </div>
                    )}
                  </div>

                  {/* Right sidebar — gap analysis */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0, marginTop: 36 }}>
                    <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 18, padding: '20px', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Zap size={13} color="white" />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>Your gap analysis</p>
                      </div>
                      <p style={{ fontSize: 11.5, color: MUTED, margin: '6px 0 18px' }}>
                        {currentViewedJob ? `Based on: ${currentViewedJob.title}` : 'Based on your top job matches'}
                      </p>
                      <div style={{ paddingBottom: 18, borderBottom: `1px solid ${BORDER}`, marginBottom: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED }}>Skill coverage</span>
                          <span style={{ fontSize: 17, fontWeight: 700, color: skillPct >= 60 ? '#16A34A' : skillPct >= 30 ? '#D97706' : '#DC2626' }}>{skillPct}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 6, background: CREAM_DK, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 6, width: `${skillPct}%`, background: skillPct >= 60 ? '#16A34A' : skillPct >= 30 ? '#D97706' : '#DC2626', transition: 'width 1s ease' }} />
                        </div>
                        <p style={{ fontSize: 11, color: MUTED, marginTop: 9, lineHeight: 1.5 }}>
                          {skillPct >= 60 ? 'Strong alignment with job requirements' : skillPct >= 30 ? 'Growing — add a few more skills' : 'Complete your profile to improve this'}
                        </p>
                      </div>
                      {topGaps.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: INK, marginBottom: 2 }}>Priority skills to build</p>
                          <p style={{ fontSize: 10.5, color: MUTED, marginBottom: 12 }}>Appear most in jobs you're matched to</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {topGaps.map((sk, i) => (
                              <div key={sk} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 10, background: i === 0 ? CREAM_DK : 'transparent' }}>
                                <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: i === 0 ? NAVY : 'rgba(0,0,0,0.05)', color: i === 0 ? 'white' : MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: i === 0 ? INK : INK_SFT, flex: 1, textTransform: 'capitalize' }}>{sk}</span>
                                {i === 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: NAVY }}>TOP GAP</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => { if (currentViewedJob) setSkillGapJob(currentViewedJob) }}
                        style={{ width: '100%', background: CREAM_DK, border: `1px solid ${BORDER}`, borderRadius: 11, padding: '11px 0', fontSize: 12.5, fontWeight: 700, color: INK, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.18s' }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(26,39,68,0.1)' }}
                        onMouseOut={e => { e.currentTarget.style.background = CREAM_DK }}
                      >
                        Full skill report <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>

                </div>{/* end inner grid */}

                {/* Right arrow */}
                {!jobsLoading && pageJobs.length > 0 && (
                  <button
                    onClick={() => setJobPage(p => Math.min(totalJobPages - 1, p + 1))}
                    disabled={safeJobPage >= totalJobPages - 1}
                    aria-label="Next job"
                    style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: `1px solid ${BORDER}`, background: safeJobPage >= totalJobPages - 1 ? CREAM : 'white', boxShadow: safeJobPage >= totalJobPages - 1 ? 'none' : '0 8px 20px rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: safeJobPage >= totalJobPages - 1 ? 'default' : 'pointer', color: safeJobPage >= totalJobPages - 1 ? CREAM_DK : NAVY, transition: 'all 0.2s' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                )}

              </div>{/* end outer flex */}
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

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes popIn   { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
        @keyframes rowIn   { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
      `}</style>
    </AspLayout>
  )
}
