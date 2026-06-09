/**
 * Phase 3 — Candidate Pipeline Page (Employer)
 * Shows all applicants for a specific job posting with pipeline management.
 */
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getJobPipeline, updateApplicationStatus, type CandidateOut } from '@/api/matching'

const STATUS_OPTIONS = [
  { value: 'under_review', label: 'Mark Under Review' },
  { value: 'shortlisted', label: 'Shortlist' },
  { value: 'rejected', label: 'Reject' },
  { value: 'hired', label: 'Mark as Hired' },
]

const STATUS_COLOR: Record<string, string> = {
  applied:       'bg-blue-100 text-blue-800',
  under_review:  'bg-yellow-100 text-yellow-800',
  shortlisted:   'bg-green-100 text-green-800',
  rejected:      'bg-red-100 text-red-800',
  hired:         'bg-emerald-100 text-emerald-800',
  withdrawn:     'bg-gray-100 text-gray-600',
}

function KrsBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span>{label}</span>
        <span>{score}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function CandidateCard({ candidate, jobId }: { candidate: CandidateOut; jobId: string }) {
  const qc = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState('')
  const [note, setNote] = useState('')
  const [showActions, setShowActions] = useState(false)

  const updateMutation = useMutation({
    mutationFn: () => updateApplicationStatus(candidate.application_id, selectedStatus, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline', jobId] })
      setShowActions(false)
      setSelectedStatus('')
      setNote('')
    },
  })

  const isTerminal = ['withdrawn', 'hired', 'rejected'].includes(candidate.status)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{candidate.full_name || 'Anonymous'}</h3>
          <p className="text-sm text-gray-500">
            {[candidate.city, candidate.state].filter(Boolean).join(', ') || 'Location not specified'}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[candidate.status] || 'bg-gray-100 text-gray-600'}`}>
          {candidate.status.replace('_', ' ')}
        </span>
      </div>

      <div className="text-sm text-gray-700 mb-2">
        <span className="font-medium">UPSC:</span>{' '}
        {candidate.upsc_attempts} attempt(s), highest: {candidate.highest_stage_cleared || 'N/A'}
      </div>

      {candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {candidate.skills.slice(0, 6).map((s) => (
            <span key={s} className="text-xs bg-green-50 text-green-800 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {candidate.skills.length > 6 && (
            <span className="text-xs text-gray-400">+{candidate.skills.length - 6} more</span>
          )}
        </div>
      )}

      <KrsBar label="Knowledge" score={candidate.k_score} />
      <KrsBar label="Readiness" score={candidate.r_score} />
      <KrsBar label="Skill Match" score={candidate.s_score} />

      {candidate.match_score !== null && (
        <div className="mt-2 text-sm font-medium text-gray-700">
          Job match: {candidate.match_score}%
        </div>
      )}

      {candidate.cover_note && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 italic">
          "{candidate.cover_note}"
        </div>
      )}

      {!isTerminal && (
        <div className="mt-4">
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="w-full text-sm border border-primary text-primary rounded-lg py-2 hover:bg-green-50 transition-colors"
            >
              Update Status
            </button>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select action...</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {selectedStatus && (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note for the candidate (optional)..."
                  maxLength={500}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowActions(false)} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={!selectedStatus || updateMutation.isPending}
                  className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CandidatePipelinePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [filter, setFilter] = useState('all')

  const { data: pipeline, isLoading, isError } = useQuery({
    queryKey: ['pipeline', jobId],
    queryFn: () => getJobPipeline(jobId!),
    enabled: !!jobId,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !pipeline) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-600">
        Failed to load candidate pipeline.
      </div>
    )
  }

  const filtered = filter === 'all'
    ? pipeline.candidates
    : pipeline.candidates.filter((c) => c.status === filter)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{pipeline.job_title}</h1>
          <p className="text-gray-600 text-sm mt-1">{pipeline.total_applications} total application(s)</p>
        </div>

        {/* Status summary */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === 'all' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            All ({pipeline.total_applications})
          </button>
          {Object.entries(pipeline.by_status).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${filter === status ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {status.replace('_', ' ')} ({count})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No candidates in this stage.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <CandidateCard key={c.application_id} candidate={c} jobId={jobId!} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
