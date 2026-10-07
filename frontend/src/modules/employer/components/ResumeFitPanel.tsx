import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleDashed, HelpCircle, XCircle } from 'lucide-react'
import Spinner from '@/shared/components/feedback/Spinner'
import { colors } from '@/design-system/tokens'
import { getResumeFit, type ResumeFitRequirement } from '@/api/matching'

const bandColor: Record<string, string> = {
  Strong: colors.state.success, Good: colors.state.info, Fair: colors.state.warning, Low: colors.state.danger,
}

function Row({ r }: { r: ResumeFitRequirement }) {
  const Icon = r.type === 'eligibility' ? HelpCircle : r.credit >= 0.99 ? CheckCircle2 : r.credit > 0 ? CircleDashed : XCircle
  const tone = r.type === 'eligibility' ? colors.text.muted
    : r.credit >= 0.99 ? colors.state.success : r.credit > 0 ? colors.state.warning : colors.state.danger
  return (
    <li style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: `1px solid ${colors.border.default}` }}>
      <Icon size={16} color={tone} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>{r.name}</span>
          <span style={{ fontSize: 11, color: colors.text.muted }}>
            {r.importance === 'must_have' ? 'Must have' : 'Nice to have'}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: tone }}>{r.label}</span>
        </div>
        {r.evidence && (
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: colors.text.inkSoft }}>“{r.evidence}”</p>
        )}
      </div>
    </li>
  )
}

/** Employer view of how well the resume a candidate attached fits the job. */
export default function ResumeFitPanel({ applicationId, status }: { applicationId: string; status?: string | null }) {
  const ready = status === 'ready'
  const { data, isLoading, isError } = useQuery({
    queryKey: ['resume-fit', applicationId],
    queryFn: () => getResumeFit(applicationId),
    enabled: ready,
  })

  const box = { border: `1px solid ${colors.border.default}`, borderRadius: 14, padding: '14px 16px' } as const
  const heading = (
    <p style={{ fontSize: 10, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', margin: '0 0 8px' }}>
      Resume fit
    </p>
  )

  if (status === 'no_resume') {
    return <div style={box}>{heading}<p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>This candidate applied without a resume, so there is no resume fit to show.</p></div>
  }
  if (status === 'pending') {
    return <div style={box}>{heading}<p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>Scoring this candidate&apos;s resume. Check back in a minute.</p></div>
  }
  if (status === 'failed') {
    return <div style={box}>{heading}<p style={{ margin: 0, fontSize: 13, color: colors.text.inkSoft }}>The resume could not be scored automatically. You can still read the resume yourself.</p></div>
  }
  if (!ready) return null
  if (isLoading) return <div style={box}>{heading}<Spinner /></div>
  const report = data?.report
  if (isError || !report) return null

  return (
    <div style={box}>
      {heading}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: bandColor[report.band], lineHeight: 1 }}>{report.score}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink }}>{report.band} fit</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colors.text.inkSoft }}>
        Must-haves fully met: <strong>{report.must_haves_met} of {report.must_haves_total}</strong>
        {report.must_haves_partial > 0 && <> · {report.must_haves_partial} more with an equivalent or weak match</>}
        {report.quality && <> · Resume writing: {report.quality.label}</>}
      </p>
      {report.cap_reasons.map(c => (
        <p key={c} style={{ margin: '8px 0 0', fontSize: 12.5, color: colors.state.danger }}>{c}</p>
      ))}
      {report.low_signal && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.text.muted }}>
          This job lists few specific requirements, so the score is less precise.
        </p>
      )}
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
        {[...report.requirements]
          .sort((a, b) => Number(a.type === 'eligibility') - Number(b.type === 'eligibility') || a.credit - b.credit)
          .map(r => <Row key={r.name} r={r} />)}
      </ul>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: colors.text.muted }}>
        Based on the resume attached to this application and the job description. It is a guide, not a hiring decision.
      </p>
    </div>
  )
}
