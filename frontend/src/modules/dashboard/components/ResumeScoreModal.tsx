import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, FileText, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { getApiError } from '@/api/client'
import { resumeMatchApi, type ScanOut } from '@/api/resumeMatch'
import ScoreRing from '@/shared/components/data-display/ScoreRing'
import { bandColor } from '@/modules/resume/components/match/matchTheme'
import Button from '@/shared/components/primitives/Button'
import { BORDER, INK, MUTED, NAVY } from '@/design-system/tokens'

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Job card → Resume. Upload a resume, see its ATS score against this job, then
 * either close or continue in the resume builder.
 */
export default function ResumeScoreModal({ job, onClose }: { job: LiveJob; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const consent = useQuery({ queryKey: ['resume-match', 'consent'], queryFn: resumeMatchApi.consent })
  const giveConsent = useMutation({
    mutationFn: resumeMatchApi.giveConsent,
    onSuccess: s => qc.setQueryData(['resume-match', 'consent'], s),
  })
  const scan = useMutation<ScanOut, unknown, File>({
    mutationFn: file => resumeMatchApi.scanUpload(job.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume-match'] }),
  })

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx') { setFileError('Only PDF and DOCX files are supported.'); return }
    if (file.size > MAX_BYTES) { setFileError('File exceeds the 5 MB limit.'); return }
    setFileError(null)
    setFileName(file.name)
    scan.mutate(file)
  }

  const result = scan.data
  const needsConsent = consent.data && !consent.data.consented
  const errorText = fileError ?? (scan.isError ? getApiError(scan.error, 'Could not check your resume right now. Please try again.') : null)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
    >
      <div
        role="dialog" aria-modal="true" aria-label="Resume ATS score"
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}
      >
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={16} color={NAVY} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{result ? 'Your ATS score' : 'Upload your resume'}</div>
            <div style={{ fontSize: 11.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {job.title} · {job.company_name}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* ── result ── */}
          {result && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0 4px' }}>
                <ScoreRing value={result.report.score} size={140} stroke={11} color={bandColor[result.report.band]} label="ATS score" />
                <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                  {result.resume_label || fileName || 'Your resume'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>Close</Button>
                <Button onClick={() => navigate('/app/resume')} style={{ flex: 2 }}>
                  <Sparkles size={14} style={{ marginRight: 6 }} /> Enhance with BeginablAI
                </Button>
              </div>
            </>
          )}

          {/* ── scanning ── */}
          {!result && scan.isPending && (
            <div style={{ textAlign: 'center', padding: '32px 0' }} role="status">
              <div style={{ width: 40, height: 40, border: `3px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Checking your resume…</p>
              <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Comparing {fileName ?? 'it'} with this job's requirements. This can take up to a minute, please keep this window open.</p>
            </div>
          )}

          {/* ── consent (first scan only) ── */}
          {!result && !scan.isPending && needsConsent && (
            <section aria-label="Resume analysis consent" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color={NAVY} />
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Before we check your resume</h2>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: INK }}>{consent.data!.text}</p>
              <div><Button onClick={() => giveConsent.mutate()} disabled={giveConsent.isPending}>I agree, continue</Button></div>
            </section>
          )}

          {/* ── upload ── */}
          {!result && !scan.isPending && consent.data?.consented && (
            <>
              <input
                ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
              />
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                style={{
                  border: `2px dashed ${dragOver ? NAVY : '#CBD5E1'}`, borderRadius: 14, padding: '36px 24px',
                  textAlign: 'center', cursor: 'pointer', background: dragOver ? '#EAECF0' : '#FAFAFA', transition: 'all 0.2s',
                }}
              >
                <FileText size={40} color={dragOver ? NAVY : '#94A3B8'} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Drag & drop your resume here</p>
                <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>PDF or DOCX · Max 5 MB</p>
                <span style={{ fontSize: 12, color: NAVY, fontWeight: 700, textDecoration: 'underline' }}>Browse file</span>
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 14, textAlign: 'center' }}>
                We'll score it against this job's requirements as an ATS would.
              </p>
            </>
          )}

          {!result && consent.isLoading && <p style={{ fontSize: 13, color: MUTED, textAlign: 'center' }}>Loading…</p>}

          {!result && errorText && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', background: '#FEF2F2', borderRadius: 10, border: '1px solid #FCA5A5' }}>
              <AlertCircle size={14} color="#DC2626" />
              <span style={{ fontSize: 12, color: '#DC2626' }}>{errorText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
