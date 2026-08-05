import { tokens } from '@/design-system'

type StatCardColor = 'navy' | 'green' | 'amber' | 'red' | 'blue'

// 'navy' matches the original hardcoded look exactly, so omitting `color`
// (every existing caller) renders identically to before this was added.
const COLOR_MAP: Record<StatCardColor, { iconBg: string; iconColor: string }> = {
  navy:  { iconBg: tokens.color.surface.elevated, iconColor: tokens.color.brand.ink },
  green: { iconBg: 'rgba(22,163,74,0.1)',  iconColor: tokens.color.state.success },
  amber: { iconBg: 'rgba(217,119,6,0.1)',  iconColor: tokens.color.state.warning },
  red:   { iconBg: 'rgba(220,38,38,0.1)',  iconColor: tokens.color.state.danger },
  blue:  { iconBg: 'rgba(37,99,235,0.1)',  iconColor: tokens.color.state.info },
}

export function StatCard({
  icon: Icon, label, value, sub, color = 'navy',
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: StatCardColor
}) {
  const { iconBg, iconColor } = COLOR_MAP[color]
  return (
    <div style={{
      background: tokens.color.surface.card, borderRadius: 16,
      border: `1px solid ${tokens.color.brand.border}`,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column' as const, gap: 0,
      transition: 'background 0.2s',
    }}
      onMouseOver={e => (e.currentTarget.style.background = tokens.color.surface.elevated)}
      onMouseOut={e => (e.currentTarget.style.background = tokens.color.surface.card)}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={18} color={iconColor} />
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: tokens.color.brand.muted, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: tokens.color.brand.ink, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: tokens.color.brand.muted, marginTop: 5 }}>{sub}</p>}
    </div>
  )
}
