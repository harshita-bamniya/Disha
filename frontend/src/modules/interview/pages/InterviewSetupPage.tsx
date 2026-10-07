import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { interviewApi } from '@/api/interview'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import InterviewShell from '../components/InterviewShell'
import { INTERVIEW_ROLES, OTHER_ROLE } from '../lib/roles'
import { DURATIONS, LANGUAGE_OPTIONS, loadDraft, saveDraft, type DurationKey, type ExperienceKey, type LanguageKey } from '../lib/draft'

const ROLES = INTERVIEW_ROLES
const OTHER = OTHER_ROLE

const EXPERIENCE: { value: ExperienceKey; line1: string; line2: string }[] = [
  { value: 'Internship',  line1: 'No experience / student',  line2: 'Focused on basics and potential' },
  { value: 'Fresher',     line1: 'Less than 1 year experience', line2: 'Focused on knowledge' },
  { value: 'Experienced', line1: 'More than 1 year experience', line2: 'Focused on depth and experience' },
]

interface JobContextOverride {
  job_title: string
  company_name: string
  required_skills: string[]
  skills_to_develop: string[]
}

function jobContextToDescription(ctx: JobContextOverride) {
  return `Role: ${ctx.job_title} at ${ctx.company_name}. `
    + `Required skills: ${ctx.required_skills.slice(0, 6).join(', ')}.`
    + (ctx.skills_to_develop.length ? ` Skills to develop: ${ctx.skills_to_develop.slice(0, 4).join(', ')}.` : '')
}

