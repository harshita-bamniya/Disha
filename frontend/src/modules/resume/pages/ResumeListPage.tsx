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
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/resume" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="#2D6A4F" />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: 'Hind, sans-serif' }}>
              Resume Builder
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
              color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Resume
          </button>
        </header>

        <main style={{ padding: '24px 28px' }}>
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {resumes?.length === 0 && !isLoading && (
            <div style={{
              textAlign: 'center', padding: 60,
              background: 'white', borderRadius: 20,
              border: '1.5px dashed rgba(226,232,240,0.8)',
            }}>
              <FileText size={48} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                No resumes yet
              </p>
              <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
                Create your first resume and let AI optimize it for corporate roles.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: '10px 22px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                  color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                Create Resume
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {resumes?.map(resume => (
              <div
                key={resume.id}
                onClick={() => navigate(`/app/resume/${resume.id}`)}
                style={{
                  background: 'white', borderRadius: 16, padding: '20px',
                  border: resume.is_primary ? '1.5px solid rgba(45,106,79,0.3)' : '1.5px solid rgba(226,232,240,0.8)',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: '0 2px 10px rgba(15,23,42,0.05)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                {resume.is_primary && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 10, color: '#2D6A4F', fontWeight: 700,
                  }}>
                    <Star size={10} fill="#2D6A4F" /> Primary
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(45,106,79,0.1), rgba(64,145,108,0.1))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FileText size={18} color="#2D6A4F" />
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
                    background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
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
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
