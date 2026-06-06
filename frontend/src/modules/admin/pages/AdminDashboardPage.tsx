import { useState, useMemo } from 'react'
import {
  Users, Briefcase, Clock, CheckCircle2, Building2, LogOut,
  Globe, MapPin, Phone, AlertCircle, X, Search, Plus, Pencil, Trash2,
  ChevronDown, ChevronUp, Compass,
} from 'lucide-react'
import {
  useAdminStats, useAdminEmployers, useApproveEmployer, useRejectEmployer,
  useAdminUsers, useAdminUser, useAdminCareerTracks, useCreateCareerTrack, useUpdateCareerTrack, useDeleteCareerTrack,
} from '../hooks/useAdmin'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import type { AspirantDetailResponse, EmployerEntry, EmployerStatus, CareerTrackAdminEntry } from '@/api/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'overview' | 'users' | 'tracks'

const SECTION_TABS: { label: string; value: Section; icon: React.ElementType }[] = [
  { label: 'Overview',      value: 'overview', icon: CheckCircle2 },
  { label: 'Users',         value: 'users',    icon: Users        },
  { label: 'Career Tracks', value: 'tracks',   icon: Compass      },
]

const EMPLOYER_TABS: { label: string; value: EmployerStatus }[] = [
  { label: 'Pending',  value: 'pending'  },
  { label: 'Approved', value: 'approved' },
  { label: 'All',      value: 'all'      },
]

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: number; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 flex flex-col gap-2">
      <Icon className={cn('w-5 h-5', color)} />
      <p className="text-3xl font-black text-gray-900">{value}</p>
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Employer section ──────────────────────────────────────────────────────────

function RejectModal({
  employer, onConfirm, onCancel, loading,
}: {
  employer: EmployerEntry; onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Reject registration</h3>
            <p className="text-sm text-gray-500 mt-0.5">{employer.company_name}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason <span className="text-danger">*</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Incomplete information, suspicious activity…"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none focus:border-danger focus:ring-2 focus:ring-danger/10"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >Cancel</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className="flex-1 h-10 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >{loading ? 'Rejecting…' : 'Reject'}</button>
        </div>
      </div>
    </div>
  )
}

