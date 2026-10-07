import { CheckCircle2, XCircle } from 'lucide-react'
import Card from '@/shared/components/data-display/Card'
import { colors } from '@/design-system/tokens'
import type { AtsCheck } from '@/api/resumeMatch'

export default function AtsPanel({ checks }: { checks: AtsCheck[] }) {
  if (checks.length === 0) return null
  const failed = checks.filter(c => !c.passed).length
  return (
    <Card padding={20}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text.ink, margin: '0 0 4px' }}>ATS readability</h3>
      <p style={{ fontSize: 12.5, color: colors.text.muted, margin: '0 0 12px' }}>
        {failed === 0
          ? 'Employer tracking systems should read this file without trouble.'
          : `${failed} thing${failed > 1 ? 's' : ''} could stop an employer's tracking system reading your resume properly.`}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {checks.map(c => (
          <li key={c.key} style={{ display: 'flex', gap: 10 }}>
            {c.passed
              ? <CheckCircle2 size={16} color={colors.state.success} style={{ flexShrink: 0, marginTop: 1 }} />
              : <XCircle size={16} color={colors.state.danger} style={{ flexShrink: 0, marginTop: 1 }} />}
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink }}>{c.label}</span>
              {c.detail && <p style={{ fontSize: 12, color: colors.text.inkSoft, margin: '2px 0 0' }}>{c.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
