import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resumeApi } from '@/api/resume'
import { resumeLibraryApi, type ResumeFile } from '@/api/resumeLibrary'
import PageHeader from '@/shared/layouts/PageHeader'
import Tabs from '@/shared/components/navigation/Tabs'
import ResumeUploadModal from '@/modules/resume/components/ResumeUploadModal'
import ScoreBreakdownCard from '@/modules/resume/components/ScoreBreakdownCard'
import Button from '@/shared/components/primitives/Button'
import EmptyState from '@/shared/components/feedback/EmptyState'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import { NAVY, INK, INK_SFT as INK_S, MUTED, BORDER, colors } from '@/design-system/tokens'
import {
  FileText, Plus, Star, Trash2, Edit3, Upload, BarChart2, FolderOpen,
  Download, Eye, Pencil, Check, X, AlertCircle, Loader2, Sparkles,
} from 'lucide-react'

const CREAM_DK = colors.surface.elevated
const WHITE    = '#fff'
const RED      = colors.state.danger

const TEMPLATE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  ats_clean: { label: 'ATS Friendly',     color: '#16A34A', bg: '#F0FDF4' },
  modern:    { label: 'ATS Risk: Medium', color: '#D97706', bg: '#FFFBEB' },
  hybrid:    { label: 'ATS Risk: Low',    color: '#0284C7', bg: '#F0F9FF' },
  executive: { label: 'Executive',        color: '#7C3AED', bg: '#F3E8FF' },
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function extColor(fmt: string) {
  if (fmt === 'pdf') return '#DC2626'
  if (fmt === 'docx' || fmt === 'doc') return '#1D4ED8'
  return '#6D28D9'
}

// ── tiny inline components (uploaded-files tab) ─────────────────────────────

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

