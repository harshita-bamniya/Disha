import { User, GraduationCap, ClipboardList, Briefcase, Zap, Target, Brain, FileText, type LucideIcon } from 'lucide-react'

export const PROFILE_KEY = ['onboarding', 'profile'] as const

export const SALARY_OPTIONS = [
  { label: 'Up to ₹5 LPA', min: 0,  max: 5   },
  { label: '₹5–10 LPA',    min: 5,  max: 10  },
  { label: '₹10–20 LPA',   min: 10, max: 20  },
  { label: '₹20–40 LPA',   min: 20, max: 40  },
  { label: '₹40 LPA+',     min: 40, max: 500 },
]

export const SECTION_META: Record<string, { Icon: LucideIcon; color: string; bg: string }> = {
  'Personal Info':      { Icon: User,          color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Education':          { Icon: GraduationCap, color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'UPSC Journey':       { Icon: ClipboardList, color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Work Experience':    { Icon: Briefcase,     color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Skills':             { Icon: Zap,           color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Career Preferences': { Icon: Target,        color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'Mindset Assessment': { Icon: Brain,         color: '#1A2744', bg: 'rgba(26,39,68,0.07)' },
  'fallback':           { Icon: FileText,      color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
}
