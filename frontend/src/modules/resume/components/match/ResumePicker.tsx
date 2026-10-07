import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import Card from '@/shared/components/data-display/Card'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import { toast } from '@/shared/components/feedback/Toast'
import { colors } from '@/design-system/tokens'
import { resumeApi } from '@/api/resume'
import { resumeLibraryApi } from '@/api/resumeLibrary'
import { resumeMatchApi } from '@/api/resumeMatch'

export type ResumeChoice =
  | { kind: 'builder'; id: string }
  | { kind: 'file'; id: string }
  | { kind: 'upload'; file: File }

const MAX_BYTES = 5 * 1024 * 1024

interface Props {
  initial?: ResumeChoice | null
  busy: boolean
  onSubmit: (choice: ResumeChoice) => void
}

function Option({ selected, disabled, onClick, title, sub }: {
  selected: boolean; disabled?: boolean; onClick: () => void; title: string; sub: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px',
        borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: selected ? colors.state.infoBg : colors.surface.card,
        border: `1.5px solid ${selected ? colors.brand.navy : colors.border.default}`,
      }}
    >
      <FileText size={18} color={selected ? colors.brand.navy : colors.text.muted} style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: colors.text.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: colors.text.muted }}>{sub}</span>
      </span>
    </button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: colors.text.muted }}>
        {title}
      </p>
      <div role="radiogroup" aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

export default function ResumePicker({ initial, busy, onSubmit }: Props) {
  const [choice, setChoice] = useState<ResumeChoice | null>(initial ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  const builder = useQuery({ queryKey: ['resumes'], queryFn: resumeApi.listResumes })
  const files = useQuery({ queryKey: ['resume-library'], queryFn: resumeLibraryApi.list })
  const quota = useQuery({ queryKey: ['resume-match-quota'], queryFn: resumeMatchApi.quota })

  const loading = builder.isLoading || files.isLoading
  const builderList = builder.data ?? []
  const fileList = files.data?.resumes ?? []
  const noneSaved = !loading && builderList.length === 0 && fileList.length === 0

  function pickFile(f: File | undefined) {
    if (!f) return
    if (!/\.(pdf|docx)$/i.test(f.name)) { toast.danger('Please choose a PDF or DOCX file.'); return }
    if (f.size > MAX_BYTES) { toast.danger('That file is larger than 5 MB.'); return }
    setChoice({ kind: 'upload', file: f })
  }

  const isSel = (kind: ResumeChoice['kind'], id?: string) =>
    choice?.kind === kind && (kind === 'upload' || (choice as { id: string }).id === id)

  return (
    <Card padding={24}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text.ink, margin: '0 0 4px' }}>Which resume should we check?</h2>
      <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '0 0 20px', lineHeight: 1.5 }}>
        We compare it with this job&apos;s requirements and show what to fix. Uploaded files are read once and not saved.
      </p>

      {loading && <Spinner />}

      {builderList.length > 0 && (
        <Group title="Resume Builder">
          {builderList.map(r => (
            <Option key={r.id} selected={isSel('builder', r.id)} onClick={() => setChoice({ kind: 'builder', id: r.id })}
              title={r.title} sub={`${r.section_count} sections`} />
          ))}
        </Group>
      )}

      {fileList.length > 0 && (
        <Group title="Uploaded files">
          {fileList.map(f => {
            const ok = f.format === 'pdf' || f.format === 'docx'
            return (
              <Option key={f.id} selected={isSel('file', f.id)} disabled={!ok}
                onClick={() => setChoice({ kind: 'file', id: f.id })}
                title={f.label || f.filename}
                sub={ok ? f.format.toUpperCase() : `${f.format.toUpperCase()} can't be checked. Save it as PDF or DOCX.`} />
            )
          })}
        </Group>
      )}

      <Group title="Upload a new file">
        <input
          ref={inputRef} type="file" accept=".pdf,.docx" hidden
          onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%', padding: '16px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            border: `1.5px dashed ${isSel('upload') ? colors.brand.navy : colors.border.strong}`,
            background: isSel('upload') ? colors.state.infoBg : colors.surface.bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <Upload size={18} color={colors.text.muted} />
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink }}>
            {choice?.kind === 'upload' ? choice.file.name : 'Choose a PDF or DOCX (max 5 MB)'}
          </span>
        </button>
      </Group>

      {noneSaved && (
        <p style={{ fontSize: 12.5, color: colors.text.muted, margin: '0 0 14px' }}>
          You don&apos;t have a saved resume yet. Upload one above, or build one in Resume Builder.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Button loading={busy} disabled={!choice || busy || quota.data?.remaining === 0} onClick={() => choice && onSubmit(choice)}>
          {busy ? 'Checking…' : 'Check my resume'}
        </Button>
        {quota.data && (
          <span style={{ fontSize: 12, color: quota.data.remaining === 0 ? colors.state.danger : colors.text.muted }}>
            {quota.data.remaining === 0
              ? 'Daily limit reached. Try again tomorrow.'
              : `${quota.data.remaining} of ${quota.data.limit} checks left today`}
          </span>
        )}
      </div>
      {busy && (
        <p style={{ fontSize: 12.5, color: colors.text.inkSoft, margin: '14px 0 0' }}>
          Reading your resume and comparing it with this job. This usually takes 10–20 seconds.
        </p>
      )}
    </Card>
  )
}
