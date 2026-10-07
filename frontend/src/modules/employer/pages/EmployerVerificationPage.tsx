import { useRef, useState } from 'react'
import { CheckCircle2, Clock, FileText, Mail, ShieldCheck, Upload, XCircle } from 'lucide-react'
import { useVerificationStatus, useRequestVerification, useUploadVerificationDocument } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { VerificationDocType, VerificationDocumentOut } from '@/api/jobs'
import { colors, radius } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import PageHeader from '@/shared/layouts/PageHeader'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'

const STEPS = [
  { key: 'requested',    label: 'Verification Requested',   desc: 'Your documents have been received and are queued for review.' },
  { key: 'under_review', label: 'Under Review',             desc: 'Our team is reviewing your documents and may reach out if anything else is needed.' },
  { key: 'approved',     label: 'Verified',                 desc: 'Your company is verified. You can now publish job listings.' },
]

const STATUS_ORDER = ['requested', 'under_review', 'approved']

const DOC_TYPES: { type: VerificationDocType; label: string; hint: string }[] = [
  { type: 'gst_certificate',      label: 'GST Certificate',                 hint: 'Or upload your Company Registration Certificate below instead' },
  { type: 'company_registration', label: 'Company Registration Certificate', hint: 'If you don\'t have a GST certificate yet' },
  { type: 'pan_card',             label: 'PAN Card',                        hint: 'Company or authorised signatory' },
  { type: 'business_email',       label: 'Business Email Proof',            hint: 'Domain-matched email screenshot, letterhead, or similar' },
]

