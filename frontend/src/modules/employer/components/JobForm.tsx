import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { JobPostingPayload, GrowthOutlook, JobPosting, JobType, EmploymentType } from '@/api/jobs'

const SECTORS = [
  'Government & Civil Services', 'Public Sector Undertakings (PSU)',
  'Management Consulting', 'Education & Training', 'NGO & Social Sector',
  'Banking & Finance', 'Legal', 'Research & Analytics', 'Media & Journalism',
  'Healthcare & Public Health', 'IT & Technology', 'Defence & Security',
  'International Organizations', 'Think Tanks & Policy', 'Entrepreneurship',
  'Corporate Affairs', 'Government & Policy', 'Consulting',
]

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

const GROWTH_OPTIONS: { value: GrowthOutlook; label: string; color: string }[] = [
  { value: 'high',   label: '↑ High growth',   color: 'bg-primary text-white border-primary' },
  { value: 'medium', label: '→ Medium growth',  color: 'bg-accent text-white border-accent' },
  { value: 'low',    label: '↓ Stable / niche', color: 'bg-gray-500 text-white border-gray-500' },
]

const JOB_TYPES: { value: JobType; label: string; icon: string; hint: string; needsLocation: boolean }[] = [
  { value: 'remote',    label: 'Remote',    icon: '🌐', hint: 'Fully remote',        needsLocation: false },
  { value: 'pan_india', label: 'Pan India', icon: '🇮🇳', hint: 'Anywhere in India',  needsLocation: false },
  { value: 'hybrid',    label: 'Hybrid',    icon: '🔀', hint: 'Office + remote mix', needsLocation: true  },
  { value: 'onsite',    label: 'On-site',   icon: '🏢', hint: 'Full time in office', needsLocation: true  },
]

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string; icon: string }[] = [
  { value: 'full_time',  label: 'Full Time',  icon: '💼' },
  { value: 'part_time',  label: 'Part Time',  icon: '⏰' },
  { value: 'internship', label: 'Internship', icon: '🎓' },
  { value: 'contract',   label: 'Contract',   icon: '📝' },
  { value: 'freelance',  label: 'Freelance',  icon: '🔓' },
]

const CITY_PRESETS = ['New Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata']

const K_SCORE_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 0,  label: 'Anyone',          hint: 'No UPSC background needed' },
  { value: 15, label: 'Basic',           hint: 'Some preparation welcome' },
  { value: 25, label: 'Exposure',        hint: 'UPSC exposure preferred' },
  { value: 35, label: 'Prelims',         hint: 'Prelims cleared preferred' },
  { value: 55, label: 'Mains',           hint: 'Mains cleared preferred' },
  { value: 75, label: 'Interview',       hint: 'Interview stage preferred' },
]

// Minimum expiry date = tomorrow
function minExpiryDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

interface JobFormProps {
  initial?: Partial<JobPosting>
  onSubmit: (data: JobPostingPayload) => void
  loading: boolean
  onCancel: () => void
}

