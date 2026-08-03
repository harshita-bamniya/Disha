import { IndianRupee, Award } from 'lucide-react'
import { useBillingOverview } from '../hooks/useAdmin'
import { Spinner, Empty, formatPaise } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function BillingPage() {
  const { data, isLoading } = useBillingOverview()

  if (isLoading) return <Spinner />
  if (!data) return <Empty icon={IndianRupee} text="Could not load billing data" />

  const maxTrend = Math.max(1, ...data.trend.map(t => t.new_subscriptions))

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Revenue</h1>
        <p className="text-sm mt-1" style={{ color: N.muted }}>
          Computed from active subscription records.{' '}
          <span className="text-amber-600 font-medium">Not a reconciled payment ledger — no Payment/Invoice model yet.</span>
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'MRR', value: formatPaise(data.mrr) },
          { label: 'ARPA', value: formatPaise(data.arpa) },
          { label: 'Active Subscriptions', value: data.active_subscriptions },
          { label: 'New (30d)', value: data.new_subscriptions_30d },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {(data.past_due_subscriptions > 0 || data.canceled_subscriptions > 0) && (
        <div className="flex gap-3">
          {data.past_due_subscriptions > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              {data.past_due_subscriptions} past due
            </span>
          )}
          {data.canceled_subscriptions > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200">
              {data.canceled_subscriptions} canceled
            </span>
          )}
        </div>
      )}

      {/* Trend chart */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 12 }}>New subscriptions — last 6 months</p>
        {data.trend.length === 0 ? (
          <p className="text-xs" style={{ color: N.muted }}>No subscriptions created in this window yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-20">
            {data.trend.map(t => (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${t.month}: ${t.new_subscriptions}`}
                  style={{ height: `${(t.new_subscriptions / maxTrend) * 100}%`, minHeight: 2, width: '100%', background: N.navy, borderRadius: 2 }}
                />
                <span className="text-[10px]" style={{ color: N.muted }}>{t.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan distribution */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 className="text-sm font-bold" style={{ color: N.ink }}>Revenue by Plan</h2>
        </div>
        {data.plan_distribution.length === 0 ? (
          <Empty icon={Award} text="No subscription plans configured" />
        ) : (
          data.plan_distribution.map((p, idx) => (
            <div
              key={p.plan_id}
              className="px-4 py-3 flex items-center justify-between"
              style={{
                borderBottom: idx < data.plan_distribution.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                background: idx % 2 === 0 ? '#fff' : N.cream,
              }}
              onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
              onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
            >
              <div>
                <p className="text-sm font-semibold capitalize" style={{ color: N.ink }}>{p.plan_name}</p>
                <p className="text-xs mt-0.5" style={{ color: N.muted }}>{p.company_count} compan{p.company_count === 1 ? 'y' : 'ies'} · {formatPaise(p.price_monthly)}/mo each</p>
              </div>
              <p className="text-sm font-black" style={{ color: N.ink }}>{formatPaise(p.mrr)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
