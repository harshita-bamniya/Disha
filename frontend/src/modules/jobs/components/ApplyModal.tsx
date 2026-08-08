/**
 * LinkedIn-style Easy Apply modal overlay.
 * Renders the full multi-step wizard (Contact Info → Resume → Questions → Submit)
 * as a fixed modal on top of whatever page is behind it.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check,
  CheckCircle2, FileText, Loader2, Send, Upload, X,
} from 'lucide-react'
import { applicationsApi, type AnswerIn, type FormSectionOut, type QuestionOut } from '@/api/applications'
import { resumeLibraryApi, type ResumeFile } from '@/api/resumeLibrary'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/api/client'

import { NAVY, INK, INK_SFT as INK_S, MUTED, BORDER, colors } from '@/design-system/tokens'
const CREAM_DK = colors.surface.elevated
const WHITE    = colors.surface.card
const RED      = colors.state.danger
const GREEN    = colors.state.success

// ── types ─────────────────────────────────────────────────────────────────────
type AnswerMap = Record<string, { text?: string; number?: number; date?: string; options?: string[] }>

interface ContactInfo {
  full_name: string
  email: string
  phone: string
  city: string
}

// ── helpers ───────────────────────────────────────────────────────────────────
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

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepBar({ total, current, labels }: { total: number; current: number; labels: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, overflowX: 'auto', paddingBottom: 2 }}>
      {labels.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                border: `2px solid ${done || active ? NAVY : CREAM_DK}`,
                background: done ? NAVY : active ? WHITE : '#F8F9FB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: done ? WHITE : active ? NAVY : MUTED,
              }}>
                {done ? <Check size={12} color={WHITE} /> : i + 1}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: active ? NAVY : done ? INK_S : MUTED,
                whiteSpace: 'nowrap', maxWidth: 56, textAlign: 'center', lineHeight: 1.2,
              }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div style={{
                width: 24, height: 2,
                background: done ? NAVY : CREAM_DK,
                margin: '0 3px', marginBottom: 16, flexShrink: 0,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Contact Info Step ─────────────────────────────────────────────────────────
function ContactInfoStep({ info, onChange, errors }: {
  info: ContactInfo
  onChange: (k: keyof ContactInfo, v: string) => void
  errors: Record<string, string>
}) {
  const inp = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '9px 13px',
    border: `1.5px solid ${err ? RED : CREAM_DK}`,
    borderRadius: 9, fontSize: 13, color: INK,
    outline: 'none', background: WHITE, boxSizing: 'border-box' as const,
  })
  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: INK_S }}>
        Review your contact details. This information will be shared with the employer.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 }}>
            Full name <span style={{ color: RED }}>*</span>
          </label>
          <input value={info.full_name} onChange={e => onChange('full_name', e.target.value)}
            placeholder="Your full name" style={inp(errors.full_name)} />
          {errors.full_name && <p style={{ margin: '3px 0 0', fontSize: 11, color: RED }}>{errors.full_name}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 }}>
            Email <span style={{ color: RED }}>*</span>
          </label>
          <input type="email" value={info.email} onChange={e => onChange('email', e.target.value)}
            placeholder="your@email.com" style={inp(errors.email)} />
          {errors.email && <p style={{ margin: '3px 0 0', fontSize: 11, color: RED }}>{errors.email}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 }}>
            Phone <span style={{ color: RED }}>*</span>
          </label>
          <input type="tel" value={info.phone} onChange={e => onChange('phone', e.target.value)}
            placeholder="+91 XXXXX XXXXX" style={inp(errors.phone)} />
          {errors.phone && <p style={{ margin: '3px 0 0', fontSize: 11, color: RED }}>{errors.phone}</p>}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 }}>
            City / Location
          </label>
          <input value={info.city} onChange={e => onChange('city', e.target.value)}
            placeholder="e.g. New Delhi" style={inp()} />
        </div>
      </div>
      <div style={{ marginTop: 16, padding: '10px 13px', background: `${NAVY}05`, borderRadius: 9, border: `1px solid ${NAVY}12` }}>
        <p style={{ margin: 0, fontSize: 11, color: INK_S }}>
          Your KRS score, skills, and profile will also be shared with the employer.
        </p>
      </div>
    </div>
  )
}

// ── Resume Step ───────────────────────────────────────────────────────────────
function ResumeStep({ selectedId, onSelect, resumeConfig, files, isLoading, onUploadDone, onDelete }: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  resumeConfig: string
  files: ResumeFile[]
  isLoading: boolean
  onUploadDone: (file: ResumeFile) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const fileRef                       = useRef<HTMLInputElement>(null)
  const required                      = resumeConfig === 'required'

  async function handleDelete(id: string) {
    setDeletingId(id)
    try { await onDelete(id) } finally { setDeletingId(null); setConfirmDelId(null) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: INK_S }}>
        {required
          ? 'A resume is required. Select one from your library or upload a new file.'
          : 'Attach a resume to strengthen your application (optional).'}
      </p>

      {/* inline upload */}
      <div style={{ marginBottom: 14 }}>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.rtf"
          style={{ display: 'none' }} onChange={handleFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 8,
            border: `1.5px dashed ${NAVY}50`,
            background: `${NAVY}04`, color: NAVY,
            fontSize: 12, fontWeight: 600, cursor: uploading ? 'default' : 'pointer',
            opacity: uploading ? 0.7 : 1,
          }}>
          {uploading
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
            : <><Upload size={13} /> Upload new resume</>}
        </button>
        {uploadError && (
          <p style={{ margin: '5px 0 0', fontSize: 11, color: RED, display: 'flex', alignItems: 'center', gap: 3 }}>
            <AlertCircle size={11} /> {uploadError}
          </p>
        )}
        <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTED }}>PDF, DOCX, DOC, RTF · Max 5 MB</p>
      </div>

      {/* library */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <Loader2 size={18} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {!isLoading && files.length === 0 && (
        <div style={{ padding: '18px 14px', textAlign: 'center', background: '#F8F9FB', borderRadius: 9, border: `1px dashed ${CREAM_DK}` }}>
          <FileText size={20} color={MUTED} style={{ marginBottom: 6 }} />
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>No resumes yet — upload one above.</p>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Your resumes
          </p>

          {!required && (
            <label onClick={() => onSelect(null)} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: 9, marginBottom: 7,
              border: `1.5px solid ${selectedId === null ? NAVY : BORDER}`,
              background: selectedId === null ? `${NAVY}05` : WHITE,
              cursor: 'pointer',
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selectedId === null ? NAVY : CREAM_DK}`,
                background: selectedId === null ? NAVY : WHITE,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedId === null && <span style={{ width: 5, height: 5, borderRadius: '50%', background: WHITE }} />}
              </span>
              <span style={{ fontSize: 12, color: INK_S }}>Apply without a resume</span>
            </label>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {files.map(f => {
              const sel = selectedId === f.id
              return (
                <label key={f.id} onClick={() => onSelect(f.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 9,
                  border: `1.5px solid ${sel ? NAVY : BORDER}`,
                  background: sel ? `${NAVY}05` : WHITE,
                  cursor: 'pointer',
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${sel ? NAVY : CREAM_DK}`,
                    background: sel ? NAVY : WHITE,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <span style={{ width: 5, height: 5, borderRadius: '50%', background: WHITE }} />}
                  </span>
                  <span style={{
                    width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                    background: '#FEE2E2', color: '#DC2626',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 800, letterSpacing: '.3px',
                  }}>
                    {f.format.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.label || f.filename}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                      {Math.round(f.file_size_bytes / 1024)} KB
                    </p>
                  </div>
                  {sel && <Check size={14} color={NAVY} style={{ flexShrink: 0 }} />}

                  {/* delete — stop propagation so it doesn't select the card */}
                  {confirmDelId === f.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}
                        style={{ padding: '2px 8px', borderRadius: 5, border: 'none', background: RED, color: WHITE, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                        {deletingId === f.id ? '…' : 'Delete'}
                      </button>
                      <button onClick={() => setConfirmDelId(null)}
                        style={{ padding: '2px 6px', borderRadius: 5, border: `1px solid ${CREAM_DK}`, background: WHITE, color: INK_S, fontSize: 10, cursor: 'pointer' }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelId(f.id) }}
                      title="Delete"
                      style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 2, display: 'flex', alignItems: 'center' }}
                    >
                      <X size={13} />
                    </button>
                  )}
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
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 13px',
    border: `1.5px solid ${error ? RED : CREAM_DK}`,
    borderRadius: 9, fontSize: 13, color: INK,
    outline: 'none', background: WHITE, boxSizing: 'border-box',
  }
  const qt   = q.question_type
  const opts = q.options_json ?? []

  const radio = (choices: string[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px', marginTop: 5 }}>
      {choices.map(c => {
        const sel = value?.options?.includes(c)
        return (
          <label key={c} onClick={() => onChange({ ...value, options: [c] })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: INK }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${sel ? NAVY : CREAM_DK}`,
              background: sel ? NAVY : WHITE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {sel && <span style={{ width: 5, height: 5, borderRadius: '50%', background: WHITE }} />}
            </span>
            {c}
          </label>
        )
      })}
    </div>
  )

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 }}>
        {q.label}
        {q.is_required && <span style={{ color: RED, marginLeft: 3 }}>*</span>}
      </label>

      {['short_text','email','phone','url','linkedin_url','github_url','portfolio_url'].includes(qt) && (
        <input type={qt === 'email' ? 'email' : qt === 'phone' ? 'tel' : 'text'}
          value={value?.text ?? ''} placeholder={q.placeholder ?? ''}
          maxLength={q.character_limit ?? undefined}
          onChange={e => onChange({ ...value, text: e.target.value })} style={inp} />
      )}
      {qt === 'long_text' && (
        <textarea value={value?.text ?? ''} placeholder={q.placeholder ?? ''} rows={3}
          maxLength={q.character_limit ?? undefined}
          onChange={e => onChange({ ...value, text: e.target.value })}
          style={{ ...inp, resize: 'vertical', minHeight: 80 }} />
      )}
      {['number','experience_years','salary_expectation','notice_period'].includes(qt) && (
        <input type="number" value={value?.number ?? ''} placeholder={q.placeholder ?? ''}
          onChange={e => onChange({ ...value, number: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={inp} />
      )}
      {qt === 'date' && (
        <input type="date" value={value?.date ?? ''}
          onChange={e => onChange({ ...value, date: e.target.value })} style={inp} />
      )}
      {(qt === 'dropdown' || qt === 'availability') && (
        <select value={value?.options?.[0] ?? ''}
          onChange={e => onChange({ ...value, options: e.target.value ? [e.target.value] : [] })}
          style={{ ...inp, appearance: 'none' }}>
          <option value="">Select…</option>
          {qt === 'availability'
            ? ['Immediately','Within 30 days','Within 60 days','More than 60 days'].map(o => <option key={o} value={o}>{o}</option>)
            : opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
          }
        </select>
      )}
      {qt === 'yes_no'            && radio(['Yes', 'No'])}
      {qt === 'work_authorization' && radio(['Yes, I am authorized', 'No, I need sponsorship', 'Prefer not to say'])}
      {qt === 'relocation'        && radio(['Yes', 'No', 'Open to discuss'])}
      {qt === 'remote_preference' && radio(['Remote only', 'Hybrid preferred', 'On-site preferred', 'Flexible'])}
      {qt === 'radio' && opts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px', marginTop: 5 }}>
          {opts.map(o => {
            const sel = value?.options?.includes(o.value)
            return (
              <label key={o.value} onClick={() => onChange({ ...value, options: [o.value] })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: INK }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${sel ? NAVY : CREAM_DK}`,
                  background: sel ? NAVY : WHITE,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <span style={{ width: 5, height: 5, borderRadius: '50%', background: WHITE }} />}
                </span>
                {o.label}
              </label>
            )
          })}
        </div>
      )}
      {qt === 'checkbox' && (
        <label onClick={() => onChange({ ...value, options: value?.options?.includes('true') ? [] : ['true'] })}
          style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: INK }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            border: `2px solid ${value?.options?.includes('true') ? NAVY : CREAM_DK}`,
            background: value?.options?.includes('true') ? NAVY : WHITE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {value?.options?.includes('true') && <Check size={9} color={WHITE} />}
          </span>
          Yes
        </label>
      )}

      {q.hint_text && <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>{q.hint_text}</p>}
      {error && <p style={{ margin: '3px 0 0', fontSize: 11, color: RED, display: 'flex', alignItems: 'center', gap: 3 }}><AlertCircle size={11} />{error}</p>}
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
      {section.description && <p style={{ margin: '0 0 16px', fontSize: 13, color: INK_S }}>{section.description}</p>}
      {section.questions
        .slice().sort((a, b) => a.order_index - b.order_index)
        .map(q => (
          <QuestionField key={q.id} q={q} value={answers[q.id]}
            onChange={v => onChange(q.id, v)} error={errors[q.id]} />
        ))}
    </div>
  )
}

