import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Upload, FileText, Trash2, Download, Eye, Pencil, Check, X,
  AlertCircle, Loader2, FolderOpen, Sparkles,
} from 'lucide-react'
import AspLayout from '@/shared/layouts/AspLayout'
import PageHeader from '@/shared/layouts/PageHeader'
import { resumeLibraryApi, type ResumeFile } from '@/api/resumeLibrary'
import { tokens } from '@/design-system'

// ── palette (matches dashboard navy/cream) ────────────────────────────────────
const NAVY     = tokens.color.brand.navy
const INK      = tokens.color.brand.ink
const INK_S    = tokens.color.brand.inkSoft
const MUTED    = tokens.color.brand.muted
const CREAM    = tokens.color.surface.bg
const CREAM_DK = tokens.color.surface.elevated
const BORDER   = tokens.color.brand.border
const WHITE    = tokens.color.surface.card
const GREEN    = tokens.color.state.success
const RED      = tokens.color.state.danger
const AMBER    = tokens.color.state.warning

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB
const ALLOWED_EXT = ['pdf', 'docx', 'doc', 'rtf']

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function extColor(fmt: string) {
  if (fmt === 'pdf')  return '#DC2626'
  if (fmt === 'docx' || fmt === 'doc') return '#1D4ED8'
  return '#6D28D9'
}

// ── tiny inline components ────────────────────────────────────────────────────
function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      background: `${color}18`, color,
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

function IconBtn({
  icon, title, onClick, danger = false, disabled = false,
}: {
  icon: React.ReactNode; title: string
  onClick: () => void; danger?: boolean; disabled?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 8,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: disabled ? CREAM_DK : hov ? (danger ? '#FEE2E2' : CREAM_DK) : 'transparent',
        color: disabled ? MUTED : danger ? RED : INK_S,
        transition: 'background 0.15s',
      }}
    >
      {icon}
    </button>
  )
}

// ── rename inline editor ──────────────────────────────────────────────────────
function RenameRow({ file, onDone }: { file: ResumeFile; onDone: () => void }) {
  const qc = useQueryClient()
  const [val, setVal] = useState(file.label || file.filename)
  const mut = useMutation({
    mutationFn: () => resumeLibraryApi.rename(file.id, val.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resume-library'] }); onDone() },
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') mut.mutate(); if (e.key === 'Escape') onDone() }}
        style={{
          flex: 1, height: 32, padding: '0 10px', borderRadius: 8,
          border: `1.5px solid ${NAVY}40`, fontSize: 13, color: INK,
          outline: 'none', background: WHITE,
        }}
      />
      <IconBtn icon={<Check size={14} />} title="Save" onClick={() => mut.mutate()} disabled={!val.trim()} />
      <IconBtn icon={<X size={14} />} title="Cancel" onClick={onDone} />
    </div>
  )
}

// ── resume card ───────────────────────────────────────────────────────────────
function ResumeCard({ file }: { file: ResumeFile }) {
  const qc = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const delMut = useMutation({
    mutationFn: () => resumeLibraryApi.delete(file.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume-library'] }),
  })

  const color = extColor(file.format)

  return (
    <div style={{
      background: WHITE, borderRadius: 14,
      border: `1px solid ${BORDER}`,
      boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      overflow: 'hidden',
    }}>
      {/* top stripe */}
      <div style={{ height: 3, background: color }} />

      <div style={{ padding: '14px 16px' }}>
        {/* format badge + size */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Pill label={file.format.toUpperCase()} color={color} />
          <span style={{ fontSize: 12, color: MUTED }}>{fmtBytes(file.file_size_bytes)}</span>
        </div>

        {/* file name / rename */}
        {renaming ? (
          <RenameRow file={file} onDone={() => setRenaming(false)} />
        ) : (
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600, color: INK,
            lineHeight: 1.4, wordBreak: 'break-word',
            marginBottom: 4,
          }}>
            {file.label || file.filename}
          </p>
        )}

        <p style={{ margin: '0 0 12px', fontSize: 11, color: MUTED }}>
          Uploaded {fmtDate(file.created_at)}
        </p>

        {/* actions */}
        {confirmDel ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#FEF2F2', borderRadius: 8, padding: '6px 10px',
          }}>
            <AlertCircle size={14} color={RED} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: RED, flex: 1 }}>Delete this file?</span>
            <button
              onClick={() => delMut.mutate()}
              style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: RED, color: WHITE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {delMut.isPending ? '…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${CREAM_DK}`, background: WHITE, color: INK_S, fontSize: 12, cursor: 'pointer' }}
            >
              No
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconBtn icon={<Eye size={14} />} title="Preview" onClick={() => window.open(resumeLibraryApi.previewUrl(file.id), '_blank')} />
            <IconBtn icon={<Download size={14} />} title="Download" onClick={() => window.open(resumeLibraryApi.downloadUrl(file.id), '_blank')} />
            <IconBtn icon={<Pencil size={14} />} title="Rename" onClick={() => setRenaming(true)} />
            <IconBtn icon={<Trash2 size={14} />} title="Delete" onClick={() => setConfirmDel(true)} danger />
          </div>
        )}
      </div>
    </div>
  )
}

