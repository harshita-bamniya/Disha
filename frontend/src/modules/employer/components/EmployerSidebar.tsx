import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Building2, Users2, Star,
  BarChart3, CalendarDays, CreditCard, ShieldCheck,
  CheckCircle2, Clock, LogOut, FileSignature, Share2,
  ClipboardList, UserCheck, CalendarCheck2, ScrollText,
  Users, FileText, HelpCircle,
} from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { useEmployerDashboard, useDashboardKpis, useEmployerPermissions } from '../hooks/useJobs'

// ── Primitives ────────────────────────────────────────────────────────────────

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{
        fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase',
        letterSpacing: '1px', padding: '10px 12px 4px', margin: 0,
      }}>{label}</p>
      {children}
    </div>
  )
}

function NavLink({ to, icon: Icon, label, active }: {
  to: string; icon: React.ElementType; label: string; active?: boolean
}) {
  return (
    <Link to={to} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 12px', borderRadius: 10, marginBottom: 1,
      background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
      color: active ? '#3B82F6' : '#374151', textDecoration: 'none',
      fontSize: 13, fontWeight: active ? 700 : 500,
      transition: 'background 0.15s',
    }}
      onMouseOver={e => { if (!active) e.currentTarget.style.background = 'rgba(30,58,95,0.05)' }}
      onMouseOut={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  )
}

// ── Role-specific nav configurations ──────────────────────────────────────────

