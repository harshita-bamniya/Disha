import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Briefcase, Map, FileText, Heart, FolderOpen,
  MessageSquare, Brain, HelpCircle, ShieldCheck,
  BarChart3, CalendarDays, Building2, Users2,
  Users, CalendarCheck2, Star, Share2, CreditCard, FileSignature,
  ClipboardList, UserCheck, ScrollText,
  Compass, Bell, UserCog, KeyRound, Activity,
  Award, Bot, Plug, MonitorDot, Settings, Clock, BarChart, IndianRupee,
  HeadphonesIcon, BarChart2,
} from 'lucide-react'

export interface NavLeaf {
  label: string
  path: string
  icon: LucideIcon
  badge?: number
  /** Highlight for any pathname starting with this prefix, instead of exact/startsWith path matching. */
  matchPrefix?: string
  /** false = active on any pathname starting with `path`. Default true = exact match. */
  exact?: boolean
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  basePath: string
  children: NavLeaf[]
}

export type NavItem = NavLeaf | NavGroup
export const isNavGroup = (item: NavItem): item is NavGroup => 'children' in item

export interface NavSection {
  label?: string
  items: NavItem[]
}

// ── Aspirant ─────────────────────────────────────────────────────────────────

export function buildAspirantNav(): NavSection[] {
  return [
    {
      label: 'Navigation',
      items: [
        { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
        { label: 'Jobs', path: '/app/jobs', icon: Briefcase },
        { label: 'My Roadmap', path: '/app/roadmap/history', icon: Map, matchPrefix: '/app/roadmap' },
        { label: 'My Applications', path: '/app/jobs/applications', icon: FileText },
        { label: 'Your Companion', path: '/app/companion', icon: Heart },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Resume Builder', path: '/app/resume', icon: FileText },
        { label: 'Resume Library', path: '/app/resume-library', icon: FolderOpen },
        { label: 'AI Interview', path: '/app/interview/setup', icon: MessageSquare },
        { label: 'AI Counsellor', path: '/app/counsellor', icon: Brain },
      ],
    },
    {
      items: [
        { label: 'Support', path: '/app/support', icon: HelpCircle },
        { label: 'Security', path: '/app/security', icon: ShieldCheck },
      ],
    },
  ]
}

// ── Employer ─────────────────────────────────────────────────────────────────

export interface EmployerNavContext {
  isOwner: boolean
  isDeptScoped: boolean
  isHiringManager: boolean
  isInterviewer: boolean
  deptId: string | null
  activeJobs: number
}

export function buildEmployerNav(ctx: EmployerNavContext): NavSection[] {
  const { isOwner, isDeptScoped, isHiringManager, isInterviewer, deptId, activeJobs } = ctx

  if (isHiringManager) {
    return [
      { label: 'My Work', items: [
        { label: 'My Approvals', path: '/app/employer/dashboard', icon: ClipboardList },
        { label: 'My Candidates', path: '/app/employer/talent-pool', icon: UserCheck, exact: false },
        { label: 'My Interviews', path: '/app/employer/calendar', icon: CalendarCheck2, exact: false },
      ] },
      { label: 'Account', items: [
        { label: 'Support', path: '/app/employer/support', icon: HelpCircle, exact: false },
        { label: 'Security', path: '/app/security', icon: ShieldCheck },
      ] },
    ]
  }

  if (isInterviewer) {
    return [
      { label: 'My Work', items: [
        { label: 'My Schedule', path: '/app/employer/calendar', icon: CalendarCheck2, exact: false },
        { label: 'Scorecards', path: '/app/employer/dashboard', icon: ScrollText },
      ] },
      { label: 'Account', items: [
        { label: 'Support', path: '/app/employer/support', icon: HelpCircle, exact: false },
        { label: 'Security', path: '/app/security', icon: ShieldCheck },
      ] },
    ]
  }

  if (isDeptScoped && deptId) {
    const deptBase = `/app/employer/departments/${deptId}`
    return [
      { label: 'Overview', items: [
        { label: 'My Dashboard', path: '/app/employer/dashboard', icon: LayoutDashboard },
        { label: 'Analytics', path: '/app/employer/analytics', icon: BarChart3, exact: false },
        { label: 'Calendar', path: '/app/employer/calendar', icon: CalendarDays, exact: false },
      ] },
      { label: 'Hiring', items: [
        { label: 'My Jobs', path: '/app/employer/jobs', icon: Briefcase, exact: false },
        { label: 'Templates', path: '/app/employer/templates', icon: FileSignature, exact: false },
      ] },
      { label: 'Candidates', items: [
        { label: 'Applicants', path: '/app/employer/applicants', icon: Users, exact: false },
        { label: 'Interviews', path: '/app/employer/interviews', icon: CalendarCheck2, exact: false },
        { label: 'Offers', path: '/app/employer/offers', icon: FileText, exact: false },
        { label: 'Talent Pool', path: '/app/employer/talent-pool', icon: Star, exact: false },
      ] },
      { label: 'My Department', items: [
        { label: 'Dept Overview', path: deptBase, icon: Building2, exact: false },
      ] },
      { label: 'Account', items: [
        { label: 'Verification', path: '/app/employer/verification', icon: ShieldCheck, exact: false },
        { label: 'Support', path: '/app/employer/support', icon: HelpCircle, exact: false },
        { label: 'Security', path: '/app/security', icon: ShieldCheck },
      ] },
    ]
  }

  return [
    { label: 'Overview', items: [
      { label: 'Dashboard', path: '/app/employer/dashboard', icon: LayoutDashboard },
      { label: 'Analytics', path: '/app/employer/analytics', icon: BarChart3, exact: false },
      { label: 'Calendar', path: '/app/employer/calendar', icon: CalendarDays, exact: false },
    ] },
    { label: 'Hiring', items: [
      { label: 'Jobs', path: '/app/employer/jobs', icon: Briefcase, exact: false, badge: activeJobs },
      { label: 'Templates', path: '/app/employer/templates', icon: FileSignature, exact: false },
    ] },
    { label: 'Candidates', items: [
      { label: 'Applicants', path: '/app/employer/applicants', icon: Users, exact: false },
      { label: 'Interviews', path: '/app/employer/interviews', icon: CalendarCheck2, exact: false },
      { label: 'Offers', path: '/app/employer/offers', icon: FileText, exact: false },
      { label: 'Talent Pool', path: '/app/employer/talent-pool', icon: Star, exact: false },
      { label: 'Referrals', path: '/app/employer/referrals', icon: Share2, exact: false },
    ] },
    { label: 'Organization', items: [
      { label: 'Departments', path: '/app/employer/departments', icon: Building2, exact: false },
      { label: 'Team', path: '/app/employer/company', icon: Users2 },
      { label: 'Verification', path: '/app/employer/verification', icon: ShieldCheck, exact: false },
    ] },
    { label: 'Account', items: [
      ...(isOwner ? [{ label: 'Billing', path: '/app/employer/subscription', icon: CreditCard, exact: false }] : []),
      { label: 'Support', path: '/app/employer/support', icon: HelpCircle, exact: false },
      { label: 'Security', path: '/app/security', icon: ShieldCheck },
    ] },
  ]
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function buildAdminNav(role: string): NavSection[] {
  const has = (roles: string[]) => roles.includes(role)

  const employerChildren: NavLeaf[] = [
    { label: 'All Employers', path: '/admin/employers', icon: Building2 },
    ...(has(['admin', 'super_admin', 'verification_officer']) ? [
      { label: 'KYC Queue', path: '/admin/kyc', icon: FileText },
      { label: 'Pending Approvals', path: '/admin/employers?status=pending', icon: Clock },
      { label: 'Verifications', path: '/admin/employers?tab=documents', icon: ShieldCheck },
    ] : []),
    ...(has(['admin', 'super_admin', 'finance_manager']) ? [
      { label: 'Employer Reports', path: '/admin/reports/employers', icon: BarChart },
      { label: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
    ] : []),
  ]

  const operations: NavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    ...(has(['admin', 'super_admin', 'verification_officer']) ? [
      { label: 'Employers', icon: Building2, basePath: '/admin/employers', children: employerChildren } as NavGroup,
    ] : []),
    ...(has(['admin', 'super_admin', 'moderator']) ? [
      { label: 'Jobs', icon: Briefcase, basePath: '/admin/jobs', children: [
        { label: 'All Jobs', path: '/admin/jobs', icon: Briefcase },
      ] } as NavGroup,
    ] : []),
    ...(has(['admin', 'super_admin', 'moderator', 'support_executive']) ? [
      { label: 'Candidates', icon: Users, basePath: '/admin/candidates', children: [
        { label: 'All Candidates', path: '/admin/candidates', icon: Users },
      ] } as NavGroup,
    ] : []),
    ...(has(['admin', 'super_admin', 'support_executive']) ? [
      { label: 'Support', icon: HeadphonesIcon, basePath: '/admin/support', children: [
        { label: 'Tickets', path: '/admin/support', icon: HeadphonesIcon },
      ] } as NavGroup,
    ] : []),
    ...(has(['admin', 'super_admin', 'finance_manager']) ? [
      { label: 'Reports', icon: BarChart2, basePath: '/admin/reports', children: [
        { label: 'Overview', path: '/admin/reports', icon: BarChart2 },
        { label: 'Employer Reports', path: '/admin/reports/employers', icon: Building2 },
        { label: 'Job Reports', path: '/admin/reports/jobs', icon: Briefcase },
        { label: 'Candidate Reports', path: '/admin/reports/candidates', icon: Users },
        { label: 'Financial', path: '/admin/reports/financial', icon: IndianRupee },
      ] } as NavGroup,
    ] : []),
  ]

  const configAll: (NavLeaf & { roles?: string[] })[] = [
    { label: 'Career Tracks', path: '/admin/career-tracks', icon: Compass },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell, roles: ['admin', 'super_admin'] },
    { label: 'Sub-Admins', path: '/admin/sub-admins', icon: UserCog, roles: ['super_admin'] },
    { label: 'Roles', path: '/admin/roles', icon: KeyRound, roles: ['super_admin'] },
    { label: 'Audit Log', path: '/admin/audit-log', icon: Activity },
    { label: 'Subscriptions', path: '/admin/subscriptions', icon: Award },
    { label: 'AI Config', path: '/admin/ai-config', icon: Bot, roles: ['super_admin'] },
    { label: 'Integrations', path: '/admin/integrations', icon: Plug, roles: ['super_admin'] },
    { label: 'System', path: '/admin/system', icon: MonitorDot, roles: ['super_admin'] },
    { label: 'Settings', path: '/admin/settings', icon: Settings, roles: ['super_admin'] },
  ]
  const configuration = configAll.filter(item => !item.roles || item.roles.includes(role))

  const sections: NavSection[] = [{ label: 'Operations', items: operations }]
  if (configuration.length) sections.push({ label: 'Configuration', items: configuration })
  return sections
}
