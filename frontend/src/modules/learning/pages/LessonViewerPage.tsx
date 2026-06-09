import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { learningApi } from '@/api/learning'
import AppSidebar from '@/components/layout/AppSidebar'
import { ArrowLeft, ArrowRight, CheckCircle, ChevronRight, BookOpen } from 'lucide-react'

export default function LessonViewerPage() {
  const { pathId, lessonId } = useParams<{ pathId: string; lessonId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [completed, setCompleted] = useState(false)

  const { data: path } = useQuery({
    queryKey: ['learning-path', pathId],
    queryFn: () => learningApi.getPathDetail(pathId!),
    enabled: !!pathId,
  })

  const completeMutation = useMutation({
    mutationFn: () => learningApi.completeLesson(lessonId!),
    onSuccess: () => {
      setCompleted(true)
      qc.invalidateQueries({ queryKey: ['learning-path', pathId] })
      qc.invalidateQueries({ queryKey: ['learning-paths'] })
      qc.invalidateQueries({ queryKey: ['learning-streak'] })
    },
  })

  // Find current lesson and neighbours
  const allLessons = path?.modules.flatMap(m => m.lessons) ?? []
  const currentIdx = allLessons.findIndex(l => l.id === lessonId)
  const lesson = allLessons[currentIdx]
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null

  const isAlreadyCompleted = lesson?.is_completed || completed

  if (!path || !lesson) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/learn" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/learn" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Breadcrumb header */}
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 8,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button onClick={() => navigate('/app/learn')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#64748B',
          }}>
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer' }} onClick={() => navigate(`/app/learn/${pathId}`)}>
            {path.name}
          </span>
          <ChevronRight size={12} color="#CBD5E1" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{lesson.title}</span>

          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
            {currentIdx + 1} / {allLessons.length}
          </div>
        </header>

        <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', fontFamily: 'Hind, sans-serif', marginBottom: 20 }}>
              {lesson.title}
            </h1>

            {lesson.content_body ? (
              <div style={{
                fontSize: 14, color: '#1E293B', lineHeight: 1.8,
                fontFamily: 'system-ui, sans-serif',
              }}>
                {lesson.content_body.split('\n').map((para, i) => {
                  if (!para.trim()) return <div key={i} style={{ height: 12 }} />
                  if (para.startsWith('## ')) return (
                    <h2 key={i} style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '24px 0 10px' }}>
                      {para.slice(3)}
                    </h2>
                  )
                  if (para.startsWith('# ')) return (
                    <h2 key={i} style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', margin: '24px 0 10px' }}>
                      {para.slice(2)}
                    </h2>
                  )
                  if (para.startsWith('- ') || para.startsWith('* ')) return (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: '#2D6A4F', flexShrink: 0 }}>•</span>
                      <span>{para.slice(2)}</span>
                    </div>
                  )
                  return <p key={i} style={{ margin: '0 0 12px' }}>{para}</p>
                })}
              </div>
            ) : (
              <div style={{
                background: 'rgba(45,106,79,0.04)', border: '1px solid rgba(45,106,79,0.12)',
                borderRadius: 12, padding: 20, color: '#64748B', fontSize: 13,
              }}>
                Content is being prepared. Check back soon.
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(226,232,240,0.6)' }}>
              <button
                onClick={() => prevLesson && navigate(`/app/learn/${pathId}/lessons/${prevLesson.id}`)}
                disabled={!prevLesson}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: prevLesson ? 'white' : 'transparent',
                  border: prevLesson ? '1.5px solid rgba(226,232,240,0.8)' : 'none',
                  color: prevLesson ? '#64748B' : 'transparent',
                  cursor: prevLesson ? 'pointer' : 'default',
                }}
              >
                <ArrowLeft size={13} /> Previous
              </button>

              {isAlreadyCompleted ? (
                nextLesson ? (
                  <button
                    onClick={() => navigate(`/app/learn/${pathId}/lessons/${nextLesson.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                      color: 'white', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Next Lesson <ArrowRight size={13} />
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: 13, fontWeight: 700 }}>
                    <CheckCircle size={16} /> Path Complete!
                  </div>
                )
              ) : (
                <button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    opacity: completeMutation.isPending ? 0.7 : 1,
                  }}
                >
                  <CheckCircle size={13} />
                  {completeMutation.isPending ? 'Saving...' : 'Mark Complete'}
                </button>
              )}
            </div>
          </div>

          {/* Lesson list sidebar */}
          <div style={{
            width: 240, borderLeft: '1px solid rgba(226,232,240,0.8)',
            background: 'white', overflow: 'auto', flexShrink: 0,
          }}>
            <div style={{ padding: '16px 16px 8px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Lessons
            </div>
            {path.modules.flatMap(m => m.lessons).map((l, idx) => {
              const isActive = l.id === lessonId
              return (
                <button
                  key={l.id}
                  onClick={() => navigate(`/app/learn/${pathId}/lessons/${l.id}`)}
                  style={{
                    width: '100%', padding: '10px 16px',
                    background: isActive ? 'rgba(45,106,79,0.06)' : 'none',
                    border: 'none', borderLeft: isActive ? '3px solid #2D6A4F' : '3px solid transparent',
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: l.is_completed ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : isActive ? 'rgba(45,106,79,0.12)' : 'rgba(226,232,240,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: l.is_completed ? 'white' : '#64748B', fontWeight: 700,
                  }}>
                    {l.is_completed ? <CheckCircle size={10} /> : idx + 1}
                  </div>
                  <span style={{ fontSize: 11, color: isActive ? '#0F172A' : '#64748B', fontWeight: isActive ? 700 : 400, lineHeight: 1.4 }}>
                    {l.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
