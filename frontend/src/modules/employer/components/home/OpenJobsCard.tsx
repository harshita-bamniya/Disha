import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import type { EmployerOverview, OpenJob } from '@/api/employerHome'
import { card, cardSub, cardTitle, plural } from '@/shared/components/dashboard/styles'
import { accents, stageColors } from '@/shared/components/dashboard/palette'

const Chip = ({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'rose' | 'slate' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: accents[tone].fg, background: accents[tone].bg, whiteSpace: 'nowrap' }}>
    {children}
  </span>
)

/** The mix of candidates by stage, drawn as a thin bar so a busy job and a stuck one look different. */
function StageMix({ job }: { job: OpenJob }) {
  const parts = [
    { key: 'new', n: job.awaiting, label: 'New' }, { key: 'screening', n: job.screening, label: 'Screening' },
    { key: 'interview', n: job.in_interview, label: 'Interview' }, { key: 'offer', n: job.offer, label: 'Offer' },
  ] as const
  const active = parts.reduce((s, p) => s + p.n, 0)
  return (
    <div title={parts.map(p => `${p.label} ${p.n}`).join(' · ')} style={{ display: 'flex', width: 120, height: 8, borderRadius: 4, overflow: 'hidden', gap: 1, background: colors.surface.elevated }}>
      {active > 0 && parts.filter(p => p.n > 0).map(p => <span key={p.key} style={{ flex: p.n, background: stageColors[p.key] }} />)}
    </div>
  )
}

/** Your open jobs, most in need of a first look at the top. */
export default function OpenJobsCard({ jobs }: { jobs: EmployerOverview['jobs'] }) {
  const navigate = useNavigate()
  const hidden = jobs.total_open - jobs.items.length
  const afterDays = jobs.no_application_after_days ?? 7
  // Showing the department on every row is noise unless there is more than one to tell apart.
  const multiDept = new Set(jobs.items.map(j => j.department).filter(Boolean)).size > 1

  return (
    <section style={{ ...card, overflow: 'hidden' }} aria-labelledby="jobs-title">
      <div style={{ padding: '18px 20px 12px' }}>
        <h2 id="jobs-title" style={cardTitle}>Open jobs</h2>
        <p style={cardSub}>{jobs.total_open === 0 ? 'No jobs are open right now' : `${plural(jobs.total_open, 'job')} open, the ones needing a first look first`}</p>
      </div>

      {jobs.items.length === 0 ? (
        <p style={{ margin: 0, padding: '0 20px 20px', fontSize: 13, color: colors.text.inkSoft }}>
          Publish a job to start receiving applications. Jobs that are still drafts are not listed here.
        </p>
      ) : jobs.items.map(j => {
        const closing = j.closes_in_days != null && j.closes_in_days <= 7
        return (
          <button key={j.id} onClick={() => navigate(`/app/employer/pipeline/${j.id}`)}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'transparent', border: 'none', borderTop: `1px solid ${colors.border.default}`, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            onMouseOver={e => (e.currentTarget.style.background = colors.surface.bg)}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: colors.text.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5, fontSize: 12, color: colors.text.muted }}>
                <span>Open {j.age_days === 0 ? 'since today' : `${j.age_days} days`}</span>
                {multiDept && j.department && <Chip tone="slate">{j.department}</Chip>}
                {closing && <Chip tone="amber">Closes {j.closes_in_days === 0 ? 'today' : `in ${plural(j.closes_in_days!, 'day')}`}</Chip>}
                {j.no_applications && <Chip tone="rose">No applications after {afterDays} days</Chip>}
              </span>
            </span>
            {j.awaiting > 0 && <Chip tone="amber">{j.awaiting} waiting</Chip>}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: colors.text.inkSoft }}><strong style={{ color: colors.text.ink }}>{j.applicants}</strong> applicants</span>
              <StageMix job={j} />
            </span>
            <ChevronRight size={16} color={colors.text.muted} aria-hidden />
          </button>
        )
      })}
      {hidden > 0 && (
        <button onClick={() => navigate('/app/employer/jobs')}
          style={{ width: '100%', padding: '13px 20px', background: 'none', border: 'none', borderTop: `1px solid ${colors.border.default}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: colors.state.info, textAlign: 'left' }}>
          See all {jobs.total_open} open jobs
        </button>
      )}
    </section>
  )
}
