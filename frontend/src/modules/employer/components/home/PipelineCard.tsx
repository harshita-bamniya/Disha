import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { PipelineStage } from '@/api/employerHome'
import { colors } from '@/design-system/tokens'
import { card, cardSub, cardTitle } from '@/shared/components/dashboard/styles'
import { stageColors } from '@/shared/components/dashboard/palette'

/** Where candidates are right now across the open jobs: one stacked bar, so the shape of the pipeline reads at a glance. */
export default function PipelineCard({ stages }: { stages: PipelineStage[] }) {
  const total = stages.reduce((n, s) => n + s.count, 0)
  return (
    <section style={{ ...card, padding: '18px 20px' }} aria-labelledby="pipeline-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 id="pipeline-title" style={cardTitle}>Pipeline now</h2>
          <p style={cardSub}>{total === 0 ? 'Nobody is in progress yet' : `${total} candidates in progress`}</p>
        </div>
        <Link to="/app/employer/applicants" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: colors.state.info, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          All applicants <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      {total > 0 && (
        <>
          <div role="img" aria-label={stages.map(s => `${s.label} ${s.count}`).join(', ')}
            style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 16, gap: 2, background: colors.surface.elevated }}>
            {stages.filter(s => s.count > 0).map(s => (
              <span key={s.key} title={`${s.label}: ${s.count}`} style={{ flex: s.count, background: stageColors[s.key], minWidth: 6 }} />
            ))}
          </div>
          <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stages.map(s => (
              <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <i aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: stageColors[s.key], flexShrink: 0 }} />
                <span style={{ flex: 1, color: colors.text.ink }}>{s.label}</span>
                <span style={{ color: colors.text.muted, fontSize: 12 }}>{Math.round((s.count / total) * 100)}%</span>
                <strong style={{ minWidth: 26, textAlign: 'right', color: colors.text.ink }}>{s.count}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
