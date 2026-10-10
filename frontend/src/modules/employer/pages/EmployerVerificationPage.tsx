import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock, FileText, Info, RotateCcw, ShieldCheck, Trash2, Upload, XCircle,
} from 'lucide-react'
import {
  useDeleteVerificationDocument, useSaveVerificationDetails, useStartVerification, useSubmitVerification,
  useUploadVerificationDocument, useVerificationRules, useVerificationStatus,
  useSendBusinessEmailCode, useVerifyBusinessEmailCode,
} from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type {
  VerificationDetails, VerificationDocType, VerificationDocumentOut, VerificationEntityType, VerificationStatusResponse,
} from '@/api/jobs'
import { colors, radius } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import PageHeader from '@/shared/layouts/PageHeader'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'

const FIELD_HINTS: Record<string, { placeholder: string; hint?: string }> = {
  gstin: { placeholder: '29ABCDE1234F1Z5', hint: '15 characters, from your GST certificate' },
  pan: { placeholder: 'ABCDE1234F', hint: "The organisation's PAN (not a personal PAN, unless you are a proprietor)" },
  cin: { placeholder: 'U74999DL2020PTC123456', hint: '21-character Corporate Identity Number from MCA' },
  llpin: { placeholder: 'AAB-1234', hint: 'LLP Identification Number' },
  udyam: { placeholder: 'UDYAM-DL-01-1234567', hint: 'Udyam (MSME) registration number' },
  darpan_id: { placeholder: 'DL/2020/0123456', hint: 'NGO Darpan unique ID (NITI Aayog)' },
  registration_number: { placeholder: 'Registration no.', hint: 'Trust / society / firm registration number' },
  business_email: { placeholder: 'hr@yourorganisation.org', hint: 'An email on your own domain — not Gmail/Yahoo' },
  signatory_name: { placeholder: 'Full name of the person managing this account' },
  signatory_designation: { placeholder: 'e.g. Director, HR Head, Founder' },
}

const STATUS_COPY: Record<string, { title: string; tone: 'info' | 'success' | 'warn' | 'danger'; body: string }> = {
  requested: { title: 'Submitted — waiting for review', tone: 'info', body: 'Our team has your details and documents. We usually respond within 2 working days and will email you.' },
  under_review: { title: 'Under review', tone: 'info', body: 'A reviewer is checking your details against government records. We will email you if we need anything else.' },
  needs_info: { title: 'We need a little more information', tone: 'warn', body: 'Update the items below and submit again. Your earlier uploads are kept.' },
  approved: { title: 'Your company is verified', tone: 'success', body: 'You can now publish jobs and receive applications.' },
  rejected: { title: 'Verification not approved', tone: 'danger', body: '' },
}

const TONES = {
  info:    { bg: colors.state.infoBg, border: colors.border.default, fg: colors.brand.navy },
  success: { bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)', fg: '#047857' },
  warn:    { bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.3)', fg: '#B45309' },
  danger:  { bg: 'rgba(220,38,38,0.05)', border: 'rgba(220,38,38,0.2)', fg: '#B91C1C' },
}

const card: React.CSSProperties = {
  padding: '18px 22px', borderRadius: radius.lg, marginBottom: 16,
  background: colors.surface.card, border: `1px solid ${colors.border.default}`,
}
const input: React.CSSProperties = {
  width: '100%', height: 38, borderRadius: 9, border: `1.5px solid ${colors.border.default}`, padding: '0 12px',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: colors.text.ink,
}
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }

function fieldErrors(e: unknown): Record<string, string> {
  const detail = (e as { response?: { data?: { detail?: { errors?: Record<string, string> } } } })?.response?.data?.detail
  return detail && typeof detail === 'object' && detail.errors ? detail.errors : {}
}

