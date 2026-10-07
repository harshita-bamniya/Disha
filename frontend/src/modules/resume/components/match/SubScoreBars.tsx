import Card from '@/shared/components/data-display/Card'
import ProgressBar from '@/shared/components/data-display/ProgressBar'
import { colors } from '@/design-system/tokens'
import type { SubScore } from '@/api/resumeMatch'
import { verdictColor } from './matchTheme'

export default function SubScoreBars({ subScores }: { subScores: SubScore[] }) {
  const scored = subScores.filter(s => s.score !== null)
  return (
    <Card padding={20}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 14px' }}>Score breakdown</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scored.map(s => (
          <div key={s.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ fontWeight: 600, color: colors.text.ink }}>{s.label}</span>
              <span style={{ color: colors.text.muted }}>
                {Math.round((s.score ?? 0) * 100)}% · counts for {Math.round(s.effective_weight * 100)}%
              </span>
            </div>
            <ProgressBar value={(s.score ?? 0) * 100} color={verdictColor(s.score ?? 0)} height={7} />
          </div>
        ))}
      </div>
    </Card>
  )
}
