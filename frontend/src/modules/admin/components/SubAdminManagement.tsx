import { useMemo, useState } from 'react'
import {
  Search, Plus, X, ChevronRight, ChevronLeft, MoreVertical, Shield, ShieldOff,
  UserCog, Trash2, Clock, History, Monitor, Check, Users, UserCheck, CalendarDays,
} from 'lucide-react'
import {
  useSubAdmins, useAdminRoles, useCreateSubAdmin, useUpdateSubAdminRole, useDeleteSubAdmin,
  useUpdateUserStatus, useLoginHistory, useDeviceSessions, useRevokeDeviceSession,
} from '../hooks/useAdmin'
import type { SubAdminEntry, RoleEntry } from '@/api/admin'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import Badge from '@/shared/components/data-display/Badge'

const PLATFORM_ROLE_NAMES = new Set([
  'super_admin', 'admin', 'moderator', 'verification_officer', 'finance_manager', 'support_executive',
])

// ── Small shared bits ──────────────────────────────────────────────────────────

function Avatar({ name, email }: { name: string | null; email: string | null }) {
  const label = (name || email || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-white flex items-center justify-center text-sm font-bold shrink-0">
      {label}
    </div>
  )
}

const STATUS_BADGE_COLOR: Record<string, 'green' | 'amber' | 'red'> = {
  active: 'green',
  suspended: 'amber',
  banned: 'red',
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    moderator: 'bg-teal-100 text-teal-700',
    verification_officer: 'bg-indigo-100 text-indigo-700',
    finance_manager: 'bg-amber-100 text-amber-700',
    support_executive: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', colors[role] ?? 'bg-gray-100 text-gray-600')}>
      {role.replace(/_/g, ' ')}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number | string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', accent)}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-gray-900 leading-tight">{value}</p>
        <p className="text-[11px] text-gray-400 font-semibold whitespace-nowrap">{label}</p>
      </div>
    </div>
  )
}

// ── Login history / sessions drawer (reuses existing endpoints) ──────────────

