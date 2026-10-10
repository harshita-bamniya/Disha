import { useState } from 'react'
import { Download } from 'lucide-react'
import { C } from '../../ds'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import EmptyState from '@/shared/components/feedback/EmptyState'
import Tabs from '@/shared/components/navigation/Tabs'
import Modal from '@/shared/components/overlays/Modal'
import { toast } from '@/shared/components/feedback/Toast'
import { getApiError } from '@/api/client'
import { referralsApi, type Reward } from '@/api/referrals'
import { useApproveReward, usePayReward, useRejectReward, useRewards } from '../../hooks/useReferrals'
import { Card, RewardBadge, ellipsis, fmtDate, inputStyle, money, rowStyle, Th } from './referralUi'

const COLS = 'minmax(150px,1fr) minmax(150px,1fr) minmax(130px,1fr) 110px 150px 200px'

type Dialog = { kind: 'pay' | 'reject'; reward: Reward } | null

function ActionDialog({ dialog, onClose }: { dialog: NonNullable<Dialog>; onClose: () => void }) {
  const pay = usePayReward()
  const reject = useRejectReward()
  const [text, setText] = useState('')
  const [hireLeft, setHireLeft] = useState(false)
  const { reward } = dialog
  const busy = pay.isPending || reject.isPending
  const isPay = dialog.kind === 'pay'

  const submit = () => {
    const done = { onSuccess: () => { toast.success(isPay ? 'Marked as paid.' : 'Bonus declined.'); onClose() },
                   onError: (e: unknown) => toast.danger(getApiError(e, 'Could not save.')) }
    if (isPay) pay.mutate({ id: reward.id, ref: text.trim() || undefined }, done)
    else reject.mutate({ id: reward.id, reason: text.trim(), hireLeft }, done)
  }

  return (
    <Modal open onClose={onClose} width={440} title={isPay ? 'Mark bonus as paid' : 'Decline bonus'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={isPay ? 'primary' : 'danger'} disabled={busy || (!isPay && text.trim().length < 3)} onClick={submit}>
          {busy ? 'Saving…' : isPay ? 'Mark as paid' : 'Decline bonus'}
        </Button>
      </>}>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: C.ink2 }}>
        {money(reward.amount, reward.currency)} to <strong style={{ color: C.ink1 }}>{reward.referrer_name}</strong> for referring {reward.candidate_name ?? 'a candidate'} ({reward.job_title}).
        {isPay && ' BeginablAI records the payout; the money itself moves through your payroll or bank.'}
      </p>
      <input aria-label={isPay ? 'Payment reference' : 'Reason'} value={text} maxLength={isPay ? 120 : 1000} onChange={e => setText(e.target.value)}
        placeholder={isPay ? 'Payroll month or bank reference (optional)' : 'Reason (the referrer is told)'} style={{ ...inputStyle, width: '100%' }} />
      {!isPay && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13, color: C.ink1 }}>
          <input type="checkbox" checked={hireLeft} onChange={e => setHireLeft(e.target.checked)} />
          The hire left before the retention period ended
        </label>
      )}
    </Modal>
  )
}

export default function RewardsPanel() {
  const [filter, setFilter] = useState('all')
  const { data, isLoading, isError, refetch } = useRewards(filter === 'all' ? undefined : filter)
  const approve = useApproveReward()
  const [dialog, setDialog] = useState<Dialog>(null)

  const exportCsv = async () => {
    try {
      const blob = await referralsApi.exportRewards()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'referral-rewards.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.danger(getApiError(e, 'Could not export.'))
    }
  }

  const tabs = [
    { key: 'all', label: 'All' }, { key: 'eligible', label: 'Ready to approve' }, { key: 'approved', label: 'To pay' },
    { key: 'pending', label: 'In retention' }, { key: 'paid', label: 'Paid' },
  ]

  return (
    <Card pad={0}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <Tabs tabs={tabs} active={filter} onChange={setFilter} variant="pill" />
        <Button variant="outline" size="sm" onClick={exportCsv}><Download size={13} />Export CSV</Button>
      </div>

      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spinner /></div>
        : isError ? <ErrorState description="Could not load bonuses." onRetry={() => refetch()} />
        : !data || data.length === 0 ? (
          <EmptyState title="No bonuses here" description="A bonus is created automatically when a referred candidate is marked Hired. It becomes payable after the retention period you set." />
        ) : (
          <div role="table" aria-label="Referral bonuses" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 860 }}>
              <Th cols={['Referrer', 'Candidate', 'Role', 'Amount', 'Status', '']} template={COLS} />
              {data.map((r, i) => (
                <div key={r.id} role="row" style={rowStyle(COLS, i === data.length - 1)}>
                  <span role="cell" style={{ ...ellipsis, fontWeight: 600 }}>{r.referrer_name}</span>
                  <span role="cell" style={{ ...ellipsis, color: C.ink2 }}>{r.candidate_name ?? '—'}</span>
                  <span role="cell" style={{ ...ellipsis, color: C.ink2 }}>{r.job_title}</span>
                  <span role="cell" style={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</span>
                  <span role="cell">
                    <RewardBadge status={r.status} />
                    <span style={{ display: 'block', fontSize: 11, color: C.ink3, marginTop: 2 }}>
                      {r.status === 'pending' ? `Payable ${fmtDate(r.eligible_on)}` : r.status === 'paid' ? `Paid ${fmtDate(r.paid_at)}${r.payment_reference ? ` · ${r.payment_reference}` : ''}` : `Hired ${fmtDate(r.hired_at)}`}
                    </span>
                  </span>
                  <span role="cell" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {r.status === 'eligible' && (
                      <Button size="sm" disabled={approve.isPending}
                        onClick={() => approve.mutate(r.id, { onSuccess: () => toast.success('Bonus approved. The referrer has been told.'), onError: e => toast.danger(getApiError(e, 'Could not approve.')) })}>
                        Approve
                      </Button>
                    )}
                    {r.status === 'approved' && <Button size="sm" onClick={() => setDialog({ kind: 'pay', reward: r })}>Mark paid</Button>}
                    {(r.status === 'pending' || r.status === 'eligible' || r.status === 'approved') && (
                      <Button size="sm" variant="ghost" style={{ color: C.red }} onClick={() => setDialog({ kind: 'reject', reward: r })}>Decline</Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      {dialog && <ActionDialog key={dialog.reward.id + dialog.kind} dialog={dialog} onClose={() => setDialog(null)} />}
    </Card>
  )
}
