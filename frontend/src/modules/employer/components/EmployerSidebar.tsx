import { memo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Building2, Users2, Star,
  BarChart3, CalendarDays, CreditCard, ShieldCheck,
  CheckCircle2, AlertCircle, LogOut, FileSignature, Share2,
  ClipboardList, UserCheck, CalendarCheck2, ScrollText,
  Users, FileText, HelpCircle, X, ChevronRight,
} from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { useEmployerDashboard, useDashboardKpis, useEmployerPermissions } from '../hooks/useJobs'
import { colors, shadows } from '@/design-system/tokens'

// ── Navy dark sidebar tokens (matches AppSidebar) ──────────────────────────────
const W_TEXT  = '#FFFFFF'
const W60     = 'rgba(255,255,255,0.60)'   // inactive nav text
const W40     = 'rgba(255,255,255,0.40)'   // section labels, chevron
const W15     = 'rgba(255,255,255,0.15)'   // badge bg on nav
const W10     = 'rgba(255,255,255,0.10)'   // active nav bg, close btn bg
const W08     = 'rgba(255,255,255,0.08)'   // hover nav bg, dividers
const W06     = 'rgba(255,255,255,0.06)'   // logout btn bg
const W065    = 'rgba(255,255,255,0.65)'   // active nav left border

// ── Nav primitives ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: W40,
      textTransform: 'uppercase', letterSpacing: '0.8px',
      padding: '12px 8px 6px', margin: 0,
    }}>{children}</p>
  )
}

const NavItem = memo(function NavItem({ to, icon: Icon, label, active, badge }: {
  to: string; icon: React.ElementType; label: string; active?: boolean; badge?: number
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px',
        borderRadius: 10,
        marginBottom: 2,
        background: active ? W10 : 'transparent',
        color: active ? W_TEXT : W60,
        border: 'none',
        borderLeft: active ? `2px solid ${W065}` : '2px solid transparent',
        textDecoration: 'none',
        fontSize: 13, fontWeight: active ? 700 : 500,
        transition: 'all 0.18s',
        position: 'relative',
      }}
      onMouseOver={e => { if (!active) { e.currentTarget.style.background = W08; e.currentTarget.style.color = W_TEXT } }}
      onMouseOut={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = W60 } }}
    >
      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0, opacity: active ? 1 : 0.75 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          background: W15, color: W_TEXT,
          fontSize: 10, fontWeight: 700, borderRadius: 99,
          padding: '1px 6px', minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      )}
    </Link>
  )
})

// ── Role nav configurations ────────────────────────────────────────────────────

