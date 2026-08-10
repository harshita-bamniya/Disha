import { CheckCircle2, Clock, FileText, Mail, ShieldCheck, XCircle } from 'lucide-react'
import { useVerificationStatus, useRequestVerification } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import { colors, radius } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import PageHeader from '@/shared/layouts/PageHeader'
import ErrorState from '@/shared/components/feedback/ErrorState'
import Spinner from '@/shared/components/feedback/Spinner'

const STEPS = [
  { key: 'requested',    label: 'Verification Requested',   desc: 'Your request has been received. A welcome email has been sent to you.' },
  { key: 'under_review', label: 'Under Review',             desc: 'Our team is reviewing your details and may contact you for documents.' },
  { key: 'approved',     label: 'Verified',                 desc: 'Your company is verified. You can now publish job listings.' },
]

const STATUS_ORDER = ['requested', 'under_review', 'approved']

const DOCUMENTS = [
  'GST Certificate  or  Company Registration Certificate',
  'PAN Card (company / authorised signatory)',
  'Business Email Proof',
]

export default function EmployerVerificationPage() {
  const { data: v, isLoading, isError, refetch } = useVerificationStatus()
  const request = useRequestVerification()

  const status = v?.status ?? 'not_submitted'
  const currentStep = STATUS_ORDER.indexOf(status)
  const isRejected = status === 'rejected'
  const isApproved = status === 'approved'
  const hasRequested = status !== 'not_submitted'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="Verification"
        subtitle="Submit documents to unlock job posting"
        icon={<ShieldCheck size={16} color={colors.text.ink} />}
      />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <p style={{ fontSize: 13, color: colors.text.inkSoft, marginBottom: 28, lineHeight: 1.6 }}>
          Get your company verified to unlock job posting. Click the button below and our team will reach out to guide you through the process.
        </p>

        {isLoading ? (
          <Spinner size="md" />
        ) : isError ? (
          <ErrorState compact title="Status unavailable" description="Could not load verification status." onRetry={() => refetch()} />
        ) : isRejected ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            padding: '28px 24px', borderRadius: 16, textAlign: 'center',
            background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)',
          }}>
            <XCircle size={32} color="#DC2626" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#B91C1C' }}>Verification Not Approved</p>
              {v?.rejection_reason && (
                <p style={{ fontSize: 13, color: '#7F1D1D', marginTop: 6, lineHeight: 1.5 }}>{v.rejection_reason}</p>
              )}
              <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 8 }}>
                Please contact us at <strong>support@beginableai.com</strong> for assistance.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => request.mutate()}
              disabled={request.isPending}
              loading={request.isPending}
            >
              {request.isPending ? 'Requesting…' : 'Request Again'}
            </Button>
          </div>
        ) : (
          <>
            {/* Status tracker */}
            {hasRequested && (
              <div style={{ marginBottom: 32 }}>
                {STEPS.map((step, idx) => {
                  const done = currentStep > idx
                  const active = currentStep === idx
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: 16, marginBottom: idx < STEPS.length - 1 ? 0 : 0 }}>
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
                      <div style={{ paddingBottom: idx < STEPS.length - 1 ? 0 : 0, paddingTop: 6, flex: 1, marginBottom: idx < STEPS.length - 1 ? 40 : 0 }}>
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

            {/* Not yet requested — show CTA */}
            {!hasRequested && (
              <>
                {/* Document list info */}
                <div style={{
                  padding: '20px 22px', borderRadius: radius.lg, marginBottom: 20,
                  background: colors.state.infoBg, border: `1px solid ${colors.border.default}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <FileText size={15} color={colors.brand.navy} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Documents you'll need to prepare</p>
                  </div>
                  {DOCUMENTS.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.brand.navy, marginTop: 5, flexShrink: 0 }} />
                      <p style={{ fontSize: 13, color: colors.text.inkSoft, lineHeight: 1.5, margin: 0 }}>{doc}</p>
                    </div>
                  ))}
                  <p style={{ fontSize: 11.5, color: colors.text.muted, marginTop: 12, margin: '12px 0 0' }}>
                    You don't need to upload these now — our team will contact you to collect them.
                  </p>
                </div>

                {/* Email info */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '14px 18px', borderRadius: 12, marginBottom: 24,
                  background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
                }}>
                  <Mail size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12.5, color: '#065F46', lineHeight: 1.5 }}>
                    Once you click the button below, you'll receive a welcome email with all the details and a team member will contact you for the next steps.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => request.mutate()}
                  disabled={request.isPending}
                  loading={request.isPending}
                >
                  {request.isPending ? 'Sending request…' : 'Request Verification'}
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
