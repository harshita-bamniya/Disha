/**
 * Phase 3 — My Applications Page (Aspirant)
 * Shows all applications with status badges and withdrawal option.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'
import { getMyApplications, withdrawApplication, type ApplicationOut } from '@/api/matching'

const STATUS_STYLES: Record<string, string> = {
  applied:       'bg-blue-100 text-blue-800',
  under_review:  'bg-yellow-100 text-yellow-800',
  shortlisted:   'bg-green-100 text-green-800',
  rejected:      'bg-red-100 text-red-800',
  hired:         'bg-emerald-100 text-emerald-800',
  withdrawn:     'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  applied:       'Applied',
  under_review:  'Under Review',
  shortlisted:   'Shortlisted 🎉',
  rejected:      'Not Selected',
  hired:         'Hired! 🎊',
  withdrawn:     'Withdrawn',
}

function ApplicationCard({ app }: { app: ApplicationOut }) {
  const qc = useQueryClient()
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawApplication(app.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-applications'] }),
  })

  const canWithdraw = !['withdrawn', 'hired', 'rejected'].includes(app.status)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{app.job_title}</h3>
          <p className="text-sm text-gray-600">{app.company_name}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[app.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[app.status] || app.status}
            </span>
            {app.match_score !== null && (
              <span className="text-xs text-gray-500">Match: {app.match_score}%</span>
            )}
          </div>
          {app.employer_note && (
            <p className="text-sm text-gray-600 mt-2 italic">"{app.employer_note}"</p>
          )}
          {app.cover_note && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
              Your note: {app.cover_note}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Link
          to={`/app/jobs/${app.job_id}`}
          className="flex-1 text-center text-sm border border-gray-300 text-gray-700 rounded-lg py-2 hover:bg-gray-50 transition-colors"
        >
          View Job
        </Link>
        {canWithdraw && (
          <button
            onClick={() => withdrawMutation.mutate()}
            disabled={withdrawMutation.isPending}
            className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            Withdraw
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Applied {new Date(app.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </p>
    </div>
  )
}

export default function MyApplicationsPage() {
  const { data: applications, isLoading, isError } = useQuery({
    queryKey: ['my-applications'],
    queryFn: getMyApplications,
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <main className="flex-1 p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
            <p className="text-gray-600 text-sm mt-1">Track all your job applications in one place</p>
          </div>
          <Link
            to="/app/jobs"
            className="text-sm bg-primary text-white rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors"
          >
            Browse Jobs
          </Link>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-red-600">Failed to load applications.</div>
        )}

        {applications && applications.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-semibold text-gray-700">No applications yet</h3>
            <p className="text-sm text-gray-500 mt-1">Browse jobs and apply to opportunities that match your profile.</p>
            <Link to="/app/jobs" className="inline-block mt-4 text-sm text-primary hover:underline">
              Explore Jobs →
            </Link>
          </div>
        )}

        {applications && applications.length > 0 && (
          <div className="grid gap-4">
            {applications.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
