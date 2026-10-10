import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commandCenterApi, type FunnelResponse, type Side } from '@/api/commandCenter'
import { colors } from '@/design-system/tokens'
import Tabs from '@/shared/components/navigation/Tabs'
import { Spinner } from '../../shared/adminUI'
import { card, cardSub, cardTitle, plural } from './shared'

const SIDES: { key: Side; label: string; noun: string }[] = [
  { key: 'aspirant', label: 'Aspirants', noun: 'aspirant' },
  { key: 'employer', label: 'Employers', noun: 'employer' },
]

const LEAK_LABEL: Record<string, string> = {
  signed_up: 'sign-up', onboarding: 'onboarding', kscore: 'K-score', prep: 'prep activity', applied: 'applying',
  interview: 'interview stage', hired: 'hiring', registered: 'registering', kyc_submitted: 'KYC submission',
  kyc_approved: 'KYC approval', job_posted: 'posting a job', applicants: 'getting applicants', paid: 'paying',
}

/** Below this many people a conversion percentage is noise, so it is not shown at all. */
const MIN_COHORT = 30

export default function JourneyCard({ days, compare }: { days: number; compare: boolean }) {
  const [side, setSide] = useState<Side>('aspirant')
  const noun = SIDES.find(s => s.key === side)!.noun
  const { data, isLoading, isError } = useQuery<FunnelResponse>({
    queryKey: ['admin', 'dashboard', 'funnel', side, days, compare],
    queryFn: () => commandCenterApi.getFunnel({ side, days, compare }),
    staleTime: 5 * 60_000,
  })
  const start = data?.steps[0]?.count ?? 0
  const sparse = start < MIN_COHORT

  return (
    <section style={{ ...card, padding: '18px 20px' }} aria-labelledby="journey-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 id="journey-title" style={cardTitle}>Sign-up journey</h2>
          <p style={cardSub}>Everyone who joined in the last {days} days, and how far they got</p>
        </div>
        <Tabs tabs={SIDES.map(s => ({ key: s.key, label: s.label }))} active={side} onChange={k => setSide(k as Side)} variant="pill" />
      </div>

      <div style={{ marginTop: 18 }}>
        {isLoading ? <Spinner size="sm" />
          : isError || !data ? <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>Could not load this funnel.</p>
          : start === 0 ? <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>No {noun}s joined in this period.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sparse && (
                <p style={{ margin: 0, fontSize: 12.5, color: colors.text.inkSoft, background: colors.surface.bg, borderRadius: 10, padding: '9px 12px' }}>
                  Only {plural(start, noun)} joined in this period, so percentages are hidden until at least {MIN_COHORT} have.
                </p>
              )}
              {data.steps.map((step, i) => {
                const rate = step.pct_of_prev?.rate
                const showRate = !sparse && i > 0 && !step.low_sample && rate != null
                return (
                  <div key={step.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: colors.text.ink }}>{step.label}</span>
                      <span style={{ fontSize: 13, color: colors.text.muted }}>
                        {showRate && <>{Math.round(rate * 100)}% continue{compare && step.delta_pt != null && step.delta_pt !== 0 && (
                          <span style={{ color: step.delta_pt > 0 ? colors.state.success : colors.state.danger, fontWeight: 600 }}>
                            {' '}({step.delta_pt > 0 ? 'up' : 'down'} {Math.abs(step.delta_pt)} points)
                          </span>
                        )}{'  '}</>}
                        <strong style={{ color: colors.text.ink, fontSize: 15 }}>{step.count}</strong>
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: colors.surface.elevated, overflow: 'hidden' }}>
                      <div style={{ width: `${step.pct_of_start}%`, minWidth: step.count > 0 ? 6 : 0, height: '100%', borderRadius: 4, background: colors.brand.navy }} />
                    </div>
                  </div>
                )
              })}
              {!sparse && data.biggest_leak && (
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: colors.state.warning, background: colors.state.warningBg, borderRadius: 10, padding: '9px 12px' }}>
                  Biggest drop is at {LEAK_LABEL[data.biggest_leak.to_key] ?? data.biggest_leak.to_key}: {Math.round(data.biggest_leak.rate * 100)}% continue
                </p>
              )}
            </div>
          )}
      </div>
    </section>
  )
}
