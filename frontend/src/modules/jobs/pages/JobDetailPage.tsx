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
import { counsellorApi } from '@/api/counsellor'
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
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar activePath="/app/jobs" />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <AppSidebar activePath="/app/jobs" />
        <main className="flex-1 flex items-center justify-center text-red-600">
          Job not found or no longer active.
        </main>
      </div>
    )
  }

  const companyInitial = (job.company_name || '?').charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar activePath="/app/jobs" />
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <Link to="/app/jobs" className="text-sm text-primary hover:underline mb-4 block">
          ← Back to Jobs
        </Link>

        {/* ── Hero header + salary/skill-overlap ── */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4 shadow-sm">
          <div
            className="relative px-7 py-7"
            style={{ background: 'linear-gradient(135deg, #1E3A6B 0%, #0B1424 100%)' }}
          >
            <div
              className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%)' }}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl font-bold text-white shrink-0">
                  {companyInitial}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white leading-tight">{job.title}</h1>
                  <p className="text-blue-200/80 mt-1">{job.company_name}</p>
                </div>
              </div>
              {job.match_score !== null && (
                <div className="text-center shrink-0 bg-black/25 rounded-2xl px-4 py-2">
                  <div className="text-2xl font-bold text-white">{job.match_score}%</div>
                  <div className="text-[10px] font-semibold tracking-widest text-gray-300">MATCH</div>
                </div>
              )}
            </div>

            <div className="relative flex flex-wrap gap-2 mt-4">
              {job.sector && (
                <span className="text-xs bg-white/15 text-white font-semibold px-3 py-1.5 rounded-full">{job.sector}</span>
              )}
              {job.location && (
                <span className="text-xs bg-white/15 text-white font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
                  <MapPin size={12} /> {job.location}
                </span>
              )}
              {job.job_type && (
                <span className="text-xs bg-white/15 text-white font-semibold px-3 py-1.5 rounded-full capitalize flex items-center gap-1">
                  <Wifi size={12} /> {job.job_type.replace('_', ' ')}
                </span>
              )}
              {job.employment_type && (
                <span className="text-xs bg-white/15 text-white font-semibold px-3 py-1.5 rounded-full capitalize flex items-center gap-1">
                  <Briefcase size={12} /> {job.employment_type.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white px-7 py-5">
            {(job.salary_min || job.salary_max) && (
              <p className="text-lg font-bold text-gray-900">
                ₹{job.salary_min || '?'}–{job.salary_max || '?'} LPA
              </p>
            )}

            {job.skill_overlap_pct !== null && (
              <div className="mt-4">
                <div className="flex justify-between text-sm font-semibold text-gray-700 mb-2">
                  <span>Skill overlap</span>
                  <span>{job.skill_overlap_pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${job.skill_overlap_pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <h2 className="text-xs font-bold tracking-widest text-gray-400 mb-3">ABOUT THIS ROLE</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
        </div>

        {job.required_skills.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
            <h2 className="text-xs font-bold tracking-widest text-gray-400 mb-3">REQUIRED SKILLS</h2>
            <div className="flex flex-wrap gap-2.5">
              {job.required_skills.map((s) => (
                <span
                  key={s}
                  className="text-sm font-semibold px-4 py-2 rounded-full"
                  style={{ background: '#F3E9D8', color: '#1F2937' }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Action cards: Prep Job / Tailored Resume / Mock Interview ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Generate Roadmap — this is what makes this job the active prep job */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center mb-4">
              {isActivePrepJob ? <Check size={20} className="text-white" /> : <Target size={20} className="text-white" />}
            </div>
            <h3 className="font-bold text-gray-900 text-sm">
              {isActivePrepJob ? 'Your Active Roadmap' : 'Generate Roadmap'}
            </h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed flex-1">
              {isActivePrepJob
                ? "This is the roadmap you're currently using."
                : 'Personalised roadmap, course suggestions, and skill tracking.'}
            </p>
            <button
              onClick={() => isActivePrepJob ? navigate('/app/roadmap') : handleGenerateRoadmap()}
              disabled={isStartingPrep}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              {isStartingPrep ? 'Generating…' : isActivePrepJob ? 'View Roadmap' : 'Generate'}
            </button>
          </div>

          {/* Tailored Resume */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center mb-4">
              <Sparkles size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Tailored Resume</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed flex-1">
              AI resume optimised for this role's required skills.
            </p>
            {resumeError && <p className="text-xs text-red-600 mt-1">{resumeError}</p>}
            <button
              onClick={handleGenerateResume}
              disabled={generatingResume}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              {generatingResume ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate
                </>
              )}
            </button>
          </div>

          {/* Mock Interview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center mb-4">
              <Mic size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Mock Interview</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed flex-1">
              AI interviewer roleplay with a detailed scorecard.
            </p>
            <button
              onClick={() => navigate(`/app/mock-interview/${job.id}`)}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              <Mic size={14} /> Start
            </button>
          </div>
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
                className="w-full text-white font-semibold rounded-lg py-3 transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E3A6B 0%, #0B1424 100%)' }}
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
                    className="flex-1 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1E3A6B 0%, #0B1424 100%)' }}
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