function FullNav({ pathname, isOwner, activeJobs }: { pathname: string; isOwner: boolean; activeJobs: number }) {
  return (
    <>
      <SectionLabel>Overview</SectionLabel>
      <NavItem to="/app/employer/dashboard" icon={LayoutDashboard} label="Dashboard"  active={pathname === '/app/employer/dashboard'} />
      <NavItem to="/app/employer/analytics"  icon={BarChart3}       label="Analytics"  active={pathname.startsWith('/app/employer/analytics')} />
      <NavItem to="/app/employer/calendar"   icon={CalendarDays}    label="Calendar"   active={pathname.startsWith('/app/employer/calendar')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Hiring</SectionLabel>
      <NavItem to="/app/employer/jobs"      icon={Briefcase}     label="Jobs"      active={pathname.startsWith('/app/employer/jobs')}      badge={activeJobs} />
      <NavItem to="/app/employer/templates" icon={FileSignature} label="Templates" active={pathname.startsWith('/app/employer/templates')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Candidates</SectionLabel>
      <NavItem to="/app/employer/applicants"  icon={Users}          label="Applicants"  active={pathname.startsWith('/app/employer/applicants')} />
      <NavItem to="/app/employer/interviews"  icon={CalendarCheck2} label="Interviews"  active={pathname.startsWith('/app/employer/interviews')} />
      <NavItem to="/app/employer/offers"      icon={FileText}       label="Offers"      active={pathname.startsWith('/app/employer/offers')} />
      <NavItem to="/app/employer/talent-pool" icon={Star}           label="Talent Pool" active={pathname.startsWith('/app/employer/talent-pool')} />
      <NavItem to="/app/employer/referrals"   icon={Share2}         label="Referrals"   active={pathname.startsWith('/app/employer/referrals')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Organization</SectionLabel>
      <NavItem to="/app/employer/departments"  icon={Building2}   label="Departments"  active={pathname.startsWith('/app/employer/departments')} />
      <NavItem to="/app/employer/company"      icon={Users2}      label="Team"         active={pathname === '/app/employer/company'} />
      <NavItem to="/app/employer/verification" icon={ShieldCheck} label="Verification" active={pathname.startsWith('/app/employer/verification')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Account</SectionLabel>
      {isOwner && <NavItem to="/app/employer/subscription" icon={CreditCard} label="Billing"  active={pathname.startsWith('/app/employer/subscription')} />}
      <NavItem to="/app/employer/support" icon={HelpCircle} label="Support"  active={pathname.startsWith('/app/employer/support')} />
      <NavItem to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
    </>
  )
}

function DeptScopedNav({ pathname, deptId }: { pathname: string; deptId: string }) {
  const deptBase = `/app/employer/departments/${deptId}`
  return (
    <>
      <SectionLabel>Overview</SectionLabel>
      <NavItem to="/app/employer/dashboard" icon={LayoutDashboard} label="My Dashboard" active={pathname === '/app/employer/dashboard'} />
      <NavItem to="/app/employer/analytics" icon={BarChart3}       label="Analytics"    active={pathname.startsWith('/app/employer/analytics')} />
      <NavItem to="/app/employer/calendar"  icon={CalendarDays}    label="Calendar"     active={pathname.startsWith('/app/employer/calendar')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Hiring</SectionLabel>
      <NavItem to="/app/employer/jobs"      icon={Briefcase}     label="My Jobs"   active={pathname.startsWith('/app/employer/jobs')} />
      <NavItem to="/app/employer/templates" icon={FileSignature} label="Templates" active={pathname.startsWith('/app/employer/templates')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Candidates</SectionLabel>
      <NavItem to="/app/employer/applicants"  icon={Users}          label="Applicants"  active={pathname.startsWith('/app/employer/applicants')} />
      <NavItem to="/app/employer/interviews"  icon={CalendarCheck2} label="Interviews"  active={pathname.startsWith('/app/employer/interviews')} />
      <NavItem to="/app/employer/offers"      icon={FileText}       label="Offers"      active={pathname.startsWith('/app/employer/offers')} />
      <NavItem to="/app/employer/talent-pool" icon={Star}           label="Talent Pool" active={pathname.startsWith('/app/employer/talent-pool')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>My Department</SectionLabel>
      <NavItem to={deptBase} icon={Building2} label="Dept Overview" active={pathname === deptBase || pathname.startsWith(`${deptBase}/`)} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Account</SectionLabel>
      <NavItem to="/app/employer/verification" icon={ShieldCheck} label="Verification" active={pathname.startsWith('/app/employer/verification')} />
      <NavItem to="/app/employer/support"      icon={HelpCircle}  label="Support"      active={pathname.startsWith('/app/employer/support')} />
      <NavItem to="/app/security"              icon={ShieldCheck} label="Security"     active={pathname === '/app/security'} />
    </>
  )
}

function HiringManagerNav({ pathname }: { pathname: string }) {
  return (
    <>
      <SectionLabel>My Work</SectionLabel>
      <NavItem to="/app/employer/dashboard"   icon={ClipboardList}  label="My Approvals"  active={pathname === '/app/employer/dashboard'} />
      <NavItem to="/app/employer/talent-pool" icon={UserCheck}      label="My Candidates" active={pathname.startsWith('/app/employer/talent-pool')} />
      <NavItem to="/app/employer/calendar"    icon={CalendarCheck2} label="My Interviews" active={pathname.startsWith('/app/employer/calendar')} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Account</SectionLabel>
      <NavItem to="/app/employer/support" icon={HelpCircle}  label="Support"  active={pathname.startsWith('/app/employer/support')} />
      <NavItem to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
    </>
  )
}

function InterviewerNav({ pathname }: { pathname: string }) {
  return (
    <>
      <SectionLabel>My Work</SectionLabel>
      <NavItem to="/app/employer/calendar"  icon={CalendarCheck2} label="My Schedule" active={pathname.startsWith('/app/employer/calendar')} />
      <NavItem to="/app/employer/dashboard" icon={ScrollText}     label="Scorecards"  active={pathname === '/app/employer/dashboard'} />

      <div style={{ height: 1, background: W08, margin: '4px 0 2px' }} />
      <SectionLabel>Account</SectionLabel>
      <NavItem to="/app/employer/support" icon={HelpCircle}  label="Support"  active={pathname.startsWith('/app/employer/support')} />
      <NavItem to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
    </>
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────────

export default function EmployerSidebar({ onClose }: { onClose?: () => void } = {}) {
  const { data: dashboard } = useEmployerDashboard()
  const { data: kpis }      = useDashboardKpis()
  const { data: perms }     = useEmployerPermissions()
  const logout              = useLogout()
  const { pathname }        = useLocation()
  const navigate            = useNavigate()

  const companyName = dashboard?.company_name ?? '…'
  const isApproved  = dashboard?.is_approved ?? false
  const initial     = companyName.charAt(0).toUpperCase()
  const activeJobs  = kpis?.active_jobs ?? 0

  const roleName        = perms?.role_name ?? ''
  const deptId          = perms?.department_id ?? null
  const deptName        = perms?.department_name ?? null
  const isWide          = perms?.is_company_wide ?? true
  const isOwner         = roleName === 'employer_owner' || (!roleName && isWide)
  const isHiringManager = roleName === 'hiring_manager'
  const isInterviewer   = roleName === 'interviewer'
  const isDeptScoped    = !isWide && !!deptId && !isHiringManager && !isInterviewer

  const contextLabel = isDeptScoped && deptName
    ? deptName
    : isHiringManager ? 'Hiring Manager'
    : isInterviewer   ? 'Interviewer'
    : null

  return (
    <aside style={{
      width: 260,
      flexShrink: 0,
      background: `linear-gradient(180deg, ${colors.brand.navy} 0%, ${colors.brand.navyDark} 100%)`,
      borderRight: 'none',
      boxShadow: shadows.sidebar,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px 20px',
        borderBottom: `1px solid ${W08}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/app/employer/dashboard')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18, fontWeight: 800, color: W_TEXT, letterSpacing: '-0.4px' }}>BeginableAI</span>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: W10, border: `1px solid ${W08}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: W60, transition: 'background 0.18s, color 0.18s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = W15; e.currentTarget.style.color = W_TEXT }}
            onMouseOut={e => { e.currentTarget.style.background = W10; e.currentTarget.style.color = W60 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Company context */}
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${W08}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: W15,
          border: `1px solid ${W08}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15, color: W_TEXT, flexShrink: 0,
          letterSpacing: '-0.3px',
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: W_TEXT,
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{companyName}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            {contextLabel ? (
              <span style={{ fontSize: 11, color: W60 }}>{contextLabel}</span>
            ) : isApproved ? (
              <><CheckCircle2 size={10} color={colors.state.success} /><span style={{ fontSize: 11, color: W60, fontWeight: 500 }}>Verified</span></>
            ) : (
              <><AlertCircle size={10} color={colors.state.warning} /><span style={{ fontSize: 11, color: W60, fontWeight: 500 }}>Pending</span></>
            )}
          </div>
        </div>
        <ChevronRight size={13} color={W40} style={{ flexShrink: 0 }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', scrollbarWidth: 'thin', scrollbarColor: `${W08} transparent` }}>
        {isHiringManager ? (
          <HiringManagerNav pathname={pathname} />
        ) : isInterviewer ? (
          <InterviewerNav pathname={pathname} />
        ) : isDeptScoped ? (
          <DeptScopedNav pathname={pathname} deptId={deptId!} />
        ) : (
          <FullNav pathname={pathname} isOwner={isOwner} activeJobs={activeJobs} />
        )}
      </nav>

      {/* Logout */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${W08}` }}>
        <button
          onClick={() => logout.mutate()}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '9px 12px', borderRadius: 10,
            background: W06, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: W60, transition: 'background 0.12s, color 0.12s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#FEF2F210'; e.currentTarget.style.color = colors.state.danger }}
          onMouseOut={e => { e.currentTarget.style.background = W06; e.currentTarget.style.color = W60 }}
        >
          <LogOut size={15} strokeWidth={1.8} style={{ opacity: 0.7 }} />
          Log out
        </button>
      </div>
    </aside>
  )
}
