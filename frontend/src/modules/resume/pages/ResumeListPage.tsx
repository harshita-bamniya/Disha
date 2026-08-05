import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi } from '@/api/resume'
import AspLayout from '@/shared/layouts/AspLayout'
import ResumeUploadModal from '@/modules/resume/components/ResumeUploadModal'
import ScoreBreakdownCard from '@/modules/resume/components/ScoreBreakdownCard'
import { FileText, Plus, Star, Trash2, Edit3, Upload, BarChart2, ChevronDown } from 'lucide-react'

const TEMPLATE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  ats_clean: { label: 'ATS Friendly',     color: '#16A34A', bg: '#F0FDF4' },
  modern:    { label: 'ATS Risk: Medium', color: '#D97706', bg: '#FFFBEB' },
  hybrid:    { label: 'ATS Risk: Low',    color: '#0284C7', bg: '#F0F9FF' },
  executive: { label: 'Executive',        color: '#7C3AED', bg: '#F3E8FF' },
}

export default function ResumeListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined)
  const [expandedScore, setExpandedScore] = useState<string | null>(null)

  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: resumeApi.listResumes,
  })

  const { data: templates } = useQuery({
    queryKey: ['resume-templates'],
    queryFn: resumeApi.getTemplates,
  })

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
    <AspLayout activePath="/app/resume">
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A2744', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Resume Builder</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
                background: 'white', color: '#1A2744', border: '1.5px solid rgba(26,39,68,0.2)',
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,39,68,0.06)',
              }}
            >
              <Upload size={13} /> Upload Resume
            </button>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
                background: '#1A2744', color: 'white', border: 'none',
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,39,68,0.2)',
              }}
            >
              <Plus size={14} /> New Resume
            </button>
          </div>
        </header>

        <main style={{ padding: '28px 32px 48px', maxWidth: 1000, margin: '0 auto' }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #1A2744', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {resumes?.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 16, border: '1px dashed #E2E8F0' }}>
              <FileText size={40} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>No resumes yet</p>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>
                Upload an existing resume or create one from scratch.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => setShowUpload(true)}
                  style={{ padding: '10px 22px', borderRadius: 10, background: '#1A2744', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  Upload Resume
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  style={{ padding: '10px 22px', borderRadius: 10, background: 'white', color: '#1A2744', border: '1.5px solid rgba(26,39,68,0.2)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  Create from Scratch
                </button>
              </div>
            </div>
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
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)', background: expandedScore === resume.id ? '#EAECF0' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Score breakdown"
                        >
                          <BarChart2 size={12} color={expandedScore === resume.id ? '#1A2744' : '#64748B'} />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/app/resume/${resume.id}`) }}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Edit3 size={12} color="#64748B" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); if (confirm('Delete this resume?')) deleteMutation.mutate(resume.id) }}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={12} color="#DC2626" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded score breakdown */}
                {expandedScore === resume.id && resume.score_breakdown && (
                  <div style={{ marginTop: -8, paddingTop: 8, paddingLeft: 2, paddingRight: 2 }}>
                    <ScoreBreakdownCard breakdown={resume.score_breakdown} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
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

              {/* Template selection */}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .resume-card:hover { box-shadow: 0 16px 36px rgba(26,39,68,0.12); transform: translateY(-3px); }
      `}</style>
    </AspLayout>
  )
}
