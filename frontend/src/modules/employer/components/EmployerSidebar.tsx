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

// ── Nav primitives ─────────────────────────────────────────────────────────────

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: '#94A3B8',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        padding: '14px 16px 4px', margin: 0,
      }}>{label}</p>
      {children}
    </div>
  )
}

function NavLink({ to, icon: Icon, label, active, badge }: {
  to: string; icon: React.ElementType; label: string; active?: boolean; badge?: number
}) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '6px 12px 6px 14px',
      margin: '1px 8px',
      borderRadius: 7,
      background: active ? '#EFF6FF' : 'transparent',
      color: active ? '#1D4ED8' : '#374151',
      textDecoration: 'none',
      fontSize: 13, fontWeight: active ? 600 : 400,
      transition: 'background 0.12s, color 0.12s',
      position: 'relative',
    }}
      onMouseOver={e => { if (!active) e.currentTarget.style.background = '#F8FAFC'; if (!active) e.currentTarget.style.color = '#111827' }}
      onMouseOut={e => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = '#374151' }}
    >
      {active && (
        <span style={{
          position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 18, borderRadius: 99,
          background: '#2563EB',
        }} />
      )}
      <Icon size={14} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          background: '#DBEAFE', color: '#1D4ED8',
          fontSize: 10, fontWeight: 700, borderRadius: 99,
          padding: '1px 6px', minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      )}
    </Link>
  )
}

// ── Role nav configurations ────────────────────────────────────────────────────

