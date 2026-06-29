import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, FileText, ShieldCheck, ShieldAlert, Upload, XCircle } from 'lucide-react'
import { useVerificationStatus, useUploadVerificationDocument, useSubmitVerification } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { VerificationDocType } from '@/api/jobs'

// Mirrors how real KYB checks work (e.g. Naukri's recruiter verification):
// one entity-identity doc (GST or company registration) + one signatory ID
// (PAN). Business email is supplementary, not required.
const DOC_TYPES: { value: VerificationDocType; label: string; required: boolean }[] = [
  { value: 'gst_certificate',      label: 'GST Certificate', required: false },
  { value: 'company_registration', label: 'Company Registration Certificate', required: false },
  { value: 'pan_card',             label: 'PAN Card', required: true },
  { value: 'business_email',       label: 'Business Email Proof', required: false },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  not_submitted: { label: 'Not submitted', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', icon: FileText },
  draft:         { label: 'Draft — not yet submitted', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', icon: FileText },
  pending:       { label: 'Submitted — pending review', color: '#D97706', bg: 'rgba(245,158,11,0.1)', icon: Clock },
  under_review:  { label: 'Under review',   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', icon: Clock },
  approved:      { label: 'Verified',       color: '#059669', bg: 'rgba(5,150,105,0.1)',  icon: CheckCircle2 },
  rejected:      { label: 'Rejected',       color: '#DC2626', bg: 'rgba(220,38,38,0.1)',  icon: XCircle },
  resubmitted:   { label: 'Resubmitted',    color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', icon: Clock },
}

function DocUploadRow({ label, existing, onUpload, isUploading, disabled }: {
  docType: VerificationDocType
  label: string
  existing?: { original_filename: string | null; status: string }
  onUpload: (file: File) => void
  isUploading: boolean
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)', marginBottom: 10,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{label}</p>
        {existing ? (
          <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            {existing.original_filename} · <span style={{ fontWeight: 600 }}>{existing.status}</span>
          </p>
        ) : (
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>No document uploaded yet</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading || disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10, border: 'none',
          background: '#3B82F6', color: 'white', fontSize: 12, fontWeight: 700,
          cursor: (isUploading || disabled) ? 'default' : 'pointer', opacity: (isUploading || disabled) ? 0.4 : 1,
        }}
      >
        <Upload size={13} />{existing ? 'Replace' : 'Upload'}
      </button>
    </div>
  )
}

export default function EmployerVerificationPage() {
  const { data: v, isLoading } = useVerificationStatus()
  const upload = useUploadVerificationDocument()
  const submit = useSubmitVerification()
  const [uploadingType, setUploadingType] = useState<VerificationDocType | null>(null)

  const status = v?.status ?? 'not_submitted'
  const meta = STATUS_META[status] ?? STATUS_META.not_submitted
  const StatusIcon = meta.icon

  const handleUpload = (docType: VerificationDocType, file: File) => {
    setUploadingType(docType)
    upload.mutate({ docType, file }, { onSettled: () => setUploadingType(null) })
  }

  const uploadedTypes = new Set(v?.documents.map(d => d.doc_type) ?? [])
  const hasEntityProof = uploadedTypes.has('gst_certificate') || uploadedTypes.has('company_registration')
  const hasSignatoryId = uploadedTypes.has('pan_card')
  // Once actually submitted (pending/under_review/approved), editing/resubmitting
  // is locked until the admin reviews it — only draft (uploading) or rejected
  // (resubmit-after-fix) states allow hitting Submit.
  const canEditDocuments = status === 'draft' || status === 'not_submitted' || status === 'rejected'
  const canSubmit = hasEntityProof && hasSignatoryId && (status === 'draft' || status === 'rejected')
  const isAwaitingReview = status === 'pending' || status === 'under_review'

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '32px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link to="/app/employer/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} />Back to dashboard
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={22} color="#3B82F6" />
          <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 22, fontWeight: 800, color: '#1E3A5F' }}>Company Verification</h1>
        </div>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
          Upload your KYC documents to get the verified badge on your job listings.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderRadius: 14, marginBottom: 20,
          background: meta.bg, border: `1px solid ${meta.color}33`,
        }}>
          <StatusIcon size={18} color={meta.color} />
          <span style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</span>
        </div>

        {status === 'rejected' && v?.rejection_reason && (
          <div style={{
            display: 'flex', gap: 10, padding: '14px 18px', borderRadius: 14, marginBottom: 20,
            background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)',
          }}>
            <ShieldAlert size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>Rejection reason</p>
              <p style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2 }}>{v.rejection_reason}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>Loading…</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>
              Required: <strong>one of</strong> GST Certificate or Company Registration Certificate,
              {' '}<strong>plus</strong> a PAN Card. Business Email Proof is optional but strengthens your application.
            </p>
            {DOC_TYPES.map(({ value, label, required }) => {
              const existing = v?.documents.find(d => d.doc_type === value)
              const isEntityProofRow = value === 'gst_certificate' || value === 'company_registration'
              return (
                <div key={value}>
                  <DocUploadRow
                    docType={value}
                    label={`${label}${required ? ' (required)' : isEntityProofRow ? ' (one required)' : ' (optional)'}`}
                    existing={existing}
                    onUpload={file => handleUpload(value, file)}
                    isUploading={uploadingType === value}
                    disabled={!canEditDocuments}
                  />
                </div>
              )
            })}

            {isAwaitingReview && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                marginTop: 20, padding: '24px 20px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <Clock size={26} color="#D97706" />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Submitted for review</p>
                  <p style={{ fontSize: 12.5, color: '#B45309', marginTop: 4, lineHeight: 1.5 }}>
                    Our team typically reviews within 24–48 hours. You can keep using the dashboard —
                    you just can't publish a job until this is approved.
                  </p>
                </div>
                <Link to="/app/employer/dashboard" style={{
                  marginTop: 4, padding: '10px 20px', borderRadius: 10,
                  background: '#D97706', color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  Back to dashboard
                </Link>
              </div>
            )}

            {upload.isError && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>{getApiError(upload.error)}</p>}

            {v?.events && v.events.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Timeline</p>
                {v.events.map(e => (
                  <div key={e.id} style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#1E3A5F' }}>{e.to_status}</span>
                    {' · '}{new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {e.note && <span> — {e.note}</span>}
                  </div>
                ))}
              </div>
            )}

            {canSubmit && (
              <button
                onClick={() => submit.mutate()}
                disabled={submit.isPending}
                style={{
                  width: '100%', marginTop: 20, padding: '13px 18px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: 'white',
                  fontSize: 14, fontWeight: 700, cursor: submit.isPending ? 'default' : 'pointer',
                  opacity: submit.isPending ? 0.7 : 1,
                }}
              >
                {submit.isPending ? 'Submitting…' : status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
              </button>
            )}
            {submit.isError && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{getApiError(submit.error)}</p>}
          </>
        )}
      </div>
    </div>
  )
}
