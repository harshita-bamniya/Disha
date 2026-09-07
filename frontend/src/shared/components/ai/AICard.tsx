import { memo, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { colors, radius, shadows } from '@/design-system/tokens'

interface AICardProps {
  title: string
  children: ReactNode
  /** Accent color for the icon + top border strip */
  accent?: string
  icon?: ReactNode
  actions?: ReactNode
  loading?: boolean
}

const AICard = memo(function AICard({ title, children, accent, icon, actions, loading }: AICardProps) {
  const accentColor = accent ?? colors.brand.navy

  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.xl,
      border: `1px solid ${colors.border.default}`,
      boxShadow: shadows.card,
      overflow: 'hidden',
    }}>
      {/* Accent strip */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 10px',
        borderBottom: `1px solid ${colors.border.default}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: radius.md,
            background: `${accentColor}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accentColor,
          }}>
            {icon ?? <Sparkles size={14} />}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{title}</span>
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{actions}</div>}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid ${colors.surface.elevated}`,
              borderTopColor: accentColor,
              animation: 'spin 0.7s linear infinite', flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, color: colors.text.muted }}>Generating insights…</span>
          </div>
        ) : children}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
})

export default AICard
