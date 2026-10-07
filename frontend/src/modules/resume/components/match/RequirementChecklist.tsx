import { CheckCircle2, CircleDashed, HelpCircle, XCircle } from 'lucide-react'
import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import { colors } from '@/design-system/tokens'
import type { RequirementResult } from '@/api/resumeMatch'
import { verdictColor, verdictLabel } from './matchTheme'

function Icon({ r }: { r: RequirementResult }) {
  if (r.requirement.type === 'eligibility') return <HelpCircle size={17} color={colors.text.muted} />
  if (r.credit >= 0.7) return <CheckCircle2 size={17} color={colors.state.success} />
  if (r.credit > 0) return <CircleDashed size={17} color={colors.state.warning} />
  return <XCircle size={17} color={colors.state.danger} />
}

function rank(r: RequirementResult): number {
  if (r.requirement.type === 'eligibility') return 3
  if (r.credit >= 0.7) return 2
  return r.credit > 0 ? 1 : 0
}

interface Props {
  results: RequirementResult[]
  /** Called when a requirement that can be improved is chosen */
  onImprove: (requirement: string) => void
}

export default function RequirementChecklist({ results, onImprove }: Props) {
  const ordered = [...results].sort(
    (a, b) => rank(a) - rank(b) || Number(b.requirement.importance === 'must_have') - Number(a.requirement.importance === 'must_have'),
  )

  return (
    <Card padding={20}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 4px' }}>Requirement checklist</h3>
      <p style={{ fontSize: 12.5, color: colors.text.muted, margin: '0 0 14px' }}>
        Every requirement from the job, and the line on your resume that supports it.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        {ordered.map(r => {
          const improvable = r.requirement.type !== 'eligibility' && r.credit < 1
          return (
            <li key={r.requirement.name} style={{
              display: 'flex', gap: 12, padding: '12px 0', borderTop: `1px solid ${colors.border.default}`,
            }}>
              <div style={{ paddingTop: 1 }}><Icon r={r} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: colors.text.ink }}>{r.requirement.name}</span>
                  <Badge color={r.requirement.importance === 'must_have' ? 'navy' : 'gray'}>
                    {r.requirement.importance === 'must_have' ? 'Must have' : 'Nice to have'}
                  </Badge>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700,
                    color: r.requirement.type === 'eligibility' ? colors.text.muted : verdictColor(r.credit),
                  }}>
                    {verdictLabel(r)}
                  </span>
                </div>
                {r.evidence && (
                  <p style={{
                    margin: '6px 0 0', fontSize: 12.5, color: colors.text.inkSoft, lineHeight: 1.5,
                    borderLeft: `3px solid ${colors.surface.elevated}`, paddingLeft: 10,
                  }}>
                    “{r.evidence}”
                  </p>
                )}
                {r.reason && <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.text.muted }}>{r.reason}</p>}
              </div>
              {improvable && (
                <button
                  onClick={() => onImprove(r.requirement.name)}
                  style={{
                    alignSelf: 'center', flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 8,
                    border: `1px solid ${colors.border.medium}`, background: colors.surface.card,
                    fontSize: 12, fontWeight: 700, color: colors.text.ink, cursor: 'pointer',
                  }}
                >
                  How to improve
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
