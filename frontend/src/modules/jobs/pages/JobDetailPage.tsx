/**
 * Phase 3 — Job Detail Page (Aspirant)
 * Shows full job description, match score breakdown, and apply CTA.
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Wifi, Briefcase, Target, Sparkles, Mic, Check } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobDetail, applyToJob } from '@/api/matching'
import { resumeApi } from '@/api/resume'
import { jobPlanApi } from '@/api/jobPlan'
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
  const { activePrep, startPrep, isStartingPrep } = useActivePrepJob()
  const isActivePrepJob = activePrep?.job_id === jobId

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(jobId!, coverNote || undefined),
    onSuccess: () => {
      setApplied(true)
      setShowApplyForm(false)
      qc.invalidateQueries({ queryKey: ['my-applications'] })
    },
  })

  // Generating a roadmap is what makes this the active prep job — there's no
  // separate manual "set active" toggle anymore. Switching roadmaps (from
  // RoadmapHistoryPage) is the only other thing that changes which job is active.
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
      <div className="flex min-h-screen bg-white">
        <AppSidebar activePath="/app/jobs" />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#2563EB', borderTopColor: 'transparent' }} />
        </main>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="flex min-h-screen bg-white">
        <AppSidebar activePath="/app/jobs" />
        <main className="flex-1 flex items-center justify-center text-red-600">
          Job not found or no longer active.
        </main>
      </div>
    )
  }

  const companyInitial = (job.company_name || '?').charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen" style={{ background: '#FAFBFD' }}>
      <AppSidebar activePath="/app/jobs" />
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: '#FAFBFD' }}>
        <header className="bg-white border-b border-gray-100 px-7 h-16 flex items-center gap-3 sticky top-0 z-20">
          <Link to="/app/jobs" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            ←
          </Link>
          <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
            <Briefcase size={14} className="text-white" />
          </div>
          <p className="text-[15px] font-bold text-gray-900">Job Details</p>
        </header>

        <main className="flex-1 p-9">
        <div
          className="max-w-3xl mx-auto rounded-2xl bg-white"
          style={{ border: '1px solid #EEF2F9', boxShadow: '0 10px 30px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)' }}
        >
        {/* ── Header + salary/skill-overlap ── */}
        <div className="border-b border-gray-100 p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-blue-600 shrink-0" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                {companyInitial}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{job.title}</h1>
                <p className="text-gray-500 mt-1 text-sm">{job.company_name}</p>
              </div>
            </div>
            {job.match_score !== null && (
              <div className="text-center shrink-0 rounded-xl px-4 py-2" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                <div className="text-xl font-bold text-blue-600">{job.match_score}%</div>
                <div className="text-[9px] font-bold tracking-widest text-blue-400 uppercase">Match</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {job.sector && <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#F8FAFC', color: '#475569' }}>{job.sector}</span>}
            {job.location && <span className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: '#F8FAFC', color: '#475569' }}><MapPin size={11} /> {job.location}</span>}
            {job.job_type && <span className="text-xs font-semibold px-3 py-1.5 rounded-full capitalize flex items-center gap-1" style={{ background: '#F8FAFC', color: '#475569' }}><Wifi size={11} /> {job.job_type.replace('_', ' ')}</span>}
            {job.employment_type && <span className="text-xs font-semibold px-3 py-1.5 rounded-full capitalize" style={{ background: '#F8FAFC', color: '#475569' }}>{job.employment_type.replace('_', ' ')}</span>}
          </div>

          {(job.salary_min || job.salary_max) && (
            <p className="text-base font-bold text-gray-900 mt-4">
              ₹{job.salary_min || '?'}–{job.salary_max || '?'} LPA
            </p>
          )}

          {job.skill_overlap_pct !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
                <span>Skill overlap</span>
                <span className="text-blue-600">{job.skill_overlap_pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${job.skill_overlap_pct}%`, background: 'linear-gradient(90deg, #60A5FA, #2563EB)' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-gray-100 p-7">
          <h2 className="text-[11px] font-bold tracking-widest text-gray-400 mb-2 uppercase">About this role</h2>
          <p className="text-gray-600 leading-relaxed whitespace-pre-line text-sm">{job.description}</p>
        </div>

        {job.required_skills.length > 0 && (
          <div className="border-b border-gray-100 p-7">
            <h2 className="text-[11px] font-bold tracking-widest text-gray-400 mb-2.5 uppercase">Required skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.map((s) => (
                <span
                  key={s}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: '#F0F4FF', color: '#4F46E5' }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Action cards: Prep Job / Tailored Resume / Mock Interview ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-7 border-b border-gray-100">
          {/* Generate Roadmap — this is what makes this job the active prep job */}
          <div className="rounded-xl p-4 flex flex-col gap-2 bg-white" style={{ border: '1px solid #EEF2F9', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: isActivePrepJob ? 'linear-gradient(150deg, #34D399, #16A34A)' : 'linear-gradient(150deg, #60A5FA, #3B82F6)',
                boxShadow: isActivePrepJob ? '0 3px 8px rgba(22,163,74,0.25)' : '0 3px 8px rgba(37,99,235,0.25)',
              }}
            >
              {isActivePrepJob ? <Check size={14} className="text-white" /> : <Target size={14} className="text-white" />}
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">
              {isActivePrepJob ? 'Your Active Roadmap' : 'Generate Roadmap'}
            </h3>
            <p className="text-[11.5px] text-gray-500 leading-relaxed">
              {isActivePrepJob
                ? "This is the roadmap you're currently using."
                : 'Personalised roadmap, course suggestions, and skill tracking.'}
            </p>
            <button
              onClick={() => isActivePrepJob ? navigate('/app/roadmap') : handleGenerateRoadmap()}
              disabled={isStartingPrep}
              className="mt-auto w-full flex items-center justify-center gap-2 disabled:opacity-60 font-bold rounded-lg py-2 text-[11.5px] transition-all"
              style={{
                background: 'white', color: isActivePrepJob ? '#16A34A' : '#2563EB',
                border: `1.5px solid ${isActivePrepJob ? '#BBF7D0' : '#BFDBFE'}`,
              }}
            >
              {isStartingPrep ? 'Generating…' : isActivePrepJob ? 'View Roadmap' : 'Generate'}
            </button>
          </div>

          {/* Tailored Resume */}
          <div className="rounded-xl p-4 flex flex-col gap-2 bg-white" style={{ border: '1px solid #EEF2F9', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(150deg, #A78BFA, #7C3AED)', boxShadow: '0 3px 8px rgba(124,58,237,0.25)' }}>
              <Sparkles size={14} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">Tailored Resume</h3>
            <p className="text-[11.5px] text-gray-500 leading-relaxed">
              AI resume optimised for this role's required skills.
            </p>
            {resumeError && <p className="text-[11px] text-red-600">{resumeError}</p>}
            <button
              onClick={handleGenerateResume}
              disabled={generatingResume}
              className="mt-auto w-full flex items-center justify-center gap-2 disabled:opacity-60 font-bold rounded-lg py-2 text-[11.5px] transition-all"
              style={{ background: 'white', color: '#7C3AED', border: '1.5px solid #DDD6FE' }}
            >
              {generatingResume ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={11} /> Generate
                </>
              )}
            </button>
          </div>

          {/* Mock Interview */}
          <div className="rounded-xl p-4 flex flex-col gap-2 bg-white" style={{ border: '1px solid #EEF2F9', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(150deg, #60A5FA, #3B82F6)', boxShadow: '0 3px 8px rgba(37,99,235,0.25)' }}>
              <Mic size={14} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">Mock Interview</h3>
            <p className="text-[11.5px] text-gray-500 leading-relaxed">
              AI interviewer roleplay with a detailed scorecard.
            </p>
            <button
              onClick={() => navigate(`/app/mock-interview/${job.id}`)}
              className="mt-auto w-full flex items-center justify-center gap-2 font-bold rounded-lg py-2 text-[11.5px] transition-all"
              style={{ background: 'white', color: '#2563EB', border: '1.5px solid #BFDBFE' }}
            >
              <Mic size={11} /> Start
            </button>
          </div>
        </div>


        {/* Apply CTA */}
        <div className="p-7">
        {!applied ? (
          <div>
            {!showApplyForm ? (
              <button
                onClick={() => setShowApplyForm(true)}
                className="w-full font-bold rounded-xl py-3 text-sm transition-all"
                style={{ background: 'white', color: '#2563EB', border: '1.5px solid #BFDBFE', boxShadow: '0 2px 8px rgba(37,99,235,0.08)' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)' }}
              >
                Apply Now
              </button>
            ) : (
              <div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">Add a cover note (optional)</h3>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Tell the employer why you're a great fit for this role..."
                  maxLength={1000}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{coverNote.length}/1000</p>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => setShowApplyForm(false)}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                    className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-60"
                    style={{ background: 'white', color: '#2563EB', border: '1.5px solid #BFDBFE' }}
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
          <div className="rounded-xl p-6 text-center" style={{ background: '#ECFDF5', border: '1px solid #BBF7D0' }}>
            <div className="text-2xl mb-2">✅</div>
            <h3 className="font-bold text-green-800 text-sm">Application Submitted!</h3>
            <p className="text-sm text-green-700 mt-1">
              The employer will review your profile and get back to you.
            </p>
            <Link to="/app/jobs/applications" className="text-sm text-blue-600 hover:underline mt-3 block">
              View My Applications
            </Link>
          </div>
        )}
        </div>
        </div>
        </main>
      </div>
    </div>
  )
}
