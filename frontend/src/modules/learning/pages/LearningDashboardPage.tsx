import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { learningApi, type LearningPathSummary } from '@/api/learning'
import AppSidebar from '@/components/layout/AppSidebar'
import { ActivePrepBanner } from '@/components/ActivePrepBanner'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { BookOpen, Flame, ChevronRight, Clock, BarChart2, CheckCircle, Lock, Target } from 'lucide-react'

const DIFFICULTY_COLORS: Record<string, [string, string]> = {
  beginner:     ['#10B981', '#34D399'],
  intermediate: ['#3B82F6', '#60A5FA'],
  advanced:     ['#8B5CF6', '#A78BFA'],
}

function PathCard({ path, onEnroll, isEnrolling }: {
  path: LearningPathSummary
  onEnroll: () => void
  isEnrolling: boolean
}) {
  const navigate = useNavigate()
  const [c1, c2] = DIFFICULTY_COLORS[path.difficulty || 'beginner'] || DIFFICULTY_COLORS.beginner
  const [hov, setHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'white' : 'rgba(255,255,255,0.92)',
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        border: hov ? `1.5px solid ${c1}30` : '1.5px solid rgba(226,232,240,0.8)',
        boxShadow: hov ? `0 12px 32px ${c1}18` : '0 2px 10px rgba(15,23,42,0.05)',
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.34,1.1,0.64,1)',
      }}
      onClick={() => navigate(`/app/learn/${path.id}`)}
    >
      <div style={{ height: 4, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{
            fontSize: 14, fontWeight: 800, color: '#0F172A',
            fontFamily: 'Hind, sans-serif', lineHeight: 1.3, flex: 1, paddingRight: 8,
          }}>{path.name}</h3>
          <span style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0,
            background: `${c1}12`, color: c1, border: `1px solid ${c1}22`,
            textTransform: 'capitalize',
          }}>{path.difficulty}</span>
        </div>

        {path.description && (
          <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, marginBottom: 12,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {path.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}>
            <Clock size={11} /> {path.estimated_hours}h
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}>
            <BookOpen size={11} /> {path.total_lessons} lessons
          </span>
          {path.career_track_name && (
            <span style={{ fontSize: 11, color: c1, fontWeight: 600 }}>{path.career_track_name}</span>
          )}
        </div>

        {path.is_enrolled ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  {path.completed_lessons}/{path.total_lessons} lessons
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c1 }}>{path.progress_pct}%</span>
              </div>
              <div style={{ height: 6, background: `${c1}15`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${path.progress_pct}%`, height: '100%',
                  background: `linear-gradient(90deg, ${c1}, ${c2})`,
                  borderRadius: 6, transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); navigate(`/app/learn/${path.id}`) }}
              style={{
                width: '100%', height: 34, borderRadius: 9,
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                color: 'white', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              {path.status === 'completed' ? <><CheckCircle size={12} /> Completed</> : <>Continue <ChevronRight size={12} /></>}
            </button>
          </>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onEnroll() }}
            disabled={isEnrolling}
            style={{
              width: '100%', height: 34, borderRadius: 9, fontSize: 12, fontWeight: 700,
              background: 'white', border: `1.5px solid ${c1}30`, color: c1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'all 0.2s',
            }}
          >
            <BookOpen size={11} /> Enroll
          </button>
        )}
      </div>
    </div>
  )
}

export default function LearningDashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: allPaths, isLoading } = useQuery({
    queryKey: ['learning-paths'],
    queryFn: learningApi.getAllPaths,
  })
  const { data: streakData } = useQuery({
    queryKey: ['learning-streak'],
    queryFn: learningApi.getStreak,
  })

  const enrollMutation = useMutation({
    mutationFn: (pathId: string) => learningApi.enrollPath(pathId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-paths'] })
    },
  })

  const { activePrep } = useActivePrepJob()

  const enrolledPaths = allPaths?.filter(p => p.is_enrolled) ?? []
  const availablePaths = allPaths?.filter(p => !p.is_enrolled) ?? []

  // If there's an active prep job with a matched track, surface those paths first
  const recommendedPaths = activePrep?.matched_track_slug
    ? availablePaths.filter(p =>
        p.career_track_slug === activePrep.matched_track_slug ||
        activePrep.skills_to_develop.some(sk =>
          p.name?.toLowerCase().includes(sk.toLowerCase()) ||
          p.description?.toLowerCase().includes(sk.toLowerCase())
        )
      )
    : []
  const otherPaths = availablePaths.filter(p => !recommendedPaths.find(r => r.id === p.id))

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/learn" />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="#2D6A4F" />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: 'Hind, sans-serif' }}>
              Learning Hub
            </span>
          </div>
          {streakData && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 20, padding: '6px 14px',
            }}>
              <Flame size={14} color="#D97706" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#D97706', fontFamily: 'Hind, sans-serif' }}>
                {streakData.current_streak} day streak
              </span>
            </div>
          )}
        </header>

        <main style={{ padding: '24px 28px' }}>
          <ActivePrepBanner showSwitch />

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {/* Enrolled paths */}
          {enrolledPaths.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #2D6A4F, #40916C)', borderRadius: 4 }} />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>My Learning Paths</h2>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{enrolledPaths.length} enrolled</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {enrolledPaths.map(p => (
                  <PathCard
                    key={p.id} path={p}
                    onEnroll={() => {}}
                    isEnrolling={false}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recommended paths for active prep job */}
          {recommendedPaths.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #10B981, #059669)', borderRadius: 4 }} />
                <Target size={14} color="#059669" />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                  Recommended for {activePrep?.job_title}
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {recommendedPaths.map(p => (
                  <PathCard
                    key={p.id} path={p}
                    onEnroll={() => enrollMutation.mutate(p.id)}
                    isEnrolling={enrollMutation.isPending && enrollMutation.variables === p.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Available paths */}
          {(otherPaths.length > 0 || (availablePaths.length > 0 && recommendedPaths.length === 0)) && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #3B82F6, #6366F1)', borderRadius: 4 }} />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Explore Learning Paths</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {(recommendedPaths.length > 0 ? otherPaths : availablePaths).map(p => (
                  <PathCard
                    key={p.id} path={p}
                    onEnroll={() => enrollMutation.mutate(p.id)}
                    isEnrolling={enrollMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}

          {!isLoading && allPaths?.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <BookOpen size={48} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Learning paths coming soon</p>
              <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                Complete your career assessment first to get personalized paths.
              </p>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