export default function JobForm({ initial, onSubmit, loading, onCancel }: JobFormProps) {
  const [title,          setTitle]          = useState(initial?.title ?? '')
  const [description,    setDescription]    = useState(initial?.description ?? '')
  const [sector,         setSector]         = useState(initial?.sector ?? '')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(initial?.required_skills ?? []))
  const [minKScore, setMinKScore] = useState(() => {
    const raw = initial?.min_k_score ?? 0
    // Snap to nearest valid option value when loading an existing job
    const validValues = K_SCORE_OPTIONS.map(o => o.value)
    return validValues.includes(raw) ? raw : validValues.reduce((prev, curr) =>
      Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev, 0)
  })
  const [salaryMin,      setSalaryMin]      = useState<string>(initial?.salary_min?.toString() ?? '')
  const [salaryMax,      setSalaryMax]      = useState<string>(initial?.salary_max?.toString() ?? '')
  const [growthOutlook,  setGrowthOutlook]  = useState<GrowthOutlook | ''>(initial?.growth_outlook as GrowthOutlook ?? '')
  const [jobType,        setJobType]        = useState<JobType | ''>(initial?.job_type as JobType ?? '')
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>(initial?.employment_type as EmploymentType ?? '')
  const [expiresAt,      setExpiresAt]      = useState<string>(initial?.expires_at ?? '')
  const [location,       setLocation]       = useState<string>(
    (initial?.job_type === 'remote' || initial?.job_type === 'pan_india')
      ? ''
      : (initial?.location ?? '')
  )
  const [isCustomSector, setIsCustomSector] = useState(!SECTORS.includes(initial?.sector ?? '') && !!initial?.sector)
  const [customSkillInput, setCustomSkillInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedType  = JOB_TYPES.find(t => t.value === jobType)
  const needsLocation = selectedType?.needsLocation ?? false

  const handleJobTypeChange = (type: JobType) => {
    const typeDef = JOB_TYPES.find(t => t.value === type)!
    setJobType(type)
    if (!typeDef.needsLocation) setLocation('')
    setErrors(p => ({ ...p, jobType: '', location: '' }))
  }

  const toggleCity = (city: string) => {
    setErrors(p => ({ ...p, location: '' }))
    setLocation(prev => {
      const parts = prev.split(',').map(p => p.trim()).filter(Boolean)
      if (parts.includes(city)) return parts.filter(p => p !== city).join(', ')
      return parts.length > 0 ? `${prev.trim()}, ${city}` : city
    })
  }

  const toggleSkill = (skill: string) => {
    setErrors(p => ({ ...p, skills: '' }))
    setSelectedSkills(prev => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      return next
    })
  }

  const addCustomJobSkill = () => {
    const skill = customSkillInput.trim()
    if (!skill) return
    const existingLower = new Set([...selectedSkills].map(s => s.toLowerCase()))
    if (existingLower.has(skill.toLowerCase())) { setCustomSkillInput(''); return }
    setSelectedSkills(prev => new Set([...prev, skill]))
    setCustomSkillInput('')
    setErrors(p => ({ ...p, skills: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!title.trim())                       e.title          = 'Job title is required'
    if (description.trim().length < 20)      e.description    = 'Description must be at least 20 characters'
    if (!sector)                             e.sector         = 'Please select a sector'
    if (selectedSkills.size === 0)           e.skills         = 'Select at least 1 required skill'
    if (!growthOutlook)                      e.growth         = 'Please select growth outlook'
    if (!jobType)                            e.jobType        = 'Please select a work type'
    if (!employmentType)                     e.employmentType = 'Please select an employment type'
    if (needsLocation && !location.trim())   e.location       = 'Enter at least one city for hybrid / on-site roles'

    const sMin = salaryMin ? parseInt(salaryMin) : null
    const sMax = salaryMax ? parseInt(salaryMax) : null
    if ((salaryMin && isNaN(sMin!)) || (salaryMax && isNaN(sMax!))) {
      e.salary = 'Enter valid numbers for salary'
    } else if (sMin !== null && sMax !== null && sMax < sMin) {
      e.salary = 'Max salary must be ≥ min salary'
    }

    if (expiresAt && expiresAt <= new Date().toISOString().split('T')[0]) {
      e.expiresAt = 'Expiry date must be a future date'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const resolvedLocation =
      jobType === 'remote'    ? 'Remote'    :
      jobType === 'pan_india' ? 'Pan India' :
      location.trim()

    onSubmit({
      title:           title.trim(),
      description:     description.trim(),
      sector,
      required_skills: Array.from(selectedSkills),
      min_k_score:     minKScore,
      salary_min:      salaryMin ? parseInt(salaryMin) : undefined,
      salary_max:      salaryMax ? parseInt(salaryMax) : undefined,
      growth_outlook:  growthOutlook as GrowthOutlook,
      job_type:        jobType as JobType,
      location:        resolvedLocation,
      employment_type: employmentType as EmploymentType,
      expires_at:      expiresAt || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* ── Basic info ── */}
      <section className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Job details</p>

        <Input
          label="Job title"
          placeholder="Senior Policy Analyst, Research Manager…"
          value={title}
          onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })) }}
          error={errors.title}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Job description</label>
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })) }}
            placeholder="Describe the role, responsibilities, and why UPSC-background candidates are a great fit…"
            rows={4}
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400',
              'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none',
              errors.description ? 'border-danger' : 'border-gray-200',
            )}
          />
          <div className="flex justify-between">
            {errors.description ? <p className="text-xs text-danger">{errors.description}</p> : <span />}
            <span className="text-xs text-gray-400">{description.length} chars</span>
          </div>
        </div>

        {/* Sector */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Sector</label>
          <select
            value={isCustomSector ? '__other__' : sector}
            onChange={e => {
              if (e.target.value === '__other__') {
                setIsCustomSector(true)
                setSector('')
              } else {
                setIsCustomSector(false)
                setSector(e.target.value)
              }
              setErrors(p => ({ ...p, sector: '' }))
            }}
            className={cn(
              'w-full h-11 rounded-xl border bg-white px-4 text-sm text-gray-900 outline-none transition-all',
              'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10',
              errors.sector && 'border-danger',
            )}
          >
            <option value="">Select sector…</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__other__">Other (specify below)</option>
          </select>
          {isCustomSector && (
            <input
              type="text"
              value={sector}
              onChange={e => { setSector(e.target.value); setErrors(p => ({ ...p, sector: '' })) }}
              placeholder="e.g. Fintech, Agritech, Space Technology…"
              autoFocus
              className={cn(
                'w-full h-10 rounded-xl border bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 mt-1',
                errors.sector ? 'border-danger' : 'border-gray-200',
              )}
            />
          )}
          {errors.sector && <p className="text-xs text-danger">{errors.sector}</p>}
        </div>

        {/* Salary */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Salary range (LPA) <span className="text-xs text-gray-400 font-normal ml-1">optional</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <input
                type="number" min={1} max={500}
                value={salaryMin}
                onChange={e => { setSalaryMin(e.target.value); setErrors(p => ({ ...p, salary: '' })) }}
                placeholder="Min  e.g. 8"
                className={cn(
                  'w-full h-10 rounded-xl border bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400',
                  'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
                  errors.salary ? 'border-danger' : 'border-gray-200',
                )}
              />
              <span className="text-xs text-gray-400 pl-1">Min LPA</span>
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="number" min={1} max={500}
                value={salaryMax}
                onChange={e => { setSalaryMax(e.target.value); setErrors(p => ({ ...p, salary: '' })) }}
                placeholder="Max  e.g. 20"
                className={cn(
                  'w-full h-10 rounded-xl border bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400',
                  'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
                  errors.salary ? 'border-danger' : 'border-gray-200',
                )}
              />
              <span className="text-xs text-gray-400 pl-1">Max LPA</span>
            </div>
          </div>
          {errors.salary && <p className="text-xs text-danger">{errors.salary}</p>}
          {salaryMin && salaryMax && !errors.salary && (
            <p className="text-xs text-primary font-medium pl-1">
              Will display as: ₹{salaryMin}–{salaryMax} LPA
            </p>
          )}
        </div>
      </section>

      {/* ── Employment type ── */}
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Employment type <span className="text-danger">*</span></p>
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setEmploymentType(value); setErrors(p => ({ ...p, employmentType: '' })) }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
                employmentType === value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-accent/50',
              )}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
        {errors.employmentType && <p className="text-xs text-danger">{errors.employmentType}</p>}
      </section>

      {/* ── Work type ── */}
      <section className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Work type <span className="text-danger">*</span></p>
          <p className="text-xs text-gray-400 mt-0.5">Remote and Pan India don't require a specific city.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {JOB_TYPES.map(({ value, label, icon, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleJobTypeChange(value)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                jobType === value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40',
              )}
            >
              <span className="text-xl leading-none">{icon}</span>
              <div>
                <p className={cn('text-sm font-semibold', jobType === value ? 'text-white' : 'text-gray-800')}>{label}</p>
                <p className={cn('text-xs', jobType === value ? 'text-white/70' : 'text-gray-400')}>{hint}</p>
              </div>
            </button>
          ))}
        </div>
        {errors.jobType && <p className="text-xs text-danger">{errors.jobType}</p>}
      </section>

      {/* ── Location — only for hybrid / on-site ── */}
      {needsLocation && (
        <section className="flex flex-col gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Location <span className="text-danger">*</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Select one or more cities, or type your own.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CITY_PRESETS.map(city => (
              <button
                key={city}
                type="button"
                onClick={() => toggleCity(city)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                  location.split(',').map(p => p.trim()).includes(city)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {location.split(',').map(p => p.trim()).includes(city) && <span className="mr-1">✓</span>}
                {city}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={location}
            onChange={e => { setLocation(e.target.value); setErrors(p => ({ ...p, location: '' })) }}
            placeholder="e.g. New Delhi, Lucknow, Patna"
            className={cn(
              'w-full h-10 rounded-xl border bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400',
              'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
              errors.location ? 'border-danger' : 'border-gray-200',
            )}
          />
          {errors.location && <p className="text-xs text-danger">{errors.location}</p>}
        </section>
      )}

      {/* ── Application deadline ── */}
      <section className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Application deadline <span className="text-xs text-gray-400 font-normal ml-1">optional</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Leave blank if the posting has no fixed closing date.</p>
        </div>
        <input
          type="date"
          min={minExpiryDate()}
          value={expiresAt}
          onChange={e => { setExpiresAt(e.target.value); setErrors(p => ({ ...p, expiresAt: '' })) }}
          className={cn(
            'w-full h-10 rounded-xl border bg-white px-4 text-sm text-gray-900',
            'outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
            errors.expiresAt ? 'border-danger' : 'border-gray-200',
          )}
        />
        {errors.expiresAt && <p className="text-xs text-danger">{errors.expiresAt}</p>}
      </section>

      {/* ── Growth outlook ── */}
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Growth outlook</p>
        <div className="grid grid-cols-3 gap-2">
          {GROWTH_OPTIONS.map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setGrowthOutlook(value); setErrors(p => ({ ...p, growth: '' })) }}
              className={cn(
                'h-11 rounded-xl border text-xs font-semibold transition-all',
                growthOutlook === value ? color : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {errors.growth && <p className="text-xs text-danger">{errors.growth}</p>}
      </section>

      {/* ── UPSC Knowledge requirement ── */}
      <section className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">UPSC preparation level required</p>
          <p className="text-xs text-gray-400">What level of UPSC background do you expect from candidates?</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {K_SCORE_OPTIONS.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMinKScore(value)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl border text-center transition-all',
                minKScore === value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
              )}
            >
              <span className={cn('text-sm font-bold', minKScore === value ? 'text-white' : 'text-gray-800')}>{label}</span>
              <span className={cn('text-xs leading-tight', minKScore === value ? 'text-white/75' : 'text-gray-400')}>{hint}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Required skills ── */}
      <section className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Required skills</p>
          <p className="text-xs text-gray-400">Select skills aspirants must have. Used to match your posting with the right candidates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map(skill => {
            const selected = selectedSkills.has(skill)
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                  selected
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50',
                )}
              >
                {selected && <span className="mr-1">✓</span>}
                {skill}
              </button>
            )
          })}
        </div>
        {/* Custom selected skills */}
        {[...selectedSkills].some(s => !ALL_SKILLS.includes(s)) && (
          <div className="flex flex-wrap gap-2">
            {[...selectedSkills].filter(s => !ALL_SKILLS.includes(s)).map(skill => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className="px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent text-xs font-medium flex items-center gap-1"
              >
                <span>✓</span> {skill}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400">
          <span>{selectedSkills.size} skill{selectedSkills.size !== 1 ? 's' : ''} selected</span>
          {selectedSkills.size > 0 && (
            <button type="button" onClick={() => setSelectedSkills(new Set())} className="text-danger hover:underline">
              Clear all
            </button>
          )}
        </div>
        {/* Custom skill input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customSkillInput}
            onChange={e => setCustomSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomJobSkill() } }}
            placeholder="Add a skill not listed above…"
            className="flex-1 h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={addCustomJobSkill}
            disabled={!customSkillInput.trim()}
            className="shrink-0 h-9 px-3 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            + Add
          </button>
        </div>
        {errors.skills && <p className="text-xs text-danger">{errors.skills}</p>}
      </section>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <Button type="submit" loading={loading} className="flex-1">
          {initial ? 'Save changes' : 'Post job'}
        </Button>
      </div>
    </form>
  )
}
