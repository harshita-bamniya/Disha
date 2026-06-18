import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, ArrowUpRight, Clock, X, AlertTriangle,
  ChevronRight, FileText, ListChecks, Hourglass, Star, TrendingUp,
} from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import {
  getMyApplications, getApplicationDetail, withdrawApplication,
  type ApplicationOut, type ApplicationStatusHistoryItem,
} from '@/api/matching'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; text: string; accent: string }> = {
  applied:      { label: 'Applied',       text: '#1D4ED8', accent: '#3B82F6' },
  under_review: { label: 'Under Review',  text: '#92400E', accent: '#F59E0B' },
  shortlisted:  { label: 'Shortlisted',   text: '#166534', accent: '#22C55E' },
  rejected:     { label: 'Not Selected',  text: '#BE123C', accent: '#F43F5E' },
  hired:        { label: 'Hired',         text: '#065F46', accent: '#10B981' },
  withdrawn:    { label: 'Withdrawn',     text: '#64748B', accent: '#94A3B8' },
}

const WITHDRAW_REASONS = [
  'Found a better opportunity',
  'Compensation does not match expectations',
  'No longer interested in this role',
  'Applied by mistake',
  'Other',
]

type ColumnKey = 'applied' | 'under_review' | 'shortlisted' | 'closed'

const COLUMNS: { key: ColumnKey; label: string; accent: string }[] = [
  { key: 'applied',      label: 'Applied',      accent: '#3B82F6' },
  { key: 'under_review', label: 'Under Review', accent: '#F59E0B' },
  { key: 'shortlisted',  label: 'Shortlisted',  accent: '#22C55E' },
  { key: 'closed',       label: 'Closed',       accent: '#94A3B8' },
]

const CLOSED_STATUSES = new Set(['rejected', 'hired', 'withdrawn'])

function columnOf(status: string): ColumnKey {
  if (status === 'applied') return 'applied'
  if (status === 'under_review') return 'under_review'
  if (status === 'shortlisted') return 'shortlisted'
  return 'closed'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function matchColor(s: number) {
  if (s >= 70) return '#16A34A'
  if (s >= 40) return '#D97706'
  return '#E11D48'
}

// ── Pipeline card (compact) ───────────────────────────────────────────────────

function PipelineCard({ app, onOpen }: { app: ApplicationOut; onOpen: () => void }) {
  const cfg = STATUS_CFG[app.status] ?? STATUS_CFG.applied
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 12, padding: '13px 14px',
        border: `1px solid ${hov ? cfg.accent + '55' : '#E8ECF1'}`,
        borderLeft: `3px solid ${cfg.accent}`,
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: hov ? '0 6px 18px rgba(15,23,42,0.08)' : '0 1px 2px rgba(15,23,42,0.03)',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.35 }}>
            {app.job_title}
          </p>
          <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0' }}>{app.company_name}</p>
        </div>
        {app.match_score !== null && (
          <span style={{
            fontSize: 11, fontWeight: 800, color: matchColor(app.match_score),
            background: matchColor(app.match_score) + '14', borderRadius: 8,
            padding: '2px 7px', flexShrink: 0,
          }}>
            {app.match_score}%
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 10.5, color: '#A0AEC0', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} /> {daysAgo(app.created_at)}
        </span>
        <ChevronRight size={13} color="#CBD5E1" />
      </div>
    </div>
  )
}

// ── Status timeline ───────────────────────────────────────────────────────────

