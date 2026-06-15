import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, Clock, ChevronRight, Loader2 } from 'lucide-react'
import { learningApi } from '@/api/learning'
import type { RoadmapOut } from '@/api/roadmap'

interface Props {
  roadmap: RoadmapOut
}

function difficultyColor(d: string | null): { bg: string; text: string } {
  switch (d?.toLowerCase()) {
    case 'beginner': return { bg: '#DCFCE7', text: '#166534' }
    case 'intermediate': return { bg: '#FEF9C3', text: '#854D0E' }
    case 'advanced': return { bg: '#FEE2E2', text: '#991B1B' }
    default: return { bg: '#F1F5F9', text: '#475569' }
  }
}

export default function LearningPathsPanel({ roadmap }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: paths, isLoading, isError } = useQuery({
    queryKey: ['learning-paths'],
    queryFn: learningApi.getAllPaths,
  })

  const enrollMutation = useMutation({
    mutationFn: (pathId: string) => learningApi.enrollPath(pathId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-paths'] }),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: '#94A3B8', fontSize: 13 }}>
        <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
        Loading learning paths…
      </div>
    )
  }

  if (isError || !paths) {
    return (
      <p style={{ fontSize: 13, color: '#EF4444', padding: '12px 0' }}>
        Failed to load learning paths. Please refresh.
      </p>
    )
  }

  // Prioritise enrolled paths first, then paths that cover gap skills
  const gapSkills = new Set((roadmap.gap_skills ?? []).map(s => s.toLowerCase()))
  const sorted = [...paths].sort((a, b) => {
    const aEnrolled = a.is_enrolled ? -2 : 0
    const bEnrolled = b.is_enrolled ? -2 : 0
    const aGap = a.gap_skills_covered?.some(s => gapSkills.has(s.toLowerCase())) ? -1 : 0
    const bGap = b.gap_skills_covered?.some(s => gapSkills.has(s.toLowerCase())) ? -1 : 0
    return (aEnrolled + aGap) - (bEnrolled + bGap)
  })

  if (sorted.length === 0) {
    return (
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <BookOpen size={28} color="#CBD5E1" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: '#94A3B8' }}>No learning paths available yet.</p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
        Complete these paths to build the skills needed for your target career track.
        {roadmap.gap_skills?.length ? ` ${roadmap.gap_skills.length} skill gaps identified.` : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(path => {
          const dc = difficultyColor(path.difficulty)
          const coversGap = path.gap_skills_covered?.some(s => gapSkills.has(s.toLowerCase()))

          return (
            <div
              key={path.id}
              style={{
                background: path.is_enrolled ? 'rgba(45,106,79,0.04)' : '#FAFAFA',
                border: path.is_enrolled ? '1px solid rgba(45,106,79,0.18)' : '1px solid #E2E8F0',
                borderRadius: 12, padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                      {path.name}
                    </span>
                    {path.difficulty && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: dc.bg, color: dc.text }}>
                        {path.difficulty}
                      </span>
                    )}
                    {coversGap && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' }}>
                        Covers skill gap
                      </span>
                    )}
                  </div>

                  {path.description && (
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0', lineHeight: 1.5 }}>
                      {path.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {path.estimated_hours}h
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BookOpen size={11} /> {path.total_lessons} lessons
                    </span>
                    {path.is_enrolled && (
                      <span style={{ fontSize: 11, color: '#2D6A4F', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCircle2 size={11} /> {path.completed_lessons}/{path.total_lessons} done
                      </span>
                    )}
                  </div>

                  {path.is_enrolled && path.progress_pct > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 4, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${path.progress_pct}%`,
                          background: path.progress_pct === 100 ? '#22C55E' : '#2D6A4F',
                          borderRadius: 4, transition: 'width 0.4s',
                        }} />
                      </div>
                      <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{path.progress_pct}% complete</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {path.is_enrolled ? (
                    <button
                      onClick={() => navigate(`/app/learn/${path.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'linear-gradient(135deg, #2D6A4F, #40916C)', color: 'white',
                        border: 'none', borderRadius: 8, padding: '7px 14px',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {path.progress_pct === 100 ? 'Review' : 'Continue'} <ChevronRight size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => enrollMutation.mutate(path.id)}
                      disabled={enrollMutation.isPending}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: '#fff', color: '#2D6A4F',
                        border: '1.5px solid #2D6A4F', borderRadius: 8, padding: '7px 14px',
                        fontSize: 12, fontWeight: 700, cursor: enrollMutation.isPending ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap', opacity: enrollMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      {enrollMutation.isPending ? 'Enrolling…' : 'Enroll'} <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => navigate('/app/learn')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 16,
          background: 'none', border: 'none', color: '#2D6A4F',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
        }}
      >
        <BookOpen size={13} /> View full Learning Hub <ChevronRight size={13} />
      </button>
    </div>
  )
}
