import Card from '@/shared/components/data-display/Card'
import ProgressBar from '@/shared/components/data-display/ProgressBar'
import ScoreRing from '@/shared/components/data-display/ScoreRing'
import { colors } from '@/design-system/tokens'
import type { ResumeQuality } from '@/api/resumeMatch'
import { verdictColor } from './matchTheme'

const labelColor: Record<ResumeQuality['label'], string> = {
  Strong: colors.state.success,
  Decent: colors.state.warning,
  'Needs work': colors.state.danger,
}

export default function QualityCard({ quality }: { quality: ResumeQuality }) {
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <ScoreRing value={quality.score} size={72} stroke={7} color={labelColor[quality.label]} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: 0 }}>
            Resume writing quality: {quality.label}
          </h3>
          <p style={{ fontSize: 12.5, color: colors.text.muted, margin: '4px 0 0', lineHeight: 1.5 }}>
            This is separate from the match score. It shows how specific and measurable your lines are, for any job.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {quality.checks.map(c => (
          <div key={c.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ fontWeight: 600, color: colors.text.ink }}>{c.label}</span>
              <span style={{ color: colors.text.muted }}>{Math.round(c.score * 100)}%</span>
            </div>
            <ProgressBar value={c.score * 100} color={verdictColor(c.score)} height={6} />
            {c.detail && <p style={{ fontSize: 12, color: colors.text.inkSoft, margin: '5px 0 0' }}>{c.detail}</p>}
            {c.score < 0.7 && c.examples.length > 0 && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: colors.text.muted, lineHeight: 1.5 }}>
                {c.examples.map(e => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
