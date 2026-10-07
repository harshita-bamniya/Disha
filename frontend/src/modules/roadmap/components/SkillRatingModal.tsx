import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/shared/components/overlays/Modal'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import { colors } from '@/design-system/tokens'
import { jobPlanApi } from '@/api/jobPlan'

interface Props {
  open: boolean
  onClose: () => void
  jobId: string
  jobTitle?: string
  submitting?: boolean
  /** Ratings the learner gave, or undefined if they chose to skip. */
  onSubmit: (ratings: Record<string, number> | undefined) => void
}

/** Asked just before a roadmap is generated: how well do you already do what THIS job asks for? */
export default function SkillRatingModal({ open, onClose, jobId, jobTitle, submitting, onSubmit }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['skills-to-rate', jobId],
    queryFn: () => jobPlanApi.skillsToRate(jobId),
    enabled: open,
    staleTime: 0,
  })
  const [ratings, setRatings] = useState<Record<string, number>>({})

  // Start from the ratings given last time, if any.
  useEffect(() => {
    if (!data) return
    const prev: Record<string, number> = {}
    for (const s of data.skills) if (s.previous != null) prev[s.name] = s.previous
    setRatings(prev)
  }, [data])

  const scale = data?.scale ?? []
  const labelFor = (v: number | undefined) => scale.find(s => s.value === v)?.label ?? 'Not rated'
  const rated = Object.keys(ratings).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How well do you already do what this job asks for?"
      width={560}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', width: '100%' }}>
          <Button variant="ghost" onClick={() => onSubmit(undefined)} disabled={submitting}>Skip and generate</Button>
          <Button onClick={() => onSubmit(rated ? ratings : undefined)} loading={submitting} disabled={isLoading || submitting}>
            Generate my roadmap
          </Button>
        </div>
      )}
    >
      <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: colors.text.inkSoft }}>
        Rate yourself on the skills <strong>{jobTitle ?? 'this job'}</strong> asks for, so your plan can shorten what you
        already do well. Your answers are used only to build this roadmap. You can leave any skill unrated.
      </p>

      {isLoading && <Spinner />}
      {isError && (
        <p style={{ margin: 0, fontSize: 13, color: colors.state.danger }}>
          We couldn&apos;t load this job&apos;s skills. You can still skip and generate your roadmap.
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data?.skills.map(s => (
          <li key={s.name} style={{ border: `1px solid ${colors.border.default}`, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: colors.text.ink }}>{s.name}</span>
              <span style={{ fontSize: 11, color: colors.text.muted }}>
                {s.importance === 'must_have' ? 'Required' : 'Nice to have'}
              </span>
            </div>
            <div role="radiogroup" aria-label={`Your level in ${s.name}`} style={{ display: 'flex', gap: 6 }}>
              {scale.map(opt => {
                const selected = ratings[s.name] === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={opt.label}
                    onClick={() => setRatings(r => {
                      if (r[s.name] === opt.value) {
                        const { [s.name]: _removed, ...rest } = r   // tap again to un-rate
                        return rest
                      }
                      return { ...r, [s.name]: opt.value }
                    })}
                    style={{
                      flex: 1, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                      border: `1.5px solid ${selected ? colors.brand.navy : colors.border.medium}`,
                      background: selected ? colors.brand.navy : colors.surface.card,
                      color: selected ? '#fff' : colors.text.ink,
                    }}
                  >
                    {opt.value}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: colors.text.muted }}>{labelFor(ratings[s.name])}</p>
          </li>
        ))}
      </ul>
      <p style={{ margin: '12px 0 0', fontSize: 11.5, color: colors.text.muted }}>
        0 = never used it · 1 = know the basics · 2 = have used it · 3 = confident, use it often
      </p>
    </Modal>
  )
}
