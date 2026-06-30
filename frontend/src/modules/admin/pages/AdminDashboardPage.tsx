import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Briefcase, Clock, CheckCircle2, Building2, LogOut,
  Globe, MapPin, Phone, AlertCircle, X, Search, Plus, Pencil, Trash2,
  ChevronDown, ChevronUp, Compass, LayoutDashboard, FileText,
  TrendingUp, Activity, ToggleLeft, ToggleRight, Shield, ShieldOff,
  UserCheck, UserX, Zap, Star, Award, BarChart3, Eye, RefreshCw,
  UserCog, KeyRound, Trash, Settings, Flag, IndianRupee, Download,
} from 'lucide-react'
import {
  useAdminStats, useAdminEmployers, useRevokeEmployer,
  useAdminUsers, useAdminUser, useDeactivateUser, useReactivateUser,
  useAdminCareerTracks, useCreateCareerTrack, useUpdateCareerTrack, useDeleteCareerTrack,
  useAdminJobs, useToggleAdminJob, useDeleteAdminJob,
  useAdminApplications, useAdminActivity,
  useLoginHistory, useDeviceSessions, useUpdateUserStatus, useRevokeDeviceSession,
  useAdminRoles, useUpdateRolePermissions, useAdminPermissions,
  useSubAdmins, useCreateSubAdmin, useUpdateSubAdminRole, useDeleteSubAdmin,
  useEmployerVerifications, useEmployerVerificationDetail, useReviewEmployerVerification,
  useAuditLogs,
  useSubscriptionPlansAdmin, useUpdateSubscriptionPlan,
  usePlatformSettings, useUpdatePlatformSetting, useFeatureFlags, useUpdateFeatureFlag,
  useBillingOverview,
} from '../hooks/useAdmin'
import { analyticsApi } from '@/api/analytics'
import { adminApi } from '@/api/admin'
import SubAdminManagement from '../components/SubAdminManagement'
import type { TrendMetric } from '@/api/analytics'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import type {
  AspirantDetailResponse, EmployerEntry, EmployerStatus,
  CareerTrackAdminEntry, AdminJobEntry, RoleEntry,
} from '@/api/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'dashboard' | 'users' | 'employers' | 'jobs' | 'applications' | 'tracks' | 'subadmins' | 'roles' | 'verifications' | 'auditlog' | 'subscriptions' | 'platform' | 'billing'

const NAV: { label: string; value: Section; icon: React.ElementType; badge?: string }[] = [
  { label: 'Dashboard',    value: 'dashboard',    icon: LayoutDashboard },
  { label: 'Users',        value: 'users',        icon: Users           },
  { label: 'Employers',    value: 'employers',    icon: Building2       },
  { label: 'KYC Verification', value: 'verifications', icon: Shield      },
  { label: 'Jobs',         value: 'jobs',         icon: Briefcase       },
  { label: 'Applications', value: 'applications', icon: FileText        },
  { label: 'Career Tracks',value: 'tracks',       icon: Compass         },
  { label: 'Sub-Admins',   value: 'subadmins',    icon: UserCog         },
  { label: 'Roles & Permissions', value: 'roles', icon: KeyRound        },
  { label: 'Audit Log',    value: 'auditlog',     icon: Activity        },
  { label: 'Revenue',      value: 'billing',      icon: IndianRupee     },
  { label: 'Subscriptions', value: 'subscriptions', icon: Award          },
  { label: 'Platform Settings', value: 'platform', icon: Settings        },
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return (
    <div className="flex justify-center py-10">
      <div className={cn(s, 'border-2 border-primary border-t-transparent rounded-full animate-spin')} />
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-12 h-12 text-gray-200 mb-3" />
      <p className="text-sm font-semibold text-gray-400">{text}</p>
    </div>
  )
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red:   'bg-red-100 text-red-700',
    blue:  'bg-blue-100 text-blue-700',
    gray:  'bg-gray-100 text-gray-500',
    purple:'bg-purple-100 text-purple-700',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', cls[color] ?? cls.gray)}>
      {children}
    </span>
  )
}