function FileCard({ file }: { file: ResumeFile }) {
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
      <div style={{ height: 3, background: color }} />

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Pill label={file.format.toUpperCase()} color={color} />
          <span style={{ fontSize: 12, color: MUTED }}>{fmtBytes(file.file_size_bytes)}</span>
        </div>

        {renaming ? (
          <RenameRow file={file} onDone={() => setRenaming(false)} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4, wordBreak: 'break-word', marginBottom: 4 }}>
            {file.label || file.filename}
          </p>
        )}

        <p style={{ margin: '0 0 12px', fontSize: 11, color: MUTED }}>
          Uploaded {fmtDate(file.created_at)}
        </p>

        {confirmDel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', borderRadius: 8, padding: '6px 10px' }}>
            <AlertCircle size={14} color={RED} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: RED, flex: 1 }}>Delete this file?</span>
            <button onClick={() => delMut.mutate()} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: RED, color: WHITE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {delMut.isPending ? '…' : 'Yes'}
            </button>
            <button onClick={() => setConfirmDel(false)} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${CREAM_DK}`, background: WHITE, color: INK_S, fontSize: 12, cursor: 'pointer' }}>
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

// ── main page ────────────────────────────────────────────────────────────────

export default function ResumeHubPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'resumes' | 'files'>('resumes')
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined)
  const [expandedScore, setExpandedScore] = useState<string | null>(null)

  const { data: resumes, isLoading: resumesLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: resumeApi.listResumes,
  })

  const { data: templates } = useQuery({
    queryKey: ['resume-templates'],
    queryFn: resumeApi.getTemplates,
  })

  const { data: library, isLoading: libraryLoading } = useQuery({
    queryKey: ['resume-library'],
    queryFn: resumeLibraryApi.list,
  })
  const files = library?.resumes ?? []

  const createMutation = useMutation({
    mutationFn: () => resumeApi.createResume({
      title: newTitle || 'My Resume',
      template_id: selectedTemplate,
    }),
    onSuccess: (resume) => {
      qc.invalidateQueries({ queryKey: ['resumes'] })
      setShowCreate(false)
      setNewTitle('')
      setSelectedTemplate(undefined)
      navigate(`/app/resume/${resume.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resumeApi.deleteResume(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resumes'] }),
  })

  const atsColor = (score: number | null) => {
    if (!score) return '#94A3B8'
    if (score >= 80) return '#16A34A'
    if (score >= 60) return '#D97706'
    return '#DC2626'
  }

  return (
    <>
      <PageHeader
        title="Resume"
        subtitle="Upload, build, and manage the resumes you use to apply for jobs."
        icon={<FileText size={14} color="#1A2744" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
              <Upload size={13} /> Upload Resume
            </Button>
            {tab === 'resumes' && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> New Resume
              </Button>
            )}
          </>
        }
      />

      <main style={{ padding: '28px 32px 48px', maxWidth: 1000, margin: '0 auto' }}>

        <Tabs
          variant="pill"
          active={tab}
          onChange={k => setTab(k as 'resumes' | 'files')}
          tabs={[
            { key: 'resumes', label: 'My Resumes', icon: <FileText size={13} />, count: resumes?.length },
            { key: 'files', label: 'Uploaded Files', icon: <FolderOpen size={13} />, count: files.length },
          ]}
          style={{ marginBottom: 20 }}
        />

        {/* ── My Resumes tab — structured, editable, ATS-scored ── */}
        {tab === 'resumes' && (
          <>
            {resumesLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
              </div>
            )}

            {resumes?.length === 0 && !resumesLoading && (
              <EmptyState
                icon={<FileText size={28} />}
                title="No resumes yet"
                description="Upload an existing resume or create one from scratch."
                action={
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <Button size="sm" onClick={() => setShowUpload(true)}>
                      <Upload size={13} /> Upload Resume
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                      Create from Scratch
                    </Button>
                  </div>
                }
              />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
              {resumes?.map(resume => (
                <div key={resume.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div
                    onClick={() => navigate(`/app/resume/${resume.id}`)}
                    className="resume-card"
                    style={{
                      background: 'white', borderRadius: 16, padding: '20px',
                      border: resume.is_primary ? '1.5px solid rgba(26,39,68,0.25)' : '1px solid #EAECF0',
                      cursor: 'pointer', position: 'relative',
                      boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                    }}
                  >
                    {resume.is_primary && (
                      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#1A2744', fontWeight: 700 }}>
                        <Star size={10} fill="#1A2744" /> Primary
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={18} color="#1A2744" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{resume.title}</div>
                        {resume.career_track_name && (
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{resume.career_track_name}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {resume.ats_score !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              border: `2.5px solid ${atsColor(resume.ats_score)}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 800, color: atsColor(resume.ats_score),
                            }}>
                              {resume.ats_score}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#94A3B8' }}>Overall Score</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: atsColor(resume.ats_score) }}>
                                {resume.ats_score >= 80 ? 'Excellent' : resume.ats_score >= 60 ? 'Good' : 'Needs Work'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#CBD5E1' }}>No score yet</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {resume.score_breakdown && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedScore(expandedScore === resume.id ? null : resume.id) }}
                            aria-label="Toggle score breakdown"
                            title="Score breakdown"
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)', background: expandedScore === resume.id ? '#EAECF0' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <BarChart2 size={12} color={expandedScore === resume.id ? '#1A2744' : '#64748B'} />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/app/resume/${resume.id}`) }}
                          aria-label="Edit resume"
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Edit3 size={12} color="#64748B" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm('Delete this resume?')) deleteMutation.mutate(resume.id) }}
                          aria-label="Delete resume"
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={12} color="#DC2626" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedScore === resume.id && resume.score_breakdown && (
                    <div style={{ marginTop: -8, paddingTop: 8, paddingLeft: 2, paddingRight: 2 }}>
                      <ScoreBreakdownCard breakdown={resume.score_breakdown} compact />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Uploaded Files tab — raw PDF/DOCX kept as-is for job applications ── */}
        {tab === 'files' && (
          <>
            {libraryLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Loader2 size={28} color={NAVY} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {!libraryLoading && files.length === 0 && (
              <EmptyState
                icon={<FolderOpen size={28} />}
                title="No uploaded files yet"
                description="Files you upload here are kept exactly as-is, ready to attach when you apply to jobs."
                action={
                  <Button size="sm" onClick={() => setShowUpload(true)}>
                    <Upload size={13} /> Upload your first file
                  </Button>
                }
              />
            )}

            {files.length > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
                  {files.map(f => <FileCard key={f.id} file={f} />)}
                </div>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: MUTED, textAlign: 'center' }}>
                  {files.length} file{files.length !== 1 ? 's' : ''} · Max 5 MB per file
                </p>
              </>
            )}

            {files.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: `${NAVY}08`, border: `1px solid ${NAVY}18`, borderRadius: 12, padding: '12px 16px' }}>
                <Sparkles size={16} color={NAVY} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 12, color: INK_S, lineHeight: 1.5 }}>
                  <strong style={{ color: NAVY }}>Tip:</strong> When you apply for a job, Disha AI will recommend the best file from here for that role.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create dialog with template selection */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 28, width: 440, boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Create New Resume</h3>
            <input
              autoFocus
              placeholder="Resume title (e.g. Policy Consulting Resume)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createMutation.mutate()}
              style={{ width: '100%', height: 40, borderRadius: 10, border: '1.5px solid rgba(226,232,240,0.8)', padding: '0 14px', fontSize: 13, color: '#0F172A', outline: 'none', boxSizing: 'border-box', marginBottom: 18 }}
            />

            {templates && templates.length > 0 && (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Choose template</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                  {templates.map(t => {
                    const badge = TEMPLATE_BADGES[t.template_type ?? ''] ?? { label: t.template_type ?? '', color: '#64748B', bg: '#F8FAFC' }
                    const selected = selectedTemplate === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(selected ? undefined : t.id)}
                        style={{
                          padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                          border: selected ? '2px solid #1A2744' : '1.5px solid #E2E8F0',
                          background: selected ? '#EAECF0' : 'white',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800, color: selected ? '#1A2744' : '#0F172A', marginBottom: 4 }}>{t.name}</div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: badge.color, background: badge.bg, padding: '2px 5px', borderRadius: 6 }}>
                          {badge.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid rgba(226,232,240,0.8)', background: 'white', color: '#64748B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} style={{ padding: '8px 20px', borderRadius: 9, background: '#1A2744', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: createMutation.isPending ? 0.7 : 1 }}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && <ResumeUploadModal onClose={() => setShowUpload(false)} />}

      <style>{`.resume-card:hover { box-shadow: 0 16px 36px rgba(26,39,68,0.12); transform: translateY(-3px); }`}</style>
    </>
  )
}