// ── upload drop zone ──────────────────────────────────────────────────────────
function UploadZone({ onUploadDone }: { onUploadDone: () => void }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (file: File) => resumeLibraryApi.upload(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resume-library'] }); onUploadDone() },
    onError: (e: Error) => setError(e.message),
  })

  function validate(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) return `File type .${ext} not supported. Use PDF, DOCX, DOC or RTF.`
    if (file.size > MAX_BYTES) return `File too large (${fmtBytes(file.size)}). Maximum is 5 MB.`
    return null
  }

  function handle(file: File) {
    setError(null)
    const err = validate(file)
    if (err) { setError(err); return }
    mut.mutate(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f) handle(f)
      }}
      style={{
        border: `2px dashed ${drag ? NAVY : CREAM_DK}`,
        borderRadius: 14,
        padding: '28px 20px',
        textAlign: 'center',
        background: drag ? `${NAVY}06` : CREAM,
        transition: 'all 0.15s',
        cursor: mut.isPending ? 'default' : 'pointer',
      }}
      onClick={() => !mut.isPending && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.rtf"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }}
      />

      {mut.isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Loader2 size={28} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: 0, fontSize: 13, color: INK_S }}>Uploading & scanning…</p>
        </div>
      ) : (
        <>
          <Upload size={28} color={drag ? NAVY : MUTED} style={{ marginBottom: 8 }} />
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: drag ? NAVY : INK }}>
            Drop your resume here or click to browse
          </p>
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            PDF, DOCX, DOC, RTF — max 5 MB
          </p>
        </>
      )}

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#FEF2F2', border: `1px solid ${RED}30`,
          borderRadius: 8, padding: '8px 12px', marginTop: 12, textAlign: 'left',
        }}>
          <AlertCircle size={14} color={RED} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: RED }}>{error}</span>
        </div>
      )}
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────────
export default function ResumeLibraryPage() {
  const [showUpload, setShowUpload] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['resume-library'],
    queryFn: resumeLibraryApi.list,
  })

  const items = data?.resumes ?? []

  return (
    <AspLayout activePath="/app/resume-library">
      <PageHeader
        title="Resume Library"
        subtitle="Upload and manage the resume files you attach to job applications."
        actions={
          <button
            onClick={() => setShowUpload(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: NAVY, color: WHITE,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Upload size={15} />
            Upload resume
          </button>
        }
      />

      <main style={{ padding: '32px 28px', maxWidth: 900, margin: '0 auto', width: '100%', flex: 1 }}>

        {/* upload zone */}
        {showUpload && (
          <div style={{ marginBottom: 24 }}>
            <UploadZone onUploadDone={() => setShowUpload(false)} />
          </div>
        )}

        {/* states */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={28} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#FEF2F2', border: `1px solid ${RED}30`,
            borderRadius: 12, padding: '14px 18px', color: RED, fontSize: 13,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            Failed to load your resume library. Please refresh.
          </div>
        )}

        {!isLoading && !error && items.length === 0 && !showUpload && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '64px 24px', textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: `${NAVY}10`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: 16,
            }}>
              <FolderOpen size={32} color={NAVY} />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: NAVY }}>
              No resumes yet
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: INK_S, maxWidth: 340 }}>
              Upload your resume files here. You can attach them when applying to jobs.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: NAVY, color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Upload size={15} />
              Upload your first resume
            </button>
          </div>
        )}

        {/* grid */}
        {items.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 32,
            }}>
              {items.map(f => <ResumeCard key={f.id} file={f} />)}
            </div>

            <p style={{ margin: 0, fontSize: 12, color: MUTED, textAlign: 'center' }}>
              {items.length} file{items.length !== 1 ? 's' : ''} · Max 5 MB per file
            </p>
          </>
        )}

        {/* tip banner */}
        {items.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: `${NAVY}08`, border: `1px solid ${NAVY}18`,
            borderRadius: 12, padding: '12px 16px', marginTop: 20,
          }}>
            <Sparkles size={16} color={NAVY} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: INK_S, lineHeight: 1.5 }}>
              <strong style={{ color: NAVY }}>Tip:</strong> When you apply for a job, Disha AI will recommend the best resume from your library for that role.
            </p>
          </div>
        )}
        </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </AspLayout>
  )
}