function SecurityDrawer({ admin, onClose }: { admin: SubAdminEntry; onClose: () => void }) {
  const { data: history, isLoading: historyLoading } = useLoginHistory(admin.user_id)
  const { data: sessions, isLoading: sessionsLoading } = useDeviceSessions(admin.user_id)
  const revoke = useRevokeDeviceSession()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="text-base font-bold text-gray-900">{admin.full_name ?? admin.email}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Login history & active sessions</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><History size={12} />Login History</p>
          {historyLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : !history || history.length === 0 ? (
            <p className="text-xs text-gray-400 mb-4">No login history recorded.</p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-5">
              {history.slice(0, 12).map(h => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className={cn('font-medium', h.success ? 'text-gray-700' : 'text-red-500')}>
                    {h.success ? 'Success' : h.failure_reason ?? 'Failed'} {h.device_label ? `· ${h.device_label}` : ''}
                  </span>
                  <span className="text-gray-400">{new Date(h.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><Monitor size={12} />Active Sessions</p>
          {sessionsLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : !sessions || sessions.length === 0 ? (
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
                    onClick={() => revoke.mutate({ userId: admin.user_id, sessionId: s.id })}
                    disabled={revoke.isPending}
                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >Force logout</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Row actions menu ───────────────────────────────────────────────────────────

function RowActions({ admin, canManage, onViewSecurity }: { admin: SubAdminEntry; canManage: boolean; onViewSecurity: () => void }) {
  const [open, setOpen] = useState(false)
  const updateStatus = useUpdateUserStatus()
  const remove = useDeleteSubAdmin()
  const isTargetSuperAdmin = admin.role_name === 'super_admin'

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl border border-gray-100 shadow-lg z-20 py-1.5 text-xs">
            <button
              onClick={() => { onViewSecurity(); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
            ><Clock size={13} />Login History & Sessions</button>
            {!isTargetSuperAdmin && admin.status !== 'active' && (
              <button
                onClick={() => { updateStatus.mutate({ userId: admin.user_id, status: 'active' }); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-green-700"
              ><Shield size={13} />Activate</button>
            )}
            {!isTargetSuperAdmin && admin.status === 'active' && (
              <button
                onClick={() => { updateStatus.mutate({ userId: admin.user_id, status: 'suspended' }); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-amber-700"
              ><ShieldOff size={13} />Suspend</button>
            )}
            {!isTargetSuperAdmin && canManage && (
              <button
                onClick={() => { if (confirm(`Remove ${admin.full_name ?? admin.email} as a sub-admin?`)) remove.mutate(admin.user_id); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
              ><Trash2 size={13} />Remove</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Create Sub-Admin wizard (3 real steps — no fabricated capability) ────────

type WizardStep = 1 | 2 | 3

function CreateSubAdminWizard({ roles, onClose }: { roles: RoleEntry[]; onClose: () => void }) {
  const create = useCreateSubAdmin()
  const [step, setStep] = useState<WizardStep>(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')

  const platformRoles = roles.filter(r => PLATFORM_ROLE_NAMES.has(r.name) && r.name !== 'super_admin')
  const selectedRole = platformRoles.find(r => r.id === roleId)

  const canNext1 = fullName.trim().length > 0 && email.trim().length > 0
  const canNext2 = !!roleId

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header + progress */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Create Sub-Admin</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  step === s ? 'bg-primary text-white' : step > s ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-gray-400',
                )}>
                  {step > s ? <Check size={13} /> : s}
                </div>
                <span className={cn('text-[11px] font-semibold whitespace-nowrap', step === s ? 'text-gray-900' : 'text-gray-400')}>
                  {s === 1 ? 'Personal' : s === 2 ? 'Role' : 'Review'}
                </span>
                {s < 3 && <div className={cn('flex-1 h-0.5 rounded', step > s ? 'bg-primary/30' : 'bg-gray-100')} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Full name *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jordan Lee"
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Work email *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jordan@disha.ai"
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Phone (optional)</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400 mb-1">Select the platform role — permissions are shown below for reference.</p>
              {platformRoles.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRoleId(r.id)}
                  className={cn(
                    'text-left rounded-xl border px-4 py-3 transition-colors',
                    roleId === r.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 capitalize">{r.name.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-gray-400">{r.permissions.length} permissions</span>
                  </div>
                  {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                </button>
              ))}
              {selectedRole && selectedRole.permissions.length > 0 && (
                <div className="mt-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Includes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRole.permissions.map(p => (
                      <span key={p} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-gray-200 text-gray-600">{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Personal Details</p>
                <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1 text-sm">
                  <p><span className="text-gray-400">Name:</span> <span className="font-semibold text-gray-900">{fullName}</span></p>
                  <p><span className="text-gray-400">Email:</span> <span className="font-semibold text-gray-900">{email}</span></p>
                  {phone && <p><span className="text-gray-400">Phone:</span> <span className="font-semibold text-gray-900">{phone}</span></p>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Assigned Role</p>
                <div className="bg-gray-50 rounded-xl p-3">
                  <RoleBadge role={selectedRole?.name ?? ''} />
                  <p className="text-xs text-gray-400 mt-2">{selectedRole?.permissions.length ?? 0} permissions granted</p>
                </div>
              </div>
              {create.isError && <p className="text-xs text-red-500">{getApiError(create.error)}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as WizardStep)}
              className="flex items-center gap-1 h-10 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
            ><ChevronLeft size={14} />Back</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Cancel</button>
          {step < 3 ? (
            <button
              onClick={() => setStep((step + 1) as WizardStep)}
              disabled={step === 1 ? !canNext1 : !canNext2}
              className="flex items-center gap-1 h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40"
            >Next<ChevronRight size={14} /></button>
          ) : (
            <button
              onClick={() => create.mutate(
                { email: email.trim(), phone: phone.trim() || undefined, role_id: roleId, full_name: fullName.trim() },
                { onSuccess: onClose },
              )}
              disabled={create.isPending}
              className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40"
            >{create.isPending ? 'Creating…' : 'Create Sub-Admin'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function SubAdminManagement() {
  const currentRole = useAuthStore(s => s.user?.role)
  const isSuperAdmin = currentRole === 'super_admin'
  const { data: admins, isLoading } = useSubAdmins()
  const { data: roles } = useAdminRoles()
  const updateRole = useUpdateSubAdminRole()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'last_login'>('created')
  const [showWizard, setShowWizard] = useState(false)
  const [securityFor, setSecurityFor] = useState<SubAdminEntry | null>(null)

  const platformRoles = (roles ?? []).filter(r => PLATFORM_ROLE_NAMES.has(r.name) && r.name !== 'super_admin')

  const stats = useMemo(() => {
    const list = admins ?? []
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return {
      total: list.length,
      active: list.filter(a => a.status === 'active').length,
      suspended: list.filter(a => a.status !== 'active').length,
      roles: new Set(list.map(a => a.role_name)).size,
      createdThisWeek: list.filter(a => new Date(a.created_at).getTime() >= weekAgo).length,
    }
  }, [admins])

  const filtered = useMemo(() => {
    let list = admins ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => (a.full_name ?? '').toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter)
    if (roleFilter !== 'all') list = list.filter(a => a.role_name === roleFilter)
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '')
      if (sortBy === 'last_login') return (b.last_login_at ?? '').localeCompare(a.last_login_at ?? '')
      return b.created_at.localeCompare(a.created_at)
    })
  }, [admins, search, statusFilter, roleFilter, sortBy])

  return (
    <section className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Total Sub-Admins" value={stats.total} accent="bg-blue-50 text-blue-600" />
        <StatCard icon={UserCheck} label="Active" value={stats.active} accent="bg-green-50 text-green-600" />
        <StatCard icon={ShieldOff} label="Suspended" value={stats.suspended} accent="bg-amber-50 text-amber-600" />
        <StatCard icon={UserCog} label="Roles in Use" value={stats.roles} accent="bg-purple-50 text-purple-600" />
        <StatCard icon={CalendarDays} label="Added This Week" value={stats.createdThisWeek} accent="bg-indigo-50 text-indigo-600" />
      </div>

      {/* Toolbar + Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full pl-8 pr-3 h-8 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-primary">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-8 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-primary">
            <option value="all">All roles</option>
            {platformRoles.map(r => <option key={r.id} value={r.name}>{r.name.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="h-8 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:border-primary">
            <option value="created">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="last_login">Last login</option>
          </select>
          <button
            onClick={() => setShowWizard(true)}
            disabled={!isSuperAdmin}
            title={isSuperAdmin ? undefined : 'Only Super Admin can create sub-admins'}
            className="flex items-center gap-1 h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 ml-auto disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
          ><Plus size={12} />Create Sub-Admin</button>
        </div>
        {!isSuperAdmin && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium">
            You're viewing as <span className="capitalize font-semibold">{currentRole?.replace(/_/g, ' ')}</span> — only Super Admin can create sub-admins, change their roles, or remove them.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCog className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">{admins && admins.length > 0 ? 'No sub-admins match your filters' : 'No sub-admins yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="text-left px-4 py-2">Sub-Admin</th>
                  <th className="text-left px-4 py-2">Role</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Last Login</th>
                  <th className="text-left px-4 py-2">Created</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.user_id} className="border-t border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={a.full_name} email={a.email} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{a.full_name ?? '—'}</p>
                          <p className="text-xs text-gray-400 truncate">{a.email ?? a.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.role_name === 'super_admin' || !isSuperAdmin ? (
                        <RoleBadge role={a.role_name} />
                      ) : (
                        <select
                          value={a.role_id}
                          onChange={e => updateRole.mutate({ userId: a.user_id, roleId: e.target.value })}
                          className="h-7 rounded-lg border border-gray-200 px-1.5 text-xs outline-none focus:border-primary capitalize"
                        >
                          {platformRoles.map(r => <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge color={STATUS_BADGE_COLOR[a.status] ?? 'gray'} className="capitalize">{a.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {a.last_login_at ? new Date(a.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions admin={a} canManage={isSuperAdmin} onViewSecurity={() => setSecurityFor(a)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">{filtered.length} of {admins?.length ?? 0} sub-admins</p>
            </div>
          </div>
        )}
      </div>

      {showWizard && <CreateSubAdminWizard roles={roles ?? []} onClose={() => setShowWizard(false)} />}
      {securityFor && <SecurityDrawer admin={securityFor} onClose={() => setSecurityFor(null)} />}
    </section>
  )
}
