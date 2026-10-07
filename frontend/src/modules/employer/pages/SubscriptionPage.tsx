import { Fragment, useState } from 'react'
import { CreditCard, CheckCircle2, Check, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSubscription, useSubscriptionUsage, useSubscriptionPlans, useUpgradeSubscription, useHasPermission } from '../hooks/useJobs'
import type { SubscriptionPlanEntry } from '@/api/company'
import { paymentsApi } from '@/api/payments'
import { openRazorpayCheckout } from '@/lib/razorpayCheckout'
import { getApiError } from '@/api/client'
import { colors, radius, shadows } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'

const PLAN_ORDER: Record<string, number> = { free: 0, standard: 1, premium: 2, enterprise: 3 }
const PLAN_PITCH: Record<string, string> = {
  free: 'Try the basics before you commit',
  standard: 'For teams hiring their first 5 roles',
  premium: 'For growing teams hiring at scale',
  enterprise: 'Custom limits, dedicated support & contracts',
}

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

function formatPrice(paise: number, planName?: string, interval: 'monthly' | 'annual' = 'monthly'): string {
  // Enterprise is priced at 0 in the DB as a placeholder for custom/negotiated
  // pricing, not because it's actually free — don't show it as "Free".
  if (planName?.toLowerCase() === 'enterprise') return 'Custom pricing'
  if (paise === 0) return 'Free'
  return `₹${(paise / 100).toLocaleString('en-IN')}/${interval === 'monthly' ? 'mo' : 'yr'}`
}

function baseName(name: string): string {
  return name.replace(/_annual$/, '')
}

