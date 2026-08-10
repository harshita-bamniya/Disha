import { memo, type ElementType } from 'react'
import { ChevronRight } from 'lucide-react'
import { colors, radius, shadows } from '@/design-system/tokens'

interface StatCardProps {
  icon: ElementType
  label: string
  value: number | string
  sub?: string
  accent?: string
  /** Renders as a clickable tile with a chevron affordance instead of a static card. */
  onClick?: () => void
}

const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, accent, onClick }: StatCardProps) {
  const iconColor = accent ?? colors.text.ink
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      style={{
        background: colors.surface.card,
        borderRadius: radius.xl,
        border: `1px solid ${colors.border.default}`,
        padding: '20px 22px',
        display: 'flex', flexDirection: 'column',
        width: '100%', textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.2s, box-shadow 0.15s',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = colors.surface.elevated
        if (onClick) e.currentTarget.style.boxShadow = shadows.cardHover
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = colors.surface.card
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: colors.surface.elevated,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={iconColor} />
        </div>
        {onClick && <ChevronRight size={15} color={colors.text.muted} />}
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: colors.text.ink, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 5 }}>{sub}</p>}
    </Tag>
  )
})

export default StatCard
