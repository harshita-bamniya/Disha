import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Compass, ArrowLeft, ExternalLink, MapPin, Building2, AlertCircle, CheckCircle2, CircleDashed, CircleOff } from 'lucide-react'
import PageHeader from '@/shared/layouts/PageHeader'
import Breadcrumb from '@/shared/components/navigation/Breadcrumb'
import Button from '@/shared/components/primitives/Button'
import SharedEmptyState from '@/shared/components/feedback/EmptyState'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import { NAVY, INK, INK_SFT, MUTED, CREAM, BORDER, shadows } from '@/design-system/tokens'
import { referenceRolesApi, type SkillFitItem, type SalaryRange } from '@/api/referenceRoles'
import { getApiError } from '@/api/client'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReferenceNotice from '../components/ReferenceNotice'

function Card({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, boxShadow: shadows.card, minWidth: 0 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: INK, margin: 0 }}>{title}</h2>
      {note && <p style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 0' }}>{note}</p>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  )
}

const chip = { fontSize: 12, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '3px 10px' } as const

function Chips({ items }: { items: string[] }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{items.map((s, i) => <span key={`${s}-${i}`} style={chip}>{s}</span>)}</div>
}

const FIT_ICON = {
  have: { icon: <CheckCircle2 size={14} color="#059669" />, label: 'On your profile' },
  related: { icon: <CircleDashed size={14} color="#D97706" />, label: 'Related to your profile' },
  gap: { icon: <CircleOff size={14} color="#9CA3AF" />, label: 'Not on your profile' },
} as const

function FitRow({ item }: { item: SkillFitItem }) {
  const m = FIT_ICON[item.status]
  return (
    <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', fontSize: 13, color: INK }}>
      <span style={{ marginTop: 2, flexShrink: 0 }} aria-hidden>{m.icon}</span>
      <span style={{ minWidth: 0 }}>
        <strong style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.skill}</strong>
        <span style={{ color: MUTED }}> — {m.label}{item.via && item.status === 'have' ? ` (${item.via})` : ''}</span>
        {item.status === 'related' && <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>From your {item.via}: {item.reason}</span>}
      </span>
    </li>
  )
}

function SalaryTable({ salary }: { salary: { entry: SalaryRange; mid: SalaryRange; senior: SalaryRange; notes: Record<string, string> } }) {
  const rows: [string, SalaryRange, string | undefined][] = [
    ['Entry level', salary.entry, salary.notes?.entry], ['Mid level', salary.mid, salary.notes?.mid], ['Senior level', salary.senior, salary.notes?.senior],
  ]
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map(([label, s, note]) => s.text && (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderBottom: `1px solid ${BORDER}`, padding: '5px 0' }}>
          <span style={{ color: INK_SFT }}>{label}</span>
          <span style={{ color: INK, fontWeight: 600, textAlign: 'right' }}>₹{s.text}{note ? <span style={{ color: MUTED, fontWeight: 400 }}> ({note})</span> : null}</span>
        </div>
      ))}
    </div>
  )
}

