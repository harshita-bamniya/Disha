import { Users, Handshake, Gift, TrendingUp, ArrowRight } from 'lucide-react'
import { C } from '../../ds'
import StatCard from '@/shared/components/data-display/StatCard'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import AlertBanner from '@/shared/components/feedback/AlertBanner'
import Button from '@/shared/components/primitives/Button'
import { useReferralOverview } from '../../hooks/useReferrals'
import { Card, H, money } from './referralUi'

const FUNNEL: { key: 'invited' | 'applied' | 'in_process' | 'hired'; label: string }[] = [
  { key: 'invited', label: 'Invited, not applied yet' },
  { key: 'applied', label: 'Applied' },
  { key: 'in_process', label: 'In interview process' },
  { key: 'hired', label: 'Hired' },
]

export default function OverviewPanel({ onGoTo }: { onGoTo: (tab: string) => void }) {
  const { data, isLoading, isError, refetch } = useReferralOverview()
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
  if (isError || !data) return <ErrorState description="Could not load the referral overview." onRetry={() => refetch()} />

  const r = data.rewards_by_status
  const toApprove = r.eligible.count
  const max = Math.max(1, ...FUNNEL.map(f => data.by_status[f.key] ?? 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!data.program_enabled && (
        <AlertBanner variant="warning" title="The program is switched off"
          message="Employees can't refer anyone and links won't attribute. Existing referrals and bonuses are unaffected."
          action={<Button size="sm" variant="outline" onClick={() => onGoTo('settings')}>Open settings</Button>} />
      )}
      {toApprove > 0 && (
        <AlertBanner variant="info" title={`${toApprove} bonus${toApprove > 1 ? 'es' : ''} ready to approve`}
          message={`${money(r.eligible.amount)} has completed its retention period.`}
          action={<Button size="sm" onClick={() => onGoTo('rewards')}>Review <ArrowRight size={13} /></Button>} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <StatCard icon={Users} label="Referrers" value={data.referrers} sub="Teammates and invited employees" />
        <StatCard icon={Handshake} label="Referrals" value={data.referrals} sub={`${data.hires} hired`} />
        <StatCard icon={TrendingUp} label="Referral → hire" value={`${Math.round(data.conversion_rate * 100)}%`} sub="Of those who applied" />
        <StatCard icon={Gift} label="Owed" value={money(r.pending.amount + r.eligible.amount + r.approved.amount)} sub={`${money(r.paid.amount)} paid so far`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Card>
          <H sub="Where referred candidates are right now">Pipeline</H>
          {data.referrals === 0 ? <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>No referrals yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FUNNEL.map(f => {
                const n = data.by_status[f.key] ?? 0
                return (
                  <div key={f.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ink2, marginBottom: 4 }}>
                      <span>{f.label}</span><strong style={{ color: C.ink1 }}>{n}</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#EAECF0' }}>
                      <div style={{ width: `${(n / max) * 100}%`, height: '100%', borderRadius: 3, background: f.key === 'hired' ? C.green : C.brand }} />
                    </div>
                  </div>
                )
              })}
              <p style={{ margin: '4px 0 0', fontSize: 12, color: C.ink3 }}>
                {(data.by_status.rejected ?? 0)} not selected · {(data.by_status.withdrawn ?? 0)} withdrew
              </p>
            </div>
          )}
        </Card>

        <Card>
          <H sub="Ranked by hires, then referrals">Top referrers</H>
          {data.top_referrers.length === 0 ? <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>Nobody has referred anyone yet.</p> : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.top_referrers.map((p, i) => (
                <li key={p.referrer_id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ width: 20, color: C.ink3, fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: C.ink1 }}>{p.name}</span>
                  <span style={{ color: C.ink2 }}>{p.referrals} referred · {p.hires} hired</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <H sub="Roles that bring in the most referrals">Top roles</H>
          {data.top_jobs.length === 0 ? <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>Nothing yet.</p> : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.top_jobs.map(j => (
                <li key={j.job_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: C.ink1 }}>{j.title}</span>
                  <span style={{ color: C.ink2, whiteSpace: 'nowrap' }}>{j.referrals} referred · {j.hires} hired</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
