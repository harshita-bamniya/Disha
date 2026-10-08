import type { ReactNode } from 'react'
import { AlertCircle, Download, RefreshCw, Table2, BarChart3 } from 'lucide-react'
import { colors, shadows } from '@/design-system/tokens'

// Shared frame for the command-center charts: same card, header controls and six states
// (loading / empty / error / low data / chart / table) so the page never jumps.

export type ViewMode = 'chart' | 'table'

interface Props {
  title: string
  question: string
  controls?: ReactNode
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  onExport?: () => void
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyMessage?: string | null      // non-null = show the empty state
  emptyHint?: string
  skeleton: ReactNode               // same geometry as the finished chart
  table: ReactNode
  footer?: ReactNode
  children: ReactNode               // the chart
}

const ctrlBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: colors.text.inkSoft,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
} as const

export function ChartCard({
  title, question, controls, view, onViewChange, onExport, isLoading, isError, onRetry,
  emptyMessage, emptyHint, skeleton, table, footer, children,
}: Props) {
  let body: ReactNode
  if (isLoading) body = skeleton
  else if (isError) {
    body = (
      <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '36px 0', textAlign: 'center' }}>
        <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-chart-bad)' }} />
        <span style={{ fontSize: 13, color: colors.text.inkSoft }}>Couldn't load {title.toLowerCase()}</span>
        {onRetry && <button type="button" onClick={onRetry} style={ctrlBtn}><RefreshCw className="w-3.5 h-3.5" />Retry</button>}
      </div>
    )
  } else if (emptyMessage != null) {
    body = (
      <div style={{ padding: '36px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink }}>{emptyMessage}</div>
        {emptyHint && <div style={{ fontSize: 12, color: colors.text.inkSoft, marginTop: 4 }}>{emptyHint}</div>}
      </div>
    )
  } else body = view === 'table' ? table : children

  const canSwitch = !isLoading && !isError && emptyMessage == null

  return (
    <section
      aria-label={title}
      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, boxShadow: shadows.card, padding: 20, minWidth: 0 }}
    >
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 16, fontWeight: 700, color: colors.text.ink, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '2px 0 0' }}>{question}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {controls}
          <button
            type="button" disabled={!canSwitch} style={{ ...ctrlBtn, opacity: canSwitch ? 1 : 0.5 }}
            aria-pressed={view === 'table'}
            onClick={() => onViewChange(view === 'table' ? 'chart' : 'table')}
          >
            {view === 'table' ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {view === 'table' ? 'Chart' : 'Table'}
          </button>
          {onExport && (
            <button type="button" disabled={!canSwitch} onClick={onExport} style={{ ...ctrlBtn, opacity: canSwitch ? 1 : 0.5 }}>
              <Download className="w-3.5 h-3.5" />CSV
            </button>
          )}
        </div>
      </header>
      <div>{body}</div>
      {footer && canSwitch && <footer style={{ marginTop: 14, fontSize: 12, color: colors.text.inkSoft }}>{footer}</footer>}
    </section>
  )
}

/** Pill-shaped segmented toggle (Aspirants / Employers, lenses). */
export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'inline-flex', padding: 2, borderRadius: 9, background: colors.surface.bg }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            style={{
              height: 26, padding: '0 12px', borderRadius: 7, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: active ? '#fff' : 'transparent', color: active ? colors.text.ink : colors.text.inkSoft,
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

/** Pill chip: good / warn / bad / neutral. Status is always paired with text or a glyph. */
export function Chip({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  const map = {
    good:    { fg: 'var(--color-chart-good-text)',   bg: 'rgba(22,163,74,0.12)' },
    warn:    { fg: 'var(--color-chart-warn-strong)', bg: 'rgba(217,119,6,0.14)' },
    bad:     { fg: 'var(--color-chart-bad)',         bg: 'rgba(220,38,38,0.10)' },
    neutral: { fg: 'var(--color-chart-neutral)',     bg: 'rgba(100,116,139,0.12)' },
  }[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, fontWeight: 500, color: map.fg, background: map.bg, whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}
