import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, ChevronUp, MapPin, RefreshCw, Plus } from 'lucide-react'
import { onboardingApi, type ProfileData } from '@/api/onboarding'
import { cn } from '@/lib/utils'
import { getApiError } from '@/api/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import AppSidebar from '@/components/layout/AppSidebar'

// ── Constants (mirrors backend VALID_SKILLS / VALID_SECTORS) ─────────────────

const ALL_SKILLS = [
  'Analytical Reasoning', 'Research & Analysis', 'Data Interpretation',
  'Data Analysis', 'Policy Research',
  'Report Writing', 'Essay Writing', 'Public Speaking',
  'Leadership', 'Management', 'Project Management', 'Strategic Planning',
  'Economics', 'Public Administration', 'Polity & Governance',
  'Ethics & Integrity', 'International Relations', 'Law & Legal Knowledge',
  'Stakeholder Engagement',
  'Communication', 'English Proficiency', 'Hindi Proficiency', 'Computer Skills',
  'Science & Technology', 'Current Affairs', 'History', 'Geography', 'Environment',
  'Teaching & Training', 'Budget & Finance',
]

const SECTORS = [
  'Government & Civil Services', 'Public Sector Undertakings (PSU)',
  'Management Consulting', 'Education & Training', 'NGO & Social Sector',
  'Banking & Finance', 'Legal', 'Research & Analytics', 'Media & Journalism',
  'Healthcare & Public Health', 'IT & Technology', 'Defence & Security',
  'International Organizations', 'Think Tanks & Policy', 'Entrepreneurship',
]

const SALARY_OPTIONS = [
  { label: 'Up to ₹5 LPA', min: 0, max: 5 },
  { label: '₹5–10 LPA', min: 5, max: 10 },
  { label: '₹10–20 LPA', min: 10, max: 20 },
  { label: '₹20–40 LPA', min: 20, max: 40 },
  { label: '₹40 LPA+', min: 40, max: 500 },
]

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
  'Andaman and Nicobar Islands', 'Lakshadweep',
  'Dadra and Nagar Haveli and Daman and Diu',
]

const PROFILE_KEY = ['onboarding', 'profile']

// ── Section icons map ─────────────────────────────────────────────────────────
const SECTION_META: Record<string, { emoji: string; color: string; bg: string }> = {
  'Personal Info':       { emoji: '👤', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  'Education':           { emoji: '🎓', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  'UPSC Journey':        { emoji: '📋', color: '#0891B2', bg: 'rgba(8,145,178,0.08)' },
  'Work Experience':     { emoji: '💼', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  'Skills':              { emoji: '⚡', color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  'Preferences':         { emoji: '🎯', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  'Mindset Assessment':  { emoji: '🧠', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
}

// ── Premium chip selector ─────────────────────────────────────────────────────
export function ChipSelector({
  options, selected, onChange, multi = false,
}: {
  options: string[]
  selected: string | string[]
  onChange: (val: any) => void
  multi?: boolean
}) {
  const isSelected = (opt: string) =>
    multi ? (selected as string[]).includes(opt) : selected === opt

  const toggle = (opt: string) => {
    if (!multi) { onChange(opt); return }
    const arr = selected as string[]
    onChange(arr.includes(opt) ? arr.filter(s => s !== opt) : [...arr, opt])
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
            background: isSelected(opt)
              ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
              : 'rgba(255,255,255,0.7)',
            color: isSelected(opt) ? '#fff' : '#374151',
            border: isSelected(opt)
              ? 'none'
              : '1.5px solid rgba(59,130,246,0.15)',
            boxShadow: isSelected(opt)
              ? '0 3px 10px rgba(59,130,246,0.3)'
              : '0 1px 3px rgba(0,0,0,0.04)',
            transform: isSelected(opt) ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          {isSelected(opt) ? '✓ ' : ''}{opt}
        </button>
      ))}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title, summary, isOpen, onToggle, children, saving, saved,
}: {
  title: string
  summary: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  saving?: boolean
  saved?: boolean
}) {
  const meta = SECTION_META[title] ?? { emoji: '📝', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' }

  return (
    <div style={{
      background: isOpen ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(20px)',
      borderRadius: 20,
      border: isOpen ? '1.5px solid rgba(59,130,246,0.18)' : '1px solid rgba(255,255,255,0.95)',
      boxShadow: isOpen
        ? '0 12px 40px rgba(30,58,95,0.1), 0 2px 8px rgba(30,58,95,0.05)'
        : '0 4px 16px rgba(30,58,95,0.06)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* Top accent strip when open */}
      {isOpen && (
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${meta.color}, #93C5FD)`,
        }} />
      )}

      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.2s',
        }}
        onMouseOver={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(59,130,246,0.02)' }}
        onMouseOut={e => { e.currentTarget.style.background = 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {meta.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F', fontFamily: 'Hind, sans-serif' }}>
                {title}
              </span>
              {saved && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700, color: '#059669',
                  background: 'rgba(5,150,105,0.08)', padding: '2px 8px', borderRadius: 20,
                  border: '1px solid rgba(5,150,105,0.2)',
                }}>
                  <Check size={10} /> Saved
                </span>
              )}
              {saving && (
                <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Saving…</span>
              )}
            </div>
            {!isOpen && (
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary}
              </p>
            )}
          </div>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: isOpen ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen ? '#3B82F6' : '#9CA3AF',
          transition: 'all 0.2s',
        }}>
          {isOpen ? <ChevronUp size={14} /> : <Pencil size={14} />}
        </div>
      </button>

      {isOpen && (
        <div style={{
          padding: '0 22px 24px',
          borderTop: '1px solid rgba(59,130,246,0.06)',
        }}>
          <div style={{ paddingTop: 20 }}>{children}</div>
        </div>
      )}
    </div>
  )
}

