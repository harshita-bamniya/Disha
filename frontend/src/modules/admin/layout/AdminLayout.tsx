import { useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Clock } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { adminApi } from '@/api/admin'
import { colors } from '@/design-system/tokens'
import Sidebar from '@/shared/layouts/Sidebar'
import { buildAdminNav } from '@/shared/config/navigation'

// ── Global search ───────────────────────────────────────────────────────────────

function GlobalSearchBar() {
  const navigate = useNavigate()
  const [query, setQuery]       = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen]         = useState(false)
  const [focused, setFocused]   = useState(false)

  const handleChange = (v: string) => {
    setQuery(v); setOpen(true)
    clearTimeout((handleChange as any)._t)
    ;(handleChange as any)._t = setTimeout(() => setDebounced(v), 300)
  }

  const ENTITY_ROUTES: Record<string, (id: string) => string> = {
    user: id => `/admin/candidates/${id}`,
    employer: id => `/admin/employers/${id}`,
    job: id => `/admin/jobs/${id}`,
    application: () => `/admin/reports`,
  }

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => adminApi.globalSearch(debounced),
    enabled: debounced.trim().length >= 2,
  })

  const TYPE_LABELS: Record<string, string> = {
    user: 'Candidate', employer: 'Employer', job: 'Job', application: 'Application',
  }

  return (
    <div className="relative flex-1 min-w-[160px] max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: focused ? colors.text.ink : '#94A3B8' }} />
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { setOpen(true); setFocused(true) }}
        onBlur={() => { setTimeout(() => setOpen(false), 150); setFocused(false) }}
        placeholder="Search employers, jobs, candidates…"
        style={{
          borderColor: focused ? colors.brand.navy : '#E2E8F0',
          boxShadow: focused ? `0 0 0 3px rgba(26,39,68,0.07)` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        className="w-full pl-8 pr-3 h-9 rounded-xl border bg-white text-xs text-gray-700 placeholder:text-gray-400 outline-none"
      />
      {open && debounced.trim().length >= 2 && (
        <div className="absolute top-10 left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-lg z-50 max-h-80 overflow-y-auto" style={{ boxShadow: '0 8px 24px rgba(26,39,68,0.12)' }}>
          {isFetching ? (
            <p className="px-4 py-3 text-xs text-gray-400">Searching…</p>
          ) : !data || data.results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">No matches for "{debounced}"</p>
          ) : data.results.map(r => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => { navigate(ENTITY_ROUTES[r.type]?.(r.id) ?? '/admin/dashboard'); setOpen(false); setQuery('') }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-2 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{r.title}</p>
                {r.subtitle && <p className="text-[11px] text-gray-400 truncate">{r.subtitle}</p>}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ color: '#94A3B8' }}>
                {TYPE_LABELS[r.type] ?? r.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Layout ──────────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const user        = useAuthStore(s => s.user)
  const logout      = useLogout()
  const isMobile    = useIsMobile()
  const navigate    = useNavigate()
  const { pathname, search } = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const role         = user?.role ?? ''
  const isSuperAdmin = role === 'super_admin'

  return (
    <div className="min-h-screen flex" style={{ background: colors.surface.bg }}>

      <Sidebar
        sections={buildAdminNav(role)}
        pathname={pathname}
        search={search}
        brandBadge={isSuperAdmin ? 'Super Admin' : 'Admin'}
        onNavigate={navigate}
        onLogout={() => logout.mutate()}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 px-6 py-3"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 12px rgba(26,39,68,0.05)',
            paddingLeft: isMobile ? 68 : 24,
          }}
        >
          <p style={{ fontSize: 12, color: '#94A3B8' }}>BeginablAI — platform administration</p>
          <div className="flex flex-wrap items-center gap-3">
            <GlobalSearchBar />
            <PendingAlert />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', background: 'rgba(26,39,68,0.06)',
              border: '0.5px solid rgba(26,39,68,0.1)', borderRadius: 20,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink, textTransform: 'capitalize' }}>
                {role.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── Pending approvals alert ─────────────────────────────────────────────────────

function PendingAlert() {
  const navigate = useNavigate()
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn:  () => adminApi.getStats(),
    staleTime: 60_000,
  })
  const pending = stats?.pending_employers ?? 0
  if (pending === 0) return null
  return (
    <button
      onClick={() => navigate('/admin/employers')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 32, padding: '0 12px', borderRadius: 20,
        background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.25)',
        color: '#B45309', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseOver={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.14)')}
      onMouseOut={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')}
    >
      <Clock size={12} />
      {pending} pending
    </button>
  )
}
