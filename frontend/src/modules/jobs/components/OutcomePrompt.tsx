import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiError } from '@/api/client'
import { toast } from '@/shared/components/feedback/Toast'
import { resumeMatchApi, type ApplicationOutcome } from '@/api/resumeMatch'
import { INK, INK_SFT, MUTED, BORDER } from '@/design-system/tokens'

const PROMPT_AFTER_DAYS = 14
const OPTIONS: { value: ApplicationOutcome; label: string }[] = [
  { value: 'interview', label: 'Got an interview' },
  { value: 'offer', label: 'Got an offer' },
  { value: 'rejected', label: 'Was rejected' },
  { value: 'no_response', label: 'Never heard back' },
]
const LABEL = Object.fromEntries(OPTIONS.map(o => [o.value, o.label])) as Record<ApplicationOutcome, string>

/** "Did you hear back?" Asked once an application is two weeks old; the answer is the candidate's own. */
export default function OutcomePrompt({ applicationId, createdAt, status }: { applicationId: string; createdAt: string; status: string }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['application-outcomes'], queryFn: resumeMatchApi.outcomes, staleTime: 60_000 })
  const save = useMutation({
    mutationFn: (o: ApplicationOutcome) => resumeMatchApi.setOutcome(applicationId, o),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['application-outcomes'] }); toast.info('Thanks, saved.') },
    onError: e => toast.danger(getApiError(e, 'Could not save your answer. Please try again.')),
  })
  if (!data) return null
  const answered = data[applicationId]
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000
  if (!answered && (ageDays < PROMPT_AFTER_DAYS || status === 'hired' || status === 'withdrawn')) return null

  return (
    <div onClick={e => e.stopPropagation()} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
      <p style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 700, color: INK }}>
        {answered ? `You told us: ${LABEL[answered]}` : 'Did you hear back about this application?'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {OPTIONS.map(o => (
          <button key={o.value} onClick={() => save.mutate(o.value)} disabled={save.isPending} aria-pressed={answered === o.value}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${answered === o.value ? INK : BORDER}`,
              background: answered === o.value ? INK : '#fff', color: answered === o.value ? '#fff' : INK_SFT }}>
            {o.label}
          </button>
        ))}
      </div>
      {!answered && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: MUTED }}>Only you see this. It helps us check whether resume fit scores match real results.</p>}
    </div>
  )
}
