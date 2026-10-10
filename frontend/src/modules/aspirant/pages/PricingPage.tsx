import { useState } from 'react'
import { Sparkles, CheckCircle2, MessageCircle, Map, FileText, Mic, Briefcase, ChevronDown, Check } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentsApi } from '@/api/payments'
import { getApiError } from '@/api/client'
import { openRazorpayCheckout } from '@/lib/razorpayCheckout'
import { colors, radius, shadows } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'

const FEATURE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  counsellor_chat: { label: 'AI Counsellor conversations', icon: <MessageCircle size={14} /> },
  roadmap: { label: 'Career roadmaps generated', icon: <Map size={14} /> },
  resume_builder: { label: 'AI resume generations', icon: <FileText size={14} /> },
  mock_interview: { label: 'Mock interview sessions', icon: <Mic size={14} /> },
}

const COMPARISON_ROWS = [
  { key: 'counsellor_chat', label: 'AI Counsellor conversations', icon: <MessageCircle size={14} /> },
  { key: 'roadmap', label: 'Career roadmaps', icon: <Map size={14} /> },
  { key: 'resume_builder', label: 'AI resume generations', icon: <FileText size={14} /> },
  { key: 'mock_interview', label: 'Mock interview sessions', icon: <Mic size={14} /> },
  { key: 'jobs', label: 'Job recommendations & applying', icon: <Briefcase size={14} /> },
]

const FAQ_ITEMS = [
  {
    q: 'Is this a recurring subscription?',
    a: 'Yes. You\'ll be billed automatically every month (or year, if you choose annual) via Razorpay — card, UPI Autopay, or net banking — until you cancel.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, from this page whenever you like. You\'ll keep Premium access until the end of your current billing period, then it won\'t renew.',
  },
  {
    q: 'What happens to my free uses if I upgrade?',
    a: 'They stop counting entirely — Premium removes the 3-use cap on AI Counsellor, roadmaps, resume builder, and mock interviews, so there\'s nothing left to track.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We don\'t offer refunds for partial billing periods, but there\'s no lock-in — cancel anytime to stop future charges.',
  },
]