// ── Submit step ───────────────────────────────────────────────────────────────
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
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 }}>
            Cover note
            {required && <span style={{ color: RED }}> *</span>}
            {!required && <span style={{ color: MUTED, fontWeight: 400 }}> (optional)</span>}
          </label>
          <textarea value={coverNote} onChange={e => onChange(e.target.value)} rows={5} maxLength={2000}
            placeholder="Briefly explain why you're a great fit…"
            style={{
              width: '100%', padding: '9px 13px', borderRadius: 9,
              border: `1.5px solid ${coverError ? RED : CREAM_DK}`,
              fontSize: 13, color: INK, resize: 'vertical', minHeight: 100,
              outline: 'none', background: WHITE, boxSizing: 'border-box',
            }} />
          {coverError && <p style={{ margin: '3px 0 0', fontSize: 11, color: RED, display: 'flex', alignItems: 'center', gap: 3 }}><AlertCircle size={11} />{coverError}</p>}
          <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>{coverNote.length} / 2000</p>
        </div>
      )}
      <div style={{ background: `${NAVY}05`, border: `1px solid ${NAVY}14`, borderRadius: 9, padding: '11px 14px' }}>
        <p style={{ margin: 0, fontSize: 12, color: INK_S }}>
          By submitting, you confirm that all information provided is accurate.
        </p>
      </div>
    </div>
  )
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ refNum, jobTitle, onClose }: { refNum: string | null; jobTitle: string; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 20px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${GREEN}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <CheckCircle2 size={32} color={GREEN} />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: NAVY }}>Application submitted!</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: INK_S, maxWidth: 320 }}>
        Your application for <strong>{jobTitle}</strong> has been received.
      </p>
      {refNum && (
        <div style={{ background: '#F8F9FB', border: `1px solid ${CREAM_DK}`, borderRadius: 9, padding: '8px 18px', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Reference</p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: NAVY, letterSpacing: 1 }}>{refNum}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => { onClose(); navigate('/app/jobs/applications') }}
          style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: NAVY, color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          View applications
        </button>
        <button onClick={onClose}
          style={{ padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${CREAM_DK}`, background: WHITE, color: INK_S, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Back to dashboard
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface ApplyModalProps {
  jobId: string
  jobTitle: string
  onClose: () => void
}

export default function ApplyModal({ jobId, jobTitle, onClose }: ApplyModalProps) {
  const qc   = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [step, setStep]               = useState(0)
  const [contactInfo, setContactInfo] = useState<ContactInfo>({ full_name: '', email: '', phone: '', city: '' })
  const [answers, setAnswers]         = useState<AnswerMap>({})
  const [selectedResumeId, setResume] = useState<string | null>(null)
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([])
  const [coverNote, setCoverNote]     = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [coverError, setCoverError]   = useState<string | undefined>()
  const [done, setDone]               = useState<{ refNum: string | null } | null>(null)
  const [savingDraft, setSaving]      = useState(false)
  const draftId                       = useRef<string | null>(null)
  const bodyRef                       = useRef<HTMLDivElement>(null)

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // pre-fill contact info
  useEffect(() => {
    apiClient.get('/onboarding/profile').then(r => {
      const p = r.data
      setContactInfo({ full_name: p.full_name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', city: p.city ?? '' })
    }).catch(() => {
      setContactInfo({ full_name: '', email: user?.email ?? '', phone: user?.phone ?? '', city: '' })
    })
  }, [user])

  // eligibility
  const { data: elig, isLoading: eligLoading } = useQuery({
    queryKey: ['eligibility', jobId],
    queryFn: () => applicationsApi.checkEligibility(jobId),
  })

  // form
  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ['apply-form', jobId],
    queryFn: () => applicationsApi.getForm(jobId).catch(() => null),
    enabled: !!elig?.eligible,
  })

  // resume library
  const { data: libraryData, isLoading: libraryLoading } = useQuery({
    queryKey: ['resume-library'],
    queryFn: resumeLibraryApi.list,
    enabled: !!elig?.eligible,
  })

  useEffect(() => {
    if (libraryData?.resumes) setResumeFiles(libraryData.resumes)
  }, [libraryData])

  // restore draft
  useEffect(() => {
    if (!elig?.has_draft) return
    applicationsApi.getDraft(jobId).then(d => {
      draftId.current = d.id
      setStep(d.current_step)
      setResume(d.selected_resume_id)
      const hydrated: AnswerMap = {}
      for (const [k, v] of Object.entries(d.responses_json as Record<string, unknown>))
        hydrated[k] = v as AnswerMap[string]
      setAnswers(hydrated)
    }).catch(() => {})
  }, [elig, jobId])

  // ── build steps ──────────────────────────────────────────────────────────
  const settings     = form?.settings_json ?? {}
  const resumeConfig = (settings.resume_config as string) ?? 'optional'
  const coverConfig  = (settings.require_cover_letter as string) ?? 'optional'
  const showResume   = resumeConfig !== 'hidden'

  const visibleSections = (form?.sections ?? [])
    .filter(s => s.is_visible && s.questions.length > 0)
    .sort((a, b) => a.order_index - b.order_index)

  const stepLabels: string[] = ['Contact Info']
  if (showResume) stepLabels.push('Resume')
  visibleSections.forEach(s => stepLabels.push(s.title))
  stepLabels.push('Submit')

  const totalSteps    = stepLabels.length
  const isContactStep = step === 0
  const isResumeStep  = showResume && step === 1
  const isSubmitStep  = step === totalSteps - 1
  const sectionOffset = 1 + (showResume ? 1 : 0)
  const currentSection = (!isContactStep && !isResumeStep && !isSubmitStep)
    ? (visibleSections[step - sectionOffset] ?? null) : null

  // ── validation ───────────────────────────────────────────────────────────
  function validate(): boolean {
    if (isContactStep) {
      const e: Record<string, string> = {}
      if (!contactInfo.full_name.trim()) e.full_name = 'Required.'
      if (!contactInfo.email.trim())     e.email     = 'Required.'
      if (!contactInfo.phone.trim())     e.phone     = 'Required.'
      if (Object.keys(e).length) { setFieldErrors(e); return false }
    }
    if (isResumeStep && resumeConfig === 'required' && !selectedResumeId) {
      setFieldErrors({ _resume: 'Please select a resume to continue.' }); return false
    }
    if (isSubmitStep && coverConfig === 'required' && !coverNote.trim()) {
      setCoverError('A cover note is required.'); return false
    }
    if (currentSection) {
      const e: Record<string, string> = {}
      for (const q of currentSection.questions)
        if (q.is_required && isAnswerEmpty(q, answers[q.id])) e[q.id] = 'Required.'
      if (Object.keys(e).length) { setFieldErrors(e); return false }
    }
    setFieldErrors({}); setCoverError(undefined); return true
  }

  async function saveProgress(toStep: number) {
    try {
      setSaving(true)
      if (!draftId.current) {
        const d = await applicationsApi.startDraft(jobId, selectedResumeId)
        draftId.current = d.id
      }
      await applicationsApi.saveDraft(jobId, toStep, answers, selectedResumeId)
    } catch { /* non-blocking */ } finally {
      setSaving(false)
    }
  }

  async function goNext() {
    if (!validate()) return
    const next = step + 1
    await saveProgress(next)
    setStep(next)
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function goPrev() {
    setFieldErrors({}); setCoverError(undefined)
    setStep(s => s - 1)
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitMut = useMutation({
    mutationFn: () => {
      const allQ = visibleSections.flatMap(s => s.questions)
      const al: AnswerIn[] = Object.entries(answers)
        .map(([qid, a]) => { const q = allQ.find(x => x.id === qid); return q ? answerToPayload(qid, a, q) : null })
        .filter((x): x is AnswerIn => x !== null)
      return applicationsApi.submit(jobId, { selected_resume_id: selectedResumeId, answers: al, cover_note: coverNote.trim() || null })
    },
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      qc.invalidateQueries({ queryKey: ['eligibility', jobId] })
      setDone({ refNum: data.reference_number })
    },
  })

  const loading = eligLoading || (!!elig?.eligible && formLoading)

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10,20,40,0.55)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* modal card */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        width: '90vw', maxWidth: 580,
        maxHeight: '88vh',
        background: WHITE,
        borderRadius: 18,
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Hind, sans-serif',
      }}>
        {/* accent bar */}
        <div style={{ height: 4, background: NAVY, flexShrink: 0 }} />

        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '18px 22px 14px', borderBottom: `1px solid ${CREAM_DK}`, flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: NAVY }}>Apply now</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 440 }}>
              {jobTitle}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, color: MUTED, flexShrink: 0,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* scrollable body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '22px 22px' }}>

          {/* loading */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <Loader2 size={26} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {/* not eligible */}
          {!loading && elig && !elig.eligible && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <AlertCircle size={32} color="#D97706" style={{ marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: NAVY }}>
                {elig.reason === 'already_applied' ? 'Already applied' : 'Job no longer available'}
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: INK_S }}>
                {elig.reason === 'already_applied'
                  ? 'You have already submitted an application for this position.'
                  : 'This job is no longer accepting applications.'}
              </p>
              <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, border: `1.5px solid ${CREAM_DK}`, background: WHITE, color: INK_S, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          )}

          {/* success */}
          {done && <SuccessScreen refNum={done.refNum} jobTitle={jobTitle} onClose={onClose} />}

          {/* wizard */}
          {!loading && elig?.eligible && !done && (
            <>
              <div style={{ marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                  Step {step + 1} of {totalSteps}{savingDraft ? ' · Saving…' : ''}
                </p>
              </div>

              <StepBar total={totalSteps} current={step} labels={stepLabels} />

              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: INK }}>
                {stepLabels[step]}
              </h3>

              {isContactStep && (
                <ContactInfoStep info={contactInfo}
                  onChange={(k, v) => setContactInfo(p => ({ ...p, [k]: v }))}
                  errors={fieldErrors} />
              )}

              {isResumeStep && (
                <>
                  <ResumeStep selectedId={selectedResumeId} onSelect={setResume}
                    resumeConfig={resumeConfig} files={resumeFiles} isLoading={libraryLoading}
                    onUploadDone={f => { setResumeFiles(prev => [f, ...prev]); setResume(f.id) }}
                    onDelete={async (id) => {
                      await resumeLibraryApi.delete(id)
                      setResumeFiles(prev => prev.filter(f => f.id !== id))
                      if (selectedResumeId === id) setResume(null)
                    }} />
                  {fieldErrors['_resume'] && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: RED, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertCircle size={11} /> {fieldErrors['_resume']}
                    </p>
                  )}
                </>
              )}

              {currentSection && (
                <SectionStep section={currentSection} answers={answers}
                  onChange={(qid, v) => setAnswers(p => ({ ...p, [qid]: v }))}
                  errors={fieldErrors} />
              )}

              {isSubmitStep && (
                <SubmitStep coverNote={coverNote} onChange={setCoverNote}
                  requireCoverLetter={coverConfig} coverError={coverError} />
              )}

              {submitMut.isError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#FEF2F2', border: `1px solid ${RED}30`, borderRadius: 9, padding: '9px 13px', marginTop: 12 }}>
                  <AlertCircle size={13} color={RED} />
                  <span style={{ fontSize: 12, color: RED }}>
                    {(submitMut.error as Error)?.message ?? 'Submission failed. Please try again.'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer nav */}
        {!loading && elig?.eligible && !done && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 22px', borderTop: `1px solid ${CREAM_DK}`, flexShrink: 0, background: WHITE,
          }}>
            <button onClick={goPrev} disabled={step === 0} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 16px', borderRadius: 9,
              border: `1.5px solid ${CREAM_DK}`,
              background: WHITE, color: step === 0 ? MUTED : INK_S,
              fontSize: 12, fontWeight: 600,
              cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.4 : 1,
            }}>
              <ArrowLeft size={13} /> Previous
            </button>

            {isSubmitStep ? (
              <button
                onClick={() => { if (validate()) submitMut.mutate() }}
                disabled={submitMut.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 22px', borderRadius: 9, border: 'none',
                  background: submitMut.isPending ? `${NAVY}80` : NAVY,
                  color: WHITE, fontSize: 13, fontWeight: 700,
                  cursor: submitMut.isPending ? 'default' : 'pointer',
                }}>
                {submitMut.isPending
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
                  : <><Send size={14} /> Submit application</>}
              </button>
            ) : (
              <button onClick={goNext} disabled={savingDraft} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: NAVY, color: WHITE, fontSize: 13, fontWeight: 700,
                cursor: savingDraft ? 'default' : 'pointer',
              }}>
                {savingDraft
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                  : <>Continue <ArrowRight size={14} /></>}
              </button>
            )}
          </div>
        )}
      </div>

    </>
  )
}