export default function InterviewSetupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activePrep } = useActivePrepJob()
  const { data: eligibility } = useQuery({ queryKey: ['interview-eligibility'], queryFn: interviewApi.getEligibility })
  const stressLocked = !eligibility?.stress.unlocked
  const cardJobContext = (location.state as { jobContext?: JobContextOverride } | null)?.jobContext ?? null
  const jobContext: JobContextOverride | null = cardJobContext ?? activePrep ?? null

  const draft = loadDraft()
  const draftRoleIsListed = !!draft && ROLES.includes(draft.role)
  const [roleChoice, setRoleChoice] = useState(draft ? (draftRoleIsListed ? draft.role : OTHER) : '')
  const [customRole, setCustomRole] = useState(draft && !draftRoleIsListed ? draft.role : '')
  const [level, setLevel] = useState<ExperienceKey | ''>(draft?.level ?? '')
  const [duration, setDuration] = useState<DurationKey | ''>(draft?.duration ?? '')
  const [language, setLanguage] = useState<LanguageKey>(draft?.language ?? 'en')
  const [jobDesc, setJobDesc] = useState(draft?.jobDesc ?? '')
  const [showJd, setShowJd] = useState(!!draft?.jobDesc && !jobContext)

  // A job card / active prep job pre-fills the role and a short description.
  useEffect(() => {
    if (jobContext) setJobDesc(jobContextToDescription(jobContext))
  }, [jobContext?.job_title, jobContext?.company_name]) // eslint-disable-line react-hooks/exhaustive-deps

  const role = jobContext ? jobContext.job_title : roleChoice === OTHER ? customRole.trim() : roleChoice
  const ready = role !== '' && level !== '' && duration !== ''

  const start = () => {
    if (!ready) return
    saveDraft({
      role, level: level as ExperienceKey, duration: duration as DurationKey, jobDesc: jobDesc.trim(),
      consent: false, language, saveAudio: draft?.saveAudio ?? false,
    })
    navigate('/app/interview/instructions')
  }

  return (
    <InterviewShell>
      <button className="iv-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} aria-hidden /> Go back
      </button>

      <h1 className="iv-h1">Let's set up your practice</h1>
      <p className="iv-sub">Customize the AI to simulate your target role or skill perfectly</p>

      <section className="iv-panel iv-panel-accent" aria-labelledby="iv-role">
        <p className="iv-eyebrow" id="iv-role">Role</p>
        {jobContext ? (
          <>
            <p className="iv-role-name">{jobContext.job_title} at {jobContext.company_name}</p>
            <p className="iv-body">Questions are based on this job's requirements and your profile.</p>
          </>
        ) : (
          <>
            <select
              className="iv-field"
              aria-labelledby="iv-role"
              value={roleChoice}
              onChange={e => setRoleChoice(e.target.value)}
            >
              <option value="" disabled>Select a role</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER}>Other (type your own)</option>
            </select>
            {roleChoice === OTHER && (
              <input
                className="iv-field"
                style={{ marginTop: 12 }}
                type="text"
                value={customRole}
                maxLength={120}
                onChange={e => setCustomRole(e.target.value)}
                placeholder="e.g. NGO Programme Officer"
                aria-label="Your role"
              />
            )}
            <p className="iv-body" style={{ marginTop: 14 }}>
              Questions and scoring are tailored to this role.{' '}
              {!showJd && <button type="button" className="iv-link-btn" onClick={() => setShowJd(true)}>Add a job description</button>}
            </p>
            {showJd && (
              <textarea
                className="iv-field"
                style={{ marginTop: 12 }}
                value={jobDesc}
                maxLength={4000}
                onChange={e => setJobDesc(e.target.value)}
                placeholder="Paste the job description (optional)"
                aria-label="Job description"
              />
            )}
          </>
        )}
      </section>

      <section className="iv-panel" aria-labelledby="iv-level">
        <h2 className="iv-panel-title" id="iv-level">Experience level</h2>
        <div className="iv-grid-3" role="radiogroup" aria-labelledby="iv-level">
          {EXPERIENCE.map(o => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={level === o.value}
              className="iv-option"
              onClick={() => setLevel(o.value)}
            >
              <span className="iv-option-title">{o.value}</span>
              <span className="iv-option-line">{o.line1}</span>
              <span className="iv-option-line">{o.line2}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="iv-panel" aria-labelledby="iv-duration">
        <h2 className="iv-panel-title" id="iv-duration">Duration</h2>
        <div className="iv-grid-3" role="radiogroup" aria-labelledby="iv-duration">
          {(Object.keys(DURATIONS) as DurationKey[]).map(key => {
            const locked = key === 'stress' && stressLocked
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={duration === key}
                aria-disabled={locked}
                disabled={locked}
                className="iv-option"
                style={locked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                onClick={() => setDuration(key)}
              >
                <span className="iv-option-title">{DURATIONS[key].label} ({DURATIONS[key].minutes} mins)</span>
                <span className="iv-option-line">{DURATIONS[key].questionRange}</span>
                {key === 'stress' && (
                  <span className="iv-option-line">
                    {locked ? (eligibility?.stress.message ?? 'Locked') : 'A tougher, sceptical panel'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="iv-panel" aria-labelledby="iv-language">
        <h2 className="iv-panel-title" id="iv-language">Language</h2>
        <div className="iv-grid-3" role="radiogroup" aria-labelledby="iv-language">
          {LANGUAGE_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={language === o.value}
              className="iv-option"
              onClick={() => setLanguage(o.value)}
            >
              <span className="iv-option-title">{o.label}</span>
              <span className="iv-option-line">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="iv-fineprint">You can answer in any mix of languages. Only what you say is judged, never accent or language choice.</p>
      </section>

      <section className="iv-panel" aria-labelledby="iv-resume">
        <h2 className="iv-panel-title" id="iv-resume">Your resume</h2>
        <p className="iv-body">
          Your primary Disha resume is used automatically to ask personalised questions about your projects and experience.{' '}
          <Link to="/app/resume" className="iv-link-btn">Manage resumes</Link>
        </p>
      </section>

      <div className="iv-actions">
        <button className="iv-btn" disabled={!ready} onClick={start}>Start new interview</button>
      </div>
      <p className="iv-fineprint" style={{ textAlign: 'right' }}>
        <Link to="/app/interview/drill" className="iv-link-btn">Just want to sharpen one answer? Try a quick drill</Link>
        {' · '}
        <Link to="/app/interview/history" className="iv-link-btn">View past interviews</Link>
      </p>
    </InterviewShell>
  )
}