function downloadCSV<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ExportButton<T extends Record<string, unknown>>({ rows, filename }: { rows: T[]; filename: string }) {
  return (
    <button
      onClick={() => downloadCSV(rows, filename)}
      disabled={rows.length === 0}
      className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Download size={12} />Export CSV
    </button>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-4 mb-2 first:mt-0">{children}</p>
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  )
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6 text-right">{value}</span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, accent,
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string; accent?: string
}) {
  return (
    <div className={cn(
      'relative bg-white rounded-2xl border shadow-sm px-5 py-5 flex flex-col gap-1 overflow-hidden',
      accent ? `border-l-4 ${accent}` : 'border-gray-100',
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', `${color}/10`)}>
          <Icon className={cn('w-4.5 h-4.5', color)} size={18} />
        </div>
      </div>
      <p className="text-3xl font-black text-gray-900 leading-none">{value}</p>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── User detail drawer ────────────────────────────────────────────────────────

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: user, isLoading } = useAdminUser(userId)
  const deactivate = useDeactivateUser()
  const reactivate = useReactivateUser()

  const fmt = (s: string | null | undefined) =>
    s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null

  const stageLabel: Record<string, string> = {
    none: 'None cleared', prelims: 'Prelims cleared',
    mains: 'Mains cleared', interview: 'Interview stage',
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {isLoading ? 'Loading…' : user?.full_name ?? 'Aspirant Profile'}
            </h3>
            {user && (
              <p className="text-xs text-gray-400 mt-0.5">
                {user.phone}{user.email ? ` · ${user.email}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && (
              user.is_active ? (
                <button
                  onClick={() => deactivate.mutate(userId)}
                  disabled={deactivate.isPending}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <UserX size={12} /> Deactivate
                </button>
              ) : (
                <button
                  onClick={() => reactivate.mutate(userId)}
                  disabled={reactivate.isPending}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <UserCheck size={12} /> Reactivate
                </button>
              )
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? <Spinner /> : !user ? (
            <p className="text-sm text-gray-400 text-center py-10">Could not load profile.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Applications', value: user.total_applications, color: 'text-primary' },
                  { label: 'KRS', value: user.krs?.composite ?? '—', color: 'text-gray-800' },
                  { label: 'Step', value: user.is_completed ? '✓' : `${user.current_step}/7`, color: 'text-amber-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <p className={cn('text-lg font-black', color)}>{value}</p>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <SectionHeading>Account</SectionHeading>
              <DetailRow label="Status" value={
                <span className={cn('px-1.5 py-0.5 rounded-md text-xs font-semibold', user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              } />
              <DetailRow label="Registered" value={new Date(user.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
              <DetailRow label="Last login" value={user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              <DetailRow label="Onboarding" value={user.is_completed ? <span className="text-green-600 font-semibold">Complete</span> : <span className="text-amber-600">Step {user.current_step} of 7</span>} />

              <SectionHeading>Personal</SectionHeading>
              <DetailRow label="Full name"     value={user.full_name} />
              <DetailRow label="Date of birth" value={user.date_of_birth} />
              <DetailRow label="Gender"        value={fmt(user.gender)} />
              <DetailRow label="City / State"  value={[user.city, user.state].filter(Boolean).join(', ') || null} />

              {user.education && (
                <>
                  <SectionHeading>Education</SectionHeading>
                  <DetailRow label="Qualification"   value={fmt(user.education.highest_qualification)} />
                  <DetailRow label="Degree"          value={user.education.degree} />
                  <DetailRow label="Field of study"  value={user.education.field_of_study} />
                  <DetailRow label="Institution"     value={user.education.institution} />
                  <DetailRow label="Graduation year" value={user.education.graduation_year?.toString()} />
                </>
              )}

              {user.upsc_journey && (
                <>
                  <SectionHeading>UPSC Journey</SectionHeading>
                  <DetailRow label="Exam"            value={user.upsc_journey.upsc_exam?.toUpperCase()} />
                  <DetailRow label="Years preparing" value={user.upsc_journey.years_preparing?.toString()} />
                  <DetailRow label="Attempts"        value={user.upsc_journey.upsc_attempts?.toString()} />
                  <DetailRow label="Highest stage"   value={stageLabel[user.upsc_journey.highest_stage_cleared ?? ''] ?? fmt(user.upsc_journey.highest_stage_cleared)} />
                  <DetailRow label="Optional subject" value={user.upsc_journey.optional_subject} />
                </>
              )}

              {user.work_experience && (
                <>
                  <SectionHeading>Work Experience</SectionHeading>
                  <DetailRow label="Has experience"    value={user.work_experience.has_work_experience === true ? 'Yes' : user.work_experience.has_work_experience === false ? 'No' : null} />
                  <DetailRow label="Years"             value={user.work_experience.work_experience_years?.toString()} />
                  <DetailRow label="Domain"            value={user.work_experience.work_experience_domain} />
                  <DetailRow label="Last designation"  value={user.work_experience.last_designation} />
                </>
              )}

              {user.skills && user.skills.length > 0 && (
                <>
                  <SectionHeading>Skills</SectionHeading>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {user.skills.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">{s}</span>
                    ))}
                  </div>
                </>
              )}

              {user.career_preferences && (
                <>
                  <SectionHeading>Career Preferences</SectionHeading>
                  {user.career_preferences.preferred_sectors?.length ? (
                    <DetailRow label="Preferred sectors" value={user.career_preferences.preferred_sectors.join(', ')} />
                  ) : null}
                  {user.career_preferences.preferred_locations?.length ? (
                    <DetailRow label="Preferred locations" value={user.career_preferences.preferred_locations.join(', ')} />
                  ) : null}
                  <DetailRow label="Open to relocation" value={user.career_preferences.open_to_relocation === true ? 'Yes' : user.career_preferences.open_to_relocation === false ? 'No' : null} />
                  {(user.career_preferences.expected_salary_min || user.career_preferences.expected_salary_max) && (
                    <DetailRow label="Expected salary" value={`${user.career_preferences.expected_salary_min ?? '?'}–${user.career_preferences.expected_salary_max ?? '?'} LPA`} />
                  )}
                </>
              )}

              {user.psychological_profile && (
                <>
                  <SectionHeading>Psychological Profile</SectionHeading>
                  <div className="flex flex-col gap-2 mb-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Burnout <span className="text-gray-400">(0 = fresh, 100 = burnt out)</span></p>
                      <ScoreBar value={user.psychological_profile.burnout_score} color={user.psychological_profile.burnout_score >= 70 ? 'bg-red-400' : user.psychological_profile.burnout_score >= 40 ? 'bg-amber-400' : 'bg-green-400'} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Confidence</p>
                      <ScoreBar value={user.psychological_profile.confidence_index} color="bg-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Financial pressure</p>
                      <ScoreBar value={user.psychological_profile.financial_pressure_score} color={user.psychological_profile.financial_pressure_score >= 70 ? 'bg-red-400' : 'bg-amber-400'} />
                    </div>
                  </div>
                  <DetailRow label="Risk tolerance"      value={fmt(user.psychological_profile.risk_tolerance)} />
                  <DetailRow label="Motivation type"     value={fmt(user.psychological_profile.motivation_type)} />
                  <DetailRow label="Identity attachment" value={fmt(user.psychological_profile.identity_attachment)} />
                  <DetailRow label="Support system"      value={fmt(user.psychological_profile.support_system)} />
                  {user.psychological_profile.disha_insight && (
                    <div className="mt-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-3">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1">BeginablAI Insight</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{user.psychological_profile.disha_insight}</p>
                    </div>
                  )}
                </>
              )}

              {user.krs && (
                <>
                  <SectionHeading>KRS Scores</SectionHeading>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[
                      { label: 'Composite', value: user.krs.composite, color: 'text-gray-900' },
                      { label: 'K', value: user.krs.k_score, color: 'text-blue-700' },
                      { label: 'R', value: user.krs.r_score, color: 'text-purple-700' },
                      { label: 'S', value: user.krs.s_score, color: 'text-green-700' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-2 text-center">
                        <p className={cn('text-xl font-black', color)}>{value}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <DetailRow label="Computed at" value={new Date(user.krs.computed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                </>
              )}

              {user.selected_tracks.length > 0 && (
                <>
                  <SectionHeading>Chosen Career Paths</SectionHeading>
                  <div className="flex flex-col gap-2">
                    {user.selected_tracks.map(t => (
                      <div key={t.track_id} className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-primary">{t.title}</p>
                          <p className="text-[10px] text-gray-400">{t.sector}</p>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {new Date(t.selected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <UserSecurityPanel userId={userId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Security panel: status / login history / device sessions ────────────────

function UserSecurityPanel({ userId }: { userId: string }) {
  const { data: history, isLoading: historyLoading } = useLoginHistory(userId)
  const { data: sessions, isLoading: sessionsLoading } = useDeviceSessions(userId)
  const updateStatus = useUpdateUserStatus()
  const revokeSession = useRevokeDeviceSession()
  const [reasonFor, setReasonFor] = useState<'suspended' | 'banned' | null>(null)
  const [reason, setReason] = useState('')

  return (
    <>
      <SectionHeading>Account Status</SectionHeading>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => updateStatus.mutate({ userId, status: 'active' })}
          disabled={updateStatus.isPending}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 disabled:opacity-50"
        ><Shield size={12} /> Activate</button>
        <button
          onClick={() => setReasonFor('suspended')}
          disabled={updateStatus.isPending}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
        ><ShieldOff size={12} /> Suspend</button>
        <button
          onClick={() => setReasonFor('banned')}
          disabled={updateStatus.isPending}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
        ><ShieldOff size={12} /> Ban</button>
      </div>

      {reasonFor && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3 flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder={`Reason for ${reasonFor === 'banned' ? 'ban' : 'suspension'}…`}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none resize-none focus:border-red-300"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setReasonFor(null); setReason('') }}
              className="flex-1 h-8 rounded-lg border border-gray-200 text-xs font-medium text-gray-600"
            >Cancel</button>
            <button
              onClick={() => {
                updateStatus.mutate({ userId, status: reasonFor, reason: reason.trim() || undefined })
                setReasonFor(null); setReason('')
              }}
              className="flex-1 h-8 rounded-lg bg-red-500 text-white text-xs font-semibold"
            >Confirm</button>
          </div>
        </div>
      )}

      <SectionHeading>Login History</SectionHeading>
      {historyLoading ? <Spinner size="sm" /> : !history || history.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">No login history recorded.</p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3">
          {history.slice(0, 10).map(h => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <span className={cn('font-medium', h.success ? 'text-gray-700' : 'text-red-500')}>
                {h.success ? 'Success' : h.failure_reason ?? 'Failed'} {h.device_label ? `· ${h.device_label}` : ''}
              </span>
              <span className="text-gray-400">{new Date(h.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      <SectionHeading>Device Sessions</SectionHeading>
      {sessionsLoading ? <Spinner size="sm" /> : !sessions || sessions.length === 0 ? (
        <p className="text-xs text-gray-400">No active sessions.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">{s.device_label ?? 'Unknown device'}</p>
                <p className="text-[10px] text-gray-400">{s.ip_address ?? '—'} · last seen {new Date(s.last_seen_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
              <button
                onClick={() => revokeSession.mutate({ userId, sessionId: s.id })}
                disabled={revokeSession.isPending}
                className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
              >Force logout</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── SECTION: Dashboard ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  signup: 'bg-blue-500',
  application: 'bg-green-500',
  job_posted: 'bg-purple-500',
  employer_approved: 'bg-amber-500',
}

function TrendChart({ metric, label, color }: { metric: TrendMetric; label: string; color: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'trends', metric],
    queryFn: () => analyticsApi.getAdminTrends(metric, 30),
  })
  const series = data?.series ?? []
  const max = Math.max(1, ...series.map(p => p.count))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
      <p className="text-xs font-semibold text-gray-500 mb-3">{label} — last 30 days</p>
      <div className="flex items-end gap-[2px] h-20">
        {series.map(p => (
          <div
            key={p.date}
            title={`${p.date}: ${p.count}`}
            style={{ height: `${(p.count / max) * 100}%`, background: color, flex: 1, minHeight: 2, borderRadius: 2 }}
          />
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        {series.length > 0 && `${series[0].date} → ${series[series.length - 1].date}`}
      </p>
    </div>
  )
}

function DashboardSection({ onNav }: { onNav: (s: Section) => void }) {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: activity, isLoading: actLoading } = useAdminActivity()

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Stat grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>Platform Overview</h2>
          <span className="text-xs text-gray-400">Live · auto-refreshes every 60s</span>
        </div>
        {statsLoading ? <Spinner /> : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            <StatCard icon={Users}       label="Total Aspirants"   value={stats.total_aspirants}    sub={`+${stats.new_users_last_7d} this week`}        color="text-blue-600"   accent="border-blue-400" />
            <StatCard icon={CheckCircle2} label="Onboarding Done"  value={stats.completed_onboarding} sub={`${Math.round(stats.completed_onboarding / Math.max(stats.total_aspirants, 1) * 100)}% completion`} color="text-green-600" accent="border-green-400" />
            <StatCard icon={Building2}   label="Employers"         value={stats.total_employers}    sub={`${stats.pending_employers} pending approval`}  color="text-amber-600"  accent="border-amber-400" />
            <StatCard icon={Briefcase}   label="Job Postings"      value={stats.total_job_postings} sub={`${stats.active_job_postings} active · +${stats.new_jobs_last_7d} this week`} color="text-purple-600" accent="border-purple-400" />
            <StatCard icon={FileText}    label="Applications"      value={stats.total_applications} sub={`${stats.hired_count} hired`}                  color="text-primary"    accent="border-primary" />
            <StatCard icon={Award}       label="Hired"             value={stats.hired_count}        sub="Total placements"                               color="text-emerald-600" accent="border-emerald-400" />
            <StatCard icon={BarChart3}   label="Avg KRS Score"     value={stats.avg_krs_composite ?? '—'} sub="Platform average"                        color="text-indigo-600" accent="border-indigo-400" />
            <StatCard icon={Shield}      label="Approved Employers" value={stats.approved_employers} sub={`${stats.total_employers - stats.approved_employers} not approved`} color="text-teal-600" accent="border-teal-400" />
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-base font-bold text-gray-900 mb-4">Growth Trends</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TrendChart metric="users" label="User Acquisition" color="#3B82F6" />
          <TrendChart metric="employers" label="Employer Growth" color="#D97706" />
          <TrendChart metric="jobs" label="Job Postings" color="#7C3AED" />
          <TrendChart metric="applications" label="Applications" color="#059669" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Conversion funnel */}
        {stats && (
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Funnel Overview</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
              {[
                { label: 'Registered',          value: stats.total_aspirants,      max: stats.total_aspirants, color: 'bg-blue-400' },
                { label: 'Completed onboarding', value: stats.completed_onboarding, max: stats.total_aspirants, color: 'bg-indigo-400' },
                { label: 'Applied to a job',     value: Math.min(stats.total_applications, stats.total_aspirants), max: stats.total_aspirants, color: 'bg-purple-400' },
                { label: 'Hired',                value: stats.hired_count,          max: stats.total_aspirants, color: 'bg-green-400' },
              ].map(({ label, value, max, color }) => {
                const pct = max > 0 ? Math.round(value / max * 100) : 0
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                      <span className="text-xs font-bold text-gray-800">{value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section>
          <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pending Approvals', sub: `${stats?.pending_employers ?? 0} employers`, icon: Clock, section: 'employers' as Section, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
              { label: 'Manage Users',      sub: `${stats?.total_aspirants ?? 0} aspirants`,    icon: Users, section: 'users' as Section,     color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
              { label: 'Review Jobs',       sub: `${stats?.active_job_postings ?? 0} active`,   icon: Briefcase, section: 'jobs' as Section,  color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
              { label: 'All Applications',  sub: `${stats?.total_applications ?? 0} total`,     icon: FileText, section: 'applications' as Section, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
            ].map(({ label, sub, icon: Icon, section, color, bg }) => (
              <button
                key={label}
                onClick={() => onNav(section)}
                className={cn('flex flex-col items-start gap-2 p-4 rounded-2xl border text-left hover:shadow-md transition-all', bg)}
              >
                <Icon className={cn('w-5 h-5', color)} />
                <div>
                  <p className="text-sm font-bold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Activity feed */}
      <section>
        <h3 className="text-base font-bold text-gray-900 mb-4">Recent Activity</h3>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {actLoading ? <Spinner /> : !activity || activity.length === 0 ? (
            <Empty icon={Activity} text="No recent activity" />
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', STATUS_COLORS[item.type] ?? 'bg-gray-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-snug">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-gray-400 mt-0.5">{item.subtitle}</p>}
                  </div>
                  <span className="text-xs text-gray-300 whitespace-nowrap shrink-0">{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ── SECTION: Users ────────────────────────────────────────────────────────────

function UsersSection() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebounced(v), 350)
  }

  const { data: users, isLoading } = useAdminUsers(debounced || undefined)

  const completed  = useMemo(() => (users ?? []).filter(u => u.is_completed).length, [users])
  const active     = useMemo(() => (users ?? []).filter(u => u.is_active).length, [users])
  const withKrs    = useMemo(() => (users ?? []).filter(u => u.krs_composite !== null).length, [users])

  return (
    <section className="flex flex-col gap-6">
      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col gap-1">
          <p className="text-2xl font-black text-blue-600">{users?.length ?? '—'}</p>
          <p className="text-xs font-semibold text-gray-500">Total aspirants</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col gap-1">
          <p className="text-2xl font-black text-green-600">{completed}</p>
          <p className="text-xs font-semibold text-gray-500">Completed onboarding</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex flex-col gap-1">
          <p className="text-2xl font-black text-purple-600">{withKrs}</p>
          <p className="text-xs font-semibold text-gray-500">Have KRS scores</p>
        </div>
      </div>

      {/* Search + table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Aspirant Users</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search name, phone, city…"
                className="pl-8 pr-3 h-8 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white w-64"
              />
            </div>
            <ExportButton
              rows={(users ?? []).map(u => ({
                full_name: u.full_name ?? '', phone: u.phone, email: u.email ?? '',
                city: u.city ?? '', state: u.state ?? '', is_active: u.is_active,
                is_completed: u.is_completed, current_step: u.current_step,
                krs_composite: u.krs_composite ?? '', application_count: u.application_count,
                registered_at: u.registered_at,
              }))}
              filename="aspirant_users.csv"
            />
          </div>
        </div>

        {isLoading ? <Spinner /> : !users || users.length === 0 ? (
          <Empty icon={Users} text={debounced ? 'No users match your search' : 'No aspirant users yet'} />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>User</span>
              <span className="text-right">Apps</span>
              <span className="text-right">KRS</span>
              <span className="text-right">Step</span>
              <span className="text-right">Joined</span>
            </div>
            {users.map((user, idx) => (
              <div
                key={user.user_id}
                onClick={() => setSelectedId(user.user_id)}
                className={cn(
                  'grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center cursor-pointer hover:bg-primary/5 transition-colors',
                  idx < users.length - 1 && 'border-b border-gray-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.full_name ?? <span className="text-gray-400 font-normal italic">No name</span>}
                    </p>
                    {!user.is_active && <Badge color="red">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {user.phone}{user.email ? ` · ${user.email}` : ''}{user.city ? ` · ${user.city}` : ''}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 text-right">{user.application_count}</span>
                <div className="flex flex-col items-end gap-0.5">
                  {user.krs_composite !== null ? (
                    <span className={cn('text-sm font-black', user.krs_composite >= 70 ? 'text-green-600' : user.krs_composite >= 45 ? 'text-amber-600' : 'text-gray-500')}>
                      {user.krs_composite}
                    </span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </div>
                <div className="text-right">
                  {user.is_completed
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                    : <span className="text-xs text-gray-400">{user.current_step}/7</span>}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap text-right">
                  {new Date(user.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
            ))}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">{users.length} users · {active} active · click to view full profile</p>
            </div>
          </>
        )}
      </div>

      {selectedId && <UserDetailDrawer userId={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  )
}

// ── SECTION: Employers ────────────────────────────────────────────────────────
// Approve/Reject moved entirely to KYC Verification — this section is now a
// read-only directory plus Revoke (for already-verified employers).

function EmployersSection({ onNav }: { onNav: (s: Section) => void }) {
  const [tab, setTab] = useState<EmployerStatus>('pending')
  const { data: employers, isLoading } = useAdminEmployers(tab)
  const revoke  = useRevokeEmployer()
  const [revokeTarget, setRevokeTarget] = useState<EmployerEntry | null>(null)

  const { data: stats } = useAdminStats()

  return (
    <section className="flex flex-col gap-6">
      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border-l-4 border-amber-400 border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-2xl font-black text-amber-600">{stats?.pending_employers ?? '—'}</p>
          <p className="text-xs font-semibold text-gray-500">Awaiting KYC verification</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-green-400 border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-2xl font-black text-green-600">{stats?.approved_employers ?? '—'}</p>
          <p className="text-xs font-semibold text-gray-500">Verified employers</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-blue-400 border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-2xl font-black text-blue-600">{stats?.total_employers ?? '—'}</p>
          <p className="text-xs font-semibold text-gray-500">Total employers</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Employer Directory</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Read-only — verification is approved/rejected from{' '}
              <button onClick={() => onNav('verifications')} className="text-primary font-semibold hover:underline">
                KYC Verification
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-gray-200 rounded-xl p-0.5 gap-0.5">
              {(['pending', 'approved', 'all'] as EmployerStatus[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn('px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all', tab === t ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700')}
                >
                  {t}
                  {t === 'pending' && stats && stats.pending_employers > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{stats.pending_employers}</span>
                  )}
                </button>
              ))}
            </div>
            <ExportButton
              rows={(employers ?? []).map(e => ({
                company_name: e.company_name, contact_person: e.contact_person ?? '',
                phone: e.phone, city: e.city ?? '', industry: e.industry ?? '',
                company_size: e.company_size ?? '', is_approved: e.is_approved,
                job_count: e.job_count, application_count: e.application_count,
                registered_at: e.registered_at,
              }))}
              filename={`employers_${tab}.csv`}
            />
          </div>
        </div>

        {isLoading ? <Spinner /> : !employers || employers.length === 0 ? (
          <Empty icon={Building2} text={tab === 'pending' ? 'No pending registrations' : 'No employers found'} />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Company</span>
              <span className="text-right">Jobs</span>
              <span className="text-right">Apps</span>
              <span className="text-right">Registered</span>
              <span className="text-right">Actions</span>
            </div>
            {employers.map((emp, idx) => (
              <div
                key={emp.id}
                className={cn('grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3.5 items-center', idx < employers.length - 1 && 'border-b border-gray-50')}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{emp.company_name}</p>
                    {emp.is_approved
                      ? <Badge color="green">Approved</Badge>
                      : emp.rejection_reason
                        ? <Badge color="red">Rejected</Badge>
                        : <Badge color="amber">Pending</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[emp.industry, emp.company_size ? `${emp.company_size} employees` : null, emp.city]
                      .filter(Boolean).join(' · ') || 'Profile not completed yet'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[emp.contact_person ? `${emp.contact_person}${emp.designation ? `, ${emp.designation}` : ''}` : null, emp.phone]
                      .filter(Boolean).join(' · ')}
                  </p>
                  {emp.gst_number && <p className="text-xs text-gray-300 font-mono mt-0.5">GST: {emp.gst_number}</p>}
                  {emp.rejection_reason && <p className="text-xs text-red-500 mt-0.5">Rejected: {emp.rejection_reason}</p>}
                </div>
                <span className="text-xs font-bold text-gray-600 text-right">{emp.job_count}</span>
                <span className="text-xs font-bold text-gray-600 text-right">{emp.application_count}</span>
                <span className="text-xs text-gray-400 text-right whitespace-nowrap">
                  {new Date(emp.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
                <div className="flex gap-1.5 justify-end">
                  {emp.is_approved ? (
                    <button
                      onClick={() => setRevokeTarget(emp)}
                      className="h-7 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >Revoke</button>
                  ) : (
                    <button
                      onClick={() => onNav('verifications')}
                      className="h-7 px-2.5 rounded-lg border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/5"
                    >Review KYC</button>
                  )}
                </div>
              </div>
            ))}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">{employers.length} employer{employers.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>

      {revokeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-900 mb-2">Revoke approval?</h3>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-semibold text-gray-700">{revokeTarget.company_name}</span> will lose access and their jobs will be unlisted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRevokeTarget(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => revoke.mutate(revokeTarget.id, { onSuccess: () => setRevokeTarget(null) })}
                disabled={revoke.isPending}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >{revoke.isPending ? 'Revoking…' : 'Revoke'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── SECTION: Jobs ─────────────────────────────────────────────────────────────

function JobsSection() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminJobEntry | null>(null)

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebounced(v), 350)
  }

  const { data: jobs, isLoading } = useAdminJobs(debounced || undefined, activeOnly || undefined)
  const toggle     = useToggleAdminJob()
  const deleteJob  = useDeleteAdminJob()

  const activeCount = useMemo(() => (jobs ?? []).filter(j => j.is_active).length, [jobs])
  const totalApps   = useMemo(() => (jobs ?? []).reduce((s, j) => s + j.applicant_count, 0), [jobs])

  const fmt = (s: string | null) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'

  return (
    <section className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border-l-4 border-purple-400 border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-2xl font-black text-purple-600">{jobs?.length ?? '—'}</p>
          <p className="text-xs font-semibold text-gray-500">Total job postings</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-green-400 border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-2xl font-black text-green-600">{activeCount}</p>
          <p className="text-xs font-semibold text-gray-500">Active postings</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-blue-400 border border-gray-100 shadow-sm px-4 py-4">
          <p className="text-2xl font-black text-blue-600">{totalApps}</p>
          <p className="text-xs font-semibold text-gray-500">Total applications</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">All Job Postings</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded" />
              Active only
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search title, company, sector…"
                className="pl-8 pr-3 h-8 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white w-60"
              />
            </div>
            <ExportButton
              rows={(jobs ?? []).map(j => ({
                title: j.title, company_name: j.company_name, sector: j.sector,
                location: j.location ?? '', employment_type: j.employment_type ?? '',
                salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '',
                is_active: j.is_active, applicant_count: j.applicant_count,
                created_at: j.created_at, expires_at: j.expires_at ?? '',
              }))}
              filename="job_postings.csv"
            />
          </div>
        </div>

        {isLoading ? <Spinner /> : !jobs || jobs.length === 0 ? (
          <Empty icon={Briefcase} text="No job postings found" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Job</span>
              <span className="text-right">Type</span>
              <span className="text-right">Applicants</span>
              <span className="text-right">Status</span>
              <span className="text-right">Actions</span>
            </div>
            {jobs.map((job, idx) => (
              <div
                key={job.id}
                className={cn('grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center', idx < jobs.length - 1 && 'border-b border-gray-50')}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{job.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{job.company_name} · {job.sector}</p>
                  {job.location && <p className="text-xs text-gray-300">{job.location}</p>}
                </div>
                <span className="text-xs text-gray-500 text-right whitespace-nowrap">{fmt(job.employment_type)}</span>
                <div className="text-right">
                  <span className={cn('text-sm font-black', job.applicant_count > 0 ? 'text-primary' : 'text-gray-300')}>
                    {job.applicant_count}
                  </span>
                </div>
                <div className="text-right">
                  {job.is_active
                    ? <Badge color="green">Active</Badge>
                    : <Badge color="gray">Inactive</Badge>}
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => toggle.mutate(job.id)}
                    disabled={toggle.isPending}
                    title={job.is_active ? 'Deactivate' : 'Activate'}
                    className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50',
                      job.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100',
                    )}
                  >
                    {job.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(job)}
                    title="Delete"
                    className="h-7 w-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">{jobs.length} job{jobs.length !== 1 ? 's' : ''} · {activeCount} active</p>
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-900 mb-2">Delete job posting?</h3>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-semibold text-gray-700">"{deleteTarget.title}"</span> and all its applications will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteJob.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
                disabled={deleteJob.isPending}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >{deleteJob.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── SECTION: Applications ─────────────────────────────────────────────────────

const STATUS_OPTIONS = ['all', 'applied', 'under_review', 'shortlisted', 'rejected', 'hired', 'withdrawn']
const STATUS_COLOR_MAP: Record<string, string> = {
  applied:      'green',
  under_review: 'blue',
  shortlisted:  'purple',
  rejected:     'red',
  hired:        'amber',
  withdrawn:    'gray',
}

function ApplicationsSection() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebounced(v), 350)
  }

  const { data: apps, isLoading } = useAdminApplications(
    statusFilter !== 'all' ? statusFilter : undefined,
    debounced || undefined,
  )

  const byStatus = useMemo(() => {
    if (!apps) return {}
    return apps.reduce((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc }, {} as Record<string, number>)
  }, [apps])

  const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Status breakdown chips */}
      <div className="flex flex-wrap gap-3">
        {STATUS_OPTIONS.filter(s => s !== 'all').map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? 'all' : s)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              statusFilter === s ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/30',
            )}
          >
            {fmt(s)} {byStatus[s] ? <span className="ml-1 opacity-75">({byStatus[s]})</span> : ''}
          </button>
        ))}
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
            Clear ×
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">
            Applications {statusFilter !== 'all' ? `· ${fmt(statusFilter)}` : ''}
            {apps && <span className="ml-2 text-gray-400 font-normal">({apps.length})</span>}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search aspirant, job, company…"
                className="pl-8 pr-3 h-8 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white w-64"
              />
            </div>
            <ExportButton
              rows={(apps ?? []).map(a => ({
                aspirant_name: a.aspirant_name ?? '', aspirant_phone: a.aspirant_phone,
                job_title: a.job_title, company_name: a.company_name,
                status: a.status, match_score: a.match_score ?? '', applied_at: a.applied_at,
              }))}
              filename="applications.csv"
            />
          </div>
        </div>

        {isLoading ? <Spinner /> : !apps || apps.length === 0 ? (
          <Empty icon={FileText} text="No applications found" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Aspirant</span>
              <span>Job</span>
              <span className="text-right">Match</span>
              <span className="text-right">Status</span>
              <span className="text-right">Applied</span>
            </div>
            {apps.slice(0, 200).map((app, idx) => (
              <div
                key={app.id}
                className={cn('grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center', idx < apps.length - 1 && 'border-b border-gray-50')}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{app.aspirant_name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-400 truncate">{app.aspirant_phone}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{app.job_title}</p>
                  <p className="text-xs text-gray-400 truncate">{app.company_name}</p>
                </div>
                <span className={cn('text-sm font-black text-right', (app.match_score ?? 0) >= 70 ? 'text-green-600' : (app.match_score ?? 0) >= 45 ? 'text-amber-500' : 'text-gray-400')}>
                  {app.match_score !== null ? `${app.match_score}%` : '—'}
                </span>
                <div className="text-right">
                  <Badge color={STATUS_COLOR_MAP[app.status] ?? 'gray'}>{fmt(app.status)}</Badge>
                </div>
                <span className="text-xs text-gray-400 text-right whitespace-nowrap">{timeAgo(app.applied_at)}</span>
              </div>
            ))}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">{apps.length} application{apps.length !== 1 ? 's' : ''} shown</p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

// ── SECTION: Career Tracks ────────────────────────────────────────────────────

const EMPTY_FORM = {
  slug: '', title: '', description: '', sector: '',
  required_skills: '', min_k_score: 0,
  salary_range: '', growth_outlook: '',
  example_roles: '',
}
type TrackFormState = typeof EMPTY_FORM

function TrackFormModal({ initial, onSave, onCancel, saving, error }: {
  initial?: CareerTrackAdminEntry | null
  onSave: (data: TrackFormState) => void
  onCancel: () => void
  saving: boolean
  error?: string | null
}) {
  const [form, setForm] = useState<TrackFormState>(
    initial ? {
      slug: initial.slug, title: initial.title, description: initial.description,
      sector: initial.sector, required_skills: initial.required_skills.join(', '),
      min_k_score: initial.min_k_score, salary_range: initial.salary_range ?? '',
      growth_outlook: initial.growth_outlook ?? '', example_roles: initial.example_roles.join(', '),
    } : EMPTY_FORM,
  )
  const set = (k: keyof TrackFormState, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!initial

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg">
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">{isEdit ? 'Edit career track' : 'New career track'}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Slug *</label>
              <input value={form.slug} onChange={e => set('slug', e.target.value)} disabled={isEdit} placeholder="policy-research"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Policy Research"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sector *</label>
              <input value={form.sector} onChange={e => set('sector', e.target.value)} placeholder="Consulting"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Min K-score</label>
              <input type="number" min={0} max={100} value={form.min_k_score} onChange={e => set('min_k_score', Number(e.target.value))}
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Required skills * <span className="font-normal text-gray-400">(comma-separated)</span></label>
            <input value={form.required_skills} onChange={e => set('required_skills', e.target.value)} placeholder="Analytical Thinking, Research"
              className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Example roles <span className="font-normal text-gray-400">(comma-separated)</span></label>
            <input value={form.example_roles} onChange={e => set('example_roles', e.target.value)} placeholder="Policy Analyst, Research Associate"
              className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Salary range</label>
              <input value={form.salary_range} onChange={e => set('salary_range', e.target.value)} placeholder="8–20 LPA"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Growth outlook</label>
              <select value={form.growth_outlook} onChange={e => set('growth_outlook', e.target.value)}
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white">
                <option value="">— none —</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.slug.trim() || !form.title.trim() || !form.description.trim() || !form.sector.trim()}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create track'}</button>
        </div>
      </div>
    </div>
  )
}

function TracksSection() {
  const { data: tracks, isLoading } = useAdminCareerTracks()
  const createMutation = useCreateCareerTrack()
  const updateMutation = useUpdateCareerTrack()
  const deleteMutation = useDeleteCareerTrack()
  const [showForm, setShowForm]         = useState(false)
  const [editTarget, setEditTarget]     = useState<CareerTrackAdminEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CareerTrackAdminEntry | null>(null)
  const [formError, setFormError]       = useState<string | null>(null)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const parseComma = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

  const handleSave = (form: TrackFormState) => {
    setFormError(null)
    const payload = {
      slug: form.slug.trim(), title: form.title.trim(), description: form.description.trim(),
      sector: form.sector.trim(), required_skills: parseComma(form.required_skills),
      min_k_score: Number(form.min_k_score), salary_range: form.salary_range.trim() || null,
      growth_outlook: form.growth_outlook.trim() || null, example_roles: parseComma(form.example_roles),
    }
    if (editTarget) {
      updateMutation.mutate({ trackId: editTarget.id, payload }, {
        onSuccess: () => { setEditTarget(null); setShowForm(false) },
        onError: (e: unknown) => setFormError(getApiError(e, 'Failed to save')),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => setShowForm(false),
        onError: (e: unknown) => setFormError(getApiError(e, 'Failed to save')),
      })
    }
  }

  const growthColor = (g: string | null) => {
    if (g === 'high') return 'green'
    if (g === 'medium') return 'amber'
    return 'gray'
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-900">Career Tracks</h2>
          <button
            onClick={() => { setEditTarget(null); setFormError(null); setShowForm(true) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> New track
          </button>
        </div>

        {isLoading ? <Spinner /> : !tracks || tracks.length === 0 ? (
          <Empty icon={Compass} text="No career tracks yet" />
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {tracks.map(track => {
                const expanded = expandedId === track.id
                return (
                  <div key={track.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedId(expanded ? null : track.id)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{track.title}</p>
                            <Badge color={growthColor(track.growth_outlook)}>{track.growth_outlook ?? 'n/a'}</Badge>
                          </div>
                          <p className="text-xs text-gray-400">{track.sector} · min K {track.min_k_score} · {track.aspirant_count} aspirants</p>
                        </div>
                      </button>
                      {track.salary_range && (
                        <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{track.salary_range}</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditTarget(track); setFormError(null); setShowForm(true) }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors"
                        ><Pencil className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setDeleteTarget(track)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-3 ml-6 flex flex-col gap-2">
                        <p className="text-xs text-gray-600 leading-relaxed">{track.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {track.required_skills.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">{s}</span>
                          ))}
                        </div>
                        {track.example_roles.length > 0 && (
                          <p className="text-xs text-gray-400">Roles: {track.example_roles.join(' · ')}</p>
                        )}
                        <p className="text-xs text-gray-300 font-mono">slug: {track.slug}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <TrackFormModal
          initial={editTarget}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
          saving={createMutation.isPending || updateMutation.isPending}
          error={formError}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-gray-900 mb-2">Delete career track?</h3>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-semibold text-gray-700">"{deleteTarget.title}"</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
                disabled={deleteMutation.isPending}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              >{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── SECTION: Roles & Permissions ─────────────────────────────────────────────

function RolesSection() {
  const { data: roles, isLoading } = useAdminRoles()
  const { data: permissions } = useAdminPermissions()
  const update = useUpdateRolePermissions()
  const [editingRole, setEditingRole] = useState<RoleEntry | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const permByKey = useMemo(() => {
    const map = new Map<string, string>() // "resource:action" -> id
    ;(permissions ?? []).forEach(p => map.set(`${p.resource}:${p.action}`, p.id))
    return map
  }, [permissions])

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Roles & Permission Matrix</h2>
          <p className="text-xs text-gray-400 mt-0.5">Click a role to edit its permission set.</p>
        </div>

        {isLoading ? <Spinner /> : !roles || roles.length === 0 ? (
          <Empty icon={KeyRound} text="No roles found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="text-left px-4 py-2">Role</th>
                  <th className="text-right px-4 py-2">Users</th>
                  <th className="text-right px-4 py-2">Permissions</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-gray-900">{role.name.replace(/_/g, ' ')}</span>
                      {role.is_system && <span className="ml-2 text-[10px] text-gray-400">system</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{role.user_count}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{role.permissions.length}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => {
                          setEditingRole(role)
                          setSelectedIds(role.permissions.map(key => permByKey.get(key)).filter((id): id is string => !!id))
                        }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">{editingRole.name.replace(/_/g, ' ')}</h3>
              <button onClick={() => setEditingRole(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(permissions ?? []).map(perm => {
                const key = `${perm.resource}:${perm.action}`
                return (
                  <label key={perm.id} className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(perm.id)}
                      onChange={e => setSelectedIds(prev =>
                        e.target.checked ? [...prev, perm.id] : prev.filter(id => id !== perm.id)
                      )}
                    />
                    {key}
                  </label>
                )
              })}
            </div>
            {update.isError && <p className="text-xs text-red-500 mt-2">{getApiError(update.error)}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingRole(null)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Cancel</button>
              <button
                onClick={() => update.mutate(
                  { roleId: editingRole.id, permissionIds: selectedIds },
                  { onSuccess: () => setEditingRole(null) },
                )}
                disabled={update.isPending || editingRole.name === 'super_admin'}
                className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40"
              >{update.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── SECTION: Employer KYC Verification Queue ─────────────────────────────────

const VERIF_STATUS_COLOR: Record<string, string> = {
  pending: 'amber', under_review: 'blue', approved: 'green', rejected: 'red', resubmitted: 'purple',
}

function VerificationDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: v, isLoading } = useEmployerVerificationDetail(id)
  const review = useReviewEmployerVerification()
  const [notes, setNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="text-base font-bold text-gray-900">{isLoading ? 'Loading…' : v?.company_name}</h3>
            {v && <Badge color={VERIF_STATUS_COLOR[v.status] ?? 'gray'}>{v.status.replace(/_/g, ' ')}</Badge>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? <Spinner /> : !v ? (
            <p className="text-sm text-gray-400 text-center py-10">Could not load verification.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <SectionHeading>Documents</SectionHeading>
              {v.documents.length === 0 ? (
                <p className="text-xs text-gray-400 mb-2">No documents uploaded.</p>
              ) : (
                <div className="flex flex-col gap-1.5 mb-3">
                  {v.documents.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{d.doc_type.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-gray-400">{d.original_filename}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adminApi.downloadVerificationDocument(v.id, d.id, d.original_filename)}
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />View
                        </button>
                        <Badge color={d.status === 'verified' ? 'green' : d.status === 'rejected' ? 'red' : 'gray'}>{d.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <SectionHeading>Timeline</SectionHeading>
              <div className="flex flex-col gap-2 mb-3">
                {v.events.map(e => (
                  <div key={e.id} className="text-xs">
                    <p className="font-semibold text-gray-700">{e.from_status ? `${e.from_status} → ` : ''}{e.to_status}</p>
                    <p className="text-gray-400">{e.actor_name ?? 'System'} · {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    {e.note && <p className="text-gray-500 mt-0.5">{e.note}</p>}
                  </div>
                ))}
              </div>

              {v.status !== 'approved' && (
                <>
                  <SectionHeading>Review</SectionHeading>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Reviewer notes (optional)…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none resize-none focus:border-primary mb-2"
                  />
                  <div className="flex gap-2">
                    {v.status === 'pending' && (
                      <button
                        onClick={() => review.mutate({ id, action: 'under_review', notes: notes.trim() || undefined })}
                        disabled={review.isPending}
                        className="flex-1 h-9 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold disabled:opacity-50"
                      >Mark Under Review</button>
                    )}
                    <button
                      onClick={() => review.mutate({ id, action: 'approve', notes: notes.trim() || undefined })}
                      disabled={review.isPending}
                      className="flex-1 h-9 rounded-lg bg-green-50 text-green-700 text-xs font-semibold disabled:opacity-50"
                    >Approve</button>
                    <button
                      onClick={() => setShowReject(true)}
                      disabled={review.isPending}
                      className="flex-1 h-9 rounded-lg bg-red-50 text-red-700 text-xs font-semibold disabled:opacity-50"
                    >Reject</button>
                  </div>
                  {showReject && (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="Rejection reason (required)…"
                        className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs outline-none resize-none focus:border-red-400"
                      />
                      <button
                        onClick={() => rejectReason.trim() && review.mutate(
                          { id, action: 'reject', notes: notes.trim() || undefined, rejection_reason: rejectReason.trim() },
                          { onSuccess: () => setShowReject(false) },
                        )}
                        disabled={!rejectReason.trim() || review.isPending}
                        className="h-9 rounded-lg bg-red-500 text-white text-xs font-semibold disabled:opacity-40"
                      >Confirm Rejection</button>
                    </div>
                  )}
                  {review.isError && <p className="text-xs text-red-500 mt-2">{getApiError(review.error)}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VerificationsSection() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending')
  const { data: list, isLoading } = useEmployerVerifications(statusFilter)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Employer KYC Verification Queue</h2>
          <select
            value={statusFilter ?? ''}
            onChange={e => setStatusFilter(e.target.value || undefined)}
            className="h-8 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-primary"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {isLoading ? <Spinner /> : !list || list.length === 0 ? (
          <Empty icon={Shield} text="No verifications match this filter" />
        ) : (
          list.map((v, idx) => (
            <div
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className={cn('flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5', idx < list.length - 1 && 'border-b border-gray-50')}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{v.company_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {v.document_count} document{v.document_count === 1 ? '' : 's'} · submitted {new Date(v.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
              </div>
              <Badge color={VERIF_STATUS_COLOR[v.status] ?? 'gray'}>{v.status.replace(/_/g, ' ')}</Badge>
            </div>
          ))
        )}
      </div>

      {selectedId && <VerificationDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  )
}

// ── SECTION: Audit Log ────────────────────────────────────────────────────────

function AuditLogSection() {
  const [actionFilter, setActionFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 25
  const { data, isLoading } = useAuditLogs({ action: actionFilter || undefined, limit, offset })

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Audit Log</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={actionFilter}
                onChange={e => { setActionFilter(e.target.value); setOffset(0) }}
                placeholder="Filter by action…"
                className="pl-8 pr-3 h-8 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white w-56"
              />
            </div>
            <ExportButton
              rows={(data?.items ?? []).map(log => ({
                action: log.action, actor: log.actor_email ?? log.actor_phone ?? 'System',
                resource: log.resource ?? '', resource_id: log.resource_id ?? '',
                ip_address: log.ip_address ?? '', created_at: log.created_at,
              }))}
              filename="audit_log_page.csv"
            />
          </div>
        </div>

        {isLoading ? <Spinner /> : !data || data.items.length === 0 ? (
          <Empty icon={Activity} text="No audit log entries match this filter" />
        ) : (
          data.items.map((log, idx) => (
            <div key={log.id} className={cn('px-4 py-3', idx < data.items.length - 1 && 'border-b border-gray-50')}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900">{log.action.replace(/[._]/g, ' ')}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {log.actor_email ?? log.actor_phone ?? 'System'}
                {log.resource ? ` · ${log.resource}${log.resource_id ? ` #${log.resource_id.slice(0, 8)}` : ''}` : ''}
                {log.ip_address ? ` · ${log.ip_address}` : ''}
              </p>
              {(log.previous_value || log.new_value) && (
                <div className="flex gap-4 mt-1.5 text-[11px]">
                  {log.previous_value && <span className="text-red-400">− {JSON.stringify(log.previous_value)}</span>}
                  {log.new_value && <span className="text-green-600">+ {JSON.stringify(log.new_value)}</span>}
                </div>
              )}
            </div>
          ))
        )}

        {data && data.total > limit && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="text-xs font-semibold text-gray-600 disabled:opacity-40"
            >Previous</button>
            <span className="text-xs text-gray-400">{offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}</span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.total}
              className="text-xs font-semibold text-gray-600 disabled:opacity-40"
            >Next</button>
          </div>
        )}
      </div>
    </section>
  )
}

// ── SECTION: Subscription Plans ──────────────────────────────────────────────

function SubscriptionPlansSection() {
  const { data: plans, isLoading } = useSubscriptionPlansAdmin()
  const update = useUpdateSubscriptionPlan()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ price_monthly: string; max_active_jobs: string; max_recruiter_seats: string }>({
    price_monthly: '', max_active_jobs: '', max_recruiter_seats: '',
  })

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Subscription Plans</h2>
        </div>

        {isLoading ? <Spinner /> : !plans || plans.length === 0 ? (
          <Empty icon={Award} text="No plans found" />
        ) : (
          plans.map((p, idx) => (
            <div key={p.id} className={cn('px-4 py-3', idx < plans.length - 1 && 'border-b border-gray-50')}>
              {editingId === p.id ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Price (paise/mo)</p>
                    <input value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: e.target.value })}
                      className="h-8 w-28 rounded-lg border border-gray-200 px-2 text-xs" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Max active jobs</p>
                    <input value={form.max_active_jobs} onChange={e => setForm({ ...form, max_active_jobs: e.target.value })}
                      placeholder="blank = unlimited" className="h-8 w-32 rounded-lg border border-gray-200 px-2 text-xs" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Max seats</p>
                    <input value={form.max_recruiter_seats} onChange={e => setForm({ ...form, max_recruiter_seats: e.target.value })}
                      placeholder="blank = unlimited" className="h-8 w-32 rounded-lg border border-gray-200 px-2 text-xs" />
                  </div>
                  <button
                    onClick={() => {
                      update.mutate({
                        planId: p.id,
                        payload: {
                          price_monthly: Number(form.price_monthly) || 0,
                          max_active_jobs: form.max_active_jobs === '' ? null : Number(form.max_active_jobs),
                          max_recruiter_seats: form.max_recruiter_seats === '' ? null : Number(form.max_recruiter_seats),
                        },
                      }, { onSuccess: () => setEditingId(null) })
                    }}
                    disabled={update.isPending}
                    className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold"
                  >Save</button>
                  <button onClick={() => setEditingId(null)} className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.price_monthly === 0 ? 'Free' : `₹${(p.price_monthly / 100).toLocaleString('en-IN')}/mo`}
                      {' · '}{p.max_active_jobs ?? 'Unlimited'} jobs · {p.max_recruiter_seats ?? 'Unlimited'} seats
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(p.id)
                      setForm({
                        price_monthly: String(p.price_monthly),
                        max_active_jobs: p.max_active_jobs?.toString() ?? '',
                        max_recruiter_seats: p.max_recruiter_seats?.toString() ?? '',
                      })
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >Edit</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function BillingSection() {
  const { data, isLoading } = useBillingOverview()

  if (isLoading) return <Spinner />
  if (!data) return <Empty icon={IndianRupee} text="Could not load billing data" />

  const maxTrend = Math.max(1, ...data.trend.map(t => t.new_subscriptions))

  return (
    <section className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-semibold mb-1">MRR</p>
          <p className="text-xl font-black text-gray-900">{formatPaise(data.mrr)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-semibold mb-1">ARPA</p>
          <p className="text-xl font-black text-gray-900">{formatPaise(data.arpa)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-semibold mb-1">Active Subscriptions</p>
          <p className="text-xl font-black text-gray-900">{data.active_subscriptions}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-semibold mb-1">New (30d)</p>
          <p className="text-xl font-black text-gray-900">{data.new_subscriptions_30d}</p>
        </div>
      </div>

      {(data.past_due_subscriptions > 0 || data.canceled_subscriptions > 0) && (
        <div className="flex gap-3">
          {data.past_due_subscriptions > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              {data.past_due_subscriptions} past due
            </span>
          )}
          {data.canceled_subscriptions > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200">
              {data.canceled_subscriptions} canceled
            </span>
          )}
        </div>
      )}

      {/* New subscriptions trend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">New subscriptions — last 6 months</p>
        {data.trend.length === 0 ? (
          <p className="text-xs text-gray-400">No subscriptions created in this window yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-20">
            {data.trend.map(t => (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${t.month}: ${t.new_subscriptions}`}
                  style={{ height: `${(t.new_subscriptions / maxTrend) * 100}%`, minHeight: 2, width: '100%' }}
                  className="bg-primary rounded"
                />
                <span className="text-[10px] text-gray-400">{t.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan distribution */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Revenue by Plan</h2>
        </div>
        {data.plan_distribution.length === 0 ? (
          <Empty icon={Award} text="No subscription plans configured" />
        ) : (
          data.plan_distribution.map((p, idx) => (
            <div key={p.plan_id} className={cn('px-4 py-3 flex items-center justify-between', idx < data.plan_distribution.length - 1 && 'border-b border-gray-50')}>
              <div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{p.plan_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.company_count} compan{p.company_count === 1 ? 'y' : 'ies'} · {formatPaise(p.price_monthly)}/mo each</p>
              </div>
              <p className="text-sm font-black text-gray-900">{formatPaise(p.mrr)}</p>
            </div>
          ))
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Computed from active subscription records, not a reconciled payment ledger — there's no Payment/Invoice model yet.
      </p>
    </section>
  )
}

function PlatformSection() {
  const { data: settings, isLoading: settingsLoading } = usePlatformSettings()
  const { data: flags, isLoading: flagsLoading } = useFeatureFlags()
  const updateSetting = useUpdatePlatformSetting()
  const updateFlag = useUpdateFeatureFlag()

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [settingValue, setSettingValue] = useState('')

  const [editingFlag, setEditingFlag] = useState<string | null>(null)
  const [flagForm, setFlagForm] = useState<{ rollout_pct: string }>({ rollout_pct: '0' })

  return (
    <section className="flex flex-col gap-6">
      {/* Platform settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Settings size={14} className="text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900">Platform Settings</h2>
        </div>

        {settingsLoading ? <Spinner /> : !settings || settings.length === 0 ? (
          <Empty icon={Settings} text="No platform settings configured" />
        ) : (
          settings.map((s, idx) => (
            <div key={s.id} className={cn('px-4 py-3', idx < settings.length - 1 && 'border-b border-gray-50')}>
              {editingKey === s.key ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-[10px] text-gray-400 mb-1">{s.key}</p>
                    <input
                      value={settingValue}
                      onChange={e => setSettingValue(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-200 px-2 text-xs font-mono"
                    />
                  </div>
                  <button
                    onClick={() => {
                      let parsed: unknown = settingValue
                      try { parsed = JSON.parse(settingValue) } catch { /* keep as raw string */ }
                      updateSetting.mutate({ key: s.key, value: parsed }, { onSuccess: () => setEditingKey(null) })
                    }}
                    disabled={updateSetting.isPending}
                    className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold"
                  >Save</button>
                  <button onClick={() => setEditingKey(null)} className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{s.key}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate font-mono">{JSON.stringify(s.value)}</p>
                    {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                  </div>
                  <button
                    onClick={() => { setEditingKey(s.key); setSettingValue(JSON.stringify(s.value)) }}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >Edit</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Feature flags */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Flag size={14} className="text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900">Feature Flags</h2>
        </div>

        {flagsLoading ? <Spinner /> : !flags || flags.length === 0 ? (
          <Empty icon={Flag} text="No feature flags configured" />
        ) : (
          flags.map((f, idx) => (
            <div key={f.id} className={cn('px-4 py-3', idx < flags.length - 1 && 'border-b border-gray-50')}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{f.flag_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {f.rollout_pct}% rollout
                    {f.target_roles && f.target_roles.length > 0 && ` · ${f.target_roles.join(', ')}`}
                  </p>
                  {f.description && <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {editingFlag === f.flag_name && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100}
                        value={flagForm.rollout_pct}
                        onChange={e => setFlagForm({ rollout_pct: e.target.value })}
                        className="h-8 w-16 rounded-lg border border-gray-200 px-2 text-xs"
                      />
                      <button
                        onClick={() => {
                          updateFlag.mutate({
                            flagName: f.flag_name,
                            payload: { is_enabled: f.is_enabled, rollout_pct: Number(flagForm.rollout_pct) || 0, target_roles: f.target_roles },
                          }, { onSuccess: () => setEditingFlag(null) })
                        }}
                        className="h-8 px-2 rounded-lg bg-primary text-white text-xs font-semibold"
                      >Save</button>
                    </div>
                  )}
                  {editingFlag !== f.flag_name && (
                    <button
                      onClick={() => { setEditingFlag(f.flag_name); setFlagForm({ rollout_pct: String(f.rollout_pct) }) }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >Rollout %</button>
                  )}
                  <button
                    onClick={() => updateFlag.mutate({
                      flagName: f.flag_name,
                      payload: { is_enabled: !f.is_enabled, rollout_pct: f.rollout_pct, target_roles: f.target_roles },
                    })}
                    disabled={updateFlag.isPending}
                    className={cn(
                      'h-7 w-12 rounded-full transition-colors relative shrink-0',
                      f.is_enabled ? 'bg-primary' : 'bg-gray-200',
                    )}
                  >
                    <span className={cn(
                      'absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
                      f.is_enabled && 'translate-x-5',
                    )} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function GlobalSearchBar({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  const handleChange = (v: string) => {
    setQuery(v)
    setOpen(true)
    clearTimeout((handleChange as any)._t)
    ;(handleChange as any)._t = setTimeout(() => setDebounced(v), 300)
  }

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => adminApi.globalSearch(debounced),
    enabled: debounced.trim().length >= 2,
  })

  const TYPE_LABELS: Record<string, string> = { user: 'Aspirant', employer: 'Employer', job: 'Job', application: 'Application' }

  return (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search anything — users, employers, jobs…"
        className="w-full pl-8 pr-3 h-9 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
      />
      {open && debounced.trim().length >= 2 && (
        <div className="absolute top-10 left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-lg z-50 max-h-80 overflow-y-auto">
          {isFetching ? (
            <p className="px-4 py-3 text-xs text-gray-400">Searching…</p>
          ) : !data || data.results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">No matches for "{debounced}"</p>
          ) : (
            data.results.map(r => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => { onNavigate(r.section as Section); setOpen(false); setQuery('') }}
                className="w-full text-left px-4 py-2.5 hover:bg-primary/5 border-b border-gray-50 last:border-0 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{r.title}</p>
                  {r.subtitle && <p className="text-[11px] text-gray-400 truncate">{r.subtitle}</p>}
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide shrink-0">{TYPE_LABELS[r.type] ?? r.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const logout = useLogout()
  const { data: stats } = useAdminStats()
  const [section, setSection] = useState<Section>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const pendingCount = stats?.pending_employers ?? 0

  const SECTION_LABELS: Record<Section, string> = {
    dashboard: 'Dashboard',
    users: 'Users',
    employers: 'Employers',
    jobs: 'Jobs',
    applications: 'Applications',
    tracks: 'Career Tracks',
    subadmins: 'Sub-Admins',
    roles: 'Roles & Permissions',
    verifications: 'KYC Verification',
    auditlog: 'Audit Log',
    subscriptions: 'Subscriptions',
    platform: 'Platform Settings',
    billing: 'Revenue',
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full bg-white border-r border-gray-100 flex flex-col z-40 transition-all duration-200',
        sidebarOpen ? 'w-52' : 'w-16',
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm">D</span>
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-black text-primary" style={{ fontFamily: 'Hind, sans-serif' }}>BeginablAI</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Admin</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
          {NAV.map(({ label, value, icon: Icon }) => {
            const isActive = section === value
            const badge = value === 'employers' && pendingCount > 0 ? pendingCount : null
            return (
              <button
                key={value}
                onClick={() => setSection(value)}
                title={!sidebarOpen ? label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full',
                  isActive
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon size={16} className="shrink-0" />
                {sidebarOpen && (
                  <span className="flex-1 truncate">{label}</span>
                )}
                {sidebarOpen && badge && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-4 border-t border-gray-100">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors w-full"
          >
            <RefreshCw size={14} />
            {sidebarOpen && <span>Collapse</span>}
          </button>
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors w-full mt-1"
          >
            <LogOut size={14} />
            {sidebarOpen && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('flex-1 flex flex-col min-h-screen transition-all duration-200', sidebarOpen ? 'ml-52' : 'ml-16')}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>
              {SECTION_LABELS[section]}
            </h1>
            <p className="text-xs text-gray-400">BeginablAI platform administration</p>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearchBar onNavigate={setSection} />
            {pendingCount > 0 && (
              <button
                onClick={() => setSection('employers')}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
              >
                <Clock size={12} />
                {pendingCount} pending approval{pendingCount > 1 ? 's' : ''}
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-600 font-medium">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
          {section === 'dashboard'    && <DashboardSection onNav={setSection} />}
          {section === 'users'        && <UsersSection />}
          {section === 'employers'    && <EmployersSection onNav={setSection} />}
          {section === 'jobs'         && <JobsSection />}
          {section === 'applications' && <ApplicationsSection />}
          {section === 'tracks'       && <TracksSection />}
          {section === 'subadmins'    && <SubAdminManagement />}
          {section === 'roles'        && <RolesSection />}
          {section === 'verifications' && <VerificationsSection />}
          {section === 'auditlog' && <AuditLogSection />}
          {section === 'subscriptions' && <SubscriptionPlansSection />}
          {section === 'platform' && <PlatformSection />}
          {section === 'billing' && <BillingSection />}
        </main>
      </div>
    </div>
  )
}
