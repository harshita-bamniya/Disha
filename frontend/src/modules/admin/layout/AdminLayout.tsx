import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Users, Building2, Briefcase, FileText,
  Compass, UserCog, KeyRound, Activity, IndianRupee, Award, Settings,
  LogOut, PanelLeftClose, PanelLeftOpen, Clock, Search, Bot, BarChart2,
  Plug, MonitorDot, Bell, HeadphonesIcon, ChevronDown, ChevronRight,
  ShieldCheck, CreditCard, BarChart, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { adminApi } from '@/api/admin'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const N = {
  navy:     '#1A2744',
  navySoft: '#243359',
  navyHover:'rgba(255,255,255,0.08)',
  navyActive:'rgba(255,255,255,0.12)',
  white:    '#FFFFFF',
  muted:    'rgba(255,255,255,0.45)',
  dim:      'rgba(255,255,255,0.25)',
  border:   'rgba(255,255,255,0.08)',
  bg:       '#F4F5F7',
  ink:      '#1E3A5F',
  inkSoft:  '#475569',
}

type NavLeaf  = { label: string; path: string; icon: React.ElementType; roles?: string[] }
type NavGroup = { groupLabel: string; icon: React.ElementType; basePath: string; children: NavLeaf[]; roles?: string[] }
type NavItem  = NavLeaf | NavGroup
const isGroup = (item: NavItem): item is NavGroup => 'children' in item

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  {
    groupLabel: 'Employers', icon: Building2, basePath: '/admin/employers',
    roles: ['admin', 'super_admin', 'verification_officer'],
    children: [
      { label: 'All Employers',      path: '/admin/employers',               icon: Building2 },
      { label: 'KYC Queue',          path: '/admin/kyc',                     icon: FileText,    roles: ['admin', 'super_admin', 'verification_officer'] },
      { label: 'Pending Approvals',  path: '/admin/employers?status=pending',icon: Clock,       roles: ['admin', 'super_admin', 'verification_officer'] },
      { label: 'Verifications',      path: '/admin/employers?tab=documents', icon: ShieldCheck, roles: ['admin', 'super_admin', 'verification_officer'] },
      { label: 'Employer Reports',   path: '/admin/reports/employers',       icon: BarChart,    roles: ['admin', 'super_admin', 'finance_manager'] },
      { label: 'Subscriptions',      path: '/admin/subscriptions',           icon: CreditCard,  roles: ['admin', 'super_admin', 'finance_manager'] },
    ],
  },
  {
    groupLabel: 'Jobs', icon: Briefcase, basePath: '/admin/jobs',
    roles: ['admin', 'super_admin', 'moderator'],
    children: [{ label: 'All Jobs', path: '/admin/jobs', icon: Briefcase }],
  },
  {
    groupLabel: 'Candidates', icon: Users, basePath: '/admin/candidates',
    roles: ['admin', 'super_admin', 'moderator', 'support_executive'],
    children: [{ label: 'All Candidates', path: '/admin/candidates', icon: Users }],
  },
  {
    groupLabel: 'Support', icon: HeadphonesIcon, basePath: '/admin/support',
    roles: ['admin', 'super_admin', 'support_executive'],
    children: [{ label: 'Tickets', path: '/admin/support', icon: HeadphonesIcon }],
  },
  {
    groupLabel: 'Reports', icon: BarChart2, basePath: '/admin/reports',
    roles: ['admin', 'super_admin', 'finance_manager'],
    children: [
      { label: 'Overview',          path: '/admin/reports',              icon: BarChart2 },
      { label: 'Employer Reports',  path: '/admin/reports/employers',    icon: Building2 },
      { label: 'Job Reports',       path: '/admin/reports/jobs',         icon: Briefcase },
      { label: 'Candidate Reports', path: '/admin/reports/candidates',   icon: Users },
      { label: 'Financial',         path: '/admin/reports/financial',    icon: IndianRupee },
    ],
  },
]

