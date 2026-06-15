/**
 * Phase 3 — Job Detail Page (Aspirant)
 * Shows full job description, match score breakdown, and apply CTA.
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobDetail, applyToJob } from '@/api/matching'
import { resumeApi } from '@/api/resume'
import { counsellorApi } from '@/api/counsellor'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [coverNote, setCoverNote] = useState('')
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applied, setApplied] = useState(false)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobDetail(jobId!),
    enabled: !!jobId,
  })
  const { activePrep, startPrep, isStartingPrep, clearPrep, isClearingPrep } = useActivePrepJob()
  const isActivePrepJob = activePrep?.job_id === jobId
  const { data: checklist } = useQuery({
    queryKey: ['prep-checklist', jobId],
    queryFn: () => counsellorApi.getPrepChecklist(jobId!),
    enabled: !!jobId && isActivePrepJob,
  })

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(jobId!, coverNote || undefined),
    onSuccess: () => {
      setApplied(true)
      setShowApplyForm(false)
      qc.invalidateQueries({ queryKey: ['my-applications'] })
    },
  })

  async function handleGenerateResume() {
    if (!job || generatingResume) return
    setGeneratingResume(true)
    setResumeError(null)
    try {
      // 1. Create a blank resume named after this job
      const newResume = await resumeApi.createResume({
        title: `${job.title} — ${job.company_name}`,
      })
      // 2. AI-generate sections tailored to this specific job
      await resumeApi.aiGenerateResume(newResume.id, {
        job_title: job.title,
        company_name: job.company_name,
        required_skills: job.required_skills,
        job_description: job.description,
      })
      // 3. Land on the resume editor — ready to review & download
      navigate(`/app/resume/${newResume.id}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setResumeError(
        typeof detail === 'string'
          ? detail
          : 'Failed to generate resume. Please try again.',
      )
    } finally {
      setGeneratingResume(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center text-red-600">
          Job not found or no longer active.
        </main>
      </div>
    )
  }

  const matchColor =
    (job.match_score ?? 0) >= 70 ? 'text-green-700' :
    (job.match_score ?? 0) >= 40 ? 'text-yellow-700' :
    'text-red-700'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <Link to="/app/jobs" className="text-sm text-primary hover:underline mb-4 block">
          ← Back to Jobs
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-gray-600 mt-1">{job.company_name}</p>
            </div>
            {job.match_score !== null && (
              <div className="text-center shrink-0">
                <div className={`text-3xl font-bold ${matchColor}`}>{job.match_score}%</div>
                <div className="text-xs text-gray-500">match</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {job.sector && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{job.sector}</span>}
            {job.location && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">📍 {job.location}</span>}
            {job.job_type && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{job.job_type.replace('_', ' ')}</span>}
            {job.employment_type && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{job.employment_type.replace('_', ' ')}</span>}
          </div>

          {(job.salary_min || job.salary_max) && (
            <p className="text-sm text-gray-700 mt-3">
              <span className="font-medium">Salary:</span>{' '}
              ₹{job.salary_min || '?'}–{job.salary_max || '?'} LPA
            </p>
          )}

          {job.skill_overlap_pct !== null && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Skill overlap</span>
                <span>{job.skill_overlap_pct}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${job.skill_overlap_pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">About this role</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{job.description}</p>
        </div>

        {job.required_skills.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.map((s) => (
                <span key={s} className="text-xs bg-green-50 text-green-800 px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Active Prep Job CTA ── */}
        <div style={{
          background: isActivePrepJob
            ? 'linear-gradient(135deg, #F0FDF4, #ECFDF5)'
            : 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
          border: isActivePrepJob ? '1.5px solid #86EFAC' : '1.5px solid #E2E8F0',
          borderRadius: 14, padding: '16px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: isActivePrepJob ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'linear-gradient(135deg,#2D6A4F,#40916C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {isActivePrepJob ? '✓' : '🎯'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>
              {isActivePrepJob ? 'This is your active prep job' : 'Set as Active Prep Job'}
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0', lineHeight: 1.4 }}>
              {isActivePrepJob
                ? 'DISHA AI is building your personalised learning roadmap. View it in My Roadmap → Stage 2.'
                : 'Get a personalised AI learning roadmap, YouTube course suggestions, and skill-gap tracking tailored to this role.'
              }
            </p>
          </div>
          {isActivePrepJob ? (
            <button
              onClick={() => clearPrep()}
              disabled={isClearingPrep}
              style={{
                flexShrink: 0, background: 'none', border: '1px solid #E2E8F0',
                borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                color: '#6B7280', cursor: isClearingPrep ? 'wait' : 'pointer',
              }}
            >
              {isClearingPrep ? 'Clearing…' : 'Clear'}
            </button>
          ) : (
            <button
              onClick={() => {
                startPrep(jobId!)
                qc.invalidateQueries({ queryKey: ['roadmap'] })
              }}
              disabled={isStartingPrep}
              style={{
                flexShrink: 0,
                background: 'linear-gradient(135deg,#2D6A4F,#40916C)', color: 'white',
                border: 'none', borderRadius: 8, padding: '9px 18px',
                fontSize: 13, fontWeight: 700, cursor: isStartingPrep ? 'wait' : 'pointer',
                opacity: isStartingPrep ? 0.7 : 1, whiteSpace: 'nowrap',
              }}
            >
              {isStartingPrep ? 'Setting…' : 'Set as Prep Job'}
            </button>
          )}
        </div>

        {/* Generate Resume for This Job */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-0.5">✨</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-indigo-900 text-sm">Generate a Tailored Resume</h3>
              <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
                AI will write a resume optimised for <span className="font-medium">{job.title}</span> at {job.company_name},
                highlighting your most relevant skills and UPSC experience.
              </p>
              {resumeError && (
                <p className="text-xs text-red-600 mt-1">{resumeError}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleGenerateResume}
            disabled={generatingResume}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {generatingResume ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating your resume…
              </>
            ) : (
              '✨ Generate Resume for This Job'
            )}
          </button>
        </div>

        {/* Mock Interview CTA */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-0.5">🎯</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-violet-900 text-sm">Practice Mock Interview</h3>
              <p className="text-xs text-violet-700 mt-0.5 leading-relaxed">
                AI will roleplay as a real interviewer — HR, Technical, or Stress round — tailored to <span className="font-medium">{job.title}</span> at {job.company_name}. Get a detailed scorecard after.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/app/mock-interview/${job.id}`)}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            🎯 Start Mock Interview
          </button>
        </div>

        {/* Prep Checklist — only shown when this is the active prep job */}
        {isActivePrepJob && checklist && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <h3 className="font-semibold text-gray-900 text-sm">Your Prep Checklist</h3>
              <span className="ml-auto text-xs text-gray-400">
                {checklist.checklist.filter(c => c.done).length}/{checklist.checklist.length} done
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {checklist.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: item.done ? '#F0FDF4' : '#F8FAFC' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: item.done ? '#10B981' : '#E2E8F0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'white', fontWeight: 800,
                  }}>
                    {item.done ? '✓' : i + 1}
                  </div>
                  <span className="text-sm flex-1" style={{ color: item.done ? '#15803D' : '#374151', textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.item}
                  </span>
                  {!item.done && (
                    <Link to={item.cta} className="text-xs text-indigo-600 font-semibold hover:underline shrink-0">
                      {item.cta_label} →
                    </Link>
                  )}
                </div>
              ))}
            </div>
            {checklist.gap_skills.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">Skills still to build:</p>
                <div className="flex flex-wrap gap-1.5">
                  {checklist.gap_skills.map(s => (
                    <span key={s} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Apply CTA */}
        {!applied ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {!showApplyForm ? (
              <button
                onClick={() => setShowApplyForm(true)}
                className="w-full bg-primary text-white font-semibold rounded-lg py-3 hover:bg-primary/90 transition-colors"
              >
                Apply Now
              </button>
            ) : (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Add a cover note (optional)</h3>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Tell the employer why you're a great fit for this role..."
                  maxLength={1000}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{coverNote.length}/1000</p>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => setShowApplyForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                    className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
                {applyMutation.isError && (
                  <p className="text-sm text-red-600 mt-2">
                    {(applyMutation.error as any)?.response?.data?.detail || 'Failed to submit application.'}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">✅</div>
            <h3 className="font-semibold text-green-800">Application Submitted!</h3>
            <p className="text-sm text-green-700 mt-1">
              The employer will review your profile and get back to you.
            </p>
            <Link to="/app/jobs/applications" className="text-sm text-primary hover:underline mt-3 block">
              View My Applications
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
