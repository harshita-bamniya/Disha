/**
 * Stage 3 — Applied Practice exercise panel.
 *
 * Fetches exercise/quiz/case_study lessons from all enrolled paths via a single
 * backend endpoint, lets users respond inline, self-grade (0-100), and submit.
 * Submissions call complete_lesson → skill competence + XP hooks fire on backend.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { learningApi, type ExerciseLesson } from '@/api/learning'
import type { RoadmapOut } from '@/api/roadmap'
import {
  CheckCircle, BookOpen, Send, Loader, ChevronDown, ChevronUp,
  ArrowRight, Zap, Brain,
} from 'lucide-react'

interface ExercisePanelProps {
  roadmap: RoadmapOut
}

const TYPE_LABEL: Record<string, string> = {
  exercise: 'Exercise', case_study: 'Case Study', quiz: 'Quiz',
}
const TYPE_COLOR: Record<string, string> = {
  exercise: '#3B82F6', case_study: '#8B5CF6', quiz: '#F59E0B',
}

export default function ExercisePanel({ roadmap }: ExercisePanelProps) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [localDone, setLocalDone] = useState<Set<string>>(new Set())
  const [formError, setFormError] = useState<Record<string, string>>({})

  const { data: exercises = [], isLoading } = useQuery<ExerciseLesson[]>({
    queryKey: ['exercises'],
    queryFn: learningApi.getExercises,
    staleTime: 2 * 60 * 1000,
  })

  const completeLesson = useMutation({
    mutationFn: ({ lessonId, score }: { lessonId: string; score: number }) =>
      learningApi.completeLesson(lessonId, 300, score),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['roadmap'] })
      qc.invalidateQueries({ queryKey: ['exercises'] })
      qc.invalidateQueries({ queryKey: ['jrs'] })
      setLocalDone(prev => new Set([...prev, vars.lessonId]))
      setActiveId(null)
    },
    onError: (_, vars) => {
      setFormError(prev => ({ ...prev, [vars.lessonId]: 'Submission failed. Please try again.' }))
    },
  })

  function handleSubmit(lessonId: string) {
    const answer = (answers[lessonId] ?? '').trim()
    if (answer.length < 50) {
      setFormError(prev => ({ ...prev, [lessonId]: 'Write at least 50 characters.' }))
      return
    }
    setFormError(prev => ({ ...prev, [lessonId]: '' }))
    completeLesson.mutate({ lessonId, score: scores[lessonId] ?? 70 })
  }

  // Gate progress
  const stageEntry = roadmap.stages.find(s => s.stage_number === 3)
  const exercisesDone: number = (stageEntry?.progress as any)?.exercises_completed ?? 0
  const exercisesTarget = 3

  return (
    <div>
      {/* Gate progress header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F' }}>Applied Practice</p>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            Apply skills through exercises, case studies, and quizzes
          </p>
        </div>
        <div style={{
          background: exercisesDone >= exercisesTarget ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.08)',
          border: `1px solid ${exercisesDone >= exercisesTarget ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.2)'}`,
          borderRadius: 20, padding: '5px 12px',
          fontSize: 12, fontWeight: 700,
          color: exercisesDone >= exercisesTarget ? '#16A34A' : '#F97316',
        }}>
          {exercisesDone} / {exercisesTarget} done
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 100, height: 5, marginBottom: 18 }}>
        <div style={{
          height: '100%', borderRadius: 100,
          width: `${Math.min(100, (exercisesDone / exercisesTarget) * 100)}%`,
          background: exercisesDone >= exercisesTarget
            ? 'linear-gradient(90deg,#22C55E,#16A34A)'
            : 'linear-gradient(90deg,#F97316,#EA580C)',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94A3B8', padding: '12px 0' }}>
          <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Loading exercises…</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && exercises.length === 0 && (
        <div style={{
          background: 'rgba(59,130,246,0.03)', border: '1px dashed rgba(59,130,246,0.18)',
          borderRadius: 14, padding: '24px 20px', textAlign: 'center',
        }}>
          <Brain size={28} color="#CBD5E1" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            No exercises found in your enrolled paths
          </p>
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, maxWidth: 340, margin: '0 auto 16px' }}>
            Enroll in a learning path that contains exercises, case studies, or quizzes to unlock Stage 3 gate progress.
          </p>
          <button
            onClick={() => navigate('/app/learn')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 10,
              background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            Browse Learning Paths <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Exercise list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map(ex => {
          const isDone = ex.is_completed || localDone.has(ex.lesson_id)
          const isOpen = activeId === ex.lesson_id
          const color = TYPE_COLOR[ex.content_type] ?? '#6B7280'
          const label = TYPE_LABEL[ex.content_type] ?? ex.content_type
          const answer = answers[ex.lesson_id] ?? ''
          const score = scores[ex.lesson_id] ?? 70
          const submitting = completeLesson.isPending && completeLesson.variables?.lessonId === ex.lesson_id

          return (
            <div key={ex.lesson_id} style={{
              border: `1px solid ${isDone ? 'rgba(34,197,94,0.25)' : isOpen ? 'rgba(59,130,246,0.28)' : 'rgba(226,232,240,0.8)'}`,
              borderRadius: 14, overflow: 'hidden',
              background: isDone ? 'rgba(34,197,94,0.03)' : 'white',
            }}>
              {/* Row header */}
              <button
                onClick={() => !isDone && setActiveId(isOpen ? null : ex.lesson_id)}
                style={{
                  width: '100%', padding: '13px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'transparent', border: 'none',
                  cursor: isDone ? 'default' : 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isDone
                    ? <CheckCircle size={15} color="#22C55E" />
                    : <BookOpen size={15} color={color} />
                  }
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        color, background: `${color}12`, padding: '1px 6px', borderRadius: 20, letterSpacing: '0.4px',
                      }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{ex.path_name}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#6B7280' : '#1E3A5F', margin: 0 }}>
                      {ex.lesson_title}
                    </p>
                    {ex.skill_focus && (
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                        Skill: {ex.skill_focus}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isDone && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={11} /> Done
                    </span>
                  )}
                  {!isDone && (isOpen
                    ? <ChevronUp size={14} color="#94A3B8" />
                    : <ChevronDown size={14} color="#94A3B8" />
                  )}
                </div>
              </button>

              {/* Expanded form */}
              {isOpen && !isDone && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(226,232,240,0.6)' }}>
                  {/* Prompt */}
                  {ex.content_body ? (
                    <div style={{
                      background: 'rgba(248,250,252,0.9)', borderRadius: 10,
                      padding: '12px 14px', margin: '12px 0',
                      border: '1px solid rgba(226,232,240,0.7)',
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Prompt</p>
                      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{ex.content_body}</p>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: '12px 0 8px', fontStyle: 'italic' }}>
                      Apply {ex.skill_focus ?? roadmap.gap_skills?.[0] ?? 'this skill'} to a real-world scenario from your experience.
                    </p>
                  )}

                  {/* Answer */}
                  <textarea
                    placeholder="Use the STAR method — Situation, Task, Action, Result. Include specific metrics and outcomes where possible."
                    value={answer}
                    onChange={e => {
                      setAnswers(prev => ({ ...prev, [ex.lesson_id]: e.target.value }))
                      if (formError[ex.lesson_id]) setFormError(prev => ({ ...prev, [ex.lesson_id]: '' }))
                    }}
                    rows={6}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: `1.5px solid ${formError[ex.lesson_id] ? '#EF4444' : 'rgba(59,130,246,0.18)'}`,
                      fontSize: 13, color: '#1E3A5F', lineHeight: 1.6,
                      resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                      background: 'white', boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ fontSize: 11, color: answer.length < 50 ? '#EF4444' : '#94A3B8', margin: '4px 0 12px' }}>
                    {answer.length} / 50 minimum characters
                  </p>

                  {/* Self-grade + submit row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                        Self-grade:
                      </label>
                      <input
                        type="number" min={0} max={100} value={score}
                        onChange={e => setScores(prev => ({
                          ...prev,
                          [ex.lesson_id]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        }))}
                        style={{
                          width: 60, padding: '6px 10px', borderRadius: 8,
                          border: '1.5px solid rgba(59,130,246,0.18)',
                          fontSize: 13, color: '#1E3A5F', textAlign: 'center', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>/ 100</span>
                    </div>

                    <button
                      onClick={() => handleSubmit(ex.lesson_id)}
                      disabled={submitting || answer.trim().length < 50}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 18px', borderRadius: 10,
                        background: answer.trim().length >= 50
                          ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : '#E5E7EB',
                        color: answer.trim().length >= 50 ? 'white' : '#9CA3AF',
                        border: 'none',
                        cursor: answer.trim().length >= 50 && !submitting ? 'pointer' : 'not-allowed',
                        fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                      }}
                    >
                      {submitting
                        ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
                        : <><Send size={12} /> Submit</>
                      }
                    </button>

                    <button
                      onClick={() => setActiveId(null)}
                      style={{ fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>

                  {formError[ex.lesson_id] && (
                    <p style={{ fontSize: 12, color: '#EF4444', marginTop: 8 }}>{formError[ex.lesson_id]}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {exercises.length > 0 && (
        <button
          onClick={() => navigate('/app/learn')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: '#3B82F6',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '14px 0 0', marginTop: 4,
          }}
        >
          <BookOpen size={13} />
          More exercises in the Learning Hub <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}
