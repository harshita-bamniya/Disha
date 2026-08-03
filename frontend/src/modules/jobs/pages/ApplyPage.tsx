/**
 * LinkedIn-style multi-step application wizard.
 *
 * Step 0  – Contact Info  (pre-filled from profile, always shown)
 * Step 1  – Resume        (library + inline upload, conditional on form config)
 * Step 2…N – Employer question sections
 * Last   – Cover note + Submit
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check,
  CheckCircle2, FileText, Loader2, Send, Upload, X,
} from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { applicationsApi, type AnswerIn, type FormSectionOut, type QuestionOut } from '@/api/applications'
import { resumeLibraryApi, type ResumeFile } from '@/api/resumeLibrary'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

// ── palette ─────────────────────────────────────────────────────────────────
const NAVY     = '#1A2744'
const INK      = '#1E3A5F'
const INK_S    = '#475569'
const MUTED    = '#94A3B8'
const CREAM    = '#F4F5F7'
const CREAM_DK = '#EAECF0'
const BORDER   = 'rgba(0,0,0,0.08)'
const WHITE    = '#FFFFFF'
const RED      = '#DC2626'
const GREEN    = '#16A34A'

// ── types ────────────────────────────────────────────────────────────────────
type AnswerMap = Record<string, { text?: string; number?: number; date?: string; options?: string[] }>

interface ContactInfo {
  full_name: string
  email: string
  phone: string
  city: string
}

// ── helpers ──────────────────────────────────────────────────────────────────
function answerToPayload(qid: string, a: AnswerMap[string], q: QuestionOut): AnswerIn {
  const base: AnswerIn = { question_id: qid }
  if (['short_text','long_text','email','phone','url','linkedin_url','github_url','portfolio_url'].includes(q.question_type)) {
    base.text_value = a.text ?? null
  } else if (['number','experience_years','salary_expectation','notice_period'].includes(q.question_type)) {
    base.number_value = a.number != null ? a.number : null
  } else if (q.question_type === 'date') {
    base.date_value = a.date ?? null
  } else {
    base.option_values = a.options ?? null
  }
  return base
}

function isAnswerEmpty(q: QuestionOut, a: AnswerMap[string] | undefined): boolean {
  if (!a) return true
  if (a.text != null && a.text.trim() !== '') return false
  if (a.number != null) return false
  if (a.date != null && a.date !== '') return false
  if (a.options != null && a.options.length > 0) return false
  return true
}

// ── Step progress bar ────────────────────────────────────────────────────────
function StepBar({ total, current, labels }: { total: number; current: number; labels: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
      {labels.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `2px solid ${done || active ? NAVY : CREAM_DK}`,
                background: done ? NAVY : active ? WHITE : CREAM,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: done ? WHITE : active ? NAVY : MUTED,
              }}>
                {done ? <Check size={13} color={WHITE} /> : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: active ? NAVY : done ? INK_S : MUTED,
                whiteSpace: 'nowrap', maxWidth: 64, textAlign: 'center', lineHeight: 1.2,
              }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div style={{ width: 28, height: 2, background: done ? NAVY : CREAM_DK, margin: '0 4px', marginBottom: 18, flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Contact Info Step (Step 0) ───────────────────────────────────────────────
function ContactInfoStep({
  info,
  onChange,
  errors,
}: {
  info: ContactInfo
  onChange: (k: keyof ContactInfo, v: string) => void
  errors: Record<string, string>
}) {
  const inputStyle = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '10px 14px',
    border: `1.5px solid ${err ? RED : CREAM_DK}`,
    borderRadius: 10, fontSize: 14, color: INK,
    outline: 'none', background: WHITE, boxSizing: 'border-box' as const,
  })

  return (
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: INK_S }}>
        Review your contact details. This information will be shared with the employer.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
            Full name <span style={{ color: RED }}>*</span>
          </label>
          <input
            value={info.full_name}
            onChange={e => onChange('full_name', e.target.value)}
            placeholder="Your full name"
            style={inputStyle(errors.full_name)}
          />
          {errors.full_name && <p style={{ margin: '4px 0 0', fontSize: 12, color: RED }}>{errors.full_name}</p>}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
            Email address <span style={{ color: RED }}>*</span>
          </label>
          <input
            type="email"
            value={info.email}
            onChange={e => onChange('email', e.target.value)}
            placeholder="your@email.com"
            style={inputStyle(errors.email)}
          />
          {errors.email && <p style={{ margin: '4px 0 0', fontSize: 12, color: RED }}>{errors.email}</p>}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
            Phone number <span style={{ color: RED }}>*</span>
          </label>
          <input
            type="tel"
            value={info.phone}
            onChange={e => onChange('phone', e.target.value)}
            placeholder="+91 XXXXX XXXXX"
            style={inputStyle(errors.phone)}
          />
          {errors.phone && <p style={{ margin: '4px 0 0', fontSize: 12, color: RED }}>{errors.phone}</p>}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
            City / Location
          </label>
          <input
            value={info.city}
            onChange={e => onChange('city', e.target.value)}
            placeholder="e.g. New Delhi"
            style={inputStyle()}
          />
        </div>
      </div>

      <div style={{
        marginTop: 20, padding: '12px 14px',
        background: `${NAVY}06`, borderRadius: 10, border: `1px solid ${NAVY}14`,
      }}>
        <p style={{ margin: 0, fontSize: 12, color: INK_S }}>
          Your profile, KRS score, and skills will also be shared with the employer automatically.
        </p>
      </div>
    </div>
  )
}

// ── Resume Step (Step 1) ─────────────────────────────────────────────────────
function ResumeStep({
  selectedId,
  onSelect,
  resumeConfig,
  files,
  isLoading,
  onUploadDone,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  resumeConfig: string
  files: ResumeFile[]
  isLoading: boolean
  onUploadDone: (file: ResumeFile) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const required = resumeConfig === 'required'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const uploaded = await resumeLibraryApi.upload(file)
      onUploadDone(uploaded)
    } catch (err: any) {
      setUploadError(err?.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: INK_S }}>
        {required
          ? 'A resume is required for this application. Select one from your library or upload a new file.'
          : 'Attach a resume to strengthen your application (optional).'}
      </p>

      {/* Upload button — always visible */}
      <div style={{ marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.rtf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 9,
            border: `1.5px dashed ${NAVY}50`,
            background: `${NAVY}04`, color: NAVY,
            fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer',
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
            : <><Upload size={14} /> Upload new resume</>
          }
        </button>
        {uploadError && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> {uploadError}
          </p>
        )}
        <p style={{ margin: '6px 0 0', fontSize: 11, color: MUTED }}>
          Accepted: PDF, DOCX, DOC, RTF · Max 5 MB
        </p>
      </div>

      {/* Library */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <Loader2 size={20} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {!isLoading && files.length === 0 && (
        <div style={{
          padding: '20px 16px', textAlign: 'center',
          background: CREAM, borderRadius: 10, border: `1px dashed ${CREAM_DK}`,
        }}>
          <FileText size={24} color={MUTED} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
            No resumes yet — upload one above to continue.
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Your resumes
          </p>

          {!required && (
            <label
              onClick={() => onSelect(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', borderRadius: 10, marginBottom: 8,
                border: `1.5px solid ${selectedId === null ? NAVY : BORDER}`,
                background: selectedId === null ? `${NAVY}06` : WHITE,
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selectedId === null ? NAVY : CREAM_DK}`,
                background: selectedId === null ? NAVY : WHITE,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedId === null && <span style={{ width: 6, height: 6, borderRadius: '50%', background: WHITE }} />}
              </span>
              <span style={{ fontSize: 13, color: INK_S }}>Apply without a resume</span>
            </label>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map(f => {
              const sel = selectedId === f.id
              const sizeKb = Math.round(f.file_size_bytes / 1024)
              const displayName = f.label || f.filename
              return (
                <label
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10,
                    border: `1.5px solid ${sel ? NAVY : BORDER}`,
                    background: sel ? `${NAVY}06` : WHITE,
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${sel ? NAVY : CREAM_DK}`,
                    background: sel ? NAVY : WHITE,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: WHITE }} />}
                  </span>

                  {/* format badge */}
                  <span style={{
                    width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                    background: '#FEE2E2', color: '#DC2626',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, letterSpacing: '.3px',
                  }}>
                    {f.format.toUpperCase()}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      {sizeKb} KB
                      {f.last_used_at ? ` · Last used ${new Date(f.last_used_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>

                  {sel && <Check size={16} color={NAVY} style={{ flexShrink: 0 }} />}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Question field ────────────────────────────────────────────────────────────
function QuestionField({ q, value, onChange, error }: {
  q: QuestionOut
  value: AnswerMap[string] | undefined
  onChange: (v: AnswerMap[string]) => void
  error?: string
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: `1.5px solid ${error ? RED : CREAM_DK}`,
    borderRadius: 10, fontSize: 14, color: INK,
    outline: 'none', background: WHITE, boxSizing: 'border-box',
  }

  const opts = q.options_json ?? []
  const qt   = q.question_type

  const radioGroup = (choices: string[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
      {choices.map(c => {
        const sel = value?.options?.includes(c)
        return (
          <label key={c} onClick={() => onChange({ ...value, options: [c] })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: INK }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${sel ? NAVY : CREAM_DK}`, background: sel ? NAVY : WHITE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: WHITE }} />}
            </span>
            {c}
          </label>
        )
      })}
    </div>
  )

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
        {q.label}
        {q.is_required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
      </label>

      {['short_text','email','phone','url','linkedin_url','github_url','portfolio_url'].includes(qt) && (
        <input type={qt === 'email' ? 'email' : qt === 'phone' ? 'tel' : 'text'}
          value={value?.text ?? ''} placeholder={q.placeholder ?? ''}
          maxLength={q.character_limit ?? undefined}
          onChange={e => onChange({ ...value, text: e.target.value })} style={inputStyle} />
      )}
      {qt === 'long_text' && (
        <textarea value={value?.text ?? ''} placeholder={q.placeholder ?? ''} rows={4}
          maxLength={q.character_limit ?? undefined}
          onChange={e => onChange({ ...value, text: e.target.value })}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} />
      )}
      {['number','experience_years','salary_expectation','notice_period'].includes(qt) && (
        <input type="number" value={value?.number ?? ''} placeholder={q.placeholder ?? ''}
          onChange={e => onChange({ ...value, number: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={inputStyle} />
      )}
      {qt === 'date' && (
        <input type="date" value={value?.date ?? ''}
          onChange={e => onChange({ ...value, date: e.target.value })} style={inputStyle} />
      )}
      {qt === 'dropdown' && opts.length > 0 && (
        <select value={value?.options?.[0] ?? ''}
          onChange={e => onChange({ ...value, options: e.target.value ? [e.target.value] : [] })}
          style={{ ...inputStyle, appearance: 'none' }}>
          <option value="">Select…</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {qt === 'yes_no' && radioGroup(['Yes', 'No'])}
      {qt === 'work_authorization' && radioGroup(['Yes, I am authorized', 'No, I need sponsorship', 'Prefer not to say'])}
      {qt === 'relocation' && radioGroup(['Yes', 'No', 'Open to discuss'])}
      {qt === 'remote_preference' && radioGroup(['Remote only', 'Hybrid preferred', 'On-site preferred', 'Flexible'])}
      {qt === 'radio' && opts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
          {opts.map(o => {
            const sel = value?.options?.includes(o.value)
            return (
              <label key={o.value} onClick={() => onChange({ ...value, options: [o.value] })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: INK }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${sel ? NAVY : CREAM_DK}`, background: sel ? NAVY : WHITE,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: WHITE }} />}
                </span>
                {o.label}
              </label>
            )
          })}
        </div>
      )}
      {qt === 'availability' && (
        <select value={value?.options?.[0] ?? ''}
          onChange={e => onChange({ ...value, options: e.target.value ? [e.target.value] : [] })}
          style={{ ...inputStyle, appearance: 'none' }}>
          <option value="">Select availability…</option>
          {['Immediately','Within 30 days','Within 60 days','More than 60 days'].map(o =>
            <option key={o} value={o}>{o}</option>
          )}
        </select>
      )}
      {qt === 'checkbox' && (
        <label onClick={() => onChange({ ...value, options: value?.options?.includes('true') ? [] : ['true'] })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: INK }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: `2px solid ${value?.options?.includes('true') ? NAVY : CREAM_DK}`,
            background: value?.options?.includes('true') ? NAVY : WHITE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {value?.options?.includes('true') && <Check size={10} color={WHITE} />}
          </span>
          Yes
        </label>
      )}

      {q.hint_text && <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>{q.hint_text}</p>}
      {error && <p style={{ margin: '4px 0 0', fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} />{error}</p>}
    </div>
  )
}

// ── Section step ──────────────────────────────────────────────────────────────
function SectionStep({ section, answers, onChange, errors }: {
  section: FormSectionOut
  answers: AnswerMap
  onChange: (qid: string, v: AnswerMap[string]) => void
  errors: Record<string, string>
}) {
  return (
    <div>
      {section.description && <p style={{ margin: '0 0 20px', fontSize: 13, color: INK_S }}>{section.description}</p>}
      {section.questions
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(q => (
          <QuestionField key={q.id} q={q} value={answers[q.id]}
            onChange={v => onChange(q.id, v)} error={errors[q.id]} />
        ))}
    </div>
  )
}

// ── Submit / Cover note step ──────────────────────────────────────────────────
function SubmitStep({ coverNote, onChange, requireCoverLetter, coverError }: {
  coverNote: string
  onChange: (v: string) => void
  requireCoverLetter: string
  coverError?: string
}) {
  const required = requireCoverLetter === 'required'
  const hidden   = requireCoverLetter === 'hidden'

  return (
    <div>
      {!hidden && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
            Cover note{required && <span style={{ color: RED }}> *</span>}
            {!required && <span style={{ color: MUTED, fontWeight: 400 }}> (optional)</span>}
          </label>
          <textarea value={coverNote} onChange={e => onChange(e.target.value)} rows={6}
            maxLength={2000}
            placeholder="Briefly explain why you're a great fit for this role…"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: `1.5px solid ${coverError ? RED : CREAM_DK}`,
              fontSize: 14, color: INK, resize: 'vertical', minHeight: 120,
              outline: 'none', background: WHITE, boxSizing: 'border-box',
            }} />
          {coverError && <p style={{ margin: '4px 0 0', fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} />{coverError}</p>}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>{coverNote.length} / 2000</p>
        </div>
      )}
      <div style={{ background: `${NAVY}06`, border: `1px solid ${NAVY}18`, borderRadius: 12, padding: '14px 16px' }}>
        <p style={{ margin: 0, fontSize: 13, color: INK_S, lineHeight: 1.6 }}>
          By submitting, you confirm that all information provided is accurate and up to date.
        </p>
      </div>
    </div>
  )
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ refNum, jobTitle, onDone }: { refNum: string | null; jobTitle: string; onDone: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `${GREEN}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <CheckCircle2 size={36} color={GREEN} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: NAVY }}>Application submitted!</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: INK_S, maxWidth: 360 }}>
        Your application for <strong>{jobTitle}</strong> has been received. The hiring team will be in touch.
      </p>
      {refNum && (
        <div style={{ background: CREAM, border: `1px solid ${CREAM_DK}`, borderRadius: 10, padding: '10px 20px', marginBottom: 24 }}>
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Reference number</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: NAVY, letterSpacing: 1 }}>{refNum}</p>
        </div>
      )}
      <button onClick={onDone} style={{
        padding: '10px 28px', borderRadius: 10, border: 'none',
        background: NAVY, color: WHITE, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        View my applications
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const user      = useAuthStore(s => s.user)

  // wizard state
  const [step, setStep]                 = useState(0)
  const [contactInfo, setContactInfo]   = useState<ContactInfo>({ full_name: '', email: '', phone: '', city: '' })
  const [answers, setAnswers]           = useState<AnswerMap>({})
  const [selectedResumeId, setResume]   = useState<string | null>(null)
  const [resumeFiles, setResumeFiles]   = useState<ResumeFile[]>([])
  const [coverNote, setCoverNote]       = useState('')
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({})
  const [coverError, setCoverError]     = useState<string | undefined>()
  const [submitted, setSubmitted]       = useState<{ refNum: string | null; jobTitle: string } | null>(null)
  const [savingDraft, setSavingDraft]   = useState(false)
  const draftId = useRef<string | null>(null)

  // pre-fill contact info from auth store + profile
  useEffect(() => {
    apiClient.get('/onboarding/profile').then(r => {
      const p = r.data
      setContactInfo({
        full_name: p.full_name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        city: p.city ?? '',
      })
    }).catch(() => {
      setContactInfo({
        full_name: '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        city: '',
      })
    })
  }, [user])

  // eligibility check
  const { data: elig, isLoading: eligLoading } = useQuery({
    queryKey: ['eligibility', jobId],
    queryFn: () => applicationsApi.checkEligibility(jobId!),
    enabled: !!jobId,
  })

  // published form for this job
  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ['apply-form', jobId],
    queryFn: () => applicationsApi.getForm(jobId!).catch(() => null),
    enabled: !!jobId && !!elig?.eligible,
  })

  // resume library
  const { data: libraryData, isLoading: libraryLoading } = useQuery({
    queryKey: ['resume-library'],
    queryFn: resumeLibraryApi.list,
    enabled: !!elig?.eligible,
  })

  // sync library into local state (so we can append after inline upload)
  useEffect(() => {
    if (libraryData?.resumes) setResumeFiles(libraryData.resumes)
  }, [libraryData])

  // restore draft
  useEffect(() => {
    if (!elig?.has_draft || !jobId) return
    applicationsApi.getDraft(jobId).then(d => {
      draftId.current = d.id
      setStep(d.current_step)
      setResume(d.selected_resume_id)
      const raw = d.responses_json as Record<string, unknown>
      const hydrated: AnswerMap = {}
      for (const [k, v] of Object.entries(raw)) hydrated[k] = v as AnswerMap[string]
      setAnswers(hydrated)
    }).catch(() => {})
  }, [elig, jobId])

  // ── build step list ────────────────────────────────────────────────────────
  const settings     = form?.settings_json ?? {}
  const resumeConfig = (settings.resume_config as string) ?? 'optional'
  const coverConfig  = (settings.require_cover_letter as string) ?? 'optional'
  const showResume   = resumeConfig !== 'hidden'

  const visibleSections = (form?.sections ?? [])
    .filter(s => s.is_visible && s.questions.length > 0)
    .sort((a, b) => a.order_index - b.order_index)

  // Always: [Contact Info, (Resume?), ...sections, Submit]
  const stepLabels: string[] = ['Contact Info']
  if (showResume) stepLabels.push('Resume')
  visibleSections.forEach(s => stepLabels.push(s.title))
  stepLabels.push('Submit')

  const totalSteps     = stepLabels.length
  const isContactStep  = step === 0
  const resumeStepIdx  = showResume ? 1 : -1
  const isResumeStep   = showResume && step === resumeStepIdx
  const isSubmitStep   = step === totalSteps - 1
  const sectionOffset  = 1 + (showResume ? 1 : 0)
  const currentSection = (!isContactStep && !isResumeStep && !isSubmitStep)
    ? (visibleSections[step - sectionOffset] ?? null)
    : null

  // ── validation ─────────────────────────────────────────────────────────────
  function validateStep(): boolean {
    if (isContactStep) {
      const errs: Record<string, string> = {}
      if (!contactInfo.full_name.trim()) errs.full_name = 'Full name is required.'
      if (!contactInfo.email.trim())     errs.email     = 'Email is required.'
      if (!contactInfo.phone.trim())     errs.phone     = 'Phone number is required.'
      if (Object.keys(errs).length) { setFieldErrors(errs); return false }
    }
    if (isResumeStep && resumeConfig === 'required' && !selectedResumeId) {
      setFieldErrors({ _resume: 'Please select a resume to continue.' })
      return false
    }
    if (isSubmitStep && coverConfig === 'required' && !coverNote.trim()) {
      setCoverError('A cover note is required.')
      return false
    }
    if (currentSection) {
      const errs: Record<string, string> = {}
      for (const q of currentSection.questions) {
        if (q.is_required && isAnswerEmpty(q, answers[q.id])) errs[q.id] = 'This field is required.'
      }
      if (Object.keys(errs).length) { setFieldErrors(errs); return false }
    }
    setFieldErrors({})
    setCoverError(undefined)
    return true
  }

  // ── auto-save ──────────────────────────────────────────────────────────────
  async function saveProgress(toStep: number) {
    if (!jobId) return
    try {
      setSavingDraft(true)
      if (!draftId.current) {
        const d = await applicationsApi.startDraft(jobId, selectedResumeId)
        draftId.current = d.id
      }
      await applicationsApi.saveDraft(jobId, toStep, answers, selectedResumeId)
    } catch { /* non-blocking */ } finally {
      setSavingDraft(false)
    }
  }

  async function goNext() {
    if (!validateStep()) return
    const next = step + 1
    await saveProgress(next)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goPrev() {
    setFieldErrors({})
    setCoverError(undefined)
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── submit ─────────────────────────────────────────────────────────────────
  const submitMut = useMutation({
    mutationFn: () => {
      const allQ = visibleSections.flatMap(s => s.questions)
      const answerList: AnswerIn[] = Object.entries(answers)
        .map(([qid, a]) => {
          const q = allQ.find(x => x.id === qid)
          return q ? answerToPayload(qid, a, q) : null
        })
        .filter((x): x is AnswerIn => x !== null)
      return applicationsApi.submit(jobId!, {
        selected_resume_id: selectedResumeId,
        answers: answerList,
        cover_note: coverNote.trim() || null,
      })
    },
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      qc.invalidateQueries({ queryKey: ['eligibility', jobId] })
      setSubmitted({ refNum: data.reference_number, jobTitle: data.job_title })
    },
  })

  const isLoading = eligLoading || (!!elig?.eligible && formLoading)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: CREAM, fontFamily: 'Hind, sans-serif' }}>
      <AppSidebar />

      <main style={{ flex: 1, padding: '32px 24px', maxWidth: 680, margin: '0 auto', width: '100%' }}>

        {/* loading */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 size={28} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {/* not eligible */}
        {!isLoading && elig && !elig.eligible && (
          <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ height: 4, background: '#F59E0B' }} />
            <div style={{ padding: '32px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <AlertCircle size={22} color="#D97706" />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>
                  {elig.reason === 'already_applied' ? 'Already applied'
                   : elig.reason === 'job_closed'    ? 'Job no longer available'
                   : 'Cannot apply'}
                </h2>
              </div>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: INK_S }}>
                {elig.reason === 'already_applied'
                  ? 'You have already submitted an application for this job.'
                  : 'This job is no longer accepting applications.'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {elig.existing_application_id && (
                  <button onClick={() => navigate('/app/jobs/applications')}
                    style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: NAVY, color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    View application
                  </button>
                )}
                <button onClick={() => navigate(-1)}
                  style={{ padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${CREAM_DK}`, background: WHITE, color: INK_S, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Go back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* success */}
        {submitted && (
          <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${BORDER}` }}>
            <SuccessScreen refNum={submitted.refNum} jobTitle={submitted.jobTitle}
              onDone={() => navigate('/app/jobs/applications')} />
          </div>
        )}

        {/* wizard */}
        {!isLoading && elig?.eligible && !submitted && (
          <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ height: 4, background: NAVY }} />
            <div style={{ padding: '28px 28px 24px' }}>

              <button onClick={() => navigate(-1)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: MUTED, padding: 0, marginBottom: 20 }}>
                <ArrowLeft size={14} /> Back to job
              </button>

              <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: NAVY }}>Apply for this position</h1>
              <p style={{ margin: '0 0 24px', fontSize: 12, color: MUTED }}>
                Step {step + 1} of {totalSteps}
                {savingDraft && <span style={{ marginLeft: 8 }}>· Saving…</span>}
              </p>

              <StepBar total={totalSteps} current={step} labels={stepLabels} />

              <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: INK }}>
                {stepLabels[step]}
              </h2>

              {/* step content */}
              {isContactStep && (
                <ContactInfoStep info={contactInfo}
                  onChange={(k, v) => setContactInfo(prev => ({ ...prev, [k]: v }))}
                  errors={fieldErrors} />
              )}

              {isResumeStep && (
                <>
                  <ResumeStep
                    selectedId={selectedResumeId}
                    onSelect={setResume}
                    resumeConfig={resumeConfig}
                    files={resumeFiles}
                    isLoading={libraryLoading}
                    onUploadDone={uploaded => {
                      setResumeFiles(prev => [uploaded, ...prev])
                      setResume(uploaded.id)
                    }}
                  />
                  {fieldErrors['_resume'] && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: RED, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} /> {fieldErrors['_resume']}
                    </p>
                  )}
                </>
              )}

              {currentSection && (
                <SectionStep section={currentSection} answers={answers}
                  onChange={(qid, v) => setAnswers(prev => ({ ...prev, [qid]: v }))}
                  errors={fieldErrors} />
              )}

              {isSubmitStep && (
                <SubmitStep coverNote={coverNote} onChange={setCoverNote}
                  requireCoverLetter={coverConfig} coverError={coverError} />
              )}

              {submitMut.isError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: `1px solid ${RED}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <AlertCircle size={14} color={RED} />
                  <span style={{ fontSize: 13, color: RED }}>
                    {(submitMut.error as Error)?.message ?? 'Submission failed. Please try again.'}
                  </span>
                </div>
              )}

              {/* navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: `1px solid ${CREAM_DK}` }}>
                <button onClick={goPrev} disabled={step === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 10,
                    border: `1.5px solid ${CREAM_DK}`,
                    background: WHITE, color: step === 0 ? MUTED : INK_S,
                    fontSize: 13, fontWeight: 600,
                    cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.4 : 1,
                  }}>
                  <ArrowLeft size={14} /> Previous
                </button>

                {isSubmitStep ? (
                  <button
                    onClick={() => { if (validateStep()) submitMut.mutate() }}
                    disabled={submitMut.isPending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '10px 24px', borderRadius: 10, border: 'none',
                      background: submitMut.isPending ? `${NAVY}80` : NAVY,
                      color: WHITE, fontSize: 14, fontWeight: 700,
                      cursor: submitMut.isPending ? 'default' : 'pointer',
                    }}>
                    {submitMut.isPending
                      ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
                      : <><Send size={15} /> Submit application</>}
                  </button>
                ) : (
                  <button onClick={goNext} disabled={savingDraft}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '10px 22px', borderRadius: 10, border: 'none',
                      background: NAVY, color: WHITE, fontSize: 14, fontWeight: 700,
                      cursor: savingDraft ? 'default' : 'pointer',
                    }}>
                    {savingDraft
                      ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                      : <>Continue <ArrowRight size={15} /></>}
                  </button>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
