/**
 * Phase 3 — Job Discovery Page (Aspirant)
 * Shows all active jobs ranked by match score with filters.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobs, type JobListItem } from '@/api/matching'

const SECTORS = ['Policy', 'ESG', 'EdTech', 'NGO', 'Consulting', 'Public Affairs', 'Research']
const JOB_TYPES = ['remote', 'pan_india', 'hybrid', 'onsite']

function MatchBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 70 ? 'bg-green-100 text-green-800' :
    score >= 40 ? 'bg-yellow-100 text-yellow-800' :
    'bg-red-100 text-red-800'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {score}% match
    </span>
  )
}

function JobCard({ job, onApply }: { job: JobListItem; onApply?: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
            <MatchBadge score={job.match_score} />
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{job.company_name}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {job.sector && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {job.sector}
              </span>
            )}
            {job.location && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                📍 {job.location}
              </span>
            )}
            {job.job_type && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {job.job_type.replace('_', ' ')}
              </span>
            )}
            {job.employment_type && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {job.employment_type.replace('_', ' ')}
              </span>
            )}
          </div>
          {(job.salary_min || job.salary_max) && (
            <p className="text-sm text-gray-700 mt-2">
              ₹{job.salary_min ? `${job.salary_min}` : '?'}
              {job.salary_max ? `–${job.salary_max}` : '+'} LPA
            </p>
          )}
          {job.skill_overlap_pct !== null && (
            <p className="text-xs text-gray-500 mt-1">
              You have {job.skill_overlap_pct}% of required skills
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Link
          to={`/app/jobs/${job.id}`}
          className="flex-1 text-center text-sm font-medium text-primary border border-primary rounded-lg py-2 hover:bg-green-50 transition-colors"
        >
          View Details
        </Link>
        {onApply && (
          <button
            onClick={() => onApply(job.id)}
            className="flex-1 text-sm font-medium bg-primary text-white rounded-lg py-2 hover:bg-primary/90 transition-colors"
          >
            Quick Apply
          </button>
        )}
      </div>
    </div>
  )
}

export default function JobsPage() {
  const [sector, setSector] = useState('')
  const [jobType, setJobType] = useState('')
  const [page, setPage] = useState(0)
  const limit = 12

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', sector, jobType, page],
    queryFn: () => getJobs({ sector: sector || undefined, job_type: jobType || undefined, limit, offset: page * limit }),
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <main className="flex-1 p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Job Opportunities</h1>
          <p className="text-gray-600 text-sm mt-1">
            Ranked by your DISHA profile match score
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={sector}
            onChange={(e) => { setSector(e.target.value); setPage(0) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Sectors</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={jobType}
            onChange={(e) => { setJobType(e.target.value); setPage(0) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Types</option>
            {JOB_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
          </select>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-red-600">
            Failed to load jobs. Please try again.
          </div>
        )}

        {data && (
          <>
            <p className="text-sm text-gray-500 mb-4">{data.total} jobs found</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {data.total > limit && (
              <div className="flex justify-center gap-3 mt-8">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {page + 1} of {Math.ceil(data.total / limit)}
                </span>
                <button
                  disabled={(page + 1) * limit >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