function FullNav({ pathname, isOwner, activeJobs }: { pathname: string; isOwner: boolean; activeJobs: number }) {
  return (
    <>
      <NavSection label="Overview">
        <NavLink to="/app/employer/dashboard" icon={LayoutDashboard} label="Dashboard"  active={pathname === '/app/employer/dashboard'} />
        <NavLink to="/app/employer/analytics"  icon={BarChart3}       label="Analytics"  active={pathname.startsWith('/app/employer/analytics')} />
        <NavLink to="/app/employer/calendar"   icon={CalendarDays}    label="Calendar"   active={pathname.startsWith('/app/employer/calendar')} />
      </NavSection>

      <NavSection label="Hiring">
        <NavLink to="/app/employer/jobs"      icon={Briefcase}     label="Jobs"      active={pathname.startsWith('/app/employer/jobs')}      badge={activeJobs} />
        <NavLink to="/app/employer/templates" icon={FileSignature} label="Templates" active={pathname.startsWith('/app/employer/templates')} />
      </NavSection>

      <NavSection label="Candidates">
        <NavLink to="/app/employer/applicants"  icon={Users}          label="Applicants"  active={pathname.startsWith('/app/employer/applicants')} />
        <NavLink to="/app/employer/interviews"  icon={CalendarCheck2} label="Interviews"  active={pathname.startsWith('/app/employer/interviews')} />
        <NavLink to="/app/employer/offers"      icon={FileText}       label="Offers"      active={pathname.startsWith('/app/employer/offers')} />
        <NavLink to="/app/employer/talent-pool" icon={Star}           label="Talent Pool" active={pathname.startsWith('/app/employer/talent-pool')} />
        <NavLink to="/app/employer/referrals"   icon={Share2}         label="Referrals"   active={pathname.startsWith('/app/employer/referrals')} />
      </NavSection>

      <NavSection label="Organization">
        <NavLink to="/app/employer/departments"  icon={Building2}   label="Departments"  active={pathname.startsWith('/app/employer/departments')} />
        <NavLink to="/app/employer/company"      icon={Users2}      label="Team"         active={pathname === '/app/employer/company'} />
        <NavLink to="/app/employer/verification" icon={ShieldCheck} label="Verification" active={pathname.startsWith('/app/employer/verification')} />
      </NavSection>

      <NavSection label="Account">
        {isOwner && <NavLink to="/app/employer/subscription" icon={CreditCard} label="Billing"  active={pathname.startsWith('/app/employer/subscription')} />}
        <NavLink to="/app/employer/support" icon={HelpCircle} label="Support"  active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

function DeptScopedNav({ pathname, deptId }: { pathname: string; deptId: string }) {
  const deptBase = `/app/employer/departments/${deptId}`
  return (
    <>
      <NavSection label="Overview">
        <NavLink to="/app/employer/dashboard" icon={LayoutDashboard} label="My Dashboard" active={pathname === '/app/employer/dashboard'} />
        <NavLink to="/app/employer/analytics" icon={BarChart3}       label="Analytics"    active={pathname.startsWith('/app/employer/analytics')} />
        <NavLink to="/app/employer/calendar"  icon={CalendarDays}    label="Calendar"     active={pathname.startsWith('/app/employer/calendar')} />
      </NavSection>
      <NavSection label="Hiring">
        <NavLink to="/app/employer/jobs"      icon={Briefcase}     label="My Jobs"   active={pathname.startsWith('/app/employer/jobs')} />
        <NavLink to="/app/employer/templates" icon={FileSignature} label="Templates" active={pathname.startsWith('/app/employer/templates')} />
      </NavSection>
      <NavSection label="Candidates">
        <NavLink to="/app/employer/applicants"  icon={Users}          label="Applicants"  active={pathname.startsWith('/app/employer/applicants')} />
        <NavLink to="/app/employer/interviews"  icon={CalendarCheck2} label="Interviews"  active={pathname.startsWith('/app/employer/interviews')} />
        <NavLink to="/app/employer/offers"      icon={FileText}       label="Offers"      active={pathname.startsWith('/app/employer/offers')} />
        <NavLink to="/app/employer/talent-pool" icon={Star}           label="Talent Pool" active={pathname.startsWith('/app/employer/talent-pool')} />
      </NavSection>
      <NavSection label="My Department">
        <NavLink to={deptBase} icon={Building2} label="Dept Overview" active={pathname === deptBase || pathname.startsWith(`${deptBase}/`)} />
      </NavSection>
      <NavSection label="Account">
        <NavLink to="/app/employer/verification" icon={ShieldCheck} label="Verification" active={pathname.startsWith('/app/employer/verification')} />
        <NavLink to="/app/employer/support"      icon={HelpCircle}  label="Support"      active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"              icon={ShieldCheck} label="Security"     active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

function HiringManagerNav({ pathname }: { pathname: string }) {
  return (
    <>
      <NavSection label="My Work">
        <NavLink to="/app/employer/dashboard"   icon={ClipboardList}  label="My Approvals"  active={pathname === '/app/employer/dashboard'} />
        <NavLink to="/app/employer/talent-pool" icon={UserCheck}      label="My Candidates" active={pathname.startsWith('/app/employer/talent-pool')} />
        <NavLink to="/app/employer/calendar"    icon={CalendarCheck2} label="My Interviews" active={pathname.startsWith('/app/employer/calendar')} />
      </NavSection>
      <NavSection label="Account">
        <NavLink to="/app/employer/support" icon={HelpCircle}  label="Support"  active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

function InterviewerNav({ pathname }: { pathname: string }) {
  return (
    <>
      <NavSection label="My Work">
        <NavLink to="/app/employer/calendar"  icon={CalendarCheck2} label="My Schedule" active={pathname.startsWith('/app/employer/calendar')} />
        <NavLink to="/app/employer/dashboard" icon={ScrollText}     label="Scorecards"  active={pathname === '/app/employer/dashboard'} />
      </NavSection>
      <NavSection label="Account">
        <NavLink to="/app/employer/support" icon={HelpCircle}  label="Support"  active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
      </NavSection>
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
      width: 220,
      flexShrink: 0,
      background: '#FFFFFF',
      borderRight: '1px solid #E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/app/employer/dashboard')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' }}>BeginableAI</span>
        </button>
        {onClose && (
          <button onClick={onClose} style={{
            width: 26, height: 26, borderRadius: 6,
            background: '#F3F4F6', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#6B7280',
          }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Company context */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: '#1E3A5F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, color: 'white', flexShrink: 0,
          letterSpacing: '-0.3px',
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 13, fontWeight: 600, color: '#111827',
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{companyName}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            {contextLabel ? (
              <span style={{ fontSize: 11, color: '#6B7280' }}>{contextLabel}</span>
            ) : isApproved ? (
              <><CheckCircle2 size={10} color="#16A34A" /><span style={{ fontSize: 11, color: '#16A34A', fontWeight: 500 }}>Verified</span></>
            ) : (
              <><AlertCircle size={10} color="#D97706" /><span style={{ fontSize: 11, color: '#D97706', fontWeight: 500 }}>Pending</span></>
            )}
          </div>
        </div>
        <ChevronRight size={13} color="#D1D5DB" style={{ flexShrink: 0 }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0', scrollbarWidth: 'none' }}>
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
      <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6' }}>
        <button
          onClick={() => logout.mutate()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '7px 10px', borderRadius: 7,
            background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 400,
            color: '#6B7280', transition: 'background 0.12s, color 0.12s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}
        >
          <LogOut size={14} strokeWidth={1.8} style={{ opacity: 0.7 }} />
          Log out
        </button>
      </div>
    </aside>
  )
}
