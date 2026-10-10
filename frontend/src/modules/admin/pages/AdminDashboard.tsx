import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { adminDashboardApi } from '@/api/adminDashboard'
import { useAuthStore } from '@/stores/authStore'
import { colors } from '@/design-system/tokens'
import Tabs from '@/shared/components/navigation/Tabs'
import Button from '@/shared/components/primitives/Button'
import { Spinner } from '../shared/adminUI'
import AttentionStrip from '../components/dashboard/AttentionStrip'
import KpiTiles from '../components/dashboard/KpiTiles'
import JourneyCard from '../components/dashboard/JourneyCard'
import SupplyDemandCard from '../components/dashboard/SupplyDemandCard'

const RANGES = [7, 30, 90] as const

const TITLES: Record<string, string> = {
  verification_officer: 'Verification overview',
  finance_manager: 'Payments overview',
  support_executive: 'Support overview',
  moderator: 'Moderation overview',
}

export default function AdminDashboard() {
  const role = useAuthStore(s => s.user?.role ?? '')
  const seesMarketplace = role === 'super_admin' || role === 'admin'

  // The period and the comparison live in the address, so a view can be shared and survives a refresh.
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('days'))
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30
  const compare = params.get('compare') === '1'
  const update = (next: { days?: number; compare?: boolean }) => {
    const p = new URLSearchParams(params)
    p.set('days', String(next.days ?? days))
    if (next.compare ?? compare) p.set('compare', '1'); else p.delete('compare')
    setParams(p, { replace: true })
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard', 'overview', days, compare],
    queryFn: () => adminDashboardApi.overview(days, compare),
    refetchInterval: 60_000,
    enabled: seesMarketplace,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: colors.text.ink, letterSpacing: '-0.3px' }}>{TITLES[role] ?? 'Platform overview'}</h1>
          {data && <p style={{ margin: '3px 0 0', fontSize: 12, color: colors.text.muted }}>{data.range.from} to {data.range.to}, India time</p>}
        </div>
        {seesMarketplace && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Tabs
              tabs={RANGES.map(r => ({ key: String(r), label: `${r} days` }))}
              active={String(days)}
              onChange={k => update({ days: Number(k) })}
              variant="pill"
            />
            <button
              onClick={() => update({ compare: !compare })}
              aria-pressed={compare}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, color: compare ? colors.brand.navy : colors.text.inkSoft,
                background: compare ? 'rgba(26,39,68,0.08)' : colors.surface.card, border: `1px solid ${compare ? colors.brand.navy : colors.border.medium}`,
              }}
            >
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: compare ? colors.brand.navy : 'transparent', border: `1.5px solid ${compare ? colors.brand.navy : colors.border.strong}` }}>
                {compare && <Check size={11} color="#fff" strokeWidth={3} />}
              </span>
              Compare with previous
            </button>
          </div>
        )}
      </header>

      <AttentionStrip />

      {seesMarketplace && (
        isLoading ? <Spinner />
        : isError || !data ? (
          <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>
            Could not load marketplace health. <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
          </p>
        ) : (
          <>
            <KpiTiles tiles={data.tiles} days={days} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'start' }}>
              <JourneyCard days={days} compare={compare} />
              <SupplyDemandCard data={data} days={days} />
            </div>
          </>
        )
      )}
    </div>
  )
}
