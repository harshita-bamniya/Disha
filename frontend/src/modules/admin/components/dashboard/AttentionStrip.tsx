import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { adminDashboardApi } from '@/api/adminDashboard'
import { colors } from '@/design-system/tokens'
import { card, describeQueue, shortAge } from './shared'

/** Only what is waiting on a person. Zero rows means the strip is a single calm line, not a card full of empty queues. */
export default function AttentionStrip() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard', 'attention'],
    queryFn: adminDashboardApi.attention,
    refetchInterval: 60_000,
  })

  const shell = { ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, padding: '10px 14px', minHeight: 52 }

  if (isLoading) return <div style={shell} aria-busy="true"><span style={{ fontSize: 13, color: colors.text.muted }}>Checking queues…</span></div>
  if (isError || !data) {
    return (
      <div style={shell}>
        <span style={{ fontSize: 13, color: colors.text.inkSoft }}>Could not load the queues.</span>
        <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: colors.state.info, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
      </div>
    )
  }

  if (data.rows.length === 0) {
    return (
      <div style={shell} role="status">
        <CheckCircle2 size={17} color={colors.state.success} aria-hidden />
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink }}>Nothing is waiting on you</span>
      </div>
    )
  }

  return (
    <section aria-label="Needs attention" style={shell}>
      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, marginRight: 2 }}>Needs attention</span>
      {data.rows.map(row => {
        const urgent = row.level === 'urgent'
        return (
          <button
            key={row.key}
            onClick={() => navigate(row.link)}
            title={describeQueue(row, data.targets)}
            aria-label={describeQueue(row, data.targets)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, color: colors.text.ink,
              background: urgent ? colors.state.dangerBg : colors.surface.bg,
              border: `1px solid ${urgent ? 'rgba(220,38,38,0.28)' : colors.border.default}`,
            }}
          >
            {urgent && <AlertTriangle size={14} color={colors.state.danger} aria-hidden />}
            <strong style={{ fontWeight: 700 }}>{row.label}</strong>
            <span style={{ fontWeight: 700 }}>{row.count > 0 ? row.count : row.parts[0]?.count}</span>
            {row.oldest_age_hours != null && <span style={{ color: colors.text.muted }}>oldest {shortAge(row.oldest_age_hours)}</span>}
            {row.overdue > 0 && <span style={{ color: colors.state.danger, fontWeight: 700 }}>{row.overdue} overdue</span>}
          </button>
        )
      })}
    </section>
  )
}