function DocRow({ docType, title, required, docs, editable, busy, onUpload, onDelete }: {
  docType: VerificationDocType; title: string; required: boolean; docs: VerificationDocumentOut[]; editable: boolean
  busy: boolean; onUpload: (t: VerificationDocType, f: File) => void; onDelete: (id: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border.default}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>
            {title} {required && <span style={{ color: '#EF4444' }}>*</span>}
          </p>
        </div>
        {editable && (
          <>
            <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(docType, f); e.target.value = '' }} />
            <Button variant="outline" size="sm" loading={busy} disabled={busy} onClick={() => ref.current?.click()}>
              <Upload size={12} />{docs.length ? 'Replace' : 'Upload'}
            </Button>
          </>
        )}
      </div>
      {docs.map((d) => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12 }}>
          {d.status === 'rejected'
            ? <XCircle size={13} color="#DC2626" />
            : d.status === 'verified' ? <BadgeCheck size={13} color="#059669" /> : <CheckCircle2 size={13} color={colors.state.success} />}
          <span style={{ color: colors.text.ink }}>{d.original_filename ?? 'Uploaded'}</span>
          <span style={{ color: d.status === 'rejected' ? '#B91C1C' : colors.text.muted }}>
            {d.status === 'rejected' ? 'Needs replacing' : d.status === 'verified' ? 'Accepted' : 'Received'}
          </span>
          {editable && (
            <button type="button" aria-label={`Remove ${d.original_filename ?? 'document'}`} onClick={() => onDelete(d.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, display: 'flex' }}>
              <Trash2 size={12} />
            </button>
          )}
          {d.notes && <span style={{ color: '#B91C1C' }}>— {d.notes}</span>}
        </div>
      ))}
    </div>
  )
}

