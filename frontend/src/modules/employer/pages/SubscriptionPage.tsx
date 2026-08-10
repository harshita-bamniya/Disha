import { CreditCard, CheckCircle2 } from 'lucide-react'
import { useSubscription, useSubscriptionUsage, useSubscriptionPlans, useUpgradeSubscription, useHasPermission } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import { colors, radius } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.inkSoft }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink }}>{used} / {limit ?? '∞'}</span>
      </div>
      {limit !== null && (
        <div style={{ height: 8, background: colors.surface.elevated, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? colors.state.danger : colors.brand.navy, borderRadius: 20 }} />
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
  const { data: sub, isLoading: subLoading, isError: subError, refetch: refetchSub } = useSubscription()
  const { data: usage } = useSubscriptionUsage()
  const { data: plans } = useSubscriptionPlans()
  const upgrade = useUpgradeSubscription()
  const canManageSubscription = useHasPermission('subscriptions:manage')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your plan and usage"
        icon={<CreditCard size={16} color={colors.text.ink} />}
      />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Current plan + usage */}
        <div style={{ background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`, padding: 24 }}>
          {subLoading ? (
            <Spinner />
          ) : subError ? (
            <ErrorState compact title="Subscription unavailable" description="Could not load subscription data." onRetry={() => refetchSub()} />
          ) : sub && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: colors.text.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>Current plan</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: colors.text.ink, margin: '2px 0 0', textTransform: 'capitalize' }}>{sub.plan.name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CreditCard size={15} color={colors.text.muted} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: colors.text.ink }}>{formatPrice(sub.plan.price_monthly)}</span>
                </div>
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
                  background: colors.surface.card, borderRadius: radius.xl, padding: 18,
                  border: isCurrent ? `2px solid ${colors.brand.navy}` : `1px solid ${colors.border.default}`,
                  transition: 'box-shadow 0.2s',
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, textTransform: 'capitalize', margin: 0 }}>{plan.name}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: colors.brand.navy, margin: '4px 0 12px' }}>{formatPrice(plan.price_monthly)}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', fontSize: 11, color: colors.text.inkSoft, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <li>{plan.max_active_jobs ?? 'Unlimited'} active jobs</li>
                  <li>{plan.max_recruiter_seats ?? 'Unlimited'} recruiter seats</li>
                  <li>{plan.resume_access ? 'Full resume access' : 'No resume access'}</li>
                </ul>
                {isCurrent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: colors.state.success }}>
                    <CheckCircle2 size={13} />Current plan
                  </div>
                ) : canManageSubscription ? (
                  <button
                    onClick={() => upgrade.mutate(plan.id)}
                    disabled={upgrade.isPending}
                    style={{
                      width: '100%', height: 32, borderRadius: 8, border: 'none',
                      background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: upgrade.isPending ? 0.6 : 1,
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={e => { if (!upgrade.isPending) e.currentTarget.style.background = colors.brand.navySoft }}
                    onMouseOut={e => { e.currentTarget.style.background = colors.brand.navy }}
                  >Switch plan</button>
                ) : (
                  <p style={{ fontSize: 11, color: colors.text.muted, margin: 0 }}>Only the company owner can change plans</p>
                )}
              </div>
            )
          })}
        </div>
        {upgrade.isError && <p style={{ fontSize: 12, color: colors.state.danger, marginTop: 4 }}>{getApiError(upgrade.error)}</p>}
      </div>
      </div>
    </div>
  )
}
