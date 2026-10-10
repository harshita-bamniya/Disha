import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import type { RecentApplicant } from '@/api/employerHome'
import { card, cardSub, cardTitle } from '@/shared/components/dashboard/styles'
import { accents } from '@/shared/components/dashboard/palette'
import Avatar from '@/shared/components/data-display/Avatar'

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hrs = Math.floor(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`
}

/** Resume fit as a ring. The number is always printed, so the colour is only a hint. */
function FitRing({ score }: { score: number | null }) {
  if (score == null) return <span title="Applied without a resume" style={{ width: 38, textAlign: 'center', fontSize: 11, color: colors.text.muted }}>No resume</span>
  const tone = score >= 75 ? accents.emerald : score >= 55 ? accents.amber : accents.slate
  const r = 15, c = 2 * Math.PI * r
  return (
    <svg width={38} height={38} viewBox="0 0 38 38" role="img" aria-label={`Resume fit ${score} out of 100`} style={{ flexShrink: 0 }}>
      <circle cx={19} cy={19} r={r} fill="none" stroke={tone.bg} strokeWidth={4} />
      <circle cx={19} cy={19} r={r} fill="none" stroke={tone.fg} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 19 19)" />
      <text x={19} y={23} textAnchor="middle" fontSize={11} fontWeight={700} fill={colors.text.ink}>{score}</text>
    </svg>
  )
}

export default function RecentApplicantsCard({ items }: { items: RecentApplicant[] }) {
  const navigate = useNavigate()
  return (
    <section style={{ ...card, overflow: 'hidden' }} aria-labelledby="recent-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 20px 12px', gap: 12 }}>
        <div>
          <h2 id="recent-title" style={cardTitle}>Recent applicants</h2>
          <p style={cardSub}>With how well their resume fits the job</p>
        </div>
        <Link to="/app/employer/applicants" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: colors.state.info, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          View all <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, padding: '0 20px 20px', fontSize: 13, color: colors.text.inkSoft }}>New applications show up here as they arrive.</p>
      ) : items.map(a => (
        <button key={a.application_id} onClick={() => navigate(`/app/employer/pipeline/${a.job_id}`)}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '11px 20px', background: 'transparent', border: 'none', borderTop: `1px solid ${colors.border.default}`, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          onMouseOver={e => (e.currentTarget.style.background = colors.surface.bg)}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
          <Avatar name={a.candidate} size={36} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: colors.text.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.candidate}</span>
              {a.status === 'applied' && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99, color: accents.indigo.fg, background: accents.indigo.bg }}>New</span>}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: colors.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.job_title} · {ago(a.applied_at)}</span>
          </span>
          <FitRing score={a.match_score} />
        </button>
      ))}
    </section>
  )
}
