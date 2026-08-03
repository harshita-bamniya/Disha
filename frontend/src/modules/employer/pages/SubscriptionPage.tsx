import { CreditCard, CheckCircle2 } from 'lucide-react'
import { useSubscription, useSubscriptionUsage, useSubscriptionPlans, useUpgradeSubscription, useHasPermission } from '../hooks/useJobs'
import { getApiError } from '@/api/client'

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{used} / {limit ?? '∞'}</span>
      </div>
      {limit !== null && (
        <div style={{ height: 8, background: '#F1F5F9', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? '#DC2626' : '#3B82F6', borderRadius: 20 }} />
        </div>
      )}
    </div>
  )
}

function formatPrice(paise: number): string {
  if (paise === 0) return 'Free'
  return `₹${(paise / 100).toLocaleString('en-IN')}/mo`
}

export default function SubscriptionPage() {
  const { data: sub, isLoading: subLoading } = useSubscription()
  const { data: usage } = useSubscriptionUsage()
  const { data: plans } = useSubscriptionPlans()
  const upgrade = useUpgradeSubscription()
  const canManageSubscription = useHasPermission('subscriptions:manage')

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <CreditCard size={20} color="#3B82F6" />
          <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>Subscription</h1>
        </div>

        {/* Current plan + usage */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(37,99,235,0.09)', padding: 24, marginBottom: 24 }}>
          {subLoading ? (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
          ) : sub && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>Current plan</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#1E3A5F', margin: '2px 0 0', textTransform: 'capitalize' }}>{sub.plan.name}</p>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#3B82F6' }}>{formatPrice(sub.plan.price_monthly)}</span>
              </div>

              {usage && (
                <>
                  <UsageBar label="Active job postings" used={usage.active_jobs_used} limit={usage.active_jobs_limit} />
                  <UsageBar label="Recruiter seats" used={usage.recruiter_seats_used} limit={usage.recruiter_seats_limit} />
                </>
              )}
            </>
          )}
        </div>

        {/* Plans grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
          {(plans ?? []).map(plan => {
            const isCurrent = sub?.plan.id === plan.id
            return (
              <div
                key={plan.id}
                style={{
                  background: '#fff', borderRadius: 14, padding: 18,
                  border: isCurrent ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', textTransform: 'capitalize', margin: 0 }}>{plan.name}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#3B82F6', margin: '4px 0 12px' }}>{formatPrice(plan.price_monthly)}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', fontSize: 11, color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <li>{plan.max_active_jobs ?? 'Unlimited'} active jobs</li>
                  <li>{plan.max_recruiter_seats ?? 'Unlimited'} recruiter seats</li>
                  <li>{plan.resume_access ? 'Full resume access' : 'No resume access'}</li>
                </ul>
                {isCurrent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#059669' }}>
                    <CheckCircle2 size={13} />Current plan
                  </div>
                ) : canManageSubscription ? (
                  <button
                    onClick={() => upgrade.mutate(plan.id)}
                    disabled={upgrade.isPending}
                    style={{
                      width: '100%', height: 32, borderRadius: 8, border: 'none',
                      background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: upgrade.isPending ? 0.6 : 1,
                    }}
                  >Switch plan</button>
                ) : (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Only the company owner can change plans</p>
                )}
              </div>
            )
          })}
        </div>
        {upgrade.isError && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 12 }}>{getApiError(upgrade.error)}</p>}
      </div>
    </div>
  )
}
