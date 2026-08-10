/**
 * Employer portal design system tokens.
 * Import `DS` and spread or reference values for consistent styling.
 *
 * Color constants below are aliased to design-system/tokens.ts values so
 * existing usages throughout the employer module automatically produce the
 * correct aspirant-aligned output. Migrate call-sites to import directly
 * from design-system/tokens.ts over time.
 */
import type React from 'react'
import { colors, radius, spacing } from '@/design-system/tokens'

// ── Color palette ──────────────────────────────────────────────────────────────
export const C = {
  // Page / surface — aligned to aspirant system
  bg:          colors.surface.bg,       // was #F6F7F9 → now #F4F5F7
  surface:     colors.surface.card,     // #FFFFFF (unchanged)
  border:      colors.border.default,   // was #E5E7EB → now rgba(0,0,0,0.08)
  borderLight: colors.border.default,   // was #F3F4F6 → now rgba(0,0,0,0.08)

  // Text — aligned to aspirant ink scale
  ink1:        colors.text.ink,         // was #111827 → now #1E3A5F
  ink2:        colors.text.inkSoft,     // was #6B7280 → now #475569
  ink3:        colors.text.muted,       // was #9CA3AF → now #94A3B8

  // Brand — aligned to aspirant brand navy
  brand:       colors.brand.navy,       // was #0F1729 → now #1A2744
  accent:      colors.state.info,       // was #4338CA indigo → now #2563EB info-blue
  accentBg:    colors.state.infoBg,     // was #EEF2FF → now #EFF6FF

  // Status colors — kept as-is (match design-system/tokens state values)
  green:       colors.state.success,
  greenBg:     colors.state.successBg,
  amber:       colors.state.warning,
  amberBg:     colors.state.warningBg,
  red:         colors.state.danger,
  redBg:       colors.state.dangerBg,
  blue:        colors.state.info,
  blueBg:      colors.state.infoBg,
} as const

// ── Status system ──────────────────────────────────────────────────────────────
export const STATUS: Record<string, { color: string; label: string }> = {
  // Job statuses
  published:            { color: C.green,  label: 'Active'      },
  active:               { color: C.green,  label: 'Active'      },
  draft:                { color: C.ink3,   label: 'Draft'       },
  paused:               { color: C.amber,  label: 'Paused'      },
  closed:               { color: C.red,    label: 'Closed'      },
  archived:             { color: C.ink3,   label: 'Archived'    },
  // Application statuses
  applied:              { color: C.blue,   label: 'Applied'     },
  screening:            { color: C.amber,  label: 'Screening'   },
  shortlisted:          { color: '#7C3AED', label: 'Shortlisted' },
  interview_scheduled:  { color: '#0891B2', label: 'Interview'   },
  interview_completed:  { color: '#0891B2', label: 'Interviewed' },
  offer_sent:           { color: C.amber,  label: 'Offer Sent'  },
  hired:                { color: C.green,  label: 'Hired'       },
  rejected:             { color: C.red,    label: 'Rejected'    },
  withdrawn:            { color: C.ink3,   label: 'Withdrawn'   },
  // Interview statuses
  scheduled:            { color: C.blue,   label: 'Scheduled'   },
  completed:            { color: C.green,  label: 'Completed'   },
  canceled:             { color: C.red,    label: 'Canceled'    },
  // Offer statuses
  sent:                 { color: C.amber,  label: 'Sent'        },
  accepted:             { color: C.green,  label: 'Accepted'    },
  declined:             { color: C.red,    label: 'Declined'    },
  // Ticket statuses
  open:                 { color: C.blue,   label: 'Open'        },
  pending:              { color: C.amber,  label: 'Pending'     },
  resolved:             { color: C.green,  label: 'Resolved'    },
}

// ── Shared style objects ───────────────────────────────────────────────────────
// Page shell (pageWrap/topbar/pageTitle/pageSub/content) removed — EmployerLayout
// + shared PageHeader now own the layout shell and typography for every page.
export const DS = {
  // Filter / toolbar bar below the page header
  toolbar: {
    background: C.surface, borderBottom: `1px solid ${colors.border.default}`,
    padding: `8px ${spacing.layout}px`, display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
  } as React.CSSProperties,

  // Card
  card: {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: radius.xl,  // 16px — matches aspirant cards
    overflow: 'hidden',
  } as React.CSSProperties,

  // Card header row
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', borderBottom: `1px solid ${C.borderLight}`,
  } as React.CSSProperties,

  // Table
  tHead: {
    display: 'grid', padding: '8px 16px',
    background: colors.surface.elevated, borderBottom: `1px solid ${C.border}`,
    fontSize: 11, fontWeight: 600, color: C.ink2,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  } as React.CSSProperties,
}

// ── Shared component helpers ───────────────────────────────────────────────────

/** Colored dot + label status indicator. */
export function statusDot(key: string) {
  const s = STATUS[key] ?? { color: C.ink3, label: key }
  return { color: s.color, label: s.label }
}

/** Format date as "12 Jul 2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format date as "12 Jul" (short) */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Format time */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

/** Compact number formatter */
export function fmtNum(n: number | null | undefined, fallback = '—'): string {
  if (n == null) return fallback
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/** Initials from name */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