// ── Personal section ──────────────────────────────────────────────────────────

function PersonalSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    full_name: profile.full_name ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.savePersonal({ ...form, gender: form.gender as any, state: form.state }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onToggle()
    },
  })

  const summary = profile.full_name
    ? `${profile.full_name} · ${profile.city ?? '—'}, ${profile.state ?? '—'}`
    : 'Not filled yet'

  return (
    <Section title="Personal Info" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <Input label="Full name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
        <Input label="Date of birth" type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} />
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Gender</label>
          <ChipSelector
            options={['Male', 'Female', 'Other', 'Prefer not to say']}
            selected={form.gender === 'prefer_not_to_say' ? 'Prefer not to say' : form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : ''}
            onChange={(val: string) => {
              const map: Record<string,string> = { 'Male':'male','Female':'female','Other':'other','Prefer not to say':'prefer_not_to_say' }
              setForm(p => ({ ...p, gender: map[val] ?? val }))
            }}
          />
        </div>
        <Input label="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>State</label>
          <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
            style={{ height: 48, borderRadius: 12, border: '1.5px solid #E5E7EB', padding: '0 14px', fontSize: 14, color: '#111827', outline: 'none', background: 'white', transition: 'border 0.2s' }}
            onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
            onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <option value="">Select state</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {mut.error && <p style={{ fontSize: 12, color: '#DC2626' }}>{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}

// ── Education section ─────────────────────────────────────────────────────────

function EducationSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    highest_qualification: profile.highest_qualification ?? '',
    degree: profile.degree ?? '',
    field_of_study: profile.field_of_study ?? '',
    institution: profile.institution ?? '',
    graduation_year: profile.graduation_year ?? new Date().getFullYear(),
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveEducation({ ...form, highest_qualification: form.highest_qualification as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROFILE_KEY }); setSaved(true); setTimeout(() => setSaved(false), 3000); onToggle() },
  })

  const summary = profile.highest_qualification
    ? `${profile.highest_qualification.replace('_', ' ')} in ${profile.field_of_study ?? '—'}, ${profile.institution ?? '—'}`
    : 'Not filled yet'

  return (
    <Section title="Education" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Highest qualification</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { val: 'graduate', label: 'Graduate' },
              { val: 'post_graduate', label: 'Post Graduate' },
              { val: 'doctorate', label: 'Doctorate' },
              { val: 'diploma', label: 'Diploma' },
              { val: 'other', label: 'Other' },
            ].map(({ val, label }) => (
              <button key={val} type="button" onClick={() => setForm(p => ({ ...p, highest_qualification: val }))}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  form.highest_qualification === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <Input label="Degree name" placeholder="B.A., M.A., B.Tech…" value={form.degree} onChange={e => setForm(p => ({ ...p, degree: e.target.value }))} />
        <Input label="Field of study" placeholder="Political Science, History…" value={form.field_of_study} onChange={e => setForm(p => ({ ...p, field_of_study: e.target.value }))} />
        <Input label="Institution" value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} />
        <Input label="Graduation year" type="number" value={String(form.graduation_year)} onChange={e => setForm(p => ({ ...p, graduation_year: parseInt(e.target.value) || p.graduation_year }))} />
        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}