export default function ReferenceRoleDetailPage() {
  const { roleId = '' } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [fitOn, setFitOn] = useState(false)

  const { data: role, isLoading, isError, error } = useQuery({ queryKey: ['reference-role', roleId], queryFn: () => referenceRolesApi.detail(roleId), retry: false })
  const fit = useQuery({ queryKey: ['reference-role-fit', roleId], queryFn: () => referenceRolesApi.skillFit(roleId), enabled: fitOn })

  const back = <Button variant="ghost" size="sm" onClick={() => navigate('/app/roles')}><ArrowLeft size={14} /> Roles</Button>
  const pad = isMobile ? '16px 16px 40px' : '20px 28px 40px'

  if (isLoading) {
    return (<><PageHeader title="Reference role" icon={<Compass size={13} color={NAVY} />} back={back} />
      <main style={{ padding: pad, display: 'grid', gap: 12 }}><Skeleton height={120} /><Skeleton height={200} /></main></>)
  }
  if (isError || !role) {
    const notFound = (error as any)?.response?.status === 404
    return (<><PageHeader title="Reference role" icon={<Compass size={13} color={NAVY} />} back={back} />
      <main style={{ padding: pad }}>
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <SharedEmptyState icon={notFound ? <Compass size={22} color={NAVY} /> : <AlertCircle size={22} color="#991B1B" />}
            title={notFound ? 'Role not found' : 'Could not load this role'}
            description={notFound ? 'This reference role does not exist in the catalogue.' : getApiError(error, 'Check your connection and try again.')}
            action={<Button onClick={() => navigate('/app/roles')}>Browse roles</Button>} />
        </div>
      </main></>)
  }

  return (
    <>
      <PageHeader title={role.job_role} subtitle={role.company_name} icon={<Compass size={13} color={NAVY} />} back={back}
        below={<Breadcrumb items={[{ label: 'Roles hiring UPSC aspirants', href: '/app/roles' }, { label: role.company_name }, { label: role.job_role }]} />} />
      <main style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
        <ReferenceNotice />

        <Card title="About the organisation">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, color: INK_SFT }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Building2 size={13} /> {role.company_name}{role.company_type ? ` · ${role.company_type}` : ''}</span>
            <span>{role.industry}{role.sub_industry ? ` · ${role.sub_industry}` : ''}</span>
            {role.headquarters && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} /> HQ {role.headquarters}</span>}
          </div>
          {role.hiring_locations.length > 0 && <div style={{ marginTop: 10 }}><p style={{ fontSize: 11.5, color: MUTED, margin: '0 0 6px' }}>Locations the research lists for this kind of role</p><Chips items={role.hiring_locations} /></div>}
          {role.website_url && (
            <p style={{ margin: '12px 0 0', fontSize: 13 }}>
              <a href={role.website_url} target="_blank" rel="noopener noreferrer" style={{ color: NAVY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                Company website <ExternalLink size={12} />
              </a>
              <span style={{ color: MUTED }}> — check their own careers page for real openings.</span>
            </p>
          )}
        </Card>

        <Card title="What the role involves">
          {role.job_description && <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.6, margin: '0 0 10px' }}>{role.job_description}</p>}
          {role.key_responsibilities.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: INK_SFT, lineHeight: 1.7 }}>{role.key_responsibilities.map((r, i) => <li key={`${r}-${i}`}>{r}</li>)}</ul>}
        </Card>

        <Card title="Skills this role asks for">
          <p style={{ fontSize: 11.5, color: MUTED, margin: '0 0 6px' }}>Required</p><Chips items={role.required_skills} />
          {role.preferred_skills.length > 0 && <><p style={{ fontSize: 11.5, color: MUTED, margin: '12px 0 6px' }}>Preferred</p><Chips items={role.preferred_skills} /></>}
          <div style={{ marginTop: 14 }}>
            {!fitOn ? (
              <Button onClick={() => setFitOn(true)}>Check how my skills fit</Button>
            ) : fit.isLoading ? <Skeleton height={80} /> : fit.isError ? (
              <div role="alert" style={{ fontSize: 13, color: '#991B1B' }}>Could not check your skills. <Button size="sm" variant="ghost" onClick={() => fit.refetch()}>Retry</Button></div>
            ) : fit.data?.needs_profile_skills ? (
              <div style={{ fontSize: 13, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
                {fit.data.message} <Link to="/app/profile" style={{ color: NAVY, fontWeight: 600 }}>Open your profile</Link>
              </div>
            ) : fit.data && (
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, background: CREAM }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>
                  {fit.data.summary!.have} of {fit.data.summary!.required_total} required skills are on your profile
                  {fit.data.summary!.related > 0 ? `, ${fit.data.summary!.related} related` : ''}
                </p>
                <p style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 6px' }}>Based on your profile skills only (not your resume). A research lens, not a hiring prediction.</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{fit.data.required!.map((i, n) => <FitRow key={`${i.skill}-${n}`} item={i} />)}</ul>
                {fit.data.preferred!.length > 0 && <><p style={{ fontSize: 11.5, color: MUTED, margin: '8px 0 0' }}>Preferred</p><ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{fit.data.preferred!.map((i, n) => <FitRow key={`${i.skill}-${n}`} item={i} />)}</ul></>}
              </div>
            )}
          </div>
        </Card>

        {(role.transferable_upsc_skills.length > 0 || role.upsc_skill_mapping || role.why_suitable) && (
          <Card title="Where UPSC preparation helps" note="From the research data, not a statement about you">
            {role.transferable_upsc_skills.length > 0 && <Chips items={role.transferable_upsc_skills} />}
            {role.upsc_skill_mapping && <p style={{ fontSize: 13, color: INK_SFT, lineHeight: 1.6, margin: '10px 0 0' }}>{role.upsc_skill_mapping}</p>}
            {role.why_suitable && <p style={{ fontSize: 13, color: INK_SFT, lineHeight: 1.6, margin: '8px 0 0' }}>{role.why_suitable}</p>}
          </Card>
        )}

        <Card title="Pay benchmarks" note="Research estimates in INR lakh per year. Not an offer and not from a posting.">
          <SalaryTable salary={role.salary} />
        </Card>

        {(role.career_path_steps.length > 0 || role.future_growth) && (
          <Card title="Career path">
            {role.career_path_steps.length > 0 && <p style={{ fontSize: 13, color: INK, margin: 0, lineHeight: 1.7 }}>{role.career_path_steps.join('  →  ')}</p>}
            {role.future_growth && <p style={{ fontSize: 13, color: INK_SFT, lineHeight: 1.6, margin: '8px 0 0' }}>{role.future_growth}</p>}
          </Card>
        )}

        {role.suitable_candidate_categories.length > 0 && (
          <Card title="Candidate profiles the research lists as suitable"><Chips items={role.suitable_candidate_categories} /></Card>
        )}
      </main>
    </>
  )
}
