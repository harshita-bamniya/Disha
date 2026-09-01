import { useState } from 'react'
import { Brain, CheckCircle2, ClipboardList, TrendingUp } from 'lucide-react'
import {
  useReviewableInterviewSessions, useSubmitInterviewHumanReview,
  useInterviewCalibrationStats, useInterviewOutcomeCorrelation,
} from '../hooks/useAdmin'
import { StatCard, Empty, Spinner } from '../shared/adminUI'
import DataTable from '@/shared/components/data-display/DataTable'
import type { TableColumn } from '@/shared/types'
import { colors } from '@/design-system/tokens'
import type { HumanReviewEntry, ReviewableSession } from '@/api/admin'

const RECOMMENDATIONS = ['Strong Hire', 'Hire', 'Maybe', 'No Hire']

// ── Blind review form for one sampled session ────────────────────────────────
// Deliberately never shown the AI's own score/recommendation — that's withheld
// server-side by ReviewableSessionOut, not just hidden in the UI, so there's
// no way for a reviewer to anchor on it even by accident.

function ReviewCard({ session }: { session: ReviewableSession }) {
  const [expanded, setExpanded] = useState(false)
  const [score, setScore] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [notes, setNotes] = useState('')
  const submitReview = useSubmitInterviewHumanReview()

  const canSubmit = score !== '' && Number(score) >= 0 && Number(score) <= 100 && recommendation !== ''

  return (
    <div className="rounded-2xl p-5" style={{ border: `1px solid ${colors.border.default}`, background: colors.surface.card }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: colors.text.ink }}>
            {session.job_role || 'Interview'} <span className="font-normal" style={{ color: colors.text.muted }}>· {session.experience_level || 'Mid-Level'}</span>
          </p>
          <p className="text-xs" style={{ color: colors.text.muted }}>
            {session.completed_at ? new Date(session.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            {' · '}{session.transcript.length} questions
          </p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ color: colors.brand.navy, background: colors.surface.elevated }}
        >
          {expanded ? 'Hide transcript' : 'Read transcript'}
        </button>
      </div>

      {expanded && (
        <div className="mb-4 flex flex-col gap-3 max-h-80 overflow-y-auto rounded-xl p-3" style={{ background: colors.surface.elevated }}>
          {session.transcript.map((t, i) => (
            <div key={i} className="text-xs">
              <p className="font-semibold mb-1" style={{ color: colors.text.ink }}>Q{i + 1}: {t.question}</p>
              <p style={{ color: colors.text.inkSoft }}>{t.response}</p>
            </div>
          ))}
        </div>
      )}

      {submitReview.isSuccess && submitReview.variables?.sessionId === session.session_id ? (
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: colors.state.success }}>
          <CheckCircle2 size={14} /> Review recorded
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Your readiness score (0-100)</label>
            <input
              type="number" min={0} max={100} value={score}
              onChange={e => setScore(e.target.value)}
              className="w-28 h-9 px-3 text-sm outline-none rounded-lg"
              style={{ border: `1px solid ${colors.border.default}` }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Your recommendation</label>
            <select
              value={recommendation}
              onChange={e => setRecommendation(e.target.value)}
              className="h-9 px-3 text-sm outline-none rounded-lg bg-white"
              style={{ border: `1px solid ${colors.border.default}`, color: colors.text.ink }}
            >
              <option value="">Select…</option>
              {RECOMMENDATIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Notes (optional)</label>
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full h-9 px-3 text-sm outline-none rounded-lg"
              style={{ border: `1px solid ${colors.border.default}` }}
            />
          </div>
          <button
            disabled={!canSubmit || submitReview.isPending}
            onClick={() => submitReview.mutate({
              sessionId: session.session_id,
              payload: { human_readiness_score: Number(score), human_recommendation: recommendation, notes: notes || undefined },
            })}
            className="h-9 px-4 text-xs font-bold rounded-lg text-white"
            style={{ background: canSubmit ? colors.brand.navy : colors.text.muted, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            Submit review
          </button>
        </div>
      )}
    </div>
  )
}

const REVIEW_COLUMNS: TableColumn<HumanReviewEntry>[] = [
  {
    key: 'session_id', header: 'Session', width: 110,
    render: row => <span className="text-xs font-mono" style={{ color: colors.text.muted }}>{row.session_id.slice(0, 8)}</span>,
  },
  {
    key: 'ai_recommendation', header: 'AI Verdict',
    render: row => (
      <span className="text-xs">
        {row.ai_recommendation ?? '—'} <span style={{ color: colors.text.muted }}>({row.ai_readiness_score ?? '—'}%)</span>
      </span>
    ),
  },
  {
    key: 'human_recommendation', header: 'Human Verdict',
    render: row => (
      <span className="text-xs">
        {row.human_recommendation} <span style={{ color: colors.text.muted }}>({row.human_readiness_score}%)</span>
      </span>
    ),
  },
  {
    key: 'agree', header: 'Agree', align: 'center', width: 80,
    render: row => row.agree
      ? <CheckCircle2 size={16} color={colors.state.success} style={{ margin: '0 auto' }} />
      : <span style={{ color: colors.state.danger, fontSize: 12, fontWeight: 700 }}>✕</span>,
  },
  {
    key: 'reviewed_at', header: 'Reviewed', align: 'right', width: 120,
    render: row => (
      <span className="text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>
        {new Date(row.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </span>
    ),
  },
]

export default function InterviewCalibrationPage() {
  const { data: sample, isLoading: sampleLoading } = useReviewableInterviewSessions(10)
  const { data: stats, isLoading: statsLoading } = useInterviewCalibrationStats()
  const { data: correlation } = useInterviewOutcomeCorrelation()

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
          AI Interviewer Calibration
        </h1>
        <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
          Blind-score sampled sessions to track how often the AI's readiness verdict agrees with a human reviewer,
          and whether higher readiness tiers actually correlate with better reported outcomes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Brain}
          label="AI-Human Agreement"
          value={stats?.agreement_rate != null ? `${stats.agreement_rate}%` : '—'}
          sub={`${stats?.total_reviews ?? 0} reviews so far`}
        />
        <StatCard
          icon={ClipboardList}
          label="Sessions Awaiting Review"
          value={sample?.length ?? 0}
        />
        <StatCard
          icon={TrendingUp}
          label="Outcomes Reported"
          value={correlation?.total_outcomes_reported ?? 0}
          sub="predictive-validity flywheel"
        />
      </div>

      {/* Outcome correlation */}
      {correlation && correlation.by_recommendation.length > 0 && (
        <div className="rounded-2xl p-5" style={{ border: `1px solid ${colors.border.default}`, background: colors.surface.card }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: colors.text.ink }}>Readiness tier vs. reported outcome</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: colors.text.muted }}>
                  <th className="text-left font-semibold pb-2">Hiring Recommendation</th>
                  <th className="text-right font-semibold pb-2">Total</th>
                  <th className="text-left font-semibold pb-2 pl-4">Outcomes</th>
                </tr>
              </thead>
              <tbody>
                {correlation.by_recommendation.map(row => (
                  <tr key={row.hiring_recommendation} style={{ borderTop: `1px solid ${colors.border.default}` }}>
                    <td className="py-2 font-semibold" style={{ color: colors.text.ink }}>{row.hiring_recommendation}</td>
                    <td className="py-2 text-right tabular-nums" style={{ color: colors.text.ink }}>{row.total}</td>
                    <td className="py-2 pl-4">
                      {Object.entries(row.outcomes).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review queue */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: colors.text.ink }}>Sessions Awaiting Review</h2>
        {sampleLoading ? (
          <Spinner />
        ) : !sample || sample.length === 0 ? (
          <Empty icon={ClipboardList} text="No sessions currently need a human review." />
        ) : (
          <div className="flex flex-col gap-3">
            {sample.map(s => <ReviewCard key={s.session_id} session={s} />)}
          </div>
        )}
      </div>

      {/* Recent reviews */}
      {!statsLoading && stats && stats.reviews.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3" style={{ color: colors.text.ink }}>Recent Reviews</h2>
          <DataTable<HumanReviewEntry>
            columns={REVIEW_COLUMNS}
            rows={stats.reviews}
            rowKey={r => r.session_id}
            loading={false}
            emptyIcon={<Brain size={28} />}
            emptyTitle="No reviews yet"
          />
        </div>
      )}
    </section>
  )
}
