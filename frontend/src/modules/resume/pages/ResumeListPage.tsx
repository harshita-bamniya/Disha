import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi } from '@/api/resume'
import AppSidebar from '@/components/layout/AppSidebar'
import { FileText, Plus, Star, Trash2, Edit3, ChevronRight } from 'lucide-react'

export default function ResumeListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: resumeApi.listResumes,
  })

  const createMutation = useMutation({
    mutationFn: () => resumeApi.createResume({ title: newTitle || 'My Resume' }),
    onSuccess: (resume) => {
      qc.invalidateQueries({ queryKey: ['resumes'] })
      setShowCreate(false)
      setNewTitle('')
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
    <div style={{ minHeight: '100vh', background: '#FAFBFD', display: 'flex' }}>
      <AppSidebar activePath="/app/resume" />
      <div style={{ flex: 1, minWidth: 0, background: '#FAFBFD' }}>
        <header style={{
          background: 'white',
          borderBottom: '1px solid #F1F5F9',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              Resume Builder
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
              background: 'white',
              color: '#2563EB', border: '1.5px solid #BFDBFE', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.08)', transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)' }}
          >
            <Plus size={14} /> New Resume
          </button>
        </header>

        <main style={{ padding: '28px 32px 48px', maxWidth: 1000, margin: '0 auto' }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {resumes?.length === 0 && !isLoading && (
            <div style={{
              textAlign: 'center', padding: 60,
              background: 'white', borderRadius: 16,
              border: '1px dashed #E2E8F0',
            }}>
              <FileText size={40} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                No resumes yet
              </p>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>
                Create your first resume and let AI optimize it for corporate roles.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: '10px 22px', borderRadius: 10,
                  background: 'white',
                  color: '#2563EB', border: '1.5px solid #BFDBFE', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                Create Resume
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {resumes?.map(resume => (
              <div
                key={resume.id}
                onClick={() => navigate(`/app/resume/${resume.id}`)}
                className="resume-card"
                style={{
                  background: 'white', borderRadius: 16, padding: '20px',
                  border: resume.is_primary ? '1.5px solid #BFDBFE' : '1px solid #EEF2F9',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
              >
                {resume.is_primary && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 10, color: '#2563EB', fontWeight: 700,
                  }}>
                    <Star size={10} fill="#2563EB" /> Primary
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FileText size={18} color="#2563EB" />
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
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>ATS Score</div>
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
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/app/resume/${resume.id}`) }}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Edit3 size={12} color="#64748B" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm('Delete this resume?')) deleteMutation.mutate(resume.id)
                      }}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(226,232,240,0.8)',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={12} color="#DC2626" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Create dialog */}
        {showCreate && (
          <div
            onClick={() => setShowCreate(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: 20, padding: 28, width: 380,
                boxShadow: '0 24px 64px rgba(15,23,42,0.2)',
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 16, fontFamily: 'Hind, sans-serif' }}>
                Create New Resume
              </h3>
              <input
                autoFocus
                placeholder="Resume title (e.g. Policy Consulting Resume)"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createMutation.mutate()}
                style={{
                  width: '100%', height: 40, borderRadius: 10, border: '1.5px solid rgba(226,232,240,0.8)',
                  padding: '0 14px', fontSize: 13, color: '#0F172A', outline: 'none',
                  boxSizing: 'border-box', marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 9, border: '1.5px solid rgba(226,232,240,0.8)',
                    background: 'white', color: '#64748B', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  style={{
                    padding: '8px 20px', borderRadius: 9,
                    background: '#2563EB',
                    color: 'white', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                    opacity: createMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .resume-card:hover { box-shadow: 0 16px 36px rgba(37,99,235,0.14); transform: translateY(-3px); }
      `}</style>
    </div>
  )
}
