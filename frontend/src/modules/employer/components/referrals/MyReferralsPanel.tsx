/**
 * "My referrals": a person's own share links, the people they referred and the bonus status.
 * Used both inside the employer portal (signed-in teammate) and on the public private-link page
 * (invited employee). The two differ only in how a nomination is submitted, so that is injected.
 */
import { useState } from 'react'
import { Copy, Check, Send, Gift } from 'lucide-react'
import { C } from '../../ds'
import Button from '@/shared/components/primitives/Button'
import StatCard from '@/shared/components/data-display/StatCard'
import EmptyState from '@/shared/components/feedback/EmptyState'
import AlertBanner from '@/shared/components/feedback/AlertBanner'
import { toast } from '@/shared/components/feedback/Toast'
import { getApiError } from '@/api/client'
import type { MyReferrals, NominatePayload } from '@/api/referrals'
import { Card, H, ReferralBadge, RewardBadge, ellipsis, fmtDate, inputStyle, money, rowStyle, selectStyle, Th } from './referralUi'

const JOBS_COLS = 'minmax(180px,1.6fr) 130px 110px 150px'
const REF_COLS = 'minmax(140px,1fr) minmax(180px,1.4fr) 120px 170px 110px'

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      } catch {
        toast.danger('Could not copy. Select the link and copy it manually.')
      }
    }}>
      {done ? <Check size={13} /> : <Copy size={13} />}{done ? 'Copied' : 'Copy link'}
    </Button>
  )
}

function NominateForm({ data, onSubmit, pending }: { data: MyReferrals; onSubmit: (p: NominatePayload) => Promise<unknown>; pending: boolean }) {
  const [jobId, setJobId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const valid = jobId && name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        if (!valid) return
        try {
          await onSubmit({ job_id: jobId, candidate_name: name.trim(), candidate_email: email.trim(), note: note.trim() || undefined })
          toast.success(`We emailed ${name.trim()} a link to apply.`)
          setName(''); setEmail(''); setNote('')
        } catch (err) {
          toast.danger(getApiError(err, 'Could not send the referral.'))
        }
      }}
      style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
    >
      <select aria-label="Job" value={jobId} onChange={e => setJobId(e.target.value)} style={selectStyle}>
        <option value="">Choose a job…</option>
        {data.jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.title}</option>)}
      </select>
      <input aria-label="Candidate name" placeholder="Their name" value={name} maxLength={150} onChange={e => setName(e.target.value)} style={inputStyle} />
      <input aria-label="Candidate email" type="email" placeholder="Their email" value={email} maxLength={255} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <input aria-label="Why are they a good fit" placeholder="Why are they a good fit? (optional)" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button type="submit" size="sm" disabled={!valid || pending}><Send size={13} />{pending ? 'Sending…' : 'Email them the role'}</Button>
        <span style={{ fontSize: 12, color: C.ink3 }}>They get one email with the job and your recommendation. You get credit when they apply through it.</span>
      </div>
    </form>
  )
}

export default function MyReferralsPanel({ data, onNominate, nominating }: {
  data: MyReferrals
  onNominate: (p: NominatePayload) => Promise<unknown>
  nominating: boolean
}) {
  const cur = data.currency
  if (!data.program_enabled) {
    return (
      <Card>
        <EmptyState
          icon={<Gift size={28} color={C.ink3} />}
          title="Referrals are paused"
          description={`${data.company_name} is not taking referrals right now. Your history below is kept, and any bonus already earned stays valid.`}
        />
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <StatCard icon={Send} label="People referred" value={data.totals.referred} sub={`${data.totals.hired} hired`} />
        <StatCard icon={Gift} label="Waiting out retention" value={money(data.totals.pending_amount, cur)} sub={`Payable ${data.hold_days} days after joining`} />
        <StatCard icon={Gift} label="Payable" value={money(data.totals.payable_amount, cur)} sub="Approved or ready to approve" />
        <StatCard icon={Check} label="Paid to you" value={money(data.totals.paid_amount, cur)} />
      </div>

      <Card pad={0}>
        <div style={{ padding: '16px 16px 4px' }}>
          <H sub="Share the link, or send it by email below. Anyone who applies through your link is credited to you.">Open roles you can refer for</H>
        </div>
        {data.jobs.length === 0 ? (
          <p style={{ padding: '4px 16px 20px', fontSize: 13, color: C.ink2 }}>No roles are open for referrals at the moment.</p>
        ) : (
          <div role="table" aria-label="Open roles" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 640 }}>
              <Th cols={['Role', 'Location', 'Bonus', '']} template={JOBS_COLS} />
              {data.jobs.map((j, i) => (
                <div key={j.job_id} role="row" style={rowStyle(JOBS_COLS, i === data.jobs.length - 1)}>
                  <span role="cell" style={{ ...ellipsis, fontWeight: 600 }}>{j.title}</span>
                  <span role="cell" style={{ ...ellipsis, color: C.ink2 }}>{j.location ?? '—'}</span>
                  <span role="cell">{j.bonus_amount > 0 ? money(j.bonus_amount, cur) : 'Recognition'}</span>
                  <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}><CopyButton text={j.share_url} /></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {data.jobs.length > 0 && (
        <Card>
          <H sub="Know someone for one of these roles? We email them directly.">Refer someone by email</H>
          <NominateForm data={data} onSubmit={onNominate} pending={nominating} />
        </Card>
      )}

      <Card pad={0}>
        <div style={{ padding: '16px 16px 4px' }}><H>Your referrals</H></div>
        {data.referrals.length === 0 ? (
          <p style={{ padding: '4px 16px 20px', fontSize: 13, color: C.ink2 }}>Nobody yet. Copy a link above and share it, or refer someone by email.</p>
        ) : (
          <div role="table" aria-label="Your referrals" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 720 }}>
              <Th cols={['Candidate', 'Role', 'Status', 'Bonus', 'Date']} template={REF_COLS} />
              {data.referrals.map((r, i) => (
                <div key={r.id} role="row" style={rowStyle(REF_COLS, i === data.referrals.length - 1)}>
                  <span role="cell" style={{ ...ellipsis, fontWeight: 600 }}>{r.candidate}</span>
                  <span role="cell" style={{ ...ellipsis, color: C.ink2 }}>{r.job_title}</span>
                  <span role="cell"><ReferralBadge status={r.status} /></span>
                  <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.reward_status ? <><RewardBadge status={r.reward_status} />{r.reward_amount ? <span style={{ fontSize: 12, color: C.ink2 }}>{money(r.reward_amount, cur)}</span> : null}</> : <span style={{ color: C.ink3 }}>—</span>}
                  </span>
                  <span role="cell" style={{ color: C.ink2 }}>{fmtDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {data.terms && (
        <AlertBanner variant="info" title="Program rules" message={data.terms} />
      )}
    </div>
  )
}
