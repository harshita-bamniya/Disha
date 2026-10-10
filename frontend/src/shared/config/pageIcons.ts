import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Briefcase, Map, FileText, Heart, MessageSquare, Brain, HelpCircle,
  ShieldCheck, CalendarDays, Building2, Users2, Users, CalendarCheck2, ScanSearch, Star,
  Share2, CreditCard, FileSignature, Compass, Bookmark, Layers, UserRound, GraduationCap, Sparkles,
} from 'lucide-react'

/**
 * Icon shown in the page header when a page doesn't pass its own. Mirrors the
 * sidebar's icons so a section looks the same in the nav and in its header.
 * First matching prefix wins, so list the more specific paths first.
 */
const PAGE_ICONS: [prefix: string, icon: LucideIcon][] = [
  ['/app/jobs/applications', FileText],
  ['/app/jobs/saved', Bookmark],
  ['/app/jobs', Briefcase],
  ['/app/dashboard', LayoutDashboard],
  ['/app/profile', UserRound],
  ['/app/roles', Compass],
  ['/app/roadmap', Map],
  ['/app/learning-setup', GraduationCap],
  ['/app/quiz', GraduationCap],
  ['/app/companion', Heart],
  ['/app/resume', FileText],
  ['/app/interview', MessageSquare],
  ['/app/counsellor', Brain],
  ['/app/support', HelpCircle],
  ['/app/pricing', Sparkles],

  ['/app/employer/dashboard', LayoutDashboard],
  ['/app/employer/calendar', CalendarDays],
  ['/app/employer/jobs', Briefcase],
  ['/app/employer/pipeline', Briefcase],
  ['/app/employer/templates', FileSignature],
  ['/app/employer/applicants', Users],
  ['/app/employer/interviews', CalendarCheck2],
  ['/app/employer/verified-interviews', ScanSearch],
  ['/app/employer/offers', FileText],
  ['/app/employer/talent-pool', Star],
  ['/app/employer/referrals', Share2],
  ['/app/employer/profile', Building2],
  ['/app/employer/departments', Layers],
  ['/app/employer/company', Users2],
  ['/app/employer/verification', ShieldCheck],
  ['/app/employer/subscription', CreditCard],
  ['/app/employer/support', HelpCircle],
]

export function iconForPath(pathname: string): LucideIcon | undefined {
  return PAGE_ICONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1]
}
