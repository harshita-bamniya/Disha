import { IndianRupee, Award, TrendingUp, AlertCircle } from 'lucide-react'
import { useBillingOverview, useSubscriptionPlansAdmin } from '../hooks/useAdmin'
import { Spinner, Empty, Breadcrumb, formatPaise } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function FinancialReportsPage() {
  const { data, isLoading }         = useBillingOverview()
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlansAdmin()

  if (isLoading || plansLoading) return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/admin/reports' }, { label: 'Financial' }]} />
      <Spinner />
    </section>
  )

  if (!data) return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/admin/reports' }, { label: 'Financial' }]} />
      <Empty icon={IndianRupee} text="Could not load billing data" />
    </section>
  )

  const maxTrend = Math.max(1, ...data.trend.map(t => t.new_subscriptions))

  return (
    <section className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/admin/reports' }, { label: 'Financial' }]} />

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Financial Reports</h1>
        <p style={{ fontSize: 14, color: N.muted, marginTop: 4 }}>
          Revenue and subscription analytics computed from active subscription records.{' '}
          <span style={{ color: '#D97706', fontWeight: 500 }}>Not a reconciled payment ledger.</span>
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'MRR',                  value: formatPaise(data.mrr) },
          { label: 'ARPA',                 value: formatPaise(data.arpa) },
          { label: 'Active Subscriptions', value: data.active_subscriptions },
          { label: 'New (30d)',            value: data.new_subscriptions_30d },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: '16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: N.ink }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(data.past_due_subscriptions > 0 || data.canceled_subscriptions > 0) && (
        <div className="flex flex-wrap gap-3">
          {data.past_due_subscriptions > 0 && (
            <div className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 10, background: '#FFFBEB', color: '#D97706', border: '1px solid rgba(0,0,0,0.08)' }}>
              <AlertCircle size={13} />
              {data.past_due_subscriptions} past due
            </div>
          )}
          {data.canceled_subscriptions > 0 && (
            <div className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid rgba(0,0,0,0.08)' }}>
              <AlertCircle size={13} />
              {data.canceled_subscriptions} canceled
            </div>
          )}
        </div>
      )}

      {/* Subscription trend */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: N.muted, whiteSpace: 'nowrap' }}>New Subscriptions — Last 6 Months</span>
          <div style={{ flex: 1, height: '0.5px', background: '#E2E8F0' }} />
          <TrendingUp size={14} style={{ color: N.muted }} />
        </div>
        {data.trend.length === 0 ? (
          <p style={{ fontSize: 12, color: N.muted }}>No subscriptions in this window yet.</p>
        ) : (
          <div className="flex items-end gap-3" style={{ height: 96 }}>
            {data.trend.map(t => (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  title={`${t.month}: ${t.new_subscriptions}`}
                  style={{
                    height: `${(t.new_subscriptions / maxTrend) * 100}%`,
                    minHeight: t.new_subscriptions > 0 ? 3 : 1,
                    width: '100%',
                    background: N.navy,
                    borderRadius: 4,
                    transition: 'height 0.3s',
                  }}
                />
                <span style={{ fontSize: 10, color: N.muted }}>{t.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue by plan */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: N.ink }}>Revenue by Plan</h2>
        </div>
        {data.plan_distribution.length === 0 ? (
          <Empty icon={Award} text="No subscription plans configured" />
        ) : (
          data.plan_distribution.map((p, idx) => (
            <div
              key={p.plan_id}
              className="flex items-center justify-between gap-4"
              style={{
                padding: '14px 20px',
                background: idx % 2 === 0 ? '#fff' : N.cream,
                borderBottom: idx < data.plan_distribution.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <div className="min-w-0">
                <p style={{ fontSize: 14, fontWeight: 600, color: N.ink, textTransform: 'capitalize' }}>{p.plan_name}</p>
                <p style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>
                  {p.company_count} compan{p.company_count === 1 ? 'y' : 'ies'} · {formatPaise(p.price_monthly)}/mo each
                </p>
              </div>
              <div className="text-right shrink-0">
                <p style={{ fontSize: 14, fontWeight: 900, color: N.ink }}>{formatPaise(p.mrr)}</p>
                <p style={{ fontSize: 10, color: N.muted, marginTop: 2 }}>MRR</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Plan limits table */}
      {plans && plans.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: N.ink }}>Subscription Plan Configuration</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: N.cream, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  {['Plan', 'Price / mo', 'Max Jobs', 'Max Seats', 'Add-ons'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: N.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p, idx) => (
                  <tr
                    key={p.id}
                    style={{ background: idx % 2 === 0 ? '#fff' : N.cream, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                    onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                    onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : N.cream)}
                  >
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: N.ink, textTransform: 'capitalize' }}>{p.name}</td>
                    <td style={{ padding: '12px 20px', color: N.ink, fontVariantNumeric: 'tabular-nums' }}>{formatPaise(p.price_monthly)}</td>
                    <td style={{ padding: '12px 20px', color: N.muted, fontVariantNumeric: 'tabular-nums' }}>{p.max_active_jobs ?? '∞'}</td>
                    <td style={{ padding: '12px 20px', color: N.muted, fontVariantNumeric: 'tabular-nums' }}>{p.max_recruiter_seats ?? '∞'}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div className="flex flex-wrap gap-1">
                        {p.resume_access && <span style={{ fontSize: 10, padding: '2px 6px', background: N.creamDk, color: N.ink, borderRadius: 4 }}>Resume Access</span>}
                        {p.candidate_search_limit !== null && <span style={{ fontSize: 10, padding: '2px 6px', background: N.cream, color: N.muted, borderRadius: 4 }}>Search: {p.candidate_search_limit}/mo</span>}
                        {!p.is_active && <span style={{ fontSize: 10, padding: '2px 6px', background: '#FEF2F2', color: '#EF4444', borderRadius: 4 }}>Inactive</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
