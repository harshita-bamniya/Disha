import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Wifi, Briefcase, Target, Sparkles, Mic, Check, IndianRupee, ArrowUpRight } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobDetail } from '@/api/matching'
import { resumeApi } from '@/api/resume'
import { jobPlanApi } from '@/api/jobPlan'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { trackJobEvent } from '@/lib/analytics'
import { tokens } from '@/design-system'

// ── palette ────────────────────────────────────────────────────────────────────
const NAVY     = tokens.color.brand.navy
const INK      = tokens.color.brand.ink
const INK_S    = tokens.color.brand.inkSoft
const MUTED    = tokens.color.brand.muted
const CREAM    = tokens.color.surface.bg
const CREAM_DK = tokens.color.surface.elevated
const BORDER   = tokens.color.brand.border

function skillBarColor(pct: number) {
  if (pct >= 60) return '#059669'
  if (pct >= 30) return '#D97706'
  return '#DC2626'
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const [applied, setApplied] = useState(false)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobDetail(jobId!),
    enabled: !!jobId,
  })
  const { activePrep, startPrep, isStartingPrep } = useActivePrepJob()
  const isActivePrepJob = activePrep?.job_id === jobId

  function handleGenerateRoadmap() {
    if (!jobId) return
    startPrep(jobId, {
      onSuccess: () => {
        jobPlanApi.generate(jobId).catch(() => {})
        navigate('/app/roadmap')
      },
    })
  }

  async function handleGenerateResume() {
    if (!job || generatingResume) return
    setGeneratingResume(true)
    setResumeError(null)
    try {
      const newResume = await resumeApi.createResume({ title: `${job.title} — ${job.company_name}` })
      await resumeApi.aiGenerateResume(newResume.id, {
        job_title: job.title,
        company_name: job.company_name,
        required_skills: job.required_skills,
        job_description: job.description,
      })
      navigate(`/app/resume/${newResume.id}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setResumeError(typeof detail === 'string' ? detail : 'Failed to generate resume. Please try again.')
    } finally {
      setGeneratingResume(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: CREAM }}>
        <AppSidebar activePath="/app/jobs" />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </main>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: CREAM }}>
        <AppSidebar activePath="/app/jobs" />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', fontSize: 14 }}>
          Job not found or no longer active.
        </main>
      </div>
    )
  }

  const companyInitial = (job.company_name || '?').charAt(0).toUpperCase()
  const overlap = job.skill_overlap_pct ?? 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: CREAM }}>
      <AppSidebar activePath="/app/jobs" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* ── top bar ── */}
        <header style={{
          background: '#fff', borderBottom: `1px solid ${BORDER}`,
          padding: '0 24px', height: 58,
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <Link
            to="/app/jobs"
            style={{
              width: 30, height: 30, borderRadius: '50%', background: CREAM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: INK_S, textDecoration: 'none', fontSize: 16, flexShrink: 0,
            }}
          >
            ←
          </Link>
          <div style={{ width: 27, height: 27, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Briefcase size={13} color="#fff" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>Job Details</p>
        </header>

        {/* ── scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px 48px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>

            {/* ══ NAVY HERO ══ */}
            <div style={{
              background: NAVY, borderRadius: '18px 18px 0 0',
              padding: '24px 28px', position: 'relative', overflow: 'hidden',
            }}>
              {/* decorative circles */}
              <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: -70, right: -50, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', bottom: -40, left: 60, pointerEvents: 'none' }} />

              {/* logo + title + match */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                    background: 'rgba(255,255,255,0.13)', border: '1.5px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 800, color: '#fff',
                  }}>
                    {companyInitial}
                  </div>
                  <div>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.25, margin: '0 0 4px' }}>
                      {job.title}
                    </h1>
                    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', margin: 0, fontWeight: 500 }}>
                      {job.company_name}
                    </p>
                  </div>
                </div>
                {job.match_score !== null && (
                  <div style={{
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 11, padding: '9px 14px', textAlign: 'center', flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{job.match_score}%</div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 3 }}>match</div>
                  </div>
                )}
              </div>

              {/* chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, position: 'relative' }}>
                {job.sector && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                    {job.sector}
                  </span>
                )}
                {job.location && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={10} />{job.location}
                  </span>
                )}
                {job.job_type && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Wifi size={10} />{job.job_type.replace('_', ' ')}
                  </span>
                )}
                {job.employment_type && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                    {job.employment_type.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* salary + apply button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Salary</div>
                  {(job.salary_min || job.salary_max) ? (
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <IndianRupee size={14} color="#fff" />{job.salary_min ?? '?'}–{job.salary_max ?? '?'} LPA
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Not disclosed</div>
                  )}
                </div>

                {applied ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                    background: 'rgba(5,150,105,0.2)', border: '1px solid rgba(5,150,105,0.35)',
                    borderRadius: 10, padding: '9px 16px',
                  }}>
                    <Check size={14} color="#34D399" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#34D399' }}>Applied</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (jobId) trackJobEvent('application_started', jobId)
                      navigate(`/app/jobs/${jobId}/apply`)
                    }}
                    style={{
                      height: 40, padding: '0 22px', borderRadius: 10,
                      background: '#fff', color: NAVY, border: 'none',
                      fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
                    }}
                  >
                    Apply Now <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            </div>


            {/* ══ CONTENT CARD ══ */}
            <div style={{
              background: '#fff',
              borderRadius: (showApplyForm && !applied) ? '0 0 18px 18px' : '0 0 18px 18px',
              border: `1px solid ${BORDER}`, borderTop: 'none',
              overflow: 'hidden',
            }}>

              {/* skill overlap */}
              {job.skill_overlap_pct !== null && (
                <div style={{ padding: '16px 28px', background: CREAM, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px' }}>Skill overlap</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: skillBarColor(overlap) }}>{overlap}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: CREAM_DK, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, background: skillBarColor(overlap), width: `${overlap}%`, transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ fontSize: 11, color: MUTED, margin: '6px 0 0' }}>You have {overlap}% of the required skills for this role.</p>
                </div>
              )}

              {/* about */}
              <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 10px' }}>About this role</p>
                <p style={{ fontSize: 13, color: INK_S, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{job.description}</p>
              </div>

              {/* required skills */}
              {job.required_skills.length > 0 && (
                <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 10px' }}>Required skills</p>
                  <div>
                    {job.required_skills.map(s => (
                      <span key={s} style={{
                        display: 'inline-block', fontSize: 11.5, fontWeight: 600,
                        padding: '5px 11px', borderRadius: 20,
                        background: CREAM_DK, border: `1px solid ${BORDER}`, color: INK,
                        margin: '3px 4px 0 0',
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* prep tools */}
              <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 12px' }}>Preparation tools</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>

                  {/* Generate Roadmap */}
                  <div style={{ borderRadius: 13, border: `1px solid ${BORDER}`, padding: '14px 14px', background: CREAM, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: isActivePrepJob ? 'rgba(5,150,105,0.12)' : CREAM_DK, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isActivePrepJob ? <Check size={15} color="#059669" /> : <Target size={15} color={INK_S} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 3px' }}>
                        {isActivePrepJob ? 'Your Active Roadmap' : 'Generate Roadmap'}
                      </p>
                      <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>
                        {isActivePrepJob ? "You're currently prepping for this role." : 'Personalised learning plan and skill tracking.'}
                      </p>
                    </div>
                    <button
                      onClick={() => isActivePrepJob ? navigate('/app/roadmap') : handleGenerateRoadmap()}
                      disabled={isStartingPrep}
                      style={{
                        height: 30, borderRadius: 8, border: `1px solid ${BORDER}`,
                        background: '#fff', fontSize: 11, fontWeight: 700,
                        color: isActivePrepJob ? '#059669' : INK,
                        cursor: isStartingPrep ? 'not-allowed' : 'pointer',
                        opacity: isStartingPrep ? 0.6 : 1, marginTop: 'auto',
                      }}
                    >
                      {isStartingPrep ? 'Generating…' : isActivePrepJob ? 'View Roadmap' : 'Generate'}
                    </button>
                  </div>

                  {/* Tailored Resume */}
                  <div style={{ borderRadius: 13, border: `1px solid ${BORDER}`, padding: '14px 14px', background: CREAM, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: CREAM_DK, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={15} color={INK_S} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 3px' }}>Tailored Resume</p>
                      <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>AI resume optimised for this role's required skills.</p>
                    </div>
                    {resumeError && <p style={{ fontSize: 11, color: '#DC2626', margin: 0 }}>{resumeError}</p>}
                    <button
                      onClick={handleGenerateResume}
                      disabled={generatingResume}
                      style={{
                        height: 30, borderRadius: 8, border: `1px solid ${BORDER}`,
                        background: '#fff', fontSize: 11, fontWeight: 700, color: INK,
                        cursor: generatingResume ? 'not-allowed' : 'pointer',
                        opacity: generatingResume ? 0.6 : 1, marginTop: 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                    >
                      {generatingResume ? (
                        <>
                          <svg style={{ animation: 'spin 0.7s linear infinite', width: 12, height: 12 }} viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        <><Sparkles size={11} /> Generate</>
                      )}
                    </button>
                  </div>

                  {/* Mock Interview */}
                  <div style={{ borderRadius: 13, border: `1px solid ${BORDER}`, padding: '14px 14px', background: CREAM, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: CREAM_DK, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mic size={15} color={INK_S} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 3px' }}>Mock Interview</p>
                      <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>AI interviewer roleplay with a detailed scorecard.</p>
                    </div>
                    <button
                      onClick={() => navigate(`/app/mock-interview/${job.id}`)}
                      style={{
                        height: 30, borderRadius: 8, border: `1px solid ${BORDER}`,
                        background: '#fff', fontSize: 11, fontWeight: 700, color: INK,
                        cursor: 'pointer', marginTop: 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                    >
                      <Mic size={11} /> Start
                    </button>
                  </div>
                </div>
              </div>

              {/* applied success banner */}
              {applied && (
                <div style={{ padding: '20px 28px' }}>
                  <div style={{ borderRadius: 12, padding: '18px 20px', textAlign: 'center', background: '#ECFDF5', border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#166534', margin: '0 0 4px' }}>Application Submitted!</p>
                    <p style={{ fontSize: 12.5, color: '#166534', opacity: 0.8, margin: '0 0 12px' }}>The employer will review your profile and get back to you.</p>
                    <Link to="/app/jobs/applications" style={{ fontSize: 12.5, color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
                      View My Applications →
                    </Link>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
