import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, CheckCircle2, XCircle, MinusCircle, RefreshCw } from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { IntegrationEntry, IntegrationStatus } from '@/api/admin'
import { Spinner } from '@/modules/admin/shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'


// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IntegrationStatus, {
  icon: React.ElementType; label: string; border: string; bg: string; text: string
}> = {
  connected:      { icon: CheckCircle2, label: 'Connected',     border: '1px solid rgba(0,0,0,0.08)', bg: '#F0FDF4',  text: '#15803D' },
  not_configured: { icon: MinusCircle,  label: 'Not configured', border: `1px solid ${colors.border.default}`, bg: colors.surface.bg,  text: colors.text.muted },
  error:          { icon: XCircle,      label: 'Error',          border: '1px solid rgba(0,0,0,0.08)', bg: '#FEF2F2',  text: '#DC2626' },
}

const CATEGORY_ORDER = ['Infrastructure', 'AI', 'Messaging', 'Auth', 'Security', 'Monitoring']

const CATEGORY_ICONS: Record<string, string> = {
  Infrastructure: '🗄️',
  AI:             '🤖',
  Messaging:      '✉️',
  Auth:           '🔑',
  Security:       '🛡️',
  Monitoring:     '📡',
}

// ── Integration card ───────────────────────────────────────────────────────────

function IntegrationCard({ item }: { item: IntegrationEntry }) {
  const cfg = STATUS_CONFIG[item.status]
  const Icon = cfg.icon

  return (
    <div
      style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'background 0.15s' }}
      onMouseOver={e => (e.currentTarget.style.background = colors.surface.elevated)}
      onMouseOut={e => (e.currentTarget.style.background = '#fff')}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <p style={{ fontSize: 14, fontWeight: 900, color: colors.text.ink, lineHeight: 1.3 }}>{item.name}</p>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, flexShrink: 0, background: cfg.bg, color: cfg.text }}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
      </div>

      <p style={{ fontSize: 12, color: colors.text.muted, fontFamily: 'monospace', lineHeight: 1.5, wordBreak: 'break-all' }}>{item.detail}</p>

      {item.latency_ms !== null && (
        <div className="flex items-center gap-1.5">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
          <span style={{ fontSize: 11, color: colors.text.muted, fontWeight: 500 }}>{item.latency_ms} ms</span>
        </div>
      )}
    </div>
  )
}

// ── Category group ─────────────────────────────────────────────────────────────

function CategoryGroup({ category, items }: { category: string; items: IntegrationEntry[] }) {
  const connected = items.filter(i => i.status === 'connected').length
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: colors.text.muted, whiteSpace: 'nowrap' }}>
          {CATEGORY_ICONS[category] ?? '🔌'} {category} ({connected}/{items.length})
        </span>
        <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map(item => <IntegrationCard key={item.id} item={item} />)}
      </div>
    </div>
  )
}

// ── Summary bar ────────────────────────────────────────────────────────────────

function SummaryBar({ items }: { items: IntegrationEntry[] }) {
  const connected      = items.filter(i => i.status === 'connected').length
  const errors         = items.filter(i => i.status === 'error').length
  const notConfigured  = items.filter(i => i.status === 'not_configured').length

  return (
    <div className="flex items-center gap-3 flex-wrap mb-6">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: colors.surface.bg, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}>
        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#15803D' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>{connected} connected</span>
      </div>
      {errors > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#FEF2F2', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}>
          <XCircle className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>{errors} error{errors > 1 ? 's' : ''}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: colors.surface.bg, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)' }}>
        <MinusCircle className="w-3.5 h-3.5" style={{ color: colors.text.muted }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.muted }}>{notConfigured} not configured</span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const qc = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: adminApi.getIntegrations,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const groups = new Map<string, IntegrationEntry[]>()
  if (data) {
    for (const item of data.integrations) {
      if (!groups.has(item.category)) groups.set(item.category, [])
      groups.get(item.category)!.push(item)
    }
  }

  const orderedGroups = CATEGORY_ORDER
    .filter(c => groups.has(c))
    .map(c => ({ category: c, items: groups.get(c)! }))

  for (const [cat, items] of groups) {
    if (!CATEGORY_ORDER.includes(cat)) orderedGroups.push({ category: cat, items })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plug className="w-5 h-5" style={{ color: colors.text.ink }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Integrations</h1>
            <p style={{ fontSize: 14, color: colors.text.muted }}>
              Live connection status for all external services.
              {data && (
                <span style={{ marginLeft: 8, color: '#CBD5E1' }}>
                  Last checked {new Date(data.checked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] })}
          disabled={isFetching}
          className="flex items-center gap-1.5 shrink-0"
          style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: colors.text.ink, fontSize: 12, fontWeight: 600, opacity: isFetching ? 0.5 : 1 }}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data ? null : (
        <>
          <SummaryBar items={data.integrations} />
          <div className="flex flex-col gap-8">
            {orderedGroups.map(g => (
              <CategoryGroup key={g.category} category={g.category} items={g.items} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
