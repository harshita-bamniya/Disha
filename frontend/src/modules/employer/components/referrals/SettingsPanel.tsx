import { useEffect, useState } from 'react'
import { C } from '../../ds'
import Button from '@/shared/components/primitives/Button'
import Badge from '@/shared/components/data-display/Badge'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { toast } from '@/shared/components/feedback/Toast'
import { getApiError } from '@/api/client'
import type { ReferralJob } from '@/api/referrals'
import { useReferralJobs, useReferralProgram, useUpdateProgram, useUpdateReferralJob } from '../../hooks/useReferrals'
import { Card, H, ellipsis, inputStyle, money, rowStyle, Th } from './referralUi'

const JOB_COLS = 'minmax(200px,1.6fr) 120px 80px 150px 190px'

function JobRow({ job, last }: { job: ReferralJob; last: boolean }) {
  const update = useUpdateReferralJob()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(job.bonus_amount))
  useEffect(() => setAmount(String(job.bonus_amount)), [job.bonus_amount])
  const fail = (e: unknown) => toast.danger(getApiError(e, 'Could not save.'))

  return (
    <div role="row" style={rowStyle(JOB_COLS, last)}>
      <span role="cell" style={{ minWidth: 0 }}>
        <span style={{ ...ellipsis, display: 'block', fontWeight: 600 }}>{job.title}</span>
        <span style={{ ...ellipsis, display: 'block', fontSize: 12, color: C.ink3 }}>{[job.department, job.location].filter(Boolean).join(' · ') || ' '}</span>
      </span>
      <span role="cell">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={job.is_open} disabled={update.isPending}
            onChange={e => update.mutate({ jobId: job.job_id, body: { is_open: e.target.checked } }, { onError: fail })} />
          {job.is_open ? 'Open' : 'Closed'}
        </label>
      </span>
      <span role="cell" style={{ color: C.ink2 }}>{job.referral_count}</span>
      <span role="cell">
        {editing ? (
          <input aria-label={`Bonus for ${job.title}`} type="number" min={0} max={10000000} value={amount} autoFocus
            onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, width: 110 }} />
        ) : (
          <span>{money(job.bonus_amount)} {job.has_override && <Badge color="amber">custom</Badge>}</span>
        )}
      </span>
      <span role="cell" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <Button size="sm" disabled={update.isPending || amount === '' || Number(amount) < 0}
              onClick={() => update.mutate({ jobId: job.job_id, body: { bonus_amount: Math.round(Number(amount)) } }, { onSuccess: () => setEditing(false), onError: fail })}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setAmount(String(job.bonus_amount)) }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Set bonus</Button>
            {job.has_override && (
              <Button size="sm" variant="ghost" disabled={update.isPending}
                onClick={() => update.mutate({ jobId: job.job_id, body: { clear_bonus: true } }, { onError: fail })}>Use default</Button>
            )}
          </>
        )}
      </span>
    </div>
  )
}

export default function SettingsPanel() {
  const { data: program, isLoading, isError, refetch } = useReferralProgram()
  const { data: jobs } = useReferralJobs()
  const save = useUpdateProgram()
  const [bonus, setBonus] = useState('')
  const [hold, setHold] = useState('')
  const [terms, setTerms] = useState('')

  useEffect(() => {
    if (!program) return
    setBonus(String(program.default_bonus_amount)); setHold(String(program.hold_days)); setTerms(program.terms ?? '')
  }, [program])

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
  if (isError || !program) return <ErrorState description="Could not load program settings." onRetry={() => refetch()} />

  const bonusN = Number(bonus), holdN = Number(hold)
  const valid = bonus !== '' && hold !== '' && Number.isInteger(bonusN) && bonusN >= 0 && bonusN <= 10_000_000 && Number.isInteger(holdN) && holdN >= 0 && holdN <= 730
  const dirty = bonusN !== program.default_bonus_amount || holdN !== program.hold_days || terms !== (program.terms ?? '')
  const fail = (e: unknown) => toast.danger(getApiError(e, 'Could not save.'))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <H sub={program.is_enabled ? 'Employees can refer people and links credit them.' : 'Nothing is credited while this is off. Existing referrals and bonuses are not affected.'}>
            Referral program is {program.is_enabled ? 'on' : 'off'}
          </H>
        </div>
        <Button variant={program.is_enabled ? 'outline' : 'primary'} disabled={save.isPending}
          onClick={() => save.mutate({ is_enabled: !program.is_enabled }, { onError: fail })}>
          {program.is_enabled ? 'Turn off' : 'Turn on'}
        </Button>
      </Card>

      <Card>
        <H sub="Applies to every role unless you set a custom bonus for it below.">Bonus and rules</H>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.ink2 }}>
            Default bonus per hire (₹)
            <input type="number" min={0} max={10000000} value={bonus} onChange={e => setBonus(e.target.value)} style={inputStyle} />
            <span style={{ color: C.ink3 }}>0 means recognition only: referrals are tracked, nothing is owed.</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.ink2 }}>
            Retention period (days)
            <input type="number" min={0} max={730} value={hold} onChange={e => setHold(e.target.value)} style={inputStyle} />
            <span style={{ color: C.ink3 }}>The bonus becomes payable this long after the hire. Most companies use 60–90.</span>
          </label>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.ink2, marginTop: 14 }}>
          Rules shown to referrers (optional)
          <textarea rows={4} maxLength={5000} value={terms} onChange={e => setTerms(e.target.value)}
            placeholder="e.g. Bonus is paid with the payroll after the retention period. Referring a direct report's team is not eligible."
            style={{ padding: 10, fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' }} />
        </label>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: C.ink3 }}>
          A change here never alters a bonus that was already created. Each one keeps the amount that applied on the day of the hire.
        </p>
        <div style={{ marginTop: 14 }}>
          <Button disabled={!valid || !dirty || save.isPending}
            onClick={() => save.mutate({ default_bonus_amount: bonusN, hold_days: holdN, terms }, { onSuccess: () => toast.success('Saved.'), onError: fail })}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Card>

      <Card pad={0}>
        <div style={{ padding: '16px 16px 4px' }}><H sub="Close a role to referrals, or pay a different bonus for a hard-to-fill one. Only published roles are listed.">Per-role settings</H></div>
        {!jobs ? <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spinner /></div>
          : jobs.length === 0 ? <p style={{ padding: '4px 16px 20px', fontSize: 13, color: C.ink2 }}>No published roles.</p> : (
            <div role="table" aria-label="Per-role referral settings" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 780 }}>
                <Th cols={['Role', 'Open to referrals', 'Referred', 'Bonus', '']} template={JOB_COLS} />
                {jobs.map((j, i) => <JobRow key={j.job_id} job={j} last={i === jobs.length - 1} />)}
              </div>
            </div>
          )}
      </Card>
    </div>
  )
}
