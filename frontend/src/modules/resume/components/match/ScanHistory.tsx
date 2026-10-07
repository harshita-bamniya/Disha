import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import { colors } from '@/design-system/tokens'
import type { ScanSummary } from '@/api/resumeMatch'
import { bandBadge } from './matchTheme'

interface Props {
  scans: ScanSummary[]
  currentId?: string
  onOpen: (scanId: string) => void
}

export default function ScanHistory({ scans, currentId, onOpen }: Props) {
  if (scans.length === 0) return null
  return (
    <Card padding={20}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 12px' }}>Your checks for this job</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scans.map(s => (
          <li key={s.id}>
            <button
              onClick={() => onOpen(s.id)}
              aria-current={s.id === currentId}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                borderRadius: 10, cursor: 'pointer',
                background: s.id === currentId ? colors.state.infoBg : colors.surface.card,
                border: `1px solid ${s.id === currentId ? colors.brand.navy : colors.border.default}`,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 800, color: colors.text.ink, minWidth: 30 }}>{s.score}</span>
              <Badge color={bandBadge[s.band]}>{s.band}</Badge>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: colors.text.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.resume_label || 'Resume'}
              </span>
              {s.score_delta !== null && s.score_delta !== 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: s.score_delta > 0 ? colors.state.success : colors.state.danger }}>
                  {s.score_delta > 0 ? '+' : ''}{s.score_delta}
                </span>
              )}
              <span style={{ fontSize: 11.5, color: colors.text.muted, flexShrink: 0 }}>
                {new Date(s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