export default function EmployerVerificationPage() {
  const { data: v, isLoading, isError, refetch } = useVerificationStatus()
  const { data: rules } = useVerificationRules()
  const save = useSaveVerificationDetails()
  const start = useStartVerification()
  const upload = useUploadVerificationDocument()
  const remove = useDeleteVerificationDocument()
  const submit = useSubmitVerification()
  const sendEmailCode = useSendBusinessEmailCode()
  const verifyEmailCode = useVerifyBusinessEmailCode()

  const [entity, setEntity] = useState<VerificationEntityType | null>(null)
  const [form, setForm] = useState<VerificationDetails>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busyDoc, setBusyDoc] = useState<VerificationDocType | null>(null)
  const [codeSent, setCodeSent] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const seeded = useRef<string | null>(null)
  // Set while a draft is being created for the first upload, so the re-seed below
  // doesn't overwrite what the employer has typed with the (emptier) saved draft.
  const keepForm = useRef(false)
  // JSON of the form as last saved/loaded: the checks below are computed on the server at save time, so when
  // the form has moved on they are out of date and the page says so.
  const savedForm = useRef('')

  // Seed the form from the server once per case (and again after a new draft starts).
  useEffect(() => {
    if (!v) return
    const key = `${v.id}:${v.status}:${v.attempt_no}`
    if (seeded.current === key) return
    seeded.current = key
    setEntity(v.entity_type)
    if (keepForm.current) { keepForm.current = false; return }
    const seed = { ...(v.details ?? {}), declarations: { ...(v.details?.declarations ?? {}) } }
    savedForm.current = JSON.stringify(seed)
    setForm(seed)
  }, [v])

  const status = v?.status ?? 'not_submitted'
  const editable = !v ? true : v.can_edit && status !== 'rejected'
  const copy = STATUS_COPY[status]
  const checklist = useMemo(() => {
    if (v?.entity_type && entity === v.entity_type) return v.checklist
    return rules?.entity_types.find((t) => t.value === entity)?.checklist ?? {}
  }, [v, entity, rules])

  const setField = (key: keyof VerificationDetails, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
    setMessage(null)
  }
  const setDecl = (key: string, value: boolean) => setForm((f) => ({ ...f, declarations: { ...(f.declarations ?? {}), [key]: value } }))

  const persist = (onDone?: () => void) => {
    if (!entity) { setMessage('Choose what kind of organisation you are first.'); return }
    save.mutate({ entity_type: entity, ...form }, {
      onSuccess: () => { savedForm.current = JSON.stringify(form); setErrors({}); setMessage('Saved.'); onDone?.() },
      onError: (e) => {
        const fe = fieldErrors(e)
        setErrors(fe)
        setMessage(Object.keys(fe).length ? 'Please fix the highlighted fields.' : getApiError(e, 'Could not save.'))
      },
    })
  }

  const handleSendEmailCode = () => persist(() => sendEmailCode.mutate(undefined, {
    onSuccess: () => { setCodeSent(true); setEmailCode(''); setMessage('Code sent. Check that inbox.') },
    onError: (e) => setMessage(getApiError(e, 'Could not send the code.')),
  }))

  const handleVerifyEmailCode = () => verifyEmailCode.mutate(emailCode, {
    onSuccess: () => { setCodeSent(false); setEmailCode(''); setMessage('Business email confirmed.') },
    onError: (e) => setMessage(getApiError(e, 'That code did not work.')),
  })

  const handleSubmit = () => {
    persist(() => submit.mutate(undefined, {
      onSuccess: () => setMessage(null),
      onError: (e) => setMessage(getApiError(e, 'Could not submit.')),
    }))
  }

  const handleUpload = (docType: VerificationDocType, file: File) => {
    if (!entity) { setMessage('Choose your organisation type first.'); return }
    setMessage(null); setBusyDoc(docType)
    let skipped = false
    const doUpload = () => upload.mutate({ docType, file }, {
      onSuccess: () => { if (skipped) setMessage('Document uploaded. Please fix the highlighted fields before submitting.') },
      onError: (e) => setMessage(getApiError(e, 'Upload failed.')),
      onSettled: () => setBusyDoc(null),
    })
    // A document needs a draft to attach to — create it on first upload. A mistake in a field
    // (e.g. a GSTIN that fails its checksum) must not block the upload, so fields the server
    // rejects are left out of the draft and flagged; the rest of what was typed is saved.
    if (!v || v.status === 'not_submitted') {
      keepForm.current = true
      const createDraft = (details: VerificationDetails, retried: boolean) =>
        save.mutate({ entity_type: entity, ...details }, {
          onSuccess: doUpload,
          onError: (e) => {
            const fe = fieldErrors(e)
            const bad = Object.keys(fe)
            if (!retried && bad.length) {
              skipped = true
              setErrors(fe)
              createDraft(Object.fromEntries(Object.entries(details).filter(([k]) => !bad.includes(k))) as VerificationDetails, true)
            } else {
              keepForm.current = false
              setBusyDoc(null)
              setMessage(getApiError(e))
            }
          },
        })
      createDraft(form, false)
    } else doUpload()
  }

  const unsavedChanges = JSON.stringify(form) !== savedForm.current

  const docsFor = (t: VerificationDocType) => (v?.documents ?? []).filter((d) => d.doc_type === t)
  const docEntries = [
    ...(checklist.documents_required ?? []).map((d) => ({ ...d, required: true })),
    ...(checklist.documents_any_of ?? []).map((d) => ({ ...d, label: d.label, required: false, anyOf: true })),
    ...(checklist.documents_optional ?? []).map((d) => ({ ...d, required: false })),
  ]
  const idFields = (checklist.ids_any_of ?? []).map((f) => f.field)
  const detailFields = [
    ...idFields.map((f) => ({ field: f, label: checklist.ids_any_of!.find((x) => x.field === f)!.label })),
    ...(checklist.fields ?? []),
  ]

  // The server only counts the proof while it matches the saved address, so compare against that, not the box.
  const renderEmailProof = (typed: string | undefined) => {
    const email = (typed ?? '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    const confirmed = !!v?.business_email_proven && (v.details?.business_email ?? '').toLowerCase() === email
    if (confirmed) {
      return <p style={{ fontSize: 11.5, color: colors.state.success, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} />Confirmed</p>
    }
    if (!editable) return null
    return (
      <div style={{ marginTop: 8 }}>
        {!codeSent ? (
          <Button variant="outline" size="sm" onClick={handleSendEmailCode} loading={sendEmailCode.isPending}
            disabled={save.isPending || sendEmailCode.isPending}>
            Send a code to confirm this email
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={emailCode} inputMode="numeric" maxLength={6} placeholder="6-digit code" aria-label="Business email code"
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))} style={{ ...input, width: 140 }} />
            <Button size="sm" onClick={handleVerifyEmailCode} loading={verifyEmailCode.isPending}
              disabled={emailCode.length !== 6 || verifyEmailCode.isPending}>Confirm</Button>
            <Button variant="outline" size="sm" onClick={handleSendEmailCode} disabled={sendEmailCode.isPending || save.isPending}>Resend</Button>
          </div>
        )}
      </div>
    )
  }

  const renderField = (field: string, fieldLabel: string, required: boolean) => {
    const meta = FIELD_HINTS[field] ?? { placeholder: '' }
    const value = (form as Record<string, unknown>)[field] as string | undefined
    // A GSTIN contains the holder's PAN (characters 3-12), so the two fields must agree. Checked live, on the
    // fields themselves, so the person sees which box to change without saving first.
    const gstin = (form.gstin ?? '').replace(/\s/g, '').toUpperCase()
    const pan = (form.pan ?? '').replace(/\s/g, '').toUpperCase()
    const pairClash = gstin.length === 15 && pan.length === 10 && gstin.slice(2, 12) !== pan
    const clashNote = !pairClash ? null
      : field === 'gstin' ? `This GSTIN contains the PAN ${gstin.slice(2, 12)}, but the PAN field says ${pan}. Correct the GSTIN, or clear it (a CIN or LLPIN is enough).`
      : field === 'pan' ? `Does not match the PAN inside the GSTIN (${gstin.slice(2, 12)}).`
      : null
    const fieldError = errors[field] || clashNote
    return (
      <div key={field}>
        <label style={label}>{fieldLabel}{required && <span style={{ color: '#EF4444' }}> *</span>}</label>
        <input value={value ?? ''} disabled={!editable} placeholder={meta.placeholder}
          onChange={(e) => setField(field as keyof VerificationDetails, e.target.value)}
          style={{ ...input, borderColor: fieldError ? '#EF4444' : colors.border.default, textTransform: field === 'business_email' ? 'none' : 'uppercase' }} />
        {fieldError
          ? <p style={{ fontSize: 11.5, color: '#DC2626', margin: '3px 0 0' }}>{fieldError}</p>
          : meta.hint && <p style={{ fontSize: 11, color: colors.text.muted, margin: '3px 0 0' }}>{meta.hint}</p>}
        {field === 'business_email' && renderEmailProof(value)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Verification" subtitle="Verify your organisation to publish jobs" icon={<ShieldCheck size={16} color={colors.text.ink} />} />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {isLoading ? <Spinner size="md" /> : isError ? (
            <ErrorState compact title="Status unavailable" description="Could not load verification status." onRetry={() => refetch()} />
          ) : (
            <>
              {copy && (
                <div style={{ ...card, background: TONES[copy.tone].bg, borderColor: TONES[copy.tone].border }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TONES[copy.tone].fg }}>
                    {status === 'approved' ? <BadgeCheck size={18} /> : status === 'rejected' ? <XCircle size={18} />
                      : status === 'needs_info' ? <AlertTriangle size={18} /> : <Clock size={18} />}
                    <p style={{ fontSize: 14.5, fontWeight: 800, margin: 0 }}>{copy.title}</p>
                  </div>
                  {status === 'rejected'
                    ? <RejectedBody v={v!} reasons={rules?.reason_codes} onRestart={() => start.mutate()} restarting={start.isPending} />
                    : <p style={{ fontSize: 12.5, color: colors.text.inkSoft, margin: '8px 0 0', lineHeight: 1.55 }}>{copy.body}</p>}
                  {status === 'needs_info' && v?.info_request && (
                    <blockquote style={{ margin: '10px 0 0', padding: '8px 12px', borderLeft: '3px solid #D97706', background: '#fff', fontSize: 13, color: colors.text.ink }}>
                      {v.info_request}
                    </blockquote>
                  )}
                </div>
              )}

              {v && !v.email_verified && editable && (
                <div style={{ ...card, background: TONES.warn.bg, borderColor: TONES.warn.border, display: 'flex', gap: 8 }}>
                  <Info size={15} color="#B45309" style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: '#92400E', margin: 0 }}>
                    Your account email isn&apos;t confirmed yet. Enter the OTP we emailed you before you submit.
                  </p>
                </div>
              )}

              {/* 1. Organisation type */}
              <section style={card}>
                <p style={{ fontSize: 13.5, fontWeight: 800, color: colors.text.ink, margin: '0 0 4px' }}>1. What kind of organisation are you?</p>
                <p style={{ fontSize: 12, color: colors.text.muted, margin: '0 0 12px' }}>This decides which documents we need.</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(rules?.entity_types ?? []).map((t) => (
                    <label key={t.value} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: radius.xl,
                      cursor: editable ? 'pointer' : 'default',
                      border: entity === t.value ? `2px solid ${colors.brand.navy}` : `1.5px solid ${colors.border.default}`,
                      background: entity === t.value ? colors.state.infoBg : '#fff',
                    }}>
                      <input type="radio" name="entity" checked={entity === t.value} disabled={!editable}
                        onChange={() => setEntity(t.value)} style={{ accentColor: colors.brand.navy }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink }}>{t.label}</span>
                    </label>
                  ))}
                </div>
              </section>

              {entity && (
                <>
                  {/* 2. Details */}
                  <section style={card}>
                    <p style={{ fontSize: 13.5, fontWeight: 800, color: colors.text.ink, margin: '0 0 4px' }}>2. Registration details</p>
                    {idFields.length > 0 && (
                      <p style={{ fontSize: 12, color: colors.text.muted, margin: '0 0 12px' }}>
                        Enter at least one of: {idFields.map((f) => checklist.ids_any_of!.find((x) => x.field === f)!.label).join(' / ')}.
                      </p>
                    )}
                    <div style={{ display: 'grid', gap: 12 }}>
                      {detailFields.map((f) => renderField(f.field, f.label, !idFields.includes(f.field)))}
                      <div>
                        <label style={label}>Website</label>
                        <input value={form.website ?? ''} disabled={!editable} placeholder="https://yourorganisation.org"
                          onChange={(e) => setField('website', e.target.value)} style={input} />
                      </div>
                      <div>
                        <label style={label}>Registered address</label>
                        <input value={form.registered_address ?? ''} disabled={!editable} placeholder="Street, city, state, PIN"
                          onChange={(e) => setField('registered_address', e.target.value)} style={input} />
                      </div>
                    </div>
                  </section>

                  {/* 3. Documents */}
                  <section style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <FileText size={15} color={colors.brand.navy} />
                      <p style={{ fontSize: 13.5, fontWeight: 800, color: colors.text.ink, margin: 0 }}>3. Documents</p>
                    </div>
                    <p style={{ fontSize: 12, color: colors.text.muted, margin: '0 0 6px' }}>
                      PDF, PNG or JPEG, up to 10MB each. Where it says &ldquo;at least one&rdquo;, one of those is enough.
                    </p>
                    {docEntries.map((d) => (
                      <DocRow key={d.doc_type} docType={d.doc_type} editable={editable} busy={busyDoc === d.doc_type}
                        title={('anyOf' in d && d.anyOf ? 'Any one: ' : '') + d.label}
                        required={d.required} docs={docsFor(d.doc_type)} onUpload={handleUpload}
                        onDelete={(id) => remove.mutate(id, { onError: (e) => setMessage(getApiError(e)) })} />
                    ))}
                  </section>

                  {/* 4. Declarations */}
                  <section style={card}>
                    <p style={{ fontSize: 13.5, fontWeight: 800, color: colors.text.ink, margin: '0 0 10px' }}>4. Declarations</p>
                    {(checklist.declarations ?? []).map((d) => (
                      <label key={d.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 12.5, color: colors.text.ink, cursor: editable ? 'pointer' : 'default' }}>
                        <input type="checkbox" checked={!!form.declarations?.[d.key]} disabled={!editable}
                          onChange={(e) => setDecl(d.key, e.target.checked)} style={{ marginTop: 2, accentColor: colors.brand.navy }} />
                        <span>{d.label}</span>
                      </label>
                    ))}
                  </section>
                </>
              )}

              {/* Auto checks + what's missing */}
              {v && v.status !== 'approved' && (v.auto_checks.some((c) => c.level !== 'ok') || (editable && v.missing.length > 0)) && (
                <section style={card}>
                  {editable && unsavedChanges && (
                    <p style={{ fontSize: 12, color: colors.text.muted, margin: '0 0 8px' }}>
                      You have unsaved changes. This list is from your last save; press Save progress to refresh it.
                    </p>
                  )}
                  {editable && v.missing.length > 0 && (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, margin: '0 0 6px' }}>Still needed before you can submit</p>
                      <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 12.5, color: colors.text.inkSoft, lineHeight: 1.7 }}>
                        {v.missing.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    </>
                  )}
                  {v.auto_checks.filter((c) => c.level !== 'ok' && !v.missing.includes(c.message)).map((c) => (
                    <p key={c.code} style={{ fontSize: 12, color: c.level === 'fail' ? '#B91C1C' : '#B45309', margin: '4px 0', display: 'flex', gap: 6 }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{c.message}
                    </p>
                  ))}
                </section>
              )}

              {editable && entity && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <Button variant="outline" onClick={() => persist()} loading={save.isPending && !submit.isPending} disabled={save.isPending || submit.isPending}>
                    Save progress
                  </Button>
                  <Button onClick={handleSubmit} loading={submit.isPending} disabled={save.isPending || submit.isPending}>
                    {status === 'needs_info' ? 'Resubmit for review' : 'Submit for review'}
                  </Button>
                  {message && <span style={{ fontSize: 12.5, color: /^(Saved|Code sent|Business email confirmed)/.test(message) ? colors.state.success : '#DC2626' }}>{message}</span>}
                </div>
              )}

              {v?.events && v.events.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Timeline</p>
                  {[...v.events].reverse().map((e) => (
                    <div key={e.id} style={{ fontSize: 12, color: colors.text.inkSoft, marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, color: colors.text.ink }}>{e.to_status.replace(/_/g, ' ')}</span>
                      {' · '}{new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {e.note && <span> — {e.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RejectedBody({ v, reasons, onRestart, restarting }: {
  v: VerificationStatusResponse; reasons?: Record<string, string>; onRestart: () => void; restarting: boolean
}) {
  const reason = v.rejection_reason || (v.reason_code && reasons?.[v.reason_code]) || null
  return (
    <>
      {reason && <p style={{ fontSize: 13, color: '#7F1D1D', margin: '8px 0 0', lineHeight: 1.5 }}>{reason}</p>}
      {v.blocked ? (
        <p style={{ fontSize: 12.5, color: colors.text.inkSoft, margin: '10px 0 0' }}>
          This can&apos;t be resubmitted online. Please contact <strong>support@beginablai.com</strong>.
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Button size="sm" onClick={onRestart} loading={restarting} disabled={restarting}>
            <RotateCcw size={13} />Correct and submit again
          </Button>
          <p style={{ fontSize: 11.5, color: colors.text.muted, margin: '8px 0 0' }}>
            Your earlier details and accepted documents are kept so you only fix what&apos;s wrong.
          </p>
        </div>
      )}
    </>
  )
}