function formatPrice(paise: number): string {
  if (paise === 0) return 'Free'
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`, boxShadow: shadows.card, overflow: 'hidden' }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={item.q} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? `1px solid ${colors.border.default}` : 'none' }}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{item.q}</span>
              <ChevronDown size={16} color={colors.text.muted} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
            </button>
            {isOpen && (
              <p style={{ margin: '0 20px 16px', fontSize: 12.5, color: colors.text.inkSoft, lineHeight: 1.6 }}>{item.a}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PricingPage() {
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
  const qc = useQueryClient()

  const { data: usage, isLoading: usageLoading, isError: usageError, refetch: refetchUsage } = useQuery({
    queryKey: ['aspirant', 'usage'],
    queryFn: paymentsApi.aspirantUsage,
  })
  const { data: plans } = useQuery({
    queryKey: ['aspirant', 'plans'],
    queryFn: () => paymentsApi.listPlans('aspirant'),
  })

  const upgrade = useMutation({
    mutationFn: async (planId: string) => {
      const checkout = await paymentsApi.checkout(planId)
      const result = await openRazorpayCheckout({
        keyId: checkout.razorpay_key_id,
        subscriptionId: checkout.razorpay_subscription_id,
        description: 'BeginablAI Premium',
      })
      await paymentsApi.verify(result)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aspirant', 'usage'] })
      qc.invalidateQueries({ queryKey: ['aspirant', 'subscription'] })
    },
  })

  const monthlyPlan = (plans ?? []).find(p => p.name === 'aspirant_premium_monthly')
  const annualPlan = (plans ?? []).find(p => p.name === 'aspirant_premium_annual')
  const premiumPlan = interval === 'monthly' ? monthlyPlan : annualPlan

  const savings = monthlyPlan && annualPlan ? monthlyPlan.price_monthly * 12 - annualPlan.price_monthly : 0
  const dailyRate = premiumPlan ? Math.round(premiumPlan.price_monthly / 100 / (interval === 'monthly' ? 30 : 365)) : 0

  // The single feature at (or nearest) its free-tier limit — surfaced as the lead-in hook.
  const maxedFeature = (usage?.features ?? []).find(f => f.limit != null && f.used_count >= f.limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="BeginablAI Premium"
        subtitle="Unlock unlimited AI Counsellor, roadmaps, resume builder & mock interviews"
        icon={<Sparkles size={16} color={colors.text.ink} />}
      />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {usageLoading ? (
            <div style={{ background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`, boxShadow: shadows.card, padding: 24 }}>
              <Spinner />
            </div>
          ) : usageError ? (
            <div style={{ background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`, boxShadow: shadows.card, padding: 24 }}>
              <ErrorState compact title="Usage unavailable" description="Could not load your usage." onRetry={() => refetchUsage()} />
            </div>
          ) : usage?.is_premium ? (
            <div style={{ background: colors.state.successBg, borderRadius: radius.xl, border: `1px solid #BBF7D0`, padding: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} color={colors.state.success} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#14532D' }}>You're on BeginablAI Premium — unlimited access to everything below.</span>
            </div>
          ) : maxedFeature ? (
            /* Contextual lead-in hook: shown when a free-tier limit has actually been hit */
            <div style={{ background: colors.state.warningBg, borderRadius: radius.xl, border: '1px solid #FDE68A', padding: 20 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400E' }}>
                You've used all {maxedFeature.limit} free {FEATURE_LABELS[maxedFeature.feature_key]?.label.toLowerCase() ?? 'uses'} — upgrade to keep going.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>
                Every aspirant gets <strong>3 free uses</strong> of each AI tool below. Job recommendations and applying stay unlimited either way.
              </p>
            </div>
          )}

          {!usage?.is_premium && (
            <>
              {/* Free vs Premium comparison */}
              <div style={{ background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`, boxShadow: shadows.card, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '14px 20px', background: colors.surface.elevated }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Feature</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center' }}>Free</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors.brand.navy, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center' }}>Premium</span>
                </div>
                {COMPARISON_ROWS.map((row, i) => {
                  const usageRow = usage?.features.find(f => f.feature_key === row.key)
                  const isUnlimitedOnFree = row.key === 'jobs'
                  return (
                    <div
                      key={row.key}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 90px', alignItems: 'center', padding: '12px 20px',
                        borderTop: i > 0 ? `1px solid ${colors.border.default}` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, color: colors.text.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {row.icon}{row.label}
                      </span>
                      <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: isUnlimitedOnFree ? colors.state.success : colors.text.muted }}>
                        {isUnlimitedOnFree ? 'Unlimited' : `${usageRow?.limit ?? 3} lifetime`}
                      </span>
                      <span style={{ display: 'flex', justifyContent: 'center' }}>
                        <Check size={16} color={colors.state.success} strokeWidth={3} />
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Billing interval toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                {(['monthly', 'annual'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setInterval(opt)}
                    style={{
                      position: 'relative', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${interval === opt ? colors.brand.navy : colors.border.default}`,
                      background: interval === opt ? colors.brand.navy : colors.surface.card,
                      color: interval === opt ? '#fff' : colors.text.inkSoft,
                    }}
                  >
                    {opt === 'monthly' ? 'Monthly' : 'Annual'}
                  </button>
                ))}
                {savings > 0 && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, color: colors.state.success, background: colors.state.successBg,
                    border: '1px solid #BBF7D0', borderRadius: 20, padding: '3px 10px',
                  }}>
                    Save ₹{(savings / 100).toLocaleString('en-IN')}/yr
                  </span>
                )}
              </div>

              {/* Premium plan card */}
              {premiumPlan && (
                <div style={{ background: colors.surface.card, borderRadius: radius.xl, padding: 28, border: `2px solid ${colors.brand.navy}`, boxShadow: shadows.elevated, textAlign: 'center', position: 'relative' }}>
                  <span style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: colors.brand.navy, color: '#fff', fontSize: 10.5, fontWeight: 800,
                    padding: '4px 14px', borderRadius: 20, letterSpacing: '0.4px', textTransform: 'uppercase',
                  }}>
                    Recommended
                  </span>
                  <p style={{ fontSize: 15, fontWeight: 800, color: colors.text.ink, margin: '6px 0 0' }}>BeginablAI Premium</p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: colors.brand.navy, margin: '8px 0 0' }}>
                    {formatPrice(premiumPlan.price_monthly)}
                    <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.muted }}>/{interval === 'monthly' ? 'mo' : 'yr'}</span>
                  </p>
                  <p style={{ fontSize: 12, color: colors.text.muted, margin: '4px 0 0' }}>
                    That's ~₹{dailyRate}/day — less than a cup of chai.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', fontSize: 13, color: colors.text.inkSoft, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', maxWidth: 320, marginInline: 'auto' }}>
                    {['Unlimited AI Counsellor conversations', 'Unlimited career roadmaps', 'Unlimited AI resume generations', 'Unlimited mock interview sessions'].map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Check size={15} color={colors.state.success} strokeWidth={3} style={{ flexShrink: 0 }} />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => upgrade.mutate(premiumPlan.id)}
                    disabled={upgrade.isPending}
                    style={{
                      width: '100%', height: 44, borderRadius: 10, border: 'none',
                      background: colors.brand.navy, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                      opacity: upgrade.isPending ? 0.6 : 1, boxShadow: shadows.button,
                    }}
                  >
                    {upgrade.isPending ? 'Processing…' : `Upgrade to Premium — ${formatPrice(premiumPlan.price_monthly)}/${interval === 'monthly' ? 'mo' : 'yr'}`}
                  </button>
                  {upgrade.isError && <p style={{ fontSize: 12, color: colors.state.danger, marginTop: 8 }}>{getApiError(upgrade.error)}</p>}
                  <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 12 }}>
                    Cancel anytime. Billed via Razorpay (UPI Autopay, cards & net banking).
                  </p>
                </div>
              )}

              <FaqAccordion />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
