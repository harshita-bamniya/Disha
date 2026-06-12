import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { learningApi, type LearningPathSummary } from '@/api/learning'
import { counsellorApi } from '@/api/counsellor'
import AppSidebar from '@/components/layout/AppSidebar'
import { ActivePrepBanner } from '@/components/ActivePrepBanner'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { BookOpen, Flame, ChevronRight, Clock, BarChart2, CheckCircle, Lock, Target, Zap, BrainCircuit, ArrowRight, RefreshCw } from 'lucide-react'

const DIFFICULTY_COLORS: Record<string, [string, string]> = {
  beginner:     ['#10B981', '#34D399'],
  intermediate: ['#3B82F6', '#60A5FA'],
  advanced:     ['#8B5CF6', '#A78BFA'],
}

// ─── Skill Gap Card ────────────────────────────────────────────────────────────
function SkillGapCard({ skill, jobId, jobTitle, company, sector }: {
  skill: string
  jobId: string
  jobTitle: string
  company: string
  sector: string
}) {
  const navigate = useNavigate()
  const [hov, setHov] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLearn() {
    setLoading(true)
    try {
      const conv = await counsellorApi.createSkillConversation({
        skillFocus: skill,
        jobId,
        jobTitle,
        company,
        sector,
      })
      navigate(`/app/counsellor/${conv.id}`)
    } catch (err) {
      console.error('Failed to create skill conversation', err)
      setLoading(false)
    }
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#FFFBF5' : 'rgba(255,255,255,0.95)',
        borderRadius: 18,
        border: hov ? '1.5px solid #FDBA74' : '1.5px solid rgba(226,232,240,0.8)',
        boxShadow: hov ? '0 10px 28px rgba(251,146,60,0.12)' : '0 2px 10px rgba(15,23,42,0.05)',
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.22s cubic-bezier(0.34,1.1,0.64,1)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
          border: '1px solid #FED7AA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BrainCircuit size={18} color="#EA580C" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: 14, fontWeight: 800, color: '#0F172A',
            fontFamily: 'Hind, sans-serif', lineHeight: 1.3, marginBottom: 3,
          }}>
            {skill}
          </h3>
          <span style={{
            fontSize: 11, color: '#94A3B8', fontWeight: 500,
          }}>
            Needed for {jobTitle}
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
          background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A',
          flexShrink: 0,
        }}>
          Gap
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
        AI coach will teach you <strong style={{ color: '#0F172A' }}>{skill}</strong> specifically
        for the {jobTitle} role at {company}.
      </p>

      {/* CTA */}
      <button
        onClick={handleLearn}
        disabled={loading}
        style={{
          width: '100%', height: 36, borderRadius: 10, border: 'none',
          background: loading
            ? '#E2E8F0'
            : 'linear-gradient(135deg, #F97316, #EA580C)',
          color: loading ? '#94A3B8' : 'white',
          fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.2s',
        }}
      >
        {loading ? (
          <>
            <div style={{ width: 12, height: 12, border: '2px solid #CBD5E1', borderTopColor: '#64748B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Opening...
          </>
        ) : (
          <>
            <Zap size={12} /> Learn with AI <ArrowRight size={11} />
          </>
        )}
      </button>
    </div>
  )
}

