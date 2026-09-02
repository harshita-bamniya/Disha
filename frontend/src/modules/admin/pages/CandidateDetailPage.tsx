import { useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Users, Shield, ShieldOff, CheckCircle2, Monitor, LogOut,
  Briefcase, AlertTriangle, MessageSquare,
} from 'lucide-react'
import {
  useAdminUser, useLoginHistory, useDeviceSessions,
  useUpdateUserStatus, useRevokeDeviceSession, useCandidateApplications,
  useCandidateSupportTickets,
} from '../hooks/useAdmin'
import {
  Spinner, Empty, Badge, SectionHeading, DetailRow, ScoreBar, Breadcrumb, TabBar, type TabDef, STATUS_COLOR_MAP,
} from '../shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'


const TABS: TabDef[] = [
  { key: 'profile',     label: 'Profile' },
  { key: 'applications',label: 'Applications' },
  { key: 'security',    label: 'Login History' },
  { key: 'moderation',  label: 'Moderation' },
  { key: 'support',     label: 'Support' },
]

const TICKET_STATUS_COLOR: Record<string, string> = {
  open: 'amber', pending: 'blue', resolved: 'green', closed: 'gray',
}
const TICKET_PRIORITY_COLOR: Record<string, string> = {
  low: 'gray', normal: 'blue', high: 'amber', urgent: 'red',
}

const cardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '20px' }
const tableCardStyle = { background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' as const }
const tableHeaderStyle = { background: colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px' }

// ── Tab: Profile ───────────────────────────────────────────────────────────────

function ProfileTab({ user }: { user: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="flex flex-col gap-4">
        <div style={cardStyle}>
          <SectionHeading>Personal Information</SectionHeading>
          <DetailRow label="Full Name"   value={user.full_name} />
          <DetailRow label="Phone"       value={user.phone} />
          <DetailRow label="Email"       value={user.email} />
          <DetailRow label="Gender"      value={user.gender} />
          <DetailRow label="Date of Birth" value={user.date_of_birth} />
          <DetailRow label="City"        value={user.city} />
          <DetailRow label="State"       value={user.state} />
          <DetailRow label="Registered"  value={new Date(user.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
          {user.last_login_at && (
            <DetailRow label="Last Login"  value={new Date(user.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          )}
        </div>

        {user.education && (
          <div style={cardStyle}>
            <SectionHeading>Education</SectionHeading>
            <DetailRow label="Qualification" value={user.education.highest_qualification} />
            <DetailRow label="Degree"        value={user.education.degree} />
            <DetailRow label="Field"         value={user.education.field_of_study} />
            <DetailRow label="Institution"   value={user.education.institution} />
            <DetailRow label="Year"          value={user.education.graduation_year} />
          </div>
        )}

        {user.work_experience && (
          <div style={cardStyle}>
            <SectionHeading>Work Experience</SectionHeading>
            <DetailRow label="Has Experience" value={user.work_experience.has_work_experience ? 'Yes' : 'No'} />
            <DetailRow label="Years"          value={user.work_experience.work_experience_years} />
            <DetailRow label="Domain"         value={user.work_experience.work_experience_domain} />
            <DetailRow label="Last Role"      value={user.work_experience.last_designation} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {user.krs && (
          <div style={cardStyle}>
            <SectionHeading>KRS Scores</SectionHeading>
            <div className="flex flex-col gap-3 mt-2">
              <div><p className="text-xs mb-1" style={{ color: colors.text.muted }}>Knowledge (K)</p><ScoreBar value={user.krs.k_score} color="bg-blue-500" /></div>
              <div><p className="text-xs mb-1" style={{ color: colors.text.muted }}>Resilience (R)</p><ScoreBar value={user.krs.r_score} color="bg-purple-500" /></div>
              <div><p className="text-xs mb-1" style={{ color: colors.text.muted }}>Skills (S)</p><ScoreBar value={user.krs.s_score} color="bg-teal-500" /></div>
              <div className="pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-xs mb-1" style={{ color: colors.text.muted }}>Composite</p>
                <ScoreBar value={user.krs.composite} color="bg-blue-700" />
              </div>
            </div>
          </div>
        )}

        {user.skills?.length > 0 && (
          <div style={cardStyle}>
            <SectionHeading>Skills</SectionHeading>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user.skills.map((s: string) => (
                <span key={s} className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: colors.surface.elevated, color: colors.text.ink }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {user.upsc_journey && (
          <div style={cardStyle}>
            <SectionHeading>UPSC Journey</SectionHeading>
            <DetailRow label="Exam"           value={user.upsc_journey.upsc_exam} />
            <DetailRow label="Years Preparing" value={user.upsc_journey.years_preparing} />
            <DetailRow label="Attempts"       value={user.upsc_journey.upsc_attempts} />
            <DetailRow label="Highest Stage"  value={user.upsc_journey.highest_stage_cleared} />
            <DetailRow label="Optional"       value={user.upsc_journey.optional_subject} />
          </div>
        )}

        {user.selected_tracks?.length > 0 && (
          <div style={cardStyle}>
            <SectionHeading>Career Tracks</SectionHeading>
            <div className="flex flex-col gap-2 mt-2">
              {user.selected_tracks.map((t: any) => (
                <div key={t.track_id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: colors.text.ink }}>{t.title}</span>
                  <span style={{ color: colors.text.muted }}>{t.sector}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Applications ──────────────────────────────────────────────────────────

function ApplicationsTab({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading } = useCandidateApplications(userId, { status: statusFilter || undefined })
  const STATUS_OPTS = ['applied', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn']

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {['', ...STATUS_OPTS].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="h-8 px-3 text-xs font-semibold transition-all"
            style={{
              borderRadius: 10,
              background: statusFilter === s ? colors.brand.navy : '#fff',
              color: statusFilter === s ? '#fff' : colors.text.ink,
              border: statusFilter === s ? 'none' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div style={tableCardStyle}>
        {isLoading ? <Spinner /> : !data?.length ? (
          <Empty icon={Briefcase} text="No applications" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 480 }}>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2" style={{ background: colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {['Job', 'Score', 'Status', 'Applied'].map((h, i) => (
                  <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>{h}</span>
                ))}
              </div>
              {data.map((app, idx) => (
                <button
                  key={app.id}
                  onClick={() => navigate(`/admin/jobs/${app.job_id}`)}
                  className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
                  style={{
                    background: idx % 2 === 0 ? '#fff' : colors.surface.bg,
                    borderBottom: idx < data.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
                  onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : colors.surface.bg)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: colors.text.ink }}>{app.job_title}</p>
                    <p className="text-xs truncate" style={{ color: colors.text.muted }}>{app.company_name}</p>
                  </div>
                  <span className="text-xs font-bold text-right" style={{ color: colors.text.ink }}>{app.match_score ?? '—'}</span>
                  <span className="text-right">
                    <Badge color={STATUS_COLOR_MAP[app.status] ?? 'gray'}>{app.status.replace(/_/g, ' ')}</Badge>
                  </span>
                  <span className="text-xs text-right whitespace-nowrap" style={{ color: colors.text.muted }}>
                    {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Security (Login History) ──────────────────────────────────────────────

function SecurityTab({ userId }: { userId: string }) {
  const { data: history, isLoading: historyLoading } = useLoginHistory(userId)
  const { data: sessions, isLoading: sessionsLoading } = useDeviceSessions(userId)
  const revokeSession = useRevokeDeviceSession()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div style={tableCardStyle}>
        <div style={tableHeaderStyle}>
          <h3 className="text-sm font-bold" style={{ color: colors.text.ink }}>Login History</h3>
          <p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>Last 20 login attempts</p>
        </div>
        {historyLoading ? <Spinner /> : !history?.length ? (
          <Empty icon={Shield} text="No login history" />
        ) : (
          history.slice(0, 20).map((h, idx) => (
            <div key={h.id} className="flex items-center justify-between px-4 py-2.5 gap-3"
              style={{ borderBottom: idx < Math.min(history.length, 20) - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined, background: idx % 2 === 0 ? '#fff' : colors.surface.bg }}>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold', h.success ? '' : 'text-red-600')} style={h.success ? { color: colors.text.ink } : {}}>
                  {h.success ? 'Success' : h.failure_reason ?? 'Failed'}
                </p>
                {h.device_label && <p className="text-[11px] truncate" style={{ color: colors.text.muted }}>{h.device_label}</p>}
                {h.ip_address && <p className="text-[11px]" style={{ color: colors.text.muted }}>{h.ip_address}</p>}
              </div>
              <span className="text-[11px] whitespace-nowrap shrink-0" style={{ color: colors.text.muted }}>
                {new Date(h.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={tableCardStyle}>
        <div style={{ ...tableHeaderStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: colors.text.ink }}>Active Sessions</h3>
            <p className="text-[11px] mt-0.5" style={{ color: colors.text.muted }}>{sessions?.length ?? 0} device{sessions?.length !== 1 ? 's' : ''}</p>
          </div>
          {sessions && sessions.length > 1 && (
            <button
              onClick={() => {
                if (!window.confirm(`Force-logout all ${sessions.length} sessions?`)) return
                sessions.forEach(s => revokeSession.mutate({ userId, sessionId: s.id }))
              }}
              disabled={revokeSession.isPending}
              className="h-7 px-3 text-xs font-semibold text-red-700 disabled:opacity-50"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}
            >
              Revoke All
            </button>
          )}
        </div>
        {sessionsLoading ? <Spinner /> : !sessions?.length ? (
          <Empty icon={Monitor} text="No active sessions" />
        ) : (
          sessions.map((s, idx) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3"
              style={{ borderBottom: idx < sessions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined }}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold" style={{ color: colors.text.ink }}>{s.device_label ?? 'Unknown device'}</p>
                  {s.is_current && <Badge color="green">Current</Badge>}
                </div>
                {s.ip_address && <p className="text-[11px]" style={{ color: colors.text.muted }}>{s.ip_address}</p>}
                <p className="text-[11px]" style={{ color: colors.text.muted }}>
                  Last seen {new Date(s.last_seen_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!s.is_current && (
                <button
                  onClick={() => revokeSession.mutate({ userId, sessionId: s.id })}
                  disabled={revokeSession.isPending}
                  className="flex items-center gap-1 h-7 px-2.5 text-xs font-semibold text-red-600 disabled:opacity-50 shrink-0"
                  style={{ border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2' }}
                >
                  <LogOut size={10} /> Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Tab: Moderation ────────────────────────────────────────────────────────────

function ModerationTab({ user }: { user: any }) {
  const updateStatus = useUpdateUserStatus()
  const [reasonFor, setReasonFor] = useState<'suspended' | 'banned' | null>(null)
  const [reason, setReason] = useState('')

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div style={cardStyle}>
        <SectionHeading>Account Status</SectionHeading>
        <div className="flex items-center gap-2 mb-3 mt-2">
          <div className={cn('w-2.5 h-2.5 rounded-full', user.is_active ? 'bg-green-400' : 'bg-red-400')} />
          <span className="text-sm font-semibold capitalize" style={{ color: colors.text.ink }}>{user.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => updateStatus.mutate({ userId: user.user_id, status: 'active' })}
            disabled={updateStatus.isPending || user.is_active}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold disabled:opacity-40"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', borderRadius: 10 }}
          >
            <Shield size={12} /> Activate
          </button>
          <button
            onClick={() => setReasonFor('suspended')}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold disabled:opacity-40"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309', borderRadius: 10 }}
          >
            <ShieldOff size={12} /> Suspend
          </button>
          <button
            onClick={() => setReasonFor('banned')}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold disabled:opacity-40"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10 }}
          >
            <ShieldOff size={12} /> Ban
          </button>
        </div>

        {reasonFor && (
          <div className="mt-3 flex flex-col gap-2" style={{ background: colors.surface.bg, borderRadius: 10, padding: 12 }}>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder={`Reason for ${reasonFor === 'banned' ? 'ban' : 'suspension'}…`}
              className="w-full px-3 py-2 text-xs outline-none resize-none"
              style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: colors.text.ink }}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setReasonFor(null); setReason('') }}>Cancel</Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                loading={updateStatus.isPending}
                onClick={() => {
                  updateStatus.mutate({ userId: user.user_id, status: reasonFor, reason: reason.trim() || undefined })
                  setReasonFor(null); setReason('')
                }}
              >Confirm</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: 16 }}>
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-1">Merge &amp; reports coming soon</p>
          <p className="text-xs text-amber-700">
            Duplicate profile merging and complaint history will be available in the next iteration.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Support ───────────────────────────────────────────────────────────────

function SupportTab({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useCandidateSupportTickets(userId)

  return (
    <div className="flex flex-col gap-4">
      <div style={tableCardStyle}>
        {isLoading ? <Spinner /> : !data?.items.length ? (
          <Empty icon={MessageSquare} text="No support tickets for this candidate" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2" style={{ background: colors.surface.bg, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {['Subject', 'Category', 'Priority', 'Status', 'Created'].map((h, i) => (
                  <span key={h} className={i > 0 ? 'text-right' : ''} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.text.muted }}>{h}</span>
                ))}
              </div>
              {data.items.map((t, idx) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/admin/support/${t.id}`)}
                  className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center text-left"
                  style={{
                    background: idx % 2 === 0 ? '#fff' : colors.surface.bg,
                    borderBottom: idx < data.items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
                  onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : colors.surface.bg)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: colors.text.ink }}>{t.subject}</p>
                  </div>
                  <span className="text-xs text-right capitalize" style={{ color: '#475569' }}>{t.category}</span>
                  <span className="text-right">
                    <Badge color={TICKET_PRIORITY_COLOR[t.priority] ?? 'gray'}>{t.priority}</Badge>
                  </span>
                  <span className="text-right">
                    <Badge color={TICKET_STATUS_COLOR[t.status] ?? 'gray'}>{t.status}</Badge>
                  </span>
                  <span className="text-xs text-right whitespace-nowrap" style={{ color: colors.text.muted }}>
                    {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'profile'
  const setTab = (t: string) => setSearchParams({ tab: t }, { replace: true })

  const { data: user, isLoading } = useAdminUser(id ?? null)

  if (isLoading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  if (!user) return <Empty icon={Users} text="Candidate not found" />

  const tabs: TabDef[] = TABS.map(t => ({
    ...t,
    count: t.key === 'applications' ? user.total_applications : undefined,
  }))

  return (
    <section className="flex flex-col gap-0">
      <Breadcrumb items={[{ label: 'Candidates', href: '/admin/candidates' }, { label: user.full_name ?? user.phone }]} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users className="w-5 h-5" style={{ color: colors.text.ink }} />
        </div>
        <div className="min-w-0">
          <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>
            {user.full_name ?? user.phone}
          </h1>
          <p className="text-xs" style={{ color: colors.text.muted }}>{user.phone}{user.email ? ` · ${user.email}` : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge color={user.is_active ? 'green' : 'red'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>
          {user.is_completed && <Badge color="blue">Onboarded</Badge>}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Applications', value: user.total_applications },
          { label: 'KRS Score',    value: user.krs?.composite ?? '—' },
          { label: 'Tracks',       value: user.selected_tracks?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '12px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: colors.text.ink }}>{value}</p>
          </div>
        ))}
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === 'profile'      && <ProfileTab user={user} />}
      {activeTab === 'applications' && <ApplicationsTab userId={user.user_id} />}
      {activeTab === 'security'     && <SecurityTab userId={user.user_id} />}
      {activeTab === 'moderation'   && <ModerationTab user={user} />}
      {activeTab === 'support'      && <SupportTab userId={user.user_id} />}
    </section>
  )
}
