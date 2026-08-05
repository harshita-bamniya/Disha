import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { PROFILE_KEY } from '../constants'
import { Section } from './Section'

// Extracted from ProfilePage.tsx (audit L-07/Sprint 6: split the
// god-component). Same markup and logic.
export function UpscSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    upsc_exam: profile.upsc_exam ?? '',
    years_preparing: profile.years_preparing ?? 1,
    upsc_attempts: profile.upsc_attempts ?? 0,
    highest_stage_cleared: profile.highest_stage_cleared ?? '',
    optional_subject: profile.optional_subject ?? '',
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveUpscJourney({ ...form, upsc_exam: form.upsc_exam as any, highest_stage_cleared: form.highest_stage_cleared as any, optional_subject: form.optional_subject || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROFILE_KEY }); setSaved(true); setTimeout(() => setSaved(false), 3000); onToggle() },
  })

  const EXAM_LABELS: Record<string, string> = { cse: 'UPSC CSE', capf: 'CAPF', cds: 'CDS', ies: 'IES', cms: 'CMS', state_pcs: 'State PCS', other: 'Other' }
  const STAGE_LABELS: Record<string, string> = { none: 'None', prelims: 'Prelims', mains: 'Mains', interview: 'Interview' }

  const summary = profile.upsc_exam
    ? `${EXAM_LABELS[profile.upsc_exam] ?? profile.upsc_exam} · ${STAGE_LABELS[profile.highest_stage_cleared ?? 'none']} · ${profile.upsc_attempts ?? 0} attempt(s)`
    : 'Not filled yet'

  return (
    <Section title="UPSC Journey" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Exam you prepared for</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(EXAM_LABELS).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setForm(p => ({ ...p, upsc_exam: val }))}
                className={cn('px-4 py-2 rounded-full border text-xs font-medium transition-all',
                  form.upsc_exam === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Highest stage cleared</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(STAGE_LABELS).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setForm(p => ({ ...p, highest_stage_cleared: val }))}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  form.highest_stage_cleared === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Years preparing" type="number" value={String(form.years_preparing)} onChange={e => setForm(p => ({ ...p, years_preparing: parseInt(e.target.value) || 0 }))} />
          <Input label="Total attempts" type="number" value={String(form.upsc_attempts)} onChange={e => setForm(p => ({ ...p, upsc_attempts: parseInt(e.target.value) || 0 }))} />
        </div>
        <Input label="Optional subject" placeholder="Public Administration, Geography…" value={form.optional_subject} onChange={e => setForm(p => ({ ...p, optional_subject: e.target.value }))} />
        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}