export default function SubscriptionPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  const { data: sub, isLoading: subLoading, isError: subError, refetch: refetchSub } = useSubscription()
  const { data: usage } = useSubscriptionUsage()
  const { data: plans } = useSubscriptionPlans()
  const switchToFree = useUpgradeSubscription()
  const canManageSubscription = useHasPermission('subscriptions:manage')
  const qc = useQueryClient()

  const checkoutPaidPlan = useMutation({
    mutationFn: async (planId: string) => {
      const checkout = await paymentsApi.checkout(planId)
      const result = await openRazorpayCheckout({
        keyId: checkout.razorpay_key_id,
        subscriptionId: checkout.razorpay_subscription_id,
        description: `${checkout.plan.name} plan`,
      })
      await paymentsApi.verify(result)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer', 'subscription'] })
      qc.invalidateQueries({ queryKey: ['employer', 'subscription', 'usage'] })
    },
  })

  const visiblePlans = (plans ?? [])
    .filter(p => p.billing_interval === billingInterval || p.price_monthly === 0 || p.name === 'enterprise')
    .sort((a, b) => (PLAN_ORDER[baseName(a.name)] ?? 99) - (PLAN_ORDER[baseName(b.name)] ?? 99))

  const standardMonthly = (plans ?? []).find(p => p.name === 'standard')
  const standardAnnual = (plans ?? []).find(p => p.name === 'standard_annual')
  const annualSavingsPct = standardMonthly && standardAnnual && standardMonthly.price_monthly > 0
    ? Math.round((1 - standardAnnual.price_monthly / (standardMonthly.price_monthly * 12)) * 100)
    : 0

  const upgradeIsPending = switchToFree.isPending || checkoutPaidPlan.isPending
  const upgradeError = switchToFree.error ?? checkoutPaidPlan.error

  const FEATURE_ROWS: { label: string; render: (p: SubscriptionPlanEntry) => React.ReactNode }[] = [
    { label: 'Active job postings', render: p => p.max_active_jobs ?? 'Unlimited' },
    { label: 'Recruiter seats', render: p => p.max_recruiter_seats ?? 'Unlimited' },
    { label: 'Resume access', render: p => p.resume_access ? <Check size={15} color={colors.state.success} strokeWidth={3} /> : <X size={15} color={colors.text.muted} /> },
    { label: 'Candidate search', render: p => p.candidate_search_limit ?? 'Unlimited' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your plan and usage"
        icon={<CreditCard size={16} color={colors.text.ink} />}
      />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Current plan + usage */}
        <div style={{ background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`, boxShadow: shadows.card, padding: 24 }}>
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
                  <span style={{ fontSize: 16, fontWeight: 700, color: colors.text.ink }}>{formatPrice(sub.plan.price_monthly, sub.plan.name, sub.plan.billing_interval)}</span>
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

        {/* Billing interval toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          {(['monthly', 'annual'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setBillingInterval(opt)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${billingInterval === opt ? colors.brand.navy : colors.border.default}`,
                background: billingInterval === opt ? colors.brand.navy : colors.surface.card,
                color: billingInterval === opt ? '#fff' : colors.text.inkSoft,
              }}
            >
              {opt === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
          {annualSavingsPct > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: colors.state.success, background: colors.state.successBg,
              border: '1px solid #BBF7D0', borderRadius: 20, padding: '3px 10px',
            }}>
              Save ~{annualSavingsPct}%
            </span>
          )}
        </div>

        {/* Plan comparison table */}
        <div style={{
          display: 'grid', gridTemplateColumns: `160px repeat(${visiblePlans.length}, 1fr)`,
          background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`,
          boxShadow: shadows.card, overflow: 'hidden', minWidth: 640,
        }}>
          {/* Header row */}
          <div />
          {visiblePlans.map(plan => {
            const isCurrent = sub?.plan.id === plan.id
            const isPopular = baseName(plan.name) === 'standard'
            const isEnterprise = plan.name === 'enterprise'
            return (
              <div
                key={plan.id}
                style={{
                  padding: '20px 16px 14px', textAlign: 'center', position: 'relative',
                  background: isPopular ? colors.surface.elevated : isEnterprise ? colors.surface.bg : 'transparent',
                  borderLeft: `1px solid ${colors.border.default}`,
                }}
              >
                {isPopular && (
                  <span style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: colors.brand.navy, color: '#fff', fontSize: 9.5, fontWeight: 800,
                    padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>
                    Most Popular
                  </span>
                )}
                <p style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, textTransform: 'capitalize', margin: '8px 0 4px' }}>
                  {baseName(plan.name).replace(/_/g, ' ')}
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: colors.brand.navy, margin: '0 0 4px' }}>
                  {formatPrice(plan.price_monthly, plan.name, plan.billing_interval)}
                </p>
                <p style={{ fontSize: 10.5, color: colors.text.muted, margin: 0, lineHeight: 1.4, minHeight: 28 }}>
                  {PLAN_PITCH[baseName(plan.name)]}
                </p>
                {isCurrent && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: colors.state.success, marginTop: 8 }}>
                    <CheckCircle2 size={12} />Current plan
                  </div>
                )}
              </div>
            )
          })}

          {/* Feature rows */}
          {FEATURE_ROWS.map(row => (
            <Fragment key={row.label}>
              <div style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 600, color: colors.text.inkSoft, borderTop: `1px solid ${colors.border.default}`, display: 'flex', alignItems: 'center' }}>
                {row.label}
              </div>
              {visiblePlans.map(plan => {
                const isPopular = baseName(plan.name) === 'standard'
                const isEnterprise = plan.name === 'enterprise'
                return (
                  <div
                    key={`${row.label}-${plan.id}`}
                    style={{
                      padding: '12px 16px', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: colors.text.ink,
                      borderTop: `1px solid ${colors.border.default}`, borderLeft: `1px solid ${colors.border.default}`,
                      background: isPopular ? colors.surface.elevated : isEnterprise ? colors.surface.bg : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {row.render(plan)}
                  </div>
                )
              })}
            </Fragment>
          ))}

          {/* CTA row */}
          <div style={{ padding: 16, borderTop: `1px solid ${colors.border.default}` }} />
          {visiblePlans.map(plan => {
            const isCurrent = sub?.plan.id === plan.id
            const isFreePlan = plan.price_monthly === 0
            const isPopular = baseName(plan.name) === 'standard'
            const isEnterprise = plan.name === 'enterprise'
            return (
              <div
                key={`cta-${plan.id}`}
                style={{
                  padding: 16, borderTop: `1px solid ${colors.border.default}`, borderLeft: `1px solid ${colors.border.default}`,
                  background: isPopular ? colors.surface.elevated : isEnterprise ? colors.surface.bg : 'transparent',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {isCurrent ? (
                  <div style={{ width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: colors.state.success }}>Current plan</div>
                ) : isEnterprise ? (
                  <button
                    onClick={() => { window.location.href = 'mailto:sales@beginablai.in?subject=Enterprise%20plan%20inquiry' }}
                    style={{
                      width: '100%', height: 34, borderRadius: 8, border: `1px solid ${colors.border.medium}`,
                      background: 'transparent', color: colors.text.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >Talk to sales</button>
                ) : canManageSubscription ? (
                  <button
                    onClick={() => (isFreePlan ? switchToFree.mutate(plan.id) : checkoutPaidPlan.mutate(plan.id))}
                    disabled={upgradeIsPending}
                    style={{
                      width: '100%', height: 34, borderRadius: 8, border: 'none',
                      background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: upgradeIsPending ? 0.6 : 1,
                    }}
                  >{upgradeIsPending ? 'Processing…' : isFreePlan ? 'Switch plan' : 'Upgrade & pay'}</button>
                ) : (
                  <p style={{ fontSize: 10.5, color: colors.text.muted, margin: 0, textAlign: 'center' }}>Owner only</p>
                )}
              </div>
            )
          })}
        </div>
        {upgradeError && <p style={{ fontSize: 12, color: colors.state.danger, marginTop: 4 }}>{getApiError(upgradeError)}</p>}
      </div>
      </div>
    </div>
  )
}
