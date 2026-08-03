/**
 * Employer portal design system tokens.
 * Import `DS` and spread or reference values for consistent styling.
 */
import type React from 'react'

// ── Color palette ──────────────────────────────────────────────────────────────
export const C = {
  bg:          '#F6F7F9',
  surface:     '#FFFFFF',
  border:      '#E5E7EB',
  borderLight: '#F3F4F6',
  ink1:        '#111827',
  ink2:        '#6B7280',
  ink3:        '#9CA3AF',
  brand:       '#0F1729',
  accent:      '#4338CA',
  accentBg:    '#EEF2FF',
  green:       '#16A34A',
  greenBg:     '#F0FDF4',
  amber:       '#D97706',
  amberBg:     '#FFFBEB',
  red:         '#DC2626',
  redBg:       '#FEF2F2',
  blue:        '#2563EB',
  blueBg:      '#EFF6FF',
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
export const DS = {
  // Page shell
  pageWrap: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
    height: '100vh', overflow: 'hidden',
  } as React.CSSProperties,

  // Top bar
  topbar: {
    height: 52, background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    padding: '0 24px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 20,
  } as React.CSSProperties,

  pageTitle: { fontSize: 14, fontWeight: 600, color: C.ink1, margin: 0, letterSpacing: '-0.1px' } as React.CSSProperties,
  pageSub:   { fontSize: 12, color: C.ink3, margin: '1px 0 0' } as React.CSSProperties,

  // Content area
  content: {
    flex: 1, overflow: 'auto', background: C.bg,
  } as React.CSSProperties,

  // Filter / toolbar bar below topbar
  toolbar: {
    background: C.surface, borderBottom: `1px solid ${C.border}`,
    padding: '8px 24px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
  } as React.CSSProperties,

  inner: { padding: '16px 24px' } as React.CSSProperties,

  // Card
  card: {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    overflow: 'hidden',
  } as React.CSSProperties,

  cardPad: { padding: 20 } as React.CSSProperties,

  // Card header row
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', borderBottom: `1px solid ${C.borderLight}`,
  } as React.CSSProperties,

  // Table
  tHead: {
    display: 'grid', padding: '8px 16px',
    background: '#FAFAFA', borderBottom: `1px solid ${C.border}`,
    fontSize: 11, fontWeight: 600, color: C.ink2,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  } as React.CSSProperties,

  tRow: {
    display: 'grid', alignItems: 'center',
    padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`,
    fontSize: 13, color: C.ink1, transition: 'background 0.1s',
    cursor: 'pointer',
  } as React.CSSProperties,

  // Buttons
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 7,
    background: C.brand, color: '#F9FAFB',
    border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  } as React.CSSProperties,

  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 7,
    background: C.surface, color: C.ink1,
    border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  } as React.CSSProperties,

  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 6,
    background: 'transparent', color: C.ink2,
    border: 'none', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
  } as React.CSSProperties,

  btnIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 6,
    background: 'transparent', border: `1px solid ${C.border}`,
    color: C.ink2, cursor: 'pointer', flexShrink: 0,
  } as React.CSSProperties,

  // Inputs
  input: {
    width: '100%', padding: '7px 10px',
    border: `1px solid ${C.border}`, borderRadius: 7,
    fontSize: 13, color: C.ink1,
    background: C.surface, outline: 'none',
    boxSizing: 'border-box',
  } as React.CSSProperties,

  select: {
    padding: '6px 10px',
    border: `1px solid ${C.border}`, borderRadius: 7,
    fontSize: 13, color: C.ink1,
    background: C.surface, outline: 'none', cursor: 'pointer',
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