const CONFIG_NAV: NavLeaf[] = [
  { label: 'Career Tracks',  path: '/admin/career-tracks', icon: Compass },
  { label: 'Notifications',  path: '/admin/notifications', icon: Bell,      roles: ['admin', 'super_admin'] },
  { label: 'Sub-Admins',     path: '/admin/sub-admins',    icon: UserCog,   roles: ['super_admin'] },
  { label: 'Roles',          path: '/admin/roles',         icon: KeyRound,  roles: ['super_admin'] },
  { label: 'Audit Log',      path: '/admin/audit-log',     icon: Activity },
  { label: 'Subscriptions',  path: '/admin/subscriptions', icon: Award },
  { label: 'AI Config',      path: '/admin/ai-config',     icon: Bot,       roles: ['super_admin'] },
  { label: 'Integrations',   path: '/admin/integrations',  icon: Plug,      roles: ['super_admin'] },
  { label: 'System',         path: '/admin/system',        icon: MonitorDot,roles: ['super_admin'] },
  { label: 'Settings',       path: '/admin/settings',      icon: Settings,  roles: ['super_admin'] },
]

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
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: focused ? N.ink : '#94A3B8' }} />
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { setOpen(true); setFocused(true) }}
        onBlur={() => { setTimeout(() => setOpen(false), 150); setFocused(false) }}
        placeholder="Search employers, jobs, candidates…"
        style={{
          borderColor: focused ? N.navy : '#E2E8F0',
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
              <span className="text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ color: N.muted }}>
                {TYPE_LABELS[r.type] ?? r.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Nav leaf ────────────────────────────────────────────────────────────────────

function NavLeafItem({ item, sidebarOpen }: { item: NavLeaf; sidebarOpen: boolean }) {
  return (
    <NavLink
      to={item.path}
      title={!sidebarOpen ? item.label : undefined}
      end
      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
      style={({ isActive }) => isActive
        ? { background: N.navyActive, color: N.white, fontWeight: 600 }
        : { color: 'rgba(255,255,255,0.65)' }
      }
      onMouseOver={e => { const el = e.currentTarget; if (!el.style.background || el.style.background === '') el.style.background = N.navyHover }}
      onMouseOut={e => { const el = e.currentTarget; if (el.style.background === N.navyHover) el.style.background = '' }}
    >
      <item.icon size={15} className="shrink-0" />
      {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
    </NavLink>
  )
}

// ── Nav group ───────────────────────────────────────────────────────────────────

function NavGroupItem({ group, sidebarOpen, role }: { group: NavGroup; sidebarOpen: boolean; role: string }) {
  const location  = useLocation()
  const isActive  = location.pathname.startsWith(group.basePath)
  const [expanded, setExpanded] = useState(isActive)

  if (group.roles && !group.roles.includes(role)) return null
  const visibleChildren = group.children.filter(c => !c.roles || c.roles.includes(role))
  if (visibleChildren.length === 0) return null

  if (!sidebarOpen) {
    return (
      <NavLink
        to={group.basePath}
        title={group.groupLabel}
        className="flex items-center justify-center px-3 py-2.5 rounded-xl transition-colors"
        style={isActive ? { background: N.navyActive, color: N.white } : { color: 'rgba(255,255,255,0.65)' }}
      >
        <group.icon size={15} className="shrink-0" />
      </NavLink>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        style={isActive && !expanded
          ? { background: N.navyActive, color: N.white, fontWeight: 600 }
          : { color: 'rgba(255,255,255,0.65)' }
        }
        onMouseOver={e => { if (!(isActive && !expanded)) e.currentTarget.style.background = N.navyHover }}
        onMouseOut={e => { if (!(isActive && !expanded)) e.currentTarget.style.background = '' }}
      >
        <group.icon size={15} className="shrink-0" />
        <span className="flex-1 text-left truncate">{group.groupLabel}</span>
        {expanded
          ? <ChevronDown size={11} className="shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
          : <ChevronRight size={11} className="shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
        }
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 pl-3" style={{ borderLeft: `1px solid ${N.border}` }}>
          {visibleChildren.map(child => {
            const [childPath, childSearch] = child.path.split('?')
            const isChildActive = childSearch
              ? location.pathname === childPath && location.search === `?${childSearch}`
              : location.pathname === childPath && !location.search
            return (
              <NavLink
                key={child.path}
                to={child.path}
                end
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={isChildActive
                  ? { background: N.navyActive, color: N.white, fontWeight: 600 }
                  : { color: 'rgba(255,255,255,0.55)' }
                }
                onMouseOver={e => { if (!isChildActive) e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
                onMouseOut={e => { if (!isChildActive) e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
              >
                <child.icon size={12} className="shrink-0" />
                <span className="truncate">{child.label}</span>
              </NavLink>
            )
          })}
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const role         = user?.role ?? ''
  const isSuperAdmin = role === 'super_admin'
  const visibleConfig = CONFIG_NAV.filter(item => !item.roles || item.roles.includes(role))

  return (
    <div className="min-h-screen flex" style={{ background: N.bg }}>

      {/* Mobile hamburger */}
      {isMobile && (
        <>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{
              position: 'fixed', top: 14, left: 14, zIndex: 1100,
              width: 40, height: 40, borderRadius: 10,
              background: N.navy, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(26,39,68,0.30)',
              opacity: mobileOpen ? 0 : 1, pointerEvents: mobileOpen ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}
          >
            <Menu size={17} color="white" />
          </button>
          {mobileOpen && (
            <div
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            />
          )}
        </>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col z-40 transition-all duration-200 shrink-0',
          isMobile ? 'fixed top-0 left-0 h-full w-56' : (sidebarOpen ? 'fixed top-0 left-0 h-full w-56' : 'fixed top-0 left-0 h-full w-16'),
        )}
        style={{
          background: N.navy,
          boxShadow: '4px 0 24px rgba(26,39,68,0.18)',
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: isMobile ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' : 'width 0.2s',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${N.border}` }}
        >
          {sidebarOpen || isMobile ? (
            <>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>BeginableAI</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                  {isSuperAdmin ? 'Super Admin' : 'Admin'}
                </span>
              </div>
              {isMobile && (
                <button
                  onClick={() => setMobileOpen(false)}
                  style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.08)', border: `1px solid ${N.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X size={13} color="rgba(255,255,255,0.6)" />
                </button>
              )}
            </>
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${N.border}` }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>B</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {sidebarOpen && (
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '4px 12px 6px' }}>
              Operations
            </p>
          )}
          {NAV.map((item, i) => {
            if (isGroup(item)) return <NavGroupItem key={i} group={item} sidebarOpen={sidebarOpen || isMobile} role={role} />
            const leaf = item as NavLeaf
            if (leaf.roles && !leaf.roles.includes(role)) return null
            return <NavLeafItem key={leaf.path} item={leaf} sidebarOpen={sidebarOpen || isMobile} />
          })}

          {visibleConfig.length > 0 && (
            <>
              {sidebarOpen || isMobile
                ? <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '16px 12px 6px' }}>
                    Configuration
                  </p>
                : <div style={{ margin: '8px 12px', borderTop: `1px solid ${N.border}` }} />
              }
              {visibleConfig.map(item => (
                <NavLeafItem key={item.path} item={item} sidebarOpen={sidebarOpen || isMobile} />
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 flex flex-col gap-1 shrink-0" style={{ borderTop: `1px solid ${N.border}` }}>
          {!isMobile && (
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors w-full"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseOver={e => { e.currentTarget.style.background = N.navyHover; e.currentTarget.style.color = '#fff' }}
              onMouseOut={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            >
              {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              {sidebarOpen && <span>Collapse</span>}
            </button>
          )}
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors w-full font-semibold"
            style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)' }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)' }}
          >
            <LogOut size={14} />
            {(sidebarOpen || isMobile) && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn('flex-1 flex flex-col min-h-screen transition-all duration-200', isMobile ? 'ml-0' : (sidebarOpen ? 'ml-56' : 'ml-16'))}
        style={isMobile ? { paddingTop: 68 } : {}}
      >
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '0.5px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 12px rgba(26,39,68,0.05)',
          }}
        >
          <p style={{ fontSize: 12, color: '#94A3B8' }}>BeginablAI — platform administration</p>
          <div className="flex items-center gap-3 shrink-0">
            <GlobalSearchBar />
            <PendingAlert />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', background: 'rgba(26,39,68,0.06)',
              border: '0.5px solid rgba(26,39,68,0.1)', borderRadius: 20,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: N.ink, textTransform: 'capitalize' }}>
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