function DocumentUploadRow({ type, label, hint, uploaded, onUpload, uploading }: {
  type: VerificationDocType
  label: string
  hint: string
  uploaded: VerificationDocumentOut[]
  onUpload: (type: VerificationDocType, file: File) => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const latest = uploaded[uploaded.length - 1]

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: `1px solid ${colors.border.default}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: latest ? colors.state.success : colors.brand.navy, marginTop: 6, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: colors.text.ink, margin: 0 }}>{label}</p>
          <p style={{ fontSize: 11.5, color: colors.text.muted, margin: '2px 0 0', lineHeight: 1.4 }}>{hint}</p>
          {latest && (
            <p style={{ fontSize: 11.5, color: colors.state.success, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> {latest.original_filename ?? 'Uploaded'}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(type, file)
          e.target.value = ''
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} loading={uploading} style={{ flexShrink: 0 }}>
        <Upload size={12} />{latest ? 'Replace' : 'Upload'}
      </Button>
    </div>
  )
}

export default function EmployerVerificationPage() {
  const { data: v, isLoading, isError, refetch } = useVerificationStatus()
  const request = useRequestVerification()
  const upload = useUploadVerificationDocument()
  const [uploadingType, setUploadingType] = useState<VerificationDocType | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const status = v?.status ?? 'not_submitted'
  const currentStep = STATUS_ORDER.indexOf(status)
  const isRejected = status === 'rejected'
  const isApproved = status === 'approved'
  const hasRequested = status !== 'not_submitted'

  const handleUpload = (docType: VerificationDocType, file: File) => {
    setUploadError(null)
    setUploadingType(docType)
    upload.mutate({ docType, file }, {
      onError: (e) => setUploadError(getApiError(e, 'Upload failed. Please try again.')),
      onSettled: () => setUploadingType(null),
    })
  }

  const documentsByType = (type: VerificationDocType) => (v?.documents ?? []).filter((d) => d.doc_type === type)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Verification"
        subtitle="Submit documents to unlock job posting"
        icon={<ShieldCheck size={16} color={colors.text.ink} />}
      />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <p style={{ fontSize: 13, color: colors.text.inkSoft, marginBottom: 28, lineHeight: 1.6 }}>
          {isApproved
            ? 'Your company is verified — job posting is unlocked.'
            : 'Upload your KYC documents below to get verified and unlock job posting. Our team reviews submissions and usually responds within 24–48 hours.'}
        </p>

        {isLoading ? (
          <Spinner size="md" />
        ) : isError ? (
          <ErrorState compact title="Status unavailable" description="Could not load verification status." onRetry={() => refetch()} />
        ) : (
          <>
            {/* Status tracker */}
            {hasRequested && !isRejected && (
              <div style={{ marginBottom: 32 }}>
                {STEPS.map((step, idx) => {
                  const done = currentStep > idx
                  const active = currentStep === idx
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done || active ? (isApproved && idx === 2 ? colors.state.success : colors.brand.navy) : colors.border.default,
                          border: active && !isApproved ? `2px solid ${colors.brand.navy}` : 'none',
                          flexShrink: 0,
                        }}>
                          {done || active ? (
                            idx === 2 && isApproved
                              ? <CheckCircle2 size={18} color="white" />
                              : active ? <Clock size={16} color="white" /> : <CheckCircle2 size={16} color="white" />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.muted }}>{idx + 1}</span>
                          )}
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div style={{ width: 2, height: 48, background: done ? colors.brand.navy : colors.border.default, margin: '4px 0' }} />
                        )}
                      </div>
                      <div style={{ paddingTop: 6, flex: 1, marginBottom: idx < STEPS.length - 1 ? 40 : 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: active || done ? colors.text.ink : colors.text.muted }}>{step.label}</p>
                        {(active || done) && (
                          <p style={{ fontSize: 12.5, color: colors.text.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{step.desc}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isRejected && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                padding: '20px 24px', borderRadius: 16, textAlign: 'center', marginBottom: 24,
                background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)',
              }}>
                <XCircle size={28} color="#DC2626" />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#B91C1C' }}>Verification Not Approved</p>
                  {v?.rejection_reason && (
                    <p style={{ fontSize: 13, color: '#7F1D1D', marginTop: 6, lineHeight: 1.5 }}>{v.rejection_reason}</p>
                  )}
                  <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 8 }}>
                    Upload corrected documents below to resubmit, or contact <strong>support@beginablai.com</strong> for help.
                  </p>
                </div>
              </div>
            )}

            {/* Document upload — always available until approved, so an
                employer can submit, add more documents an admin asked for,
                or fix and resubmit after a rejection, without waiting on
                anyone else to collect the files from them. */}
            {!isApproved && (
              <div style={{
                padding: '18px 22px', borderRadius: radius.lg, marginBottom: 20,
                background: colors.state.infoBg, border: `1px solid ${colors.border.default}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <FileText size={15} color={colors.brand.navy} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Your documents</p>
                </div>
                {DOC_TYPES.map((doc) => (
                  <DocumentUploadRow
                    key={doc.type}
                    type={doc.type}
                    label={doc.label}
                    hint={doc.hint}
                    uploaded={documentsByType(doc.type)}
                    onUpload={handleUpload}
                    uploading={uploadingType === doc.type}
                  />
                ))}
                {uploadError && (
                  <p style={{ fontSize: 12, color: colors.state.danger, marginTop: 10 }}>{uploadError}</p>
                )}
                <p style={{ fontSize: 11.5, color: colors.text.muted, marginTop: 12, margin: '12px 0 0' }}>
                  PDF, PNG or JPEG, up to 10MB each. GST certificate or company registration is enough to get started —
                  add the rest whenever you have them.
                </p>
              </div>
            )}

            {/* No documents uploaded yet and never requested — offer the
                original "just ask our team" path as a fallback for anyone
                who'd rather not upload documents right away. */}
            {!hasRequested && (v?.documents.length ?? 0) === 0 && (
              <>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '14px 18px', borderRadius: 12, marginBottom: 20,
                  background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
                }}>
                  <Mail size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: '#065F46', lineHeight: 1.5 }}>
                    Prefer not to upload right now? Click below and our team will email you to collect documents instead.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => request.mutate()}
                  disabled={request.isPending}
                  loading={request.isPending}
                >
                  {request.isPending ? 'Sending request…' : 'Request Verification Without Uploading'}
                </Button>
                {request.isError && (
                  <p style={{ fontSize: 12, color: colors.state.danger, marginTop: 8 }}>{getApiError(request.error)}</p>
                )}
              </>
            )}

            {/* Timeline */}
            {v?.events && v.events.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Timeline</p>
                {v.events.map(e => (
                  <div key={e.id} style={{ fontSize: 12, color: colors.text.inkSoft, marginBottom: 6 }}>
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
