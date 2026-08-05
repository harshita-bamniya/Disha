import { tokens } from '@/design-system'

export function StatCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string; accent?: string
}) {
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
      <div style={{ width: 40, height: 40, borderRadius: 12, background: tokens.color.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={18} color={tokens.color.brand.ink} />
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: tokens.color.brand.muted, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: tokens.color.brand.ink, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: tokens.color.brand.muted, marginTop: 5 }}>{sub}</p>}
    </div>
  )
}
