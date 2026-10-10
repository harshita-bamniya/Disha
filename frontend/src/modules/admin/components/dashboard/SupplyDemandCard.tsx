import { useNavigate } from 'react-router-dom'
import type { MarketplaceOverview } from '@/api/adminDashboard'
import { colors } from '@/design-system/tokens'
import { card, cardSub, cardTitle, plural } from './shared'

/** Where the two sides of the marketplace are out of balance: applications per live job, by sector. */
export default function SupplyDemandCard({ data, days }: { data: MarketplaceOverview; days: number }) {
  const navigate = useNavigate()
  const max = Math.max(1, ...data.sectors.map(s => s.per_job))
  const zero = data.zero_application_jobs

  return (
    <section style={{ ...card, padding: '18px 20px' }} aria-labelledby="supply-title">
      <h2 id="supply-title" style={cardTitle}>Supply and demand</h2>
      <p style={cardSub}>Applications per live job, by sector, over the last {days} days</p>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.sectors.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>There are no live jobs yet.</p>
        ) : data.sectors.map(s => (
          <div key={s.sector}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: colors.text.ink }}>{s.sector}</span>
              <span style={{ fontSize: 12, color: s.applications === 0 ? colors.state.danger : colors.text.muted, fontWeight: s.applications === 0 ? 700 : 400, textAlign: 'right' }}>
                {plural(s.jobs, 'job')} · {s.applications === 0 ? 'no applications' : `${s.per_job} per job`}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: colors.surface.elevated, overflow: 'hidden' }}>
              <div style={{ width: `${(s.per_job / max) * 100}%`, minWidth: s.per_job > 0 ? 6 : 0, height: '100%', borderRadius: 4, background: colors.brand.navy }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${colors.border.default}` }}>
        {zero.total === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>
            Every job live for {zero.after_days} days or more has had an application.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: colors.text.ink }}>
              {plural(zero.total, 'job')} with no applications after {zero.after_days} days
            </p>
            {zero.items.map(j => (
              <button key={j.id} onClick={() => navigate(`/admin/jobs/${j.id}`)}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 13, color: colors.state.info }}>{j.title}</span>
                <span style={{ fontSize: 12, color: colors.text.muted, whiteSpace: 'nowrap' }}>{j.age_days}d live</span>
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
