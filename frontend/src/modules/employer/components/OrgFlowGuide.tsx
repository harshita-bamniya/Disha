import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useDepartments, useEmployerDashboard, useTeamInvites, useTeamMembers } from '../hooks/useJobs'
import { colors } from '@/design-system/tokens'

type Step = 'departments' | 'team' | 'jobs'

interface StepDef {
  key: Step
  title: string
  what: string
  status: string
  done: boolean
  to: string
  cta: string
}

/**
 * The three things that make up a hiring workspace, in the order they are done, with the
 * live state of each. It is what the Departments and Team pages share so the flow is
 * never a guess:  structure (departments) -> people (team, by invitation) -> work (jobs).
 */
export default function OrgFlowGuide({ here }: { here: Step }) {
  const { data: departments } = useDepartments()
  const { data: team } = useTeamMembers()
  const { data: invites } = useTeamInvites()
  const { data: dashboard } = useEmployerDashboard()

  const deptCount = departments?.length ?? 0
  const members = (team ?? []).filter(m => !m.is_owner).length
  const waiting = (invites ?? []).filter(i => i.status === 'pending').length
  const jobCount = dashboard?.total_jobs ?? 0

  const steps: StepDef[] = [
    {
      key: 'departments', title: 'Departments',
      what: 'The teams you hire for, such as Engineering or Legal. A department can exist before anyone is in it.',
      status: deptCount === 0 ? 'None yet' : `${deptCount} created`,
      done: deptCount > 0, to: '/app/employer/departments', cta: deptCount ? 'Manage departments' : 'Create a department',
    },
    {
      key: 'team', title: 'Team',
      what: 'Invite people by email and give each a role. They choose their own password and stay “Invited” until they accept.',
      status: members + waiting === 0 ? 'Just you' : `${members} active${waiting ? ` · ${waiting} invited` : ''}`,
      done: members + waiting > 0, to: '/app/employer/company', cta: members + waiting ? 'Manage team' : 'Invite people',
    },
    {
      key: 'jobs', title: 'Jobs',
      what: 'Post jobs under a department. Each job gets its own hiring team of recruiters, managers and interviewers.',
      status: jobCount === 0 ? 'None yet' : `${jobCount} posted`,
      done: jobCount > 0, to: deptCount ? '/app/employer/jobs' : '/app/employer/departments', cta: deptCount ? 'View jobs' : 'Start with a department',
    },
  ]
  const nextIndex = steps.findIndex(s => !s.done)

  return (
    <section aria-label="How your hiring workspace is set up" style={{
      background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: 14,
      padding: '16px 20px',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.text.muted }}>
        How it fits together
      </p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
        {steps.map((s, i) => {
          const isHere = s.key === here
          const isNext = i === nextIndex
          return (
            <li key={s.key} style={{
              display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
              border: `1px solid ${isHere ? colors.brand.navy : colors.border.default}`,
              background: isHere ? colors.surface.bg : 'transparent',
            }}>
              <span aria-hidden style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
                background: s.done ? '#16A34A' : isNext ? colors.brand.navy : colors.surface.elevated,
                color: s.done || isNext ? '#fff' : colors.text.muted,
              }}>
                {s.done ? <Check size={14} /> : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: colors.text.ink, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {s.title}
                  {isHere && <span style={{ fontSize: 10, fontWeight: 700, color: colors.brand.navy, background: colors.surface.elevated, padding: '1px 7px', borderRadius: 10 }}>You are here</span>}
                </p>
                <p style={{ margin: '3px 0 6px', fontSize: 12, lineHeight: 1.5, color: colors.text.inkSoft }}>{s.what}</p>
                <p style={{ margin: 0, fontSize: 12, color: colors.text.muted }}>
                  <strong style={{ color: s.done ? '#15803D' : colors.text.inkSoft }}>{s.status}</strong>
                  {!isHere && (
                    <> · <Link to={s.to} style={{ color: colors.brand.navy, fontWeight: 600, textDecoration: 'underline' }}>{s.cta}</Link></>
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