// ── UPSC Journey section ──────────────────────────────────────────────────────

function UpscSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
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
        <Input label="Optional subject (if any)" placeholder="Public Administration, Geography…" value={form.optional_subject} onChange={e => setForm(p => ({ ...p, optional_subject: e.target.value }))} />
        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}

// ── Work Experience section ───────────────────────────────────────────────────

function WorkSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const [hasExp, setHasExp] = useState<boolean>(profile.has_work_experience ?? false)
  const [form, setForm] = useState({
    work_experience_years: profile.work_experience_years ?? 1,
    work_experience_domain: profile.work_experience_domain ?? '',
    last_designation: profile.last_designation ?? '',
  })
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveWorkExperience(hasExp ? { has_work_experience: true, ...form } : { has_work_experience: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROFILE_KEY }); setSaved(true); setTimeout(() => setSaved(false), 3000); onToggle() },
  })

  const summary = profile.has_work_experience
    ? `${profile.work_experience_years ?? 0} yr(s) in ${profile.work_experience_domain ?? '—'} as ${profile.last_designation ?? '—'}`
    : 'No prior work experience'

  return (
    <Section title="Work Experience" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Do you have work experience?</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(({ val, label }) => (
              <button key={String(val)} type="button" onClick={() => setHasExp(val)}
                className={cn('h-10 rounded-xl border text-sm font-medium transition-all',
                  hasExp === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {hasExp && (
          <>
            <Input label="Years of experience" type="number" value={String(form.work_experience_years)} onChange={e => setForm(p => ({ ...p, work_experience_years: parseInt(e.target.value) || 1 }))} />
            <Input label="Domain / sector" placeholder="Education & Training, Banking…" value={form.work_experience_domain} onChange={e => setForm(p => ({ ...p, work_experience_domain: e.target.value }))} />
            <Input label="Last designation" placeholder="Content Writer, Policy Analyst…" value={form.last_designation} onChange={e => setForm(p => ({ ...p, last_designation: e.target.value }))} />
          </>
        )}
        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}

// ── Skills section ────────────────────────────────────────────────────────────

function SkillsSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set(profile.skills))
  const [customInput, setCustomInput] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const MAX = 10

  const mut = useMutation({
    mutationFn: () => onboardingApi.saveSkills({ skills: Array.from(selected) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROFILE_KEY }); setSaved(true); setTimeout(() => setSaved(false), 3000); onToggle() },
  })

  const toggle = (skill: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(skill)) { next.delete(skill) } else if (next.size < MAX) { next.add(skill) }
      return next
    })
  }

  const addCustomSkill = () => {
    const skill = customInput.trim()
    if (!skill) return
    const existingLower = new Set([...selected].map(s => s.toLowerCase()))
    if (existingLower.has(skill.toLowerCase())) { setCustomInput(''); return }
    if (selected.size >= MAX) return
    setSelected(prev => new Set([...prev, skill]))
    setCustomInput('')
    inputRef.current?.focus()
  }

  const isPredefined = (skill: string) => ALL_SKILLS.includes(skill)
  const customSkills = [...selected].filter(s => !isPredefined(s))

  const summary = profile.skills.length > 0
    ? profile.skills.slice(0, 4).join(', ') + (profile.skills.length > 4 ? ` +${profile.skills.length - 4} more` : '')
    : 'No skills selected'

  return (
    <Section title="Skills" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-gray-400">{selected.size}/{MAX} selected</p>

        {/* Predefined skill chips */}
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map(skill => {
            const isSelected = selected.has(skill)
            const isDisabled = !isSelected && selected.size >= MAX
            return (
              <button key={skill} type="button" onClick={() => toggle(skill)} disabled={isDisabled}
                className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                  isSelected && 'bg-primary text-white border-primary',
                  !isSelected && !isDisabled && 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                  isDisabled && 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed')}>
                {skill}
              </button>
            )
          })}
        </div>

        {/* Custom skills already saved — show as removable chips */}
        {customSkills.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-gray-400">Your custom skills:</p>
            <div className="flex flex-wrap gap-2">
              {customSkills.map(skill => (
                <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent text-xs font-medium rounded-full">
                  {skill}
                  <button type="button" onClick={() => toggle(skill)} className="text-accent/60 hover:text-danger leading-none">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add custom skill input */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add a skill not listed above</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill() } }}
              placeholder="e.g. Machine Learning, Negotiation, SQL…"
              disabled={selected.size >= MAX}
              className={cn(
                'flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
                'disabled:bg-gray-50 disabled:text-gray-300',
              )}
            />
            <button
              type="button"
              onClick={addCustomSkill}
              disabled={!customInput.trim() || selected.size >= MAX}
              className="shrink-0 h-10 px-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} disabled={selected.size === 0} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient()
  const [sectors, setSectors] = useState<Set<string>>(new Set(profile.preferred_sectors))
  // null means not yet answered (for existing profiles that already have a value, pre-fill it)
  const [openToReloc, setOpenToReloc] = useState<boolean | null>(
    profile.open_to_relocation != null ? profile.open_to_relocation : null
  )
  const [locations, setLocations] = useState<string[]>(profile.preferred_locations)
  const [locInput, setLocInput] = useState('')
  const [salary, setSalary] = useState<{ min: number; max: number } | null>(
    profile.expected_salary_min != null ? { min: profile.expected_salary_min, max: profile.expected_salary_max ?? 500 } : null
  )
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: () => onboardingApi.savePreferences({
      preferred_sectors: Array.from(sectors),
      preferred_locations: openToReloc ? [] : locations,
      open_to_relocation: openToReloc ?? false,
      expected_salary_min: salary?.min ?? 0,
      expected_salary_max: salary?.max ?? 500,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PROFILE_KEY }); setSaved(true); setTimeout(() => setSaved(false), 3000); onToggle() },
  })

  const addLoc = () => {
    const loc = locInput.trim()
    if (loc && !locations.includes(loc)) setLocations(p => [...p, loc])
    setLocInput('')
  }

  const currentSalaryLabel = SALARY_OPTIONS.find(o => o.min === salary?.min)?.label ?? 'Not set'
  const summary = profile.preferred_sectors.length > 0
    ? `${profile.preferred_sectors.slice(0, 2).join(', ')} · ${currentSalaryLabel}`
    : 'Not filled yet'

  return (
    <Section title="Career Preferences" summary={summary} isOpen={open} onToggle={onToggle} saving={mut.isPending} saved={saved}>
      <div className="flex flex-col gap-5">

        {/* Sectors */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Preferred sectors</label>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map(s => (
              <button key={s} type="button"
                onClick={() => setSectors(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })}
                className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                  sectors.has(s) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Relocation — asked FIRST */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Are you open to relocation?</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: true,  label: 'Yes, I can relocate'  },
              { val: false, label: 'No, I prefer my city' },
            ].map(({ val, label }) => (
              <button key={String(val)} type="button"
                onClick={() => {
                  setOpenToReloc(val)
                  if (val) setLocations([]) // clear locations when switching to "yes"
                }}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  openToReloc === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred locations — only shown when NOT open to relocation */}
        {openToReloc === false && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Preferred locations</label>
            <p className="text-xs text-gray-400 -mt-1">Add the cities you'd like to work in.</p>
            <div className="flex gap-2">
              <Input placeholder="Delhi, Mumbai…" value={locInput}
                onChange={e => setLocInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLoc() } }}
                prefix={<MapPin className="w-4 h-4" />} />
              <button type="button" onClick={addLoc}
                className="shrink-0 px-4 h-11 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
                Add
              </button>
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {locations.map(loc => (
                  <span key={loc} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    {loc}
                    <button type="button" onClick={() => setLocations(p => p.filter(l => l !== loc))} className="text-primary/60 hover:text-danger">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Salary */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Expected salary range</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SALARY_OPTIONS.map(opt => (
              <button key={opt.label} type="button" onClick={() => setSalary({ min: opt.min, max: opt.max })}
                className={cn('h-10 rounded-xl border text-xs font-medium transition-all',
                  salary?.min === opt.min ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50')}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mut.error && <p className="text-xs text-danger">{getApiError(mut.error, 'Save failed')}</p>}
        <Button fullWidth loading={mut.isPending} onClick={() => mut.mutate()}>Save changes</Button>
      </div>
    </Section>
  )
}

// ── Mindset section (read-only) ───────────────────────────────────────────────

function MindsetSection({ profile, open, onToggle }: { profile: ProfileData; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate()

  const MOTIVATION_LABELS: Record<string, string> = {
    intrinsic: 'Driven by meaningful work',
    extrinsic: 'Motivated by recognition & salary',
    mixed: 'Motivated by both purpose and recognition',
  }
  const RISK_LABELS: Record<string, string> = {
    low: 'Prefers stability',
    medium: 'Open to calculated risks',
    high: 'Willing to take bold moves',
  }

  const summary = profile.motivation_type
    ? `${MOTIVATION_LABELS[profile.motivation_type] ?? profile.motivation_type} · ${RISK_LABELS[profile.risk_tolerance ?? 'medium'] ?? ''}`
    : 'Not completed'

  return (
    <Section title="Mindset Assessment" summary={summary} isOpen={open} onToggle={onToggle}>
      <div className="flex flex-col gap-4">
        {profile.disha_insight && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-primary mb-1">Your DISHA insight</p>
            <p className="text-sm text-gray-700 leading-relaxed italic">"{profile.disha_insight}"</p>
          </div>
        )}

        {profile.motivation_type && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Motivation</p>
              <p className="text-xs font-semibold text-gray-700">{MOTIVATION_LABELS[profile.motivation_type] ?? profile.motivation_type}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Risk appetite</p>
              <p className="text-xs font-semibold text-gray-700">{RISK_LABELS[profile.risk_tolerance ?? 'medium'] ?? ''}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Support system</p>
              <p className="text-xs font-semibold text-gray-700 capitalize">{profile.support_system ?? '—'}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/app/onboarding/step/7')}
          className="flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-primary hover:text-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retake assessment
        </button>
      </div>
    </Section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate()
  const [openSection, setOpenSection] = useState<string | null>(null)

  const { data: profile, isLoading, error } = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: onboardingApi.getProfile,
  })

  const toggle = (section: string) =>
    setOpenSection(prev => (prev === section ? null : section))

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <AppSidebar activePath="/app/profile" />

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(59,130,246,0.08)',
          padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 2px 16px rgba(30,58,95,0.04)',
        }}>
          <div>
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: '#1E3A5F' }}>Profile</h1>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Every update improves your KRS score & job matches</p>
          </div>
        </header>

        <main style={{ padding: '28px 32px', flex: 1 }}>

          {/* Hero card */}
          <div style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 60%, #E0F2FE 100%)',
            borderRadius: 24, padding: '28px 32px', position: 'relative', overflow: 'hidden',
            border: '1px solid rgba(59,130,246,0.15)',
            boxShadow: '0 4px 24px rgba(59,130,246,0.08)', marginBottom: 24,
          }}>
            <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'rgba(59,130,246,0.06)', top: '-70px', right: '-50px' }} />
            <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', background: 'rgba(99,102,241,0.04)', bottom: '-30px', left: '40%' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 18,
                background: 'rgba(59,130,246,0.12)',
                border: '2px solid rgba(59,130,246,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0, color: '#3B82F6', fontWeight: 800,
              }}>
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '👤'}
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500, marginBottom: 3 }}>Your profile</p>
                <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 22, fontWeight: 900, color: '#1E3A5F', letterSpacing: '-0.3px' }}>
                  {profile?.full_name ?? 'Complete your profile'}
                </h2>
                <p style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                  {profile?.city ? `${profile.city}, ${profile.state ?? ''}` : 'Add your location'}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Each section you complete improves your KRS score and surfaces better job matches.
              </p>
            </div>
          </div>

          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.6)', animation: 'pulse 2s infinite', border: '1px solid rgba(59,130,246,0.06)' }} />
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 16, padding: '14px 18px', fontSize: 14, color: '#DC2626' }}>
              Could not load profile. Please refresh.
            </div>
          )}

          {profile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PersonalSection     profile={profile} open={openSection === 'personal'}     onToggle={() => toggle('personal')} />
              <EducationSection    profile={profile} open={openSection === 'education'}    onToggle={() => toggle('education')} />
              <UpscSection         profile={profile} open={openSection === 'upsc'}         onToggle={() => toggle('upsc')} />
              <WorkSection         profile={profile} open={openSection === 'work'}         onToggle={() => toggle('work')} />
              <SkillsSection       profile={profile} open={openSection === 'skills'}       onToggle={() => toggle('skills')} />
              <PreferencesSection  profile={profile} open={openSection === 'preferences'}  onToggle={() => toggle('preferences')} />
              <MindsetSection      profile={profile} open={openSection === 'mindset'}      onToggle={() => toggle('mindset')} />
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}
