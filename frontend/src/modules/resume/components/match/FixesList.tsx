import { ArrowRight, Map, Sparkles } from 'lucide-react'
import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import { colors } from '@/design-system/tokens'
import type { Fix, RoadmapLink } from '@/api/resumeMatch'
import { fixTypeBadge, fixTypeLabel } from './matchTheme'

interface Props {
  fixes: Fix[]
  roadmap: RoadmapLink | null
  onImprove: (requirement: string) => void
  onRoadmap: (requirement: string, inRoadmap: boolean) => void
  roadmapBusy?: boolean
}

export default function FixesList({ fixes, roadmap, onImprove, onRoadmap, roadmapBusy }: Props) {
  if (fixes.length === 0) {
    return (
      <Card padding={20}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 6px' }}>Top fixes</h3>
        <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: 0 }}>
          Nothing left to fix that would raise your score. Nice work.
        </p>
      </Card>
    )
  }

  return (
    <Card padding={20}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 4px' }}>Top fixes</h3>
      <p style={{ fontSize: 12.5, color: colors.text.muted, margin: '0 0 14px' }}>
        Ranked by how many points each one adds to your score.
      </p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fixes.map((f, i) => {
          const covered = !!roadmap?.covered.includes(f.requirement)
          return (
            <li key={f.requirement} style={{
              border: `1px solid ${colors.border.default}`, borderRadius: 12, padding: 14,
              display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0, textAlign: 'center',
                background: colors.state.successBg, color: colors.state.success,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>+{f.points_gained}</span>
                <span style={{ fontSize: 9, fontWeight: 700 }}>pts</span>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: colors.text.muted, fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink }}>{f.requirement}</span>
                  <Badge color={fixTypeBadge[f.type]}>{fixTypeLabel[f.type]}</Badge>
                </div>
                <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '6px 0 10px', lineHeight: 1.5 }}>{f.action}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => onImprove(f.requirement)}
                    style={{
                      height: 32, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Sparkles size={13} />
                    {f.type === 'real_gap' ? 'I have used this' : 'Suggest wording'}
                  </button>
                  {f.type === 'real_gap' && (
                    <button
                      onClick={() => onRoadmap(f.requirement, covered)}
                      disabled={roadmapBusy}
                      style={{
                        height: 32, padding: '0 14px', borderRadius: 8, cursor: roadmapBusy ? 'not-allowed' : 'pointer',
                        border: `1px solid ${colors.border.medium}`, background: colors.surface.card,
                        color: colors.text.ink, fontSize: 12, fontWeight: 700, opacity: roadmapBusy ? 0.6 : 1,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Map size={13} />
                      {covered ? 'In your roadmap' : 'Learn this'}
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
