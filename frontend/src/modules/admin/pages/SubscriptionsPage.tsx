import { useState } from 'react'
import { Award } from 'lucide-react'
import { useSubscriptionPlansAdmin, useUpdateSubscriptionPlan } from '../hooks/useAdmin'
import { Spinner, Empty } from '../shared/adminUI'
import { cn } from '@/lib/utils'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

export default function SubscriptionsPage() {
  const { data: plans, isLoading } = useSubscriptionPlansAdmin()
  const update = useUpdateSubscriptionPlan()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ price_monthly: string; max_active_jobs: string; max_recruiter_seats: string }>({
    price_monthly: '', max_active_jobs: '', max_recruiter_seats: '',
  })

  const inputStyle = { height: 32, padding: '0 8px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Subscription Plans</h1>
        <p style={{ fontSize: 14, color: N.muted, marginTop: 4 }}>Configure plan limits and pricing. Prices are in paise (1 INR = 100 paise).</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: N.ink }}>Active Plans</h2>
        </div>

        {isLoading ? <Spinner /> : !plans || plans.length === 0 ? (
          <Empty icon={Award} text="No plans found" />
        ) : (
          plans.map((p, idx) => (
            <div
              key={p.id}
              style={{
                padding: '16px 20px',
                borderBottom: idx < plans.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                background: idx % 2 === 0 ? '#fff' : N.cream,
              }}
            >
              {editingId === p.id ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <p style={{ fontSize: 10, color: N.muted, marginBottom: 4 }}>Price (paise/mo)</p>
                    <input value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: e.target.value })}
                      style={{ ...inputStyle, width: 112 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: N.muted, marginBottom: 4 }}>Max active jobs</p>
                    <input value={form.max_active_jobs} onChange={e => setForm({ ...form, max_active_jobs: e.target.value })}
                      placeholder="blank = unlimited" style={{ ...inputStyle, width: 128 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: N.muted, marginBottom: 4 }}>Max seats</p>
                    <input value={form.max_recruiter_seats} onChange={e => setForm({ ...form, max_recruiter_seats: e.target.value })}
                      placeholder="blank = unlimited" style={{ ...inputStyle, width: 128 }} />
                  </div>
                  <button
                    onClick={() => update.mutate({
                      planId: p.id,
                      payload: {
                        price_monthly: Number(form.price_monthly) || 0,
                        max_active_jobs: form.max_active_jobs === '' ? null : Number(form.max_active_jobs),
                        max_recruiter_seats: form.max_recruiter_seats === '' ? null : Number(form.max_recruiter_seats),
                      },
                    }, { onSuccess: () => setEditingId(null) })}
                    disabled={update.isPending}
                    style={{ height: 32, padding: '0 12px', borderRadius: 10, background: N.navy, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', opacity: update.isPending ? 0.5 : 1 }}
                  >Save</button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ height: 32, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, fontWeight: 500, color: N.muted, background: '#fff' }}
                  >Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: N.ink, textTransform: 'capitalize' }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>
                      {p.price_monthly === 0 ? 'Free' : `₹${(p.price_monthly / 100).toLocaleString('en-IN')}/mo`}
                      {' · '}{p.max_active_jobs ?? 'Unlimited'} jobs · {p.max_recruiter_seats ?? 'Unlimited'} seats
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(p.id)
                      setForm({
                        price_monthly: String(p.price_monthly),
                        max_active_jobs: p.max_active_jobs?.toString() ?? '',
                        max_recruiter_seats: p.max_recruiter_seats?.toString() ?? '',
                      })
                    }}
                    style={{ fontSize: 12, fontWeight: 600, color: N.navy, background: 'transparent', border: 'none' }}
                  >Edit</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
