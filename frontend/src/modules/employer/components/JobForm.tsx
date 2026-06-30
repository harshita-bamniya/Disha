import { useState } from 'react'
import {
  Briefcase, Clock4, GraduationCap, FileSignature, Sparkles,
  Globe, MapPinned, Shuffle, Building2, MapPin, IndianRupee,
  CalendarClock, TrendingUp, GaugeCircle, Tags, X, Plus, Info, Wand2,
} from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useSuggestSkills, useGenerateDescription, useJobTemplates, useCreateJobTemplate } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
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

const GROWTH_OPTIONS: { value: GrowthOutlook; label: string }[] = [
  { value: 'high',   label: 'High growth' },
  { value: 'medium', label: 'Medium growth' },
  { value: 'low',    label: 'Stable / niche' },
]

const JOB_TYPES: { value: JobType; label: string; icon: typeof Globe; hint: string; needsLocation: boolean }[] = [
  { value: 'remote',    label: 'Remote',    icon: Globe,      hint: 'Fully remote',        needsLocation: false },
  { value: 'pan_india', label: 'Pan India', icon: MapPinned,  hint: 'Anywhere in India',   needsLocation: false },
  { value: 'hybrid',    label: 'Hybrid',    icon: Shuffle,    hint: 'Office + remote mix', needsLocation: true  },
  { value: 'onsite',    label: 'On-site',   icon: Building2,  hint: 'Full time in office', needsLocation: true  },
]

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string; icon: typeof Briefcase }[] = [
  { value: 'full_time',  label: 'Full Time',  icon: Briefcase },
  { value: 'part_time',  label: 'Part Time',  icon: Clock4 },
  { value: 'internship', label: 'Internship', icon: GraduationCap },
  { value: 'contract',   label: 'Contract',   icon: FileSignature },
  { value: 'freelance',  label: 'Freelance',  icon: Sparkles },
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

function FieldLabel({ children, required, hint }: { children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-800">
        {children}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5">
      <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
      {children}
    </section>
  )
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

  const suggestSkills = useSuggestSkills()
  const generateDescription = useGenerateDescription()
  const { data: templates } = useJobTemplates()
  const createTemplate = useCreateJobTemplate()

  const selectedType  = JOB_TYPES.find(t => t.value === jobType)
  const needsLocation = selectedType?.needsLocation ?? false

  const applyTemplate = (templateId: string) => {
    const t = templates?.find(t => t.id === templateId)
    if (!t) return
    setTitle(t.title)
    setDescription(t.description)
    setSector(t.sector)
    setIsCustomSector(!SECTORS.includes(t.sector))
    setSelectedSkills(new Set(t.required_skills))
    setMinKScore(t.min_k_score)
    if (t.job_type) handleJobTypeChange(t.job_type)
    if (t.employment_type) setEmploymentType(t.employment_type)
  }

  const handleSaveAsTemplate = () => {
    const name = window.prompt('Name this template (e.g. "Standard Analyst Req"):', title)
    if (!name?.trim()) return
    createTemplate.mutate({
      name: name.trim(), title, description, sector,
      required_skills: Array.from(selectedSkills),
      job_type: (jobType || null) as JobType | null,
      employment_type: (employmentType || null) as EmploymentType | null,
      min_k_score: minKScore,
    })
  }

  const handleGenerateDescription = () => {
    generateDescription.mutate({ title, sector, keyPoints: description }, {
      onSuccess: (data) => {
        setDescription(data.description)
        setErrors(p => ({ ...p, description: '' }))
      },
    })
  }

  const handleSuggestSkills = () => {
    suggestSkills.mutate({ title, description }, {
      onSuccess: (data) => {
        setSelectedSkills(prev => new Set([...prev, ...data.suggested_skills]))
        setErrors(p => ({ ...p, skills: '' }))
      },
    })
  }

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
      next.has(skill) ? next.delete(skill) : next.add(skill)
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

    if (!expiresAt) {
      e.expiresAt = 'Application deadline is required'
    } else if (expiresAt <= new Date().toISOString().split('T')[0]) {
      e.expiresAt = 'Expiry date must be a future date'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submitWithPublish = (publish: boolean) => {
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
      expires_at:      expiresAt,
      publish,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitWithPublish(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700">Fields marked with <span className="text-danger font-semibold">*</span> are required.</p>
      </div>

      {!initial && templates && templates.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/15">
          <FileSignature className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Start from a template:</span>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) applyTemplate(e.target.value) }}
            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none"
          >
            <option value="">Select a saved template…</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* ── Basic details ── */}
      <FormSection title="Basic details">
        <Input
          label="Job title"
          required
          placeholder="e.g. Senior Policy Analyst, Research Manager"
          value={title}
          onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })) }}
          error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <FieldLabel required>Job description</FieldLabel>
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={generateDescription.isPending || !title.trim() || !sector}
              title={!title.trim() || !sector ? 'Enter a job title and sector first' : 'Replaces the text below — write key points first to guide it, or leave blank for a generic first draft'}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generateDescription.isPending ? 'Writing…' : 'Generate with AI'}
            </button>
          </div>
          {generateDescription.isError && (
            <p className="text-xs text-danger">{getApiError(generateDescription.error, 'Could not generate a description. Please try again.')}</p>
          )}
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: '' })) }}
            placeholder="Describe the role, responsibilities, and why this candidate profile is a great fit… (or jot a few key points and click Generate with AI)"
            rows={5}
            className={cn(
              'w-full rounded-xl border-[1.5px] bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400',
              'outline-none transition-all duration-200 resize-none',
              'focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8 hover:border-gray-300',
              errors.description ? 'border-[#DC2626]' : 'border-gray-200',
            )}
          />
          <div className="flex justify-between">
            {errors.description ? <p className="text-xs text-danger">{errors.description}</p> : <span className="text-xs text-gray-400">Minimum 20 characters</span>}
            <span className="text-xs text-gray-400">{description.length} chars</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel required>Sector</FieldLabel>
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
              'w-full h-12 rounded-xl border-[1.5px] bg-white/80 px-4 text-sm text-gray-900 outline-none transition-all duration-200',
              'focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8 hover:border-gray-300',
              errors.sector ? 'border-[#DC2626]' : 'border-gray-200',
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
              placeholder="e.g. Fintech, Agritech, Space Technology"
              autoFocus
              className={cn(
                'w-full h-11 rounded-xl border-[1.5px] bg-white/80 px-4 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all duration-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
                errors.sector ? 'border-[#DC2626]' : 'border-gray-200',
              )}
            />
          )}
          {errors.sector && <p className="text-xs text-danger">{errors.sector}</p>}
        </div>
      </FormSection>

      {/* ── Employment & work type ── */}
      <FormSection title="Employment type & location">
        <div className="flex flex-col gap-2">
          <FieldLabel required>Employment type</FieldLabel>
          <div className="grid grid-cols-5 gap-2">
            {EMPLOYMENT_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setEmploymentType(value); setErrors(p => ({ ...p, employmentType: '' })) }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border-[1.5px] text-xs font-semibold transition-all',
                  employmentType === value
                    ? 'bg-primary/5 border-primary text-primary'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {errors.employmentType && <p className="text-xs text-danger">{errors.employmentType}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel required hint="Remote and Pan India don't require a specific city.">Work type</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {JOB_TYPES.map(({ value, label, icon: Icon, hint }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleJobTypeChange(value)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px] text-left transition-all',
                  jobType === value
                    ? 'bg-primary/5 border-primary'
                    : 'bg-white border-gray-200 hover:border-gray-300',
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  jobType === value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500',
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', jobType === value ? 'text-primary' : 'text-gray-800')}>{label}</p>
                  <p className="text-xs text-gray-400">{hint}</p>
                </div>
              </button>
            ))}
          </div>
          {errors.jobType && <p className="text-xs text-danger">{errors.jobType}</p>}
        </div>

        {needsLocation && (
          <div className="flex flex-col gap-2">
            <FieldLabel required hint="Select one or more cities, or type your own.">City / cities</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {CITY_PRESETS.map(city => {
                const active = location.split(',').map(p => p.trim()).includes(city)
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg border-[1.5px] text-xs font-semibold transition-all',
                      active
                        ? 'bg-primary/5 border-primary text-primary'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <MapPin className="w-3 h-3" />
                    {city}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={location}
              onChange={e => { setLocation(e.target.value); setErrors(p => ({ ...p, location: '' })) }}
              placeholder="e.g. New Delhi, Lucknow, Patna"
              className={cn(
                'w-full h-11 rounded-xl border-[1.5px] bg-white/80 px-4 text-sm text-gray-900 placeholder:text-gray-400',
                'outline-none transition-all duration-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
                errors.location ? 'border-[#DC2626]' : 'border-gray-200',
              )}
            />
            {errors.location && <p className="text-xs text-danger">{errors.location}</p>}
          </div>
        )}
      </FormSection>

      {/* ── Compensation & timing ── */}
      <FormSection title="Compensation & timing">
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <FieldLabel hint="Leave blank to keep compensation undisclosed.">
              Salary range (LPA) <span className="text-gray-400 font-normal">(optional)</span>
            </FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative flex items-center">
                <IndianRupee className="absolute left-3 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="number" min={1} max={500}
                  value={salaryMin}
                  onChange={e => { setSalaryMin(e.target.value); setErrors(p => ({ ...p, salary: '' })) }}
                  placeholder="Min, e.g. 8"
                  className={cn(
                    'w-full h-11 rounded-xl border-[1.5px] bg-white/80 pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400',
                    'outline-none transition-all duration-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
                    errors.salary ? 'border-[#DC2626]' : 'border-gray-200',
                  )}
                />
              </div>
              <div className="relative flex items-center">
                <IndianRupee className="absolute left-3 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="number" min={1} max={500}
                  value={salaryMax}
                  onChange={e => { setSalaryMax(e.target.value); setErrors(p => ({ ...p, salary: '' })) }}
                  placeholder="Max, e.g. 20"
                  className={cn(
                    'w-full h-11 rounded-xl border-[1.5px] bg-white/80 pl-8 pr-2 text-sm text-gray-900 placeholder:text-gray-400',
                    'outline-none transition-all duration-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
                    errors.salary ? 'border-[#DC2626]' : 'border-gray-200',
                  )}
                />
              </div>
            </div>
            {errors.salary && <p className="text-xs text-danger">{errors.salary}</p>}
            {salaryMin && salaryMax && !errors.salary && (
              <p className="text-xs text-primary font-medium">Displays as ₹{salaryMin}–{salaryMax} LPA</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel required hint="Postings close automatically on this date.">
              Application deadline
            </FieldLabel>
            <div className="relative flex items-center">
              <CalendarClock className="absolute left-3.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                min={minExpiryDate()}
                value={expiresAt}
                onChange={e => { setExpiresAt(e.target.value); setErrors(p => ({ ...p, expiresAt: '' })) }}
                className={cn(
                  'w-full h-11 rounded-xl border-[1.5px] bg-white/80 pl-9 pr-4 text-sm text-gray-900',
                  'outline-none transition-all duration-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
                  errors.expiresAt ? 'border-[#DC2626]' : 'border-gray-200',
                )}
              />
            </div>
            {errors.expiresAt && <p className="text-xs text-danger">{errors.expiresAt}</p>}
          </div>
        </div>
      </FormSection>

      {/* ── Candidate requirements ── */}
      <FormSection title="Candidate requirements">
        <div className="flex flex-col gap-2">
          <FieldLabel required>Growth outlook</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {GROWTH_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setGrowthOutlook(value); setErrors(p => ({ ...p, growth: '' })) }}
                className={cn(
                  'flex items-center justify-center gap-1.5 h-11 rounded-xl border-[1.5px] text-xs font-semibold transition-all',
                  growthOutlook === value
                    ? 'bg-primary/5 border-primary text-primary'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          {errors.growth && <p className="text-xs text-danger">{errors.growth}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel hint="What level of UPSC background do you expect from candidates?">
            UPSC preparation level <span className="text-gray-400 font-normal">(optional)</span>
          </FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {K_SCORE_OPTIONS.map(({ value, label, hint }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMinKScore(value)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl border-[1.5px] text-center transition-all',
                  minKScore === value
                    ? 'bg-primary/5 border-primary'
                    : 'bg-white border-gray-200 hover:border-gray-300',
                )}
              >
                <GaugeCircle className={cn('w-3.5 h-3.5 mb-0.5', minKScore === value ? 'text-primary' : 'text-gray-400')} />
                <span className={cn('text-sm font-bold', minKScore === value ? 'text-primary' : 'text-gray-800')}>{label}</span>
                <span className="text-xs leading-tight text-gray-400">{hint}</span>
              </button>
            ))}
          </div>
        </div>
      </FormSection>

      {/* ── Required skills ── */}
      <FormSection title="Required skills">
        <div className="flex items-start justify-between gap-3">
          <FieldLabel required hint="Select skills aspirants must have. Used to match your posting with the right candidates.">
            Skills
          </FieldLabel>
          <button
            type="button"
            onClick={handleSuggestSkills}
            disabled={suggestSkills.isPending || description.trim().length < 20}
            title={description.trim().length < 20 ? 'Write at least 20 characters in the job description first' : undefined}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {suggestSkills.isPending ? 'Suggesting…' : 'Suggest skills with AI'}
          </button>
        </div>
        {suggestSkills.isError && (
          <p className="text-xs text-danger">{getApiError(suggestSkills.error, 'Could not suggest skills. Please try again.')}</p>
        )}
        {suggestSkills.isSuccess && suggestSkills.data.suggested_skills.length === 0 && (
          <p className="text-xs text-gray-400">No clear skill matches found — try adding more detail to the description.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map(skill => {
            const selected = selectedSkills.has(skill)
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-[1.5px] text-xs font-medium transition-all',
                  selected
                    ? 'bg-primary/5 border-primary text-primary'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                <Tags className="w-3 h-3" />
                {skill}
              </button>
            )
          })}
        </div>
        {[...selectedSkills].some(s => !ALL_SKILLS.includes(s)) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            {[...selectedSkills].filter(s => !ALL_SKILLS.includes(s)).map(skill => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-primary bg-primary/5 text-primary text-xs font-medium"
              >
                {skill}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{selectedSkills.size} skill{selectedSkills.size !== 1 ? 's' : ''} selected</span>
          {selectedSkills.size > 0 && (
            <button type="button" onClick={() => setSelectedSkills(new Set())} className="text-xs text-danger font-medium hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customSkillInput}
            onChange={e => setCustomSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomJobSkill() } }}
            placeholder="Add a skill not listed above…"
            className="flex-1 h-10 rounded-xl border-[1.5px] border-gray-200 bg-white/80 px-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8"
          />
          <button
            type="button"
            onClick={addCustomJobSkill}
            disabled={!customSkillInput.trim()}
            className="shrink-0 inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
        {errors.skills && <p className="text-xs text-danger">{errors.skills}</p>}
      </FormSection>

      {!initial && (
        <button
          type="button"
          onClick={handleSaveAsTemplate}
          disabled={!title.trim() || !sector || createTemplate.isPending}
          className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer p-0"
        >
          <FileSignature className="w-3.5 h-3.5" />
          {createTemplate.isPending ? 'Saving…' : createTemplate.isSuccess ? 'Saved as template ✓' : 'Save these details as a template'}
        </button>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl border-[1.5px] border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        {initial ? (
          <Button type="submit" size="lg" loading={loading} className="flex-1">
            Save changes
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="lg" onClick={() => submitWithPublish(false)} disabled={loading} className="flex-1">
              Save as draft
            </Button>
            <Button type="submit" size="lg" loading={loading} className="flex-1">
              Publish
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
