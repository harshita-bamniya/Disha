import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { learningApi, type LessonOut } from '@/api/learning'
import AppSidebar from '@/components/layout/AppSidebar'
import { ArrowLeft, BookOpen, Clock, CheckCircle, ChevronDown, ChevronRight, Play, Lock } from 'lucide-react'

export default function PathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const { data: path, isLoading } = useQuery({
    queryKey: ['learning-path', pathId],
    queryFn: () => learningApi.getPathDetail(pathId!),
    enabled: !!pathId,
  })

  const enrollMutation = useMutation({
    mutationFn: () => learningApi.enrollPath(pathId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-path', pathId] })
      qc.invalidateQueries({ queryKey: ['learning-paths'] })
    },
  })

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId)
      return next
    })
  }

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/learn" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  if (!path) return null

  const completedCount = path.modules
    .flatMap(m => m.lessons)
    .filter((l: LessonOut) => l.is_completed).length
  const totalLessons = path.modules.flatMap(m => m.lessons).length
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/learn" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button onClick={() => navigate('/app/learn')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            borderRadius: 8, color: '#64748B', display: 'flex', alignItems: 'center',
          }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 14, color: '#64748B' }}>Learning Hub</span>
          <ChevronRight size={14} color="#CBD5E1" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', fontFamily: 'Hind, sans-serif' }}>
            {path.name}
          </span>
        </header>

        <main style={{ padding: '24px 28px', maxWidth: 860 }}>
          {/* Hero card */}
          <div style={{
            background: 'white', borderRadius: 20, padding: '24px 28px', marginBottom: 24,
            border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 10px rgba(15,23,42,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', fontFamily: 'Hind, sans-serif', marginBottom: 8 }}>
                  {path.name}
                </h1>
                {path.description && (
                  <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7, marginBottom: 16 }}>
                    {path.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748B' }}>
                    <Clock size={13} /> {path.estimated_hours}h estimated
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748B' }}>
                    <BookOpen size={13} /> {totalLessons} lessons
                  </span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
                    textTransform: 'capitalize',
                  }}>{path.difficulty}</span>
                </div>
              </div>

              {path.is_enrolled ? (
                <div style={{ minWidth: 160 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#64748B' }}>{completedCount}/{totalLessons} lessons</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#2D6A4F' }}>{progressPct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(45,106,79,0.1)', borderRadius: 8 }}>
                      <div style={{
                        width: `${progressPct}%`, height: '100%',
                        background: 'linear-gradient(90deg, #2D6A4F, #40916C)',
                        borderRadius: 8, transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                  {progressPct === 100 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: 12, fontWeight: 700 }}>
                      <CheckCircle size={14} /> Completed!
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => enrollMutation.mutate()}
                  disabled={enrollMutation.isPending}
                  style={{
                    padding: '10px 24px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                    opacity: enrollMutation.isPending ? 0.7 : 1,
                  }}
                >
                  <BookOpen size={14} />
                  {enrollMutation.isPending ? 'Enrolling...' : 'Enroll Now'}
                </button>
              )}
            </div>
          </div>

          {/* Modules list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {path.modules.map((mod, idx) => {
              const isExpanded = expandedModules.has(mod.id)
              const modCompleted = mod.lessons.filter((l: LessonOut) => l.is_completed).length
              const modTotal = mod.lessons.length

              return (
                <div key={mod.id} style={{
                  background: 'white', borderRadius: 16,
                  border: '1.5px solid rgba(226,232,240,0.8)',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    style={{
                      width: '100%', padding: '16px 20px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: modCompleted === modTotal && modTotal > 0
                        ? 'linear-gradient(135deg, #2D6A4F, #40916C)'
                        : 'rgba(45,106,79,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: modCompleted === modTotal && modTotal > 0 ? 'white' : '#2D6A4F',
                    }}>
                      {modCompleted === modTotal && modTotal > 0 ? <CheckCircle size={14} /> : idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{mod.title}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {modCompleted}/{modTotal} lessons completed
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={16} color="#94A3B8" /> : <ChevronRight size={16} color="#94A3B8" />}
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(226,232,240,0.6)' }}>
                      {mod.lessons.map((lesson: LessonOut, lIdx: number) => {
                        const canAccess = path.is_enrolled
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => canAccess && navigate(`/app/learn/${pathId}/lessons/${lesson.id}`)}
                            disabled={!canAccess}
                            style={{
                              width: '100%', padding: '12px 20px 12px 32px',
                              background: lesson.is_completed ? 'rgba(45,106,79,0.03)' : 'white',
                              border: 'none', borderBottom: lIdx < mod.lessons.length - 1 ? '1px solid rgba(226,232,240,0.4)' : 'none',
                              cursor: canAccess ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                            }}
                          >
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                              background: lesson.is_completed ? 'linear-gradient(135deg, #2D6A4F, #40916C)' : 'rgba(226,232,240,0.6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {lesson.is_completed
                                ? <CheckCircle size={12} color="white" />
                                : canAccess
                                ? <Play size={10} color="#64748B" />
                                : <Lock size={10} color="#94A3B8" />
                              }
                            </div>
                            <span style={{ fontSize: 12, color: canAccess ? '#0F172A' : '#94A3B8', fontWeight: 500, flex: 1 }}>
                              {lesson.title}
                            </span>
                            {lesson.duration_minutes && (
                              <span style={{ fontSize: 11, color: '#CBD5E1' }}>{lesson.duration_minutes}m</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
