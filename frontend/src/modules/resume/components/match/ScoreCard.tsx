import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react'
import ScoreRing from '@/shared/components/data-display/ScoreRing'
import Badge from '@/shared/components/data-display/Badge'
import Card from '@/shared/components/data-display/Card'
import { colors } from '@/design-system/tokens'
import type { ScanOut } from '@/api/resumeMatch'
import { bandBadge, bandColor } from './matchTheme'

export default function ScoreCard({ scan }: { scan: ScanOut }) {
  const { report } = scan
  const delta = scan.score_delta

  return (
    <Card padding={24}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
        <ScoreRing value={report.score} size={120} stroke={10} color={bandColor[report.band]} label="of 100" />

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: colors.text.ink }}>{report.band} match</span>
            <Badge color={bandBadge[report.band]}>{report.band}</Badge>
            {delta !== null && delta !== 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                color: delta > 0 ? colors.state.success : colors.state.danger,
              }}>
                {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {delta > 0 ? '+' : ''}{delta} since your last check
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: colors.text.inkSoft, margin: '6px 0 12px', lineHeight: 1.5 }}>
            {report.band_message}
          </p>
          <p style={{ fontSize: 13, color: colors.text.ink, margin: 0, fontWeight: 600 }}>
            Must-have requirements fully met: {report.must_haves_met} of {report.must_haves_total}
            {report.must_haves_partial > 0 && (
              <span style={{ fontWeight: 500, color: colors.text.inkSoft }}> · {report.must_haves_partial} more with an equivalent or weak match</span>
            )}
          </p>
          <p style={{ fontSize: 11, color: colors.text.muted, margin: '8px 0 0' }}>
            An estimate based on your resume and this job description. It is not a prediction of the hiring outcome.
          </p>
        </div>
      </div>

      {report.cap_reasons.length > 0 && (
        <div role="alert" style={{
          marginTop: 18, padding: '12px 14px', borderRadius: 10,
          background: colors.state.dangerBg, border: `1px solid ${colors.state.danger}33`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.state.danger, fontWeight: 700, fontSize: 13 }}>
            <AlertTriangle size={15} /> Score limited by a hard requirement
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 22, fontSize: 13, color: colors.text.ink, lineHeight: 1.6 }}>
            {report.cap_reasons.map(r => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      {report.low_signal && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start',
          background: colors.state.infoBg, border: `1px solid ${colors.state.info}33`,
          fontSize: 12.5, color: colors.text.ink, lineHeight: 1.5,
        }}>
          <Info size={15} color={colors.state.info} style={{ flexShrink: 0, marginTop: 1 }} />
          This job lists few specific requirements, so the score is less precise than usual.
        </div>
      )}

      {report.to_confirm.length > 0 && (
        <p style={{ fontSize: 12.5, color: colors.text.inkSoft, margin: '14px 0 0', lineHeight: 1.5 }}>
          <strong>Confirm before you apply:</strong> {report.to_confirm.join(', ')}. A resume can&apos;t show these.
        </p>
      )}
    </Card>
  )
}