/** Employer Owner & HR Admin — full navigation */
function FullNav({ pathname, isOwner }: { pathname: string; isOwner: boolean }) {
  return (
    <>
      <NavSection label="Overview">
        <NavLink to="/app/employer/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === '/app/employer/dashboard'} />
        <NavLink to="/app/employer/analytics"  icon={BarChart3}       label="Analytics" active={pathname.startsWith('/app/employer/analytics')} />
        <NavLink to="/app/employer/calendar"   icon={CalendarDays}    label="Calendar"  active={pathname.startsWith('/app/employer/calendar')} />
      </NavSection>

      <NavSection label="Hiring">
        <NavLink to="/app/employer/jobs"      icon={Briefcase}     label="Jobs"      active={pathname.startsWith('/app/employer/jobs')} />
        <NavLink to="/app/employer/templates" icon={FileSignature} label="Templates" active={pathname.startsWith('/app/employer/templates')} />
      </NavSection>

      <NavSection label="Candidates">
        <NavLink to="/app/employer/applicants"  icon={Users}     label="Applicants"  active={pathname.startsWith('/app/employer/applicants')} />
        <NavLink to="/app/employer/interviews"  icon={CalendarCheck2} label="Interviews" active={pathname.startsWith('/app/employer/interviews')} />
        <NavLink to="/app/employer/offers"      icon={FileText}  label="Offers"      active={pathname.startsWith('/app/employer/offers')} />
        <NavLink to="/app/employer/talent-pool" icon={Star}      label="Talent Pool" active={pathname.startsWith('/app/employer/talent-pool')} />
        <NavLink to="/app/employer/referrals"   icon={Share2}    label="Referrals"   active={pathname.startsWith('/app/employer/referrals')} />
      </NavSection>

      <NavSection label="Organization">
        <NavLink to="/app/employer/departments" icon={Building2}  label="Departments"  active={pathname.startsWith('/app/employer/departments')} />
        <NavLink to="/app/employer/company"     icon={Users2}     label="Team"         active={pathname === '/app/employer/company'} />
        <NavLink to="/app/employer/verification" icon={ShieldCheck} label="Verification" active={pathname.startsWith('/app/employer/verification')} />
      </NavSection>

      <NavSection label="Account">
        {isOwner && <NavLink to="/app/employer/subscription" icon={CreditCard} label="Billing" active={pathname.startsWith('/app/employer/subscription')} />}
        <NavLink to="/app/employer/support" icon={HelpCircle} label="Support" active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security" icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

/** Department Head & Dept-scoped Recruiter — scoped navigation */
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
        <NavLink to="/app/employer/jobs"      icon={Briefcase}     label="My Jobs"      active={pathname.startsWith('/app/employer/jobs')} />
        <NavLink to="/app/employer/templates" icon={FileSignature} label="Templates"    active={pathname.startsWith('/app/employer/templates')} />
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
        <NavLink to="/app/employer/verification" icon={ShieldCheck}  label="Verification" active={pathname.startsWith('/app/employer/verification')} />
        <NavLink to="/app/employer/support"      icon={HelpCircle}   label="Support"      active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"              icon={ShieldCheck}  label="Security"     active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

/** Hiring Manager — minimal job-scoped view */
function HiringManagerNav({ pathname }: { pathname: string }) {
  return (
    <>
      <NavSection label="My Work">
        <NavLink to="/app/employer/dashboard"   icon={ClipboardList}  label="My Approvals"  active={pathname === '/app/employer/dashboard'} />
        <NavLink to="/app/employer/talent-pool" icon={UserCheck}      label="My Candidates" active={pathname.startsWith('/app/employer/talent-pool')} />
        <NavLink to="/app/employer/calendar"    icon={CalendarCheck2} label="My Interviews" active={pathname.startsWith('/app/employer/calendar')} />
      </NavSection>

      <NavSection label="Account">
        <NavLink to="/app/employer/support" icon={HelpCircle} label="Support"  active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

/** Interviewer — minimal schedule view */
function InterviewerNav({ pathname }: { pathname: string }) {
  return (
    <>
      <NavSection label="My Work">
        <NavLink to="/app/employer/calendar"    icon={CalendarCheck2} label="My Schedule" active={pathname.startsWith('/app/employer/calendar')} />
        <NavLink to="/app/employer/dashboard"   icon={ScrollText}     label="Scorecards"  active={pathname === '/app/employer/dashboard'} />
      </NavSection>

      <NavSection label="Account">
        <NavLink to="/app/employer/support" icon={HelpCircle} label="Support"  active={pathname.startsWith('/app/employer/support')} />
        <NavLink to="/app/security"         icon={ShieldCheck} label="Security" active={pathname === '/app/security'} />
      </NavSection>
    </>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export default function EmployerSidebar() {
  const { data: dashboard } = useEmployerDashboard()
  const { data: kpis }      = useDashboardKpis()
  const { data: perms }     = useEmployerPermissions()
  const logout    = useLogout()
  const { pathname } = useLocation()
  const navigate  = useNavigate()

  const companyName = dashboard?.company_name ?? '…'
  const isApproved  = dashboard?.is_approved ?? false
  const initial     = companyName.charAt(0).toUpperCase()

  const activeJobs = kpis?.active_jobs ?? dashboard?.active_jobs ?? 0
  const draftJobs  = kpis?.draft_jobs ?? 0
  const totalJobs  = (kpis?.active_jobs ?? 0) + (kpis?.draft_jobs ?? 0) + (kpis?.closed_jobs ?? 0)

  const roleName   = perms?.role_name ?? ''
  const deptId     = perms?.department_id ?? null
  const deptName   = perms?.department_name ?? null
  const isWide     = perms?.is_company_wide ?? true
  const isOwner    = roleName === 'employer_owner' || (!roleName && isWide)

  // Decide which nav configuration to render
  const isHiringManager = roleName === 'hiring_manager'
  const isInterviewer   = roleName === 'interviewer'
  const isDeptScoped    = !isWide && !!deptId && !isHiringManager && !isInterviewer

  // Context label shown below the company name
  const contextLabel = isDeptScoped && deptName
    ? deptName
    : isHiringManager
    ? 'Hiring Manager'
    : isInterviewer
    ? 'Interviewer'
    : null

  return (
    <aside style={{
      width: 248, flexShrink: 0,
      background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(30,58,95,0.07)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflow: 'auto',
      boxShadow: '4px 0 20px rgba(30,58,95,0.04)',
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(30,58,95,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(59,130,246,0.3)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 15 }}>D</span>
          </div>
          <div>
            <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 16, color: '#1E3A5F' }}>BeginablAI</span>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Employer Portal</span>
          </div>
        </div>
      </div>

      {/* Company / context card */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(30,58,95,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(147,197,253,0.2))',
            border: '2px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 14, color: '#3B82F6', flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              {contextLabel ? (
                <span style={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>{contextLabel}</span>
              ) : isApproved ? (
                <><CheckCircle2 size={10} color="#059669" /><span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>Verified</span></>
              ) : (
                <><Clock size={10} color="#D97706" /><span style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>Pending approval</span></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' }}>
        {isHiringManager ? (
          <HiringManagerNav pathname={pathname} />
        ) : isInterviewer ? (
          <InterviewerNav pathname={pathname} />
        ) : isDeptScoped ? (
          <DeptScopedNav pathname={pathname} deptId={deptId!} />
        ) : (
          <FullNav pathname={pathname} isOwner={isOwner} />
        )}

        {/* Job stats mini-panel — only for roles that see Jobs */}
        {!isHiringManager && !isInterviewer && (totalJobs > 0 || activeJobs > 0) && (
          <div
            style={{
              margin: '12px 4px 0', padding: 14,
              background: 'rgba(59,130,246,0.04)',
              border: '1px solid rgba(59,130,246,0.12)',
              borderRadius: 14, cursor: 'pointer',
            }}
            onClick={() => navigate('/app/employer/jobs')}
          >
            <p style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Job Postings</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Total',  value: totalJobs  },
                { label: 'Active', value: activeJobs },
                { label: 'Draft',  value: draftJobs  },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(59,130,246,0.07)', borderRadius: 8, padding: '7px 4px',
                  border: '1px solid rgba(59,130,246,0.1)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(30,58,95,0.06)' }}>
        <button onClick={() => logout.mutate()} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', borderRadius: 9,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 500, color: '#9CA3AF', transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={13} />Log out
        </button>
      </div>
    </aside>
  )
}