function StatusTimeline({ items }: { items: ApplicationStatusHistoryItem[] }) {
  if (!items.length) return (
    <p style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'center', padding: '10px 0' }}>No timeline events yet.</p>
  )
  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: '#E2E8F0' }} />
      {items.map((item, i) => {
        const cfg = STATUS_CFG[item.to_status] ?? STATUS_CFG.applied
        const isLast = i === items.length - 1
        return (
          <div key={i} style={{ position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
            <div style={{
              position: 'absolute', left: -20, top: 3,
              width: 11, height: 11, borderRadius: '50%',
              background: isLast ? cfg.accent : '#CBD5E1',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
              <span style={{ fontSize: 11, color: '#A0AEC0' }}>{fmtDate(item.created_at)}</span>
            </div>
            {item.note && (
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0', lineHeight: 1.5 }}>{item.note}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Withdraw flow (realistic — requires a reason, warns at advanced stages) ────

function WithdrawPanel({ app, onDone, onCancel }: {
  app: ApplicationOut; onDone: () => void; onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const mutation = useMutation({
    mutationFn: () => withdrawApplication(app.id, reason, note || undefined),
    onSuccess: onDone,
  })
  const isAdvanced = app.status === 'shortlisted'

  return (
    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 16 }}>
      {isAdvanced && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
          <AlertTriangle size={14} color="#B45309" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
            You're shortlisted for this role. Withdrawing now will notify the employer immediately and you typically can't reapply to this posting.
          </p>
        </div>
      )}
      <p style={{ fontSize: 12.5, fontWeight: 700, color: '#7C2D12', margin: '0 0 8px' }}>
        Why are you withdrawing?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {WITHDRAW_REASONS.map(r => (
          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
            <input type="radio" name="withdraw-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note for your records (optional)"
        rows={2}
        style={{
          width: '100%', fontSize: 12.5, padding: '8px 10px', borderRadius: 8,
          border: '1px solid #FED7AA', resize: 'vertical', outline: 'none',
          fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={!reason || mutation.isPending}
          onClick={() => mutation.mutate()}
          style={{
            fontSize: 12.5, fontWeight: 700, color: '#fff',
            background: reason ? '#DC2626' : '#FCA5A5', border: 'none', borderRadius: 9,
            padding: '8px 16px', cursor: reason ? 'pointer' : 'not-allowed',
          }}
        >
          {mutation.isPending ? 'Withdrawing…' : 'Confirm Withdrawal'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontSize: 12.5, fontWeight: 600, color: '#64748B', background: '#fff',
            border: '1px solid #E2E8F0', borderRadius: 9, padding: '8px 14px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ app, onClose }: { app: ApplicationOut; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [withdrawing, setWithdrawing] = useState(false)
  const cfg = STATUS_CFG[app.status] ?? STATUS_CFG.applied
  const canWithdraw = !CLOSED_STATUSES.has(app.status)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['application-detail', app.id],
    queryFn: () => getApplicationDetail(app.id),
    staleTime: 60 * 1000,
  })

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
        zIndex: 40, animation: 'fadeIn 0.18s ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '92vw',
        background: '#fff', zIndex: 41, boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: cfg.text, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              {cfg.label}
            </span>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '4px 0 2px' }}>{app.job_title}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{app.company_name}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={15} color="#64748B" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Match + applied date */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            {app.match_score !== null && (
              <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: matchColor(app.match_score), margin: 0 }}>{app.match_score}%</p>
                <p style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600, margin: '2px 0 0' }}>MATCH SCORE</p>
              </div>
            )}
            <div style={{ flex: 1, background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#374151', margin: 0 }}>{fmtDate(app.created_at)}</p>
              <p style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600, margin: '2px 0 0' }}>APPLIED ON</p>
            </div>
          </div>

          {app.employer_note && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Note from employer</p>
              <p style={{ fontSize: 13, color: '#14532D', margin: 0, lineHeight: 1.55 }}>{app.employer_note}</p>
            </div>
          )}

          {app.cover_note && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText size={12} /> Your Cover Note
              </p>
              <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{app.cover_note}</p>
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Timeline
          </p>
          {isLoading
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
                <div style={{ width: 20, height: 20, border: '2px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            : <StatusTimeline items={detail?.status_history ?? []} />
          }

          {/* Withdraw section */}
          {canWithdraw && (
            <div style={{ marginTop: 22 }}>
              {!withdrawing ? (
                <button
                  type="button"
                  onClick={() => setWithdrawing(true)}
                  style={{
                    fontSize: 12.5, fontWeight: 600, color: '#94A3B8', background: 'transparent',
                    border: '1px dashed #E2E8F0', borderRadius: 10, padding: '9px 14px',
                    cursor: 'pointer', width: '100%', textAlign: 'center',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FCA5A5' }}
                  onMouseOut={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = '#E2E8F0' }}
                >
                  Withdraw Application
                </button>
              ) : (
                <WithdrawPanel
                  app={app}
                  onCancel={() => setWithdrawing(false)}
                  onDone={() => { qc.invalidateQueries({ queryKey: ['my-applications'] }); onClose() }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer action */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid #F1F5F9' }}>
          <button
            type="button"
            onClick={() => navigate(`/app/jobs/${app.job_id}`)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 13.5, fontWeight: 700, background: '#3B82F6',
              color: '#fff', border: 'none', borderRadius: 11, padding: '11px 0', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59,130,246,0.25)', transition: 'background 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#1D4ED8' }}
            onMouseOut={e => { e.currentTarget.style.background = '#3B82F6' }}
          >
            View Full Job Posting <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyApplicationsPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState<ApplicationOut | null>(null)

  const { data: applications, isLoading, isError } = useQuery({
    queryKey: ['my-applications'],
    queryFn: getMyApplications,
    staleTime: 60 * 1000,
  })

  const all = applications ?? []
  const shortlisted = all.filter(a => a.status === 'shortlisted').length
  const inProgress  = all.filter(a => a.status === 'applied' || a.status === 'under_review').length
  const respRate    = all.length > 0
    ? Math.round(((all.length - all.filter(a => a.status === 'applied').length) / all.length) * 100)
    : 0

  const byColumn: Record<ColumnKey, ApplicationOut[]> = {
    applied: [], under_review: [], shortlisted: [], closed: [],
  }
  for (const app of all) byColumn[columnOf(app.status)].push(app)
  for (const key of Object.keys(byColumn) as ColumnKey[]) {
    byColumn[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)' }}>
      <AppSidebar activePath="/app/jobs/applications" />

      <main style={{ flex: 1, minWidth: 0, padding: '28px 30px', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 22, fontWeight: 900, color: '#15130F', margin: 0, letterSpacing: '-0.3px' }}>
              Application Pipeline
            </h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
              Track every application from submission to offer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/jobs')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 700, color: '#fff',
              background: '#15130F', border: 'none', borderRadius: 10,
              padding: '10px 18px', cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#2B2722' }}
            onMouseOut={e => { e.currentTarget.style.background = '#15130F' }}
          >
            Browse Jobs <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Applications', value: all.length, Icon: ListChecks },
            { label: 'In Progress',         value: inProgress, Icon: Hourglass },
            { label: 'Shortlisted',         value: shortlisted, Icon: Star },
            { label: 'Response Rate',       value: `${respRate}%`, Icon: TrendingUp },
          ].map(s => (
            <div key={s.label} style={{
              background: 'white', borderRadius: 14, padding: '14px 16px',
              border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.Icon size={16} color="#3B82F6" />
              </div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#15130F', margin: 0, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {isError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '16px 20px', color: '#991B1B', fontSize: 14 }}>
            Failed to load applications. Please refresh.
          </div>
        )}

        {!isLoading && !isError && all.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Briefcase size={26} color="#3B82F6" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#15130F', margin: '0 0 8px' }}>No applications yet</h3>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px' }}>Once you apply to jobs, they'll show up here as a pipeline.</p>
            <button
              type="button"
              onClick={() => navigate('/app/jobs')}
              style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#3B82F6', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: 'pointer' }}
            >
              Browse Jobs →
            </button>
          </div>
        )}

        {!isLoading && !isError && all.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, minWidth: 'max-content' }}>
            {COLUMNS.map((col, ci) => {
              const items = byColumn[col.key]
              return (
                <div key={col.key} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.accent, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#15130F' }}>{col.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: '#94A3B8', background: '#F1EAE0',
                        borderRadius: 20, padding: '1px 8px', marginLeft: 'auto',
                      }}>
                        {items.length}
                      </span>
                    </div>

                    {/* Column body */}
                    <div style={{
                      background: '#FAF7F1', border: '1px solid #F1EAE0', borderRadius: 16, padding: 10, flex: 1,
                      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120,
                    }}>
                      {items.length === 0
                        ? <p style={{ fontSize: 12, color: '#B0A99A', textAlign: 'center', padding: '20px 6px' }}>Nothing here</p>
                        : items.map(app => (
                            <PipelineCard key={app.id} app={app} onOpen={() => setActive(app)} />
                          ))
                      }
                    </div>
                  </div>
                  {ci < COLUMNS.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 120, marginTop: 36, flexShrink: 0 }}>
                      <ChevronRight size={16} color="#D6CFC0" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {active && <DetailDrawer app={active} onClose={() => setActive(null)} />}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  )
}