// ─── Path Card ─────────────────────────────────────────────────────────────────
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
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
  const { data: dueReviews } = useQuery({
    queryKey: ['learning-due-reviews'],
    queryFn: learningApi.getDueReviews,
  })

  const enrollMutation = useMutation({
    mutationFn: (pathId: string) => learningApi.enrollPath(pathId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-paths'] })
    },
  })

  const { activePrep } = useActivePrepJob()

  const [quickMode, setQuickMode] = useState(false)

  const enrolledPaths = allPaths?.filter(p => p.is_enrolled) ?? []
  const enrolledIds = new Set(enrolledPaths.map(p => p.id))
  const otherPaths = (allPaths ?? []).filter(p => !enrolledIds.has(p.id))

  // Quick mode: only show paths ≤2 estimated hours (roughly 15-30 min sessions)
  const filterPaths = <T extends { estimated_hours?: number }>(paths: T[]) =>
    quickMode ? paths.filter(p => (p.estimated_hours ?? 99) <= 2) : paths
  const filteredEnrolled = filterPaths(enrolledPaths)
  const filteredOther = filterPaths(otherPaths)

  // Gap skills from active prep — these drive the AI skill cards
  const gapSkills: string[] = activePrep?.skills_to_develop ?? []

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setQuickMode(q => !q)}
              title="Show only paths under 2 hours — perfect for 15-minute daily sessions"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: quickMode ? 'rgba(16,185,129,0.1)' : 'white',
                border: quickMode ? '1.5px solid #10B981' : '1.5px solid rgba(226,232,240,0.9)',
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Clock size={12} color={quickMode ? '#10B981' : '#94A3B8'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: quickMode ? '#10B981' : '#64748B' }}>
                Quick (≤2h)
              </span>
            </button>
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
          </div>
        </header>

        <main style={{ padding: '24px 28px' }}>
          <ActivePrepBanner showSwitch />

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(45,106,79,0.2)', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {/* ── Skill Gap Cards (AI-driven, per active prep job) ── */}
          {activePrep && gapSkills.length > 0 && (
            <section style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #F97316, #EA580C)', borderRadius: 4 }} />
                <Target size={14} color="#EA580C" />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                  Skills to Build — {activePrep.job_title}
                </h2>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>
                  at {activePrep.company_name}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16, marginLeft: 12 }}>
                Click any skill to open a dedicated AI coaching session that teaches it in the context of this specific job.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {gapSkills.map(skill => (
                  <SkillGapCard
                    key={skill}
                    skill={skill}
                    jobId={activePrep.job_id}
                    jobTitle={activePrep.job_title}
                    company={activePrep.company_name}
                    sector={activePrep.sector}
                  />
                ))}
              </div>
            </section>
          )}

          {/* No gap skills — show a prompt to set a prep job */}
          {!activePrep && !isLoading && (
            <div style={{
              background: 'linear-gradient(135deg, #FFF7ED, #FFFBF5)',
              border: '1.5px solid #FED7AA',
              borderRadius: 16, padding: '20px 24px',
              marginBottom: 32,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <Target size={28} color="#EA580C" />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Set an active prep job to see personalised skill cards
                </p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                  Go to Jobs → choose a job → Start Prep. AI coaching cards will appear here based on your skill gap.
                </p>
              </div>
            </div>
          )}

          {/* Spaced repetition — due reviews */}
          {dueReviews && dueReviews.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #8B5CF6, #A78BFA)', borderRadius: 4 }} />
                <RefreshCw size={14} color="#7C3AED" />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Due for Review</h2>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{dueReviews.length} lesson{dueReviews.length > 1 ? 's' : ''}</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 14, marginLeft: 12 }}>
                Spaced repetition: revisit these lessons now to lock in what you learned.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dueReviews.map(r => (
                  <div
                    key={r.lesson_id}
                    onClick={() => r.path_id && navigate(`/app/learn/${r.path_id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'white', borderRadius: 12, padding: '12px 16px',
                      border: '1.5px solid rgba(139,92,246,0.2)',
                      cursor: r.path_id ? 'pointer' : 'default',
                      boxShadow: '0 1px 6px rgba(139,92,246,0.07)',
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { if (r.path_id) e.currentTarget.style.borderColor = '#8B5CF6' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <RefreshCw size={14} color="#7C3AED" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.lesson_title}</p>
                      <p style={{ fontSize: 11, color: '#94A3B8' }}>{r.path_name} · {r.review_interval_days}-day review</p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                      background: r.days_overdue > 1 ? '#FEE2E2' : '#EDE9FE',
                      color: r.days_overdue > 1 ? '#DC2626' : '#7C3AED',
                    }}>
                      {r.days_overdue > 0 ? `${r.days_overdue}d overdue` : 'Due today'}
                    </span>
                    <ChevronRight size={14} color="#CBD5E1" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Enrolled paths */}
          {filteredEnrolled.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #2D6A4F, #40916C)', borderRadius: 4 }} />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>My Learning Paths</h2>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{filteredEnrolled.length} enrolled</span>
                {quickMode && enrolledPaths.length !== filteredEnrolled.length && (
                  <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>({enrolledPaths.length - filteredEnrolled.length} hidden by Quick filter)</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {filteredEnrolled.map(p => (
                  <PathCard key={p.id} path={p} onEnroll={() => {}} isEnrolling={false} />
                ))}
              </div>
            </section>
          )}

          {/* All other paths */}
          {filteredOther.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #3B82F6, #6366F1)', borderRadius: 4 }} />
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Explore Learning Paths</h2>
                {quickMode && <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>showing quick paths only</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {filteredOther.map(p => (
                  <PathCard
                    key={p.id} path={p}
                    onEnroll={() => enrollMutation.mutate(p.id)}
                    isEnrolling={enrollMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}

          {!isLoading && (allPaths?.length === 0) && !activePrep && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <BookOpen size={48} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>No learning paths yet</p>
              <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                Set an active prep job to see AI-powered skill coaching cards.
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
