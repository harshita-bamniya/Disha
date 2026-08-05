import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { resumeApi, type ParsedResumeData } from '@/api/resume'
import { Upload, FileText, CheckCircle, X, AlertCircle } from 'lucide-react'
import { Modal } from '@/shared/components/overlays/Modal'

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'parsing' | 'confirm' | 'importing'

export default function ResumeUploadModal({ onClose }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedResumeData | null>(null)
  const [resumeTitle, setResumeTitle] = useState('Imported Resume')

  const parseMutation = useMutation({
    mutationFn: (file: File) => resumeApi.parseResumeFile(file),
    onMutate: () => { setStep('parsing'); setError(null) },
    onSuccess: (data) => { setParsed(data); setStep('confirm') },
    onError: (err: Error) => { setError(err.message); setStep('upload') },
  })

  const importMutation = useMutation({
    mutationFn: () => resumeApi.importParsedResume({ title: resumeTitle, parsed_data: parsed! }),
    onMutate: () => setStep('importing'),
    onSuccess: (resume) => {
      qc.invalidateQueries({ queryKey: ['resumes'] })
      navigate(`/app/resume/${resume.id}`)
    },
    onError: (err: Error) => { setError(err.message); setStep('confirm') },
  })

  function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds 5 MB limit.')
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx') {
      setError('Only PDF and DOCX files are supported.')
      return
    }
    setError(null)
    parseMutation.mutate(file)
  }

  const p = parsed

  return (
    <Modal onClose={onClose} maxWidth={520} radius={20}>
        {/* header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Upload size={16} color="#1A2744" />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Upload Resume</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>

          {/* ── Step: upload ── */}
          {(step === 'upload') && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
                style={{
                  border: `2px dashed ${dragOver ? '#1A2744' : '#CBD5E1'}`,
                  borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#EAECF0' : '#FAFAFA',
                  transition: 'all 0.2s',
                }}
              >
                <FileText size={40} color={dragOver ? '#1A2744' : '#94A3B8'} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                  Drag & drop your resume here
                </p>
                <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  PDF or DOCX · Max 5 MB
                </p>
                <span style={{ fontSize: 12, color: '#1A2744', fontWeight: 700, textDecoration: 'underline' }}>
                  Browse file
                </span>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', background: '#FEF2F2', borderRadius: 10, border: '1px solid #FCA5A5' }}>
                  <AlertCircle size={14} color="#DC2626" />
                  <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>
                </div>
              )}

              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 14, textAlign: 'center' }}>
                AI will extract your experience, education, skills, and more.
                You'll review everything before saving.
              </p>
            </>
          )}

          {/* ── Step: parsing ── */}
          {step === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 40, height: 40, border: '3px solid #1A2744', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Parsing your resume…</p>
              <p style={{ fontSize: 12, color: '#64748B' }}>AI is extracting your experience, education, and skills.</p>
            </div>
          )}

          {/* ── Step: confirm ── */}
          {step === 'confirm' && p && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
                <CheckCircle size={14} color="#16A34A" />
                <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}>
                  Parsing complete — review before saving
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto', marginBottom: 16 }}>
                <InfoRow label="Name" value={p.personal_info?.name} />
                <InfoRow label="Email" value={p.personal_info?.email} />
                <InfoRow label="Location" value={p.personal_info?.location} />
                <InfoRow label="Summary" value={p.summary ? p.summary.slice(0, 120) + (p.summary.length > 120 ? '…' : '') : null} />
                <InfoRow label="Experience" value={p.experience.length > 0 ? `${p.experience.length} role(s) detected` : null} />
                <InfoRow label="Education" value={p.education.length > 0 ? `${p.education.length} qualification(s)` : null} />
                <InfoRow label="Skills" value={
                  Object.values(p.skills || {}).flat().length > 0
                    ? `${Object.values(p.skills || {}).flat().length} skills`
                    : null
                } />
                <InfoRow label="Projects" value={p.projects.length > 0 ? `${p.projects.length} project(s)` : null} />
                <InfoRow label="Languages" value={p.languages.length > 0 ? p.languages.map((l: any) => l.language).join(', ') : null} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Resume title
                </label>
                <input
                  value={resumeTitle}
                  onChange={e => setResumeTitle(e.target.value)}
                  style={{ width: '100%', height: 38, borderRadius: 9, border: '1.5px solid #E2E8F0', padding: '0 12px', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#FEF2F2', borderRadius: 10, border: '1px solid #FCA5A5' }}>
                  <AlertCircle size={14} color="#DC2626" />
                  <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setParsed(null); setStep('upload') }}
                  style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: 'white', color: '#64748B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  Re-upload
                </button>
                <button
                  onClick={() => importMutation.mutate()}
                  style={{ flex: 2, padding: '9px', borderRadius: 9, background: '#1A2744', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >
                  Save & Open Editor
                </button>
              </div>
            </>
          )}

          {/* ── Step: importing ── */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 40, height: 40, border: '3px solid #1A2744', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Saving your resume…</p>
            </div>
          )}
        </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Modal>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', width: 90, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: value ? '#0F172A' : '#CBD5E1', flex: 1 }}>
        {value ?? '—'}
      </span>
    </div>
  )
}
