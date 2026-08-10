import { memo, type ElementType } from 'react'
import { colors, radius } from '@/design-system/tokens'

interface StatCardProps {
  icon: ElementType
  label: string
  value: number | string
  sub?: string
  accent?: string
}

const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, accent }: StatCardProps) {
  const iconColor = accent ?? colors.text.ink
  return (
    <div
      style={{
        background: colors.surface.card,
        borderRadius: radius.xl,
        border: `1px solid ${colors.border.default}`,
        padding: '20px 22px',
        display: 'flex', flexDirection: 'column',
        transition: 'background 0.2s',
      }}
      onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
      onMouseOut={e => (e.currentTarget.style.background = colors.surface.card)}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: colors.surface.elevated,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <Icon size={18} color={iconColor} />
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: colors.text.ink, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 5 }}>{sub}</p>}
    </div>
  )
})

export default StatCard