function EmployerCard({
  employer, onApprove, onReject, approving,
}: {
  employer: EmployerEntry; onApprove: () => void; onReject: () => void; approving: boolean
}) {
  const date = new Date(employer.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className={cn('bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-4', employer.is_approved ? 'border-green-100' : 'border-gray-100')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900">{employer.company_name}</h3>
            {employer.is_approved ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Approved</span>
            ) : employer.rejection_reason ? (
              <span className="px-2 py-0.5 bg-red-100 text-danger text-xs font-semibold rounded-full">Rejected</span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Pending</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{employer.industry} · {employer.company_size} employees</p>
        </div>
        <p className="text-xs text-gray-400 shrink-0">{date}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Phone className="w-3.5 h-3.5 text-gray-400" />
          <span>{employer.phone}</span>
          {employer.phone_verified ? <span className="text-green-500 font-medium">✓</span> : <span className="text-amber-500 font-medium">unverified</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin className="w-3.5 h-3.5 text-gray-400" /><span>{employer.city}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 col-span-2">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span>{employer.contact_person}{employer.designation ? `, ${employer.designation}` : ''}</span>
        </div>
        {employer.website && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 col-span-2 min-w-0">
            <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <a href={employer.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{employer.website}</a>
          </div>
        )}
        {employer.gst_number && (
          <div className="text-xs text-gray-400 col-span-2">GST: <span className="font-mono text-gray-600">{employer.gst_number}</span></div>
        )}
      </div>
      {employer.description && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">{employer.description}</p>
      )}
      {employer.rejection_reason && (
        <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-danger">{employer.rejection_reason}</p>
        </div>
      )}
      {!employer.is_approved && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button onClick={onReject} className="flex-1 h-9 rounded-xl border border-gray-200 text-xs font-semibold text-danger hover:bg-red-50 transition-colors">Reject</button>
          <button onClick={onApprove} disabled={approving} className="flex-1 h-9 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── User detail modal ─────────────────────────────────────────────────────────

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
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6 text-right">{value}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-4 mb-2 first:mt-0">
      {children}
    </p>
  )
}

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: user, isLoading } = useAdminUser(userId)

  const fmt = (s: string | null | undefined) =>
    s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null

  const stageLabel: Record<string, string> = {
    none: 'None cleared', prelims: 'Prelims cleared',
    mains: 'Mains cleared', interview: 'Interview stage',
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {isLoading ? 'Loading…' : user?.full_name ?? 'Aspirant Profile'}
            </h3>
            {user && (
              <p className="text-xs text-gray-400 mt-0.5">{user.phone}{user.email ? ` · ${user.email}` : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <Spinner />
          ) : !user ? (
            <p className="text-sm text-gray-400 text-center py-10">Could not load profile.</p>
          ) : (
            <div className="flex flex-col gap-1">

              {/* ── Account ── */}
              <SectionHeading>Account</SectionHeading>
              <DetailRow label="Registered" value={new Date(user.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
              <DetailRow label="Last login" value={user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              <DetailRow label="Status" value={
                <span className={cn('px-1.5 py-0.5 rounded-md text-xs font-semibold', user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              } />
              <DetailRow label="Onboarding" value={
                user.is_completed
                  ? <span className="text-green-600 font-semibold">Complete</span>
                  : <span className="text-amber-600">Step {user.current_step} of 7</span>
              } />

              {/* ── Personal ── */}
              <SectionHeading>Personal</SectionHeading>
              <DetailRow label="Full name"    value={user.full_name} />
              <DetailRow label="Date of birth" value={user.date_of_birth} />
              <DetailRow label="Gender"       value={fmt(user.gender)} />
              <DetailRow label="City / State" value={[user.city, user.state].filter(Boolean).join(', ') || null} />

              {/* ── Education ── */}
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

              {/* ── UPSC Journey ── */}
              {user.upsc_journey && (
                <>
                  <SectionHeading>UPSC Journey</SectionHeading>
                  <DetailRow label="Exam"             value={user.upsc_journey.upsc_exam?.toUpperCase()} />
                  <DetailRow label="Years preparing"  value={user.upsc_journey.years_preparing?.toString()} />
                  <DetailRow label="Attempts"         value={user.upsc_journey.upsc_attempts?.toString()} />
                  <DetailRow label="Highest stage"    value={stageLabel[user.upsc_journey.highest_stage_cleared ?? ''] ?? fmt(user.upsc_journey.highest_stage_cleared)} />
                  <DetailRow label="Optional subject" value={user.upsc_journey.optional_subject} />
                </>
              )}

              {/* ── Work Experience ── */}
              {user.work_experience && (
                <>
                  <SectionHeading>Work Experience</SectionHeading>
                  <DetailRow label="Has experience" value={user.work_experience.has_work_experience === true ? 'Yes' : user.work_experience.has_work_experience === false ? 'No' : null} />
                  <DetailRow label="Years"          value={user.work_experience.work_experience_years?.toString()} />
                  <DetailRow label="Domain"         value={user.work_experience.work_experience_domain} />
                  <DetailRow label="Last designation" value={user.work_experience.last_designation} />
                </>
              )}

              {/* ── Skills ── */}
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

              {/* ── Career Preferences ── */}
              {user.career_preferences && (
                <>
                  <SectionHeading>Career Preferences</SectionHeading>
                  {user.career_preferences.preferred_sectors && user.career_preferences.preferred_sectors.length > 0 && (
                    <DetailRow label="Preferred sectors" value={user.career_preferences.preferred_sectors.join(', ')} />
                  )}
                  {user.career_preferences.preferred_locations && user.career_preferences.preferred_locations.length > 0 && (
                    <DetailRow label="Preferred locations" value={user.career_preferences.preferred_locations.join(', ')} />
                  )}
                  <DetailRow label="Open to relocation" value={user.career_preferences.open_to_relocation === true ? 'Yes' : user.career_preferences.open_to_relocation === false ? 'No' : null} />
                  {(user.career_preferences.expected_salary_min || user.career_preferences.expected_salary_max) && (
                    <DetailRow label="Expected salary" value={`${user.career_preferences.expected_salary_min ?? '?'}–${user.career_preferences.expected_salary_max ?? '?'} LPA`} />
                  )}
                </>
              )}

              {/* ── Psychological Profile ── */}
              {user.psychological_profile && (
                <>
                  <SectionHeading>Psychological Profile</SectionHeading>
                  <div className="flex flex-col gap-2 mb-1">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Burnout <span className="text-gray-500">(0 = fresh, 100 = burnt out)</span></p>
                      <ScoreBar value={user.psychological_profile.burnout_score} color={user.psychological_profile.burnout_score >= 70 ? 'bg-danger' : user.psychological_profile.burnout_score >= 40 ? 'bg-amber-400' : 'bg-green-400'} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Confidence</p>
                      <ScoreBar value={user.psychological_profile.confidence_index} color="bg-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Financial pressure</p>
                      <ScoreBar value={user.psychological_profile.financial_pressure_score} color={user.psychological_profile.financial_pressure_score >= 70 ? 'bg-danger' : 'bg-amber-400'} />
                    </div>
                  </div>
                  <DetailRow label="Risk tolerance"      value={fmt(user.psychological_profile.risk_tolerance)} />
                  <DetailRow label="Motivation type"     value={fmt(user.psychological_profile.motivation_type)} />
                  <DetailRow label="Identity attachment" value={fmt(user.psychological_profile.identity_attachment)} />
                  <DetailRow label="Support system"      value={fmt(user.psychological_profile.support_system)} />
                  {user.psychological_profile.disha_insight && (
                    <div className="mt-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-3">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1">DISHA Insight</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{user.psychological_profile.disha_insight}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── KRS Scores ── */}
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

              {/* ── Selected Career Tracks ── */}
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

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Users section ─────────────────────────────────────────────────────────────

function KrsChip({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value === null) return null
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-bold', color)}>
      {label} {value}
    </span>
  )
}

function UsersSection() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Simple debounce on input
  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout((handleSearch as any)._t)
    ;(handleSearch as any)._t = setTimeout(() => setDebouncedSearch(val), 350)
  }

  const { data: users, isLoading } = useAdminUsers(debouncedSearch || undefined)

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>
          Aspirant Users
        </h2>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search name, phone, city…"
            className="w-full pl-8 pr-3 h-9 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !users || users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-14 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">
            {debouncedSearch ? 'No users match your search' : 'No aspirant users yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>User</span>
            <span className="text-right">KRS</span>
            <span className="text-right">Step</span>
            <span className="text-right">Joined</span>
          </div>

          {users.map((user, idx) => (
            <div
              key={user.user_id}
              onClick={() => setSelectedUserId(user.user_id)}
              className={cn(
                'grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer',
                idx < users.length - 1 && 'border-b border-gray-100',
                'hover:bg-primary/5 transition-colors',
              )}
            >
              {/* Name / phone / location */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.full_name ?? <span className="text-gray-400 font-normal italic">No name</span>}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {user.phone}
                  {user.email && <span className="mx-1">·</span>}
                  {user.email && <span>{user.email}</span>}
                  {user.city && <span className="mx-1">·</span>}
                  {user.city && <span>{user.city}{user.state ? `, ${user.state}` : ''}</span>}
                </p>
                {!user.is_completed && (
                  <span className="mt-1 inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-md font-medium">
                    Onboarding
                  </span>
                )}
              </div>

              {/* KRS scores */}
              <div className="flex flex-col items-end gap-1">
                {user.krs_composite !== null ? (
                  <>
                    <span className={cn(
                      'text-sm font-black',
                      user.krs_composite >= 70 ? 'text-green-600' : user.krs_composite >= 45 ? 'text-amber-600' : 'text-gray-500'
                    )}>
                      {user.krs_composite}
                    </span>
                    <div className="flex gap-1">
                      <KrsChip label="K" value={user.k_score} color="bg-blue-50 text-blue-700" />
                      <KrsChip label="R" value={user.r_score} color="bg-purple-50 text-purple-700" />
                      <KrsChip label="S" value={user.s_score} color="bg-green-50 text-green-700" />
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>

              {/* Onboarding step */}
              <div className="text-right">
                {user.is_completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                ) : (
                  <span className="text-xs text-gray-400">Step {user.current_step}</span>
                )}
              </div>

              {/* Date */}
              <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                {new Date(user.registered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
              </div>
            </div>
          ))}

          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''} · click a row to view full profile</p>
          </div>
        </div>
      )}

      {selectedUserId && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </section>
  )
}

// ── Career Tracks section ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  slug: '', title: '', description: '', sector: '',
  required_skills: '', min_k_score: 0,
  salary_range: '', growth_outlook: '',
  example_roles: '',
}

type TrackFormState = typeof EMPTY_FORM

function TrackFormModal({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: CareerTrackAdminEntry | null
  onSave: (data: TrackFormState) => void
  onCancel: () => void
  saving: boolean
  error?: string | null
}) {
  const [form, setForm] = useState<TrackFormState>(
    initial
      ? {
          slug: initial.slug,
          title: initial.title,
          description: initial.description,
          sector: initial.sector,
          required_skills: initial.required_skills.join(', '),
          min_k_score: initial.min_k_score,
          salary_range: initial.salary_range ?? '',
          growth_outlook: initial.growth_outlook ?? '',
          example_roles: initial.example_roles.join(', '),
        }
      : EMPTY_FORM,
  )

  const set = (k: keyof TrackFormState, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const isEdit = !!initial

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg">
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">{isEdit ? 'Edit career track' : 'New career track'}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Row: slug + title */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Slug *</label>
              <input
                value={form.slug}
                onChange={e => set('slug', e.target.value)}
                disabled={isEdit}
                placeholder="policy-research"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Policy Research & Consulting"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="2–3 sentences explaining the track…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Row: sector + min_k_score */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sector *</label>
              <input
                value={form.sector}
                onChange={e => set('sector', e.target.value)}
                placeholder="Consulting"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Min K-score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.min_k_score}
                onChange={e => set('min_k_score', Number(e.target.value))}
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>

          {/* Required skills */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Required skills * <span className="font-normal text-gray-400">(comma-separated)</span></label>
            <input
              value={form.required_skills}
              onChange={e => set('required_skills', e.target.value)}
              placeholder="Analytical Thinking, Research, Written Communication"
              className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Example roles */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Example roles <span className="font-normal text-gray-400">(comma-separated)</span></label>
            <input
              value={form.example_roles}
              onChange={e => set('example_roles', e.target.value)}
              placeholder="Policy Analyst, Research Associate"
              className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Row: salary_range + growth_outlook */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Salary range</label>
              <input
                value={form.salary_range}
                onChange={e => set('salary_range', e.target.value)}
                placeholder="8–20 LPA"
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Growth outlook</label>
              <select
                value={form.growth_outlook}
                onChange={e => set('growth_outlook', e.target.value)}
                className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
              >
                <option value="">— none —</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.slug.trim() || !form.title.trim() || !form.description.trim() || !form.sector.trim()}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create track'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  track, onConfirm, onCancel, loading,
}: {
  track: CareerTrackAdminEntry; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
        <h3 className="text-base font-bold text-gray-900 mb-2">Delete career track?</h3>
        <p className="text-sm text-gray-500 mb-5">
          <span className="font-semibold text-gray-700">"{track.title}"</span> will be permanently deleted.
          Any aspirants who have selected this track will lose their selection.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CareerTracksSection() {
  const { data: tracks, isLoading } = useAdminCareerTracks()
  const createMutation = useCreateCareerTrack()
  const updateMutation = useUpdateCareerTrack()
  const deleteMutation = useDeleteCareerTrack()

  const [showForm, setShowForm]       = useState(false)
  const [editTarget, setEditTarget]   = useState<CareerTrackAdminEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CareerTrackAdminEntry | null>(null)
  const [formError, setFormError]     = useState<string | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  const parseComma = (s: string) =>
    s.split(',').map(x => x.trim()).filter(Boolean)

  const handleSave = (form: TrackFormState) => {
    setFormError(null)
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      sector: form.sector.trim(),
      required_skills: parseComma(form.required_skills),
      min_k_score: Number(form.min_k_score),
      salary_range: form.salary_range.trim() || null,
      growth_outlook: form.growth_outlook.trim() || null,
      example_roles: parseComma(form.example_roles),
    }
    if (editTarget) {
      updateMutation.mutate(
        { trackId: editTarget.id, payload },
        {
          onSuccess: () => { setEditTarget(null); setShowForm(false) },
          onError: (e: unknown) => setFormError(getApiError(e, 'Failed to save')),
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { setShowForm(false) },
        onError: (e: unknown) => setFormError(getApiError(e, 'Failed to save')),
      })
    }
  }

  const growthColor = (g: string | null) => {
    if (g === 'high') return 'bg-green-100 text-green-700'
    if (g === 'medium') return 'bg-amber-100 text-amber-700'
    if (g === 'low') return 'bg-gray-100 text-gray-500'
    return 'bg-gray-100 text-gray-400'
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>
          Career Tracks
        </h2>
        <button
          onClick={() => { setEditTarget(null); setFormError(null); setShowForm(true) }}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> New track
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !tracks || tracks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-14 text-center">
          <Compass className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">No career tracks yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {tracks.map(track => {
            const expanded = expandedId === track.id
            return (
              <div key={track.id} className="px-4 py-3">
                {/* Row */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : track.id)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {expanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{track.title}</p>
                      <p className="text-xs text-gray-400">{track.sector} · min K {track.min_k_score}</p>
                    </div>
                  </button>

                  {track.growth_outlook && (
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 capitalize', growthColor(track.growth_outlook))}>
                      {track.growth_outlook}
                    </span>
                  )}
                  {track.salary_range && (
                    <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{track.salary_range}</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditTarget(track); setFormError(null); setShowForm(true) }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(track)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-danger transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
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
          <div className="px-4 py-2.5 bg-gray-50">
            <p className="text-xs text-gray-400">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <TrackFormModal
          initial={editTarget}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
          saving={createMutation.isPending || updateMutation.isPending}
          error={formError}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmModal
          track={deleteTarget}
          loading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  )
}

// ── Overview section (stats + employer approvals) ─────────────────────────────

function OverviewSection() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const [tab, setTab]                             = useState<EmployerStatus>('pending')
  const { data: employers, isLoading: empLoading } = useAdminEmployers(tab)
  const approve    = useApproveEmployer()
  const reject     = useRejectEmployer()
  const [approvingId, setApprovingId]   = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<EmployerEntry | null>(null)

  const handleApprove = (profileId: string) => {
    setApprovingId(profileId)
    approve.mutate(profileId, { onSettled: () => setApprovingId(null) })
  }
  const handleReject = (profileId: string, reason: string) => {
    reject.mutate({ profileId, reason }, { onSuccess: () => setRejectTarget(null) })
  }

  return (
    <>
      {/* Stats */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: 'Hind, sans-serif' }}>Platform Overview</h2>
        {statsLoading ? (
          <Spinner />
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Users}      label="Aspirants"     value={stats.total_aspirants}   sub={`${stats.completed_onboarding} completed onboarding`} color="text-primary" />
            <StatCard icon={Building2}  label="Employers"     value={stats.total_employers}   sub={`${stats.pending_employers} pending approval`}        color="text-accent" />
            <StatCard icon={CheckCircle2} label="Approved"    value={stats.approved_employers}                                                           color="text-green-500" />
            <StatCard icon={Briefcase}  label="Job postings"  value={stats.total_job_postings} sub={`${stats.active_job_postings} active`}               color="text-gray-500" />
          </div>
        ) : null}
      </section>

      {/* Employer approvals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>Employer Registrations</h2>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {EMPLOYER_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', tab === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
              >
                {t.label}
                {t.value === 'pending' && stats && stats.pending_employers > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{stats.pending_employers}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {empLoading ? (
          <Spinner />
        ) : employers && employers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-14 text-center">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">
              {tab === 'pending' ? 'No pending employer registrations' : 'No employers found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(employers ?? []).map(employer => (
              <EmployerCard
                key={employer.id}
                employer={employer}
                approving={approvingId === employer.id}
                onApprove={() => handleApprove(employer.id)}
                onReject={() => setRejectTarget(employer)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          employer={rejectTarget}
          loading={reject.isPending}
          onConfirm={reason => handleReject(rejectTarget.id, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const logout = useLogout()
  const { data: stats } = useAdminStats()
  const [section, setSection] = useState<Section>('overview')

  const pendingCount = stats?.pending_employers ?? 0

  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-base font-bold text-primary" style={{ fontFamily: 'Hind, sans-serif' }}>
              DISHA AI <span className="text-xs font-normal text-gray-400 ml-1">Admin</span>
            </span>
          </div>

          {/* Section nav */}
          <nav className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {SECTION_TABS.map(({ label, value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSection(value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  section === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {value === 'overview' && pendingCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <button
          onClick={() => logout.mutate()}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-danger transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        {section === 'overview' && <OverviewSection />}
        {section === 'users'    && <UsersSection />}
        {section === 'tracks'   && <CareerTracksSection />}
      </main>
    </div>
  )
}
