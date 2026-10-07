import type { CSSProperties, ReactNode } from 'react'
import { colors } from '@/design-system/tokens'
import '../interview.css'

const d = colors.dark

const THEME_VARS = {
  '--iv-bg': d.bg,
  '--iv-surface': d.surface,
  '--iv-surface-raised': d.surfaceRaised,
  '--iv-border': d.border,
  '--iv-border-strong': d.borderStrong,
  '--iv-text': d.text,
  '--iv-text-muted': d.textMuted,
  '--iv-text-dim': d.textDim,
  '--iv-accent': d.accent,
  '--iv-accent-soft': d.accentSoft,
  '--iv-success': d.success,
  '--iv-danger': d.danger,
  '--iv-disabled': d.disabledBg,
} as CSSProperties

interface Props {
  children: ReactNode
  /** Right side of the header (e.g. the Exit button in the live room). */
  headerRight?: ReactNode
  narrow?: boolean
}

export default function InterviewShell({ children, headerRight, narrow }: Props) {
  return (
    <div className="iv-root" style={THEME_VARS}>
      <header className="iv-header">
        <div className="iv-header-inner">
          <span className="iv-wordmark">Begina<span>bl</span>AI</span>
          {headerRight}
        </div>
      </header>
      <main className={`iv-main${narrow ? ' iv-narrow' : ''}`}>{children}</main>
    </div>
  )
}
