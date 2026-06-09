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
