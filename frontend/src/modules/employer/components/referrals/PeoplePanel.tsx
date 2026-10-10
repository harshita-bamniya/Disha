import { useState } from 'react'
import { Plus, RotateCcw } from 'lucide-react'
import { C } from '../../ds'
import Button from '@/shared/components/primitives/Button'
import Badge from '@/shared/components/data-display/Badge'
import Modal from '@/shared/components/overlays/Modal'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import EmptyState from '@/shared/components/feedback/EmptyState'
import { toast } from '@/shared/components/feedback/Toast'
import { getApiError } from '@/api/client'
import { useInviteReferrers, useReferrers, useResendReferrer, useSetReferrerStatus } from '../../hooks/useReferrals'
import { Card, ellipsis, money, rowStyle, Th } from './referralUi'

const COLS = 'minmax(180px,1.4fr) 120px 90px 90px 110px 190px'
const EMAIL_RE = /[^\s,;<>"]+@[^\s,;<>"]+\.[^\s,;<>"]+/g

/** Accepts one per line: "Name <email>", "Name, email", or just an email. */
function parsePeople(raw: string): { name: string; email: string }[] {
  const seen = new Set<string>()
  const out: { name: string; email: string }[] = []
  for (const line of raw.split(/\n/)) {
    const m = line.match(EMAIL_RE)
    if (!m) continue
    const email = m[0].toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    const name = line.replace(m[0], '').replace(/[<>,;"]/g, ' ').replace(/\s+/g, ' ').trim()
    out.push({ name: name || email.split('@')[0], email })
  }
  return out
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [raw, setRaw] = useState('')
  const invite = useInviteReferrers()
  const people = parsePeople(raw)

  return (
    <Modal open onClose={onClose} width={520} title="Add referrers"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={people.length === 0 || invite.isPending} onClick={() => invite.mutate(people, {
          onSuccess: res => {
            const skipped = res.skipped.length
            toast.success(`${res.added.length} added${skipped ? `, ${skipped} skipped (${res.skipped[0].reason.toLowerCase()})` : ''}.`)
            onClose()
          },
          onError: e => toast.danger(getApiError(e, 'Could not add them.')),
        })}>
          {invite.isPending ? 'Sending…' : `Add ${people.length || ''} ${people.length === 1 ? 'person' : 'people'}`}
        </Button>
      </>}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: C.ink2 }}>
        Employees don't need a BeginablAI account or a team seat. Each gets an email with a private page showing their share links and referral status.
      </p>
      <textarea aria-label="People to add" rows={7} value={raw} onChange={e => setRaw(e.target.value)}
        placeholder={'Asha Rao <asha@company.com>\nravi@company.com\nMeera Iyer, meera@company.com'}
        style={{ width: '100%', padding: 10, fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' }} />
      <p style={{ margin: '6px 0 0', fontSize: 12, color: C.ink3 }}>
        One per line. {people.length > 0 && `${people.length} valid ${people.length === 1 ? 'address' : 'addresses'} found.`} Up to 200 at a time.
      </p>
    </Modal>
  )
}

export default function PeoplePanel() {
  const { data, isLoading, isError, refetch } = useReferrers()
  const resend = useResendReferrer()
  const setStatus = useSetReferrerStatus()
  const [adding, setAdding] = useState(false)

  return (
    <Card pad={0}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12, color: C.ink2 }}>Teammates appear automatically the first time they open this page. Employees without a seat are added here.</span>
        <Button size="sm" onClick={() => setAdding(true)}><Plus size={13} />Add referrers</Button>
      </div>

      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spinner /></div>
        : isError ? <ErrorState description="Could not load referrers." onRetry={() => refetch()} />
        : !data || data.length === 0 ? (
          <EmptyState title="No referrers yet" description="Add the employees who should be able to refer people. They get a private link by email."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus size={13} />Add referrers</Button>} />
        ) : (
          <div role="table" aria-label="Referrers" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 820 }}>
              <Th cols={['Person', 'Type', 'Referred', 'Hired', 'Earned', '']} template={COLS} />
              {data.map((p, i) => (
                <div key={p.id} role="row" style={{ ...rowStyle(COLS, i === data.length - 1), opacity: p.status === 'disabled' ? 0.55 : 1 }}>
                  <span role="cell" style={{ minWidth: 0 }}>
                    <span style={{ ...ellipsis, display: 'block', fontWeight: 600 }}>{p.name}</span>
                    <span style={{ ...ellipsis, display: 'block', fontSize: 12, color: C.ink3 }}>{p.email}</span>
                  </span>
                  <span role="cell">{p.status === 'disabled' ? <Badge color="gray">Disabled</Badge> : p.is_teammate ? <Badge color="navy">Teammate</Badge> : <Badge color="blue">Invited</Badge>}</span>
                  <span role="cell">{p.referral_count}</span>
                  <span role="cell">{p.hired_count}</span>
                  <span role="cell">{p.earned_amount ? money(p.earned_amount) : '—'}</span>
                  <span role="cell" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {!p.is_teammate && p.status === 'active' && (
                      <Button size="sm" variant="outline" disabled={resend.isPending}
                        onClick={() => resend.mutate(p.id, { onSuccess: () => toast.success(`New private link sent to ${p.email}. The old one no longer works.`), onError: e => toast.danger(getApiError(e, 'Could not resend.')) })}>
                        <RotateCcw size={12} />New link
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" style={{ color: p.status === 'active' ? C.red : C.accent }} disabled={setStatus.isPending}
                      onClick={() => {
                        if (p.status === 'active' && !window.confirm(`Disable ${p.name}? Their share link and private page stop working immediately. Referrals already made keep their credit.`)) return
                        setStatus.mutate({ id: p.id, status: p.status === 'active' ? 'disabled' : 'active' }, { onError: e => toast.danger(getApiError(e, 'Could not update.')) })
                      }}>
                      {p.status === 'active' ? 'Disable' : 'Enable'}
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      {adding && <InviteModal onClose={() => setAdding(false)} />}
    </Card>
  )
}
