import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlayCircle, ExternalLink, CheckCircle2, Circle,
  Zap, RefreshCw, Loader2, AlertCircle, ChevronDown,
  ChevronUp, Target, Save, Check, Sparkles, X, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { attachSchedule, jobPlanApi, type GenerationDetail, type GenerationStep, type PlanModule, type PlanResource, type QuizProgress, type VideoRating } from '@/api/jobPlan'
import type { RoadmapOut } from '@/api/roadmap'
import { useOnboardingProfile } from '@/modules/onboarding/hooks/useOnboarding'

interface Props {
  roadmap: RoadmapOut
  /** The job the user is currently prepping for */
  activeJobId: string
  activeJobTitle?: string
  activeCompany?: string
  /** When set, auto-expand and scroll to the module covering this skill */
  highlightSkill?: string | null
  /** When true (used in per-subtopic nesting), render only the matching module, not the whole plan */
  onlyMatching?: boolean
  /** Fired with a ready-to-send, topic-grounded prompt when the user clicks "Ask AI" on a module */
  onAskAI?: (prompt: string) => void
}

/** Builds a context-rich prompt for a module so the docked counsellor answers about the exact material shown, not just the topic name. */
function buildAskAIPrompt(mod: PlanModule, jobTitle?: string): string {
  const resourceTitles = mod.resources.slice(0, 4).map(r => r.title).filter(Boolean)
  let prompt = `I'm a bit confused about "${mod.skill}"`
  if (jobTitle) prompt += ` for the ${jobTitle} role`
  prompt += `. ${mod.why_important}`
  if (resourceTitles.length) {
    prompt += ` The material covers: ${resourceTitles.join(', ')}.`
  }
  prompt += ` Can you explain this simply and tell me what to focus on first?`
  return prompt
}

function skillKey(s: string) {
  return s.toLowerCase().trim()
}

// ── helpers ────────────────────────────────────────────────────────────────────

function moduleProgress(mod: PlanModule, progress: Record<string, { done: boolean }>): number {
  if (!mod.resources.length) return 0
  const done = mod.resources.filter(r => progress[r.id]?.done).length
  return Math.round((done / mod.resources.length) * 100)
}

function totalProgress(modules: PlanModule[], progress: Record<string, { done: boolean }>): { done: number; total: number; pct: number } {
  const all = modules.flatMap(m => m.resources)
  const done = all.filter(r => progress[r.id]?.done).length
  return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 }
}

// ── sub-components ─────────────────────────────────────────────────────────────

// ── Step-by-step generation progress ─────────────────────────────────────────

const GEN_STEPS: { key: GenerationStep; label: string; Icon: typeof Target }[] = [
  { key: 'agenda',     label: 'Creating Your Learning Path',        Icon: Target },
  { key: 'resources',  label: 'Curating Best Resources for You',    Icon: Zap },
  { key: 'finalizing', label: 'Finalizing & Saving Your Roadmap',   Icon: Save },
]

// Builds the right-hand "live commentary" panel from real backend counters —
// no canned/static copy. Falls back to a plain "working on it" line only for
// the brief instants before the backend has reported any detail yet.
function buildNarration(step: GenerationStep, detail: GenerationDetail | undefined, jobTitle?: string) {
  if (step === 'agenda') {
    return {
      title: 'BeginablAI is Creating Your Learning Path',
      subtitle: `Drafting modules from the skill gaps for ${jobTitle ?? 'this role'}`,
      lines: ['Reading the job description and required skills', 'Comparing them against your profile', 'Drafting prioritised modules'],
    }
  }
  if (step === 'resources') {
    const done = detail?.resources_done ?? 0
    const total = detail?.resources_total ?? 0
    const lines: string[] = []
    if (detail?.current_skill) lines.push(`Searching videos for: ${detail.current_skill}`)
    if (total > 0) lines.push(`Curated ${done} of ${total} resources so far`)
    if (detail?.last_found) lines.push(`Just found: "${detail.last_found}"`)
    if (lines.length === 0) lines.push('Starting real YouTube search for each module…')
    return {
      title: 'BeginablAI is Curating Your Resources',
      subtitle: 'Searching for real, watchable videos — not just search links',
      lines,
    }
  }
  return {
    title: 'BeginablAI is Finalizing Your Roadmap',
    subtitle: detail?.modules_planned ? `Saving your ${detail.modules_planned}-module roadmap` : 'Saving your roadmap',
    lines: ['Double-checking every module has working resources', 'Writing your roadmap to your dashboard'],
  }
}

function GenerationProgress({
  step, detail, jobTitle, stuck, onRegenerate, regenerating, onClose, cancelling,
}: {
  step: GenerationStep
  detail?: GenerationDetail
  jobTitle?: string
  stuck: boolean
  onRegenerate: () => void
  regenerating: boolean
  onClose: () => void
  cancelling: boolean
}) {
  const stepIndex = GEN_STEPS.findIndex(s => s.key === step)
  const resourcesPct = detail?.resources_total ? (detail.resources_done ?? 0) / detail.resources_total : 0
  const pct = Math.round(((stepIndex + resourcesPct) / GEN_STEPS.length) * 100)
  const narration = buildNarration(step, detail, jobTitle)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 18,
        width: '100%', maxWidth: 880,
        boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          disabled={cancelling}
          title="Stop generating this roadmap"
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 1,
            width: 30, height: 30, borderRadius: 9,
            background: '#F8FAFC', border: '1px solid #EEF2F9',
            color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: cancelling ? 'wait' : 'pointer', transition: 'all 0.2s',
            opacity: cancelling ? 0.6 : 1,
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
          onMouseOut={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}
        >
          {cancelling ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <X size={14} />}
        </button>

        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #818CF8, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 16,
            }}>D</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                Crafting your personalised roadmap
              </p>
              <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '3px 0 0' }}>
                Analysing skill gaps for <strong style={{ color: '#4B5563' }}>{jobTitle ?? 'your target role'}</strong>
              </p>
            </div>
          </div>

          {/* Progress ring */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <svg width={56} height={56} viewBox="0 0 56 56">
              <circle cx={28} cy={28} r={23} fill="none" stroke="#F1F5F9" strokeWidth={5} />
              <circle cx={28} cy={28} r={23} fill="none" stroke="#6366F1" strokeWidth={5}
                strokeDasharray={`${2 * Math.PI * 23}`}
                strokeDashoffset={`${2 * Math.PI * 23 * (1 - pct / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text x={28} y={32} textAnchor="middle" fill="#111827" fontSize={12} fontWeight={700}>{pct}%</text>
            </svg>
          </div>
        </div>

        {/* Body: two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 280 }}>

          {/* Left: step tracker */}
          <div style={{ padding: '24px 32px', borderRight: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 18 }}>Generation Steps</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {GEN_STEPS.map((s, i) => {
                const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming'
                return (
                  <div key={s.key} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: state === 'upcoming' ? '#F1F5F9' : '#6366F1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: state === 'upcoming' ? '#9CA3AF' : 'white',
                      }}>
                        {state === 'done'
                          ? <Check size={15} />
                          : state === 'active'
                            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                            : <s.Icon size={15} />
                        }
                      </div>
                      {i < GEN_STEPS.length - 1 && (
                        <div style={{ width: 2, flex: 1, minHeight: 16, margin: '4px 0', background: state === 'done' ? '#6366F1' : '#F1F5F9' }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 18, paddingTop: 5 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: state === 'upcoming' ? '#9CA3AF' : '#111827', margin: 0 }}>
                        {s.label}
                      </p>
                      <p style={{ fontSize: 11, margin: '3px 0 0', fontWeight: 600,
                        color: state === 'done' ? '#16A34A' : state === 'active' ? '#6366F1' : '#D1D5DB',
                      }}>
                        {state === 'done' ? 'Complete' : state === 'active' ? 'In Progress' : 'Pending'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {stuck && (
              <div style={{
                marginTop: 8, padding: '12px 16px', borderRadius: 10,
                background: '#FEF2F2',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>Generation stuck — please regenerate.</span>
                <button onClick={onRegenerate} disabled={regenerating} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#DC2626', color: 'white', border: 'none',
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                  cursor: regenerating ? 'wait' : 'pointer', flexShrink: 0,
                }}>
                  <RefreshCw size={12} /> Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Right: live AI narration */}
          <div style={{ padding: '24px 32px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 18 }}>What BeginablAI is doing now</p>

            <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid rgba(37,99,235,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{narration.title}</p>
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>{narration.subtitle}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {narration.lines.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: '2px solid #6366F1', borderTopColor: 'transparent',
                      animation: 'spin 0.9s linear infinite',
                    }} />
                    {i < narration.lines.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 14, margin: '4px 0', background: '#F1F5F9' }} />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#4B5563', margin: 0, paddingBottom: 16, lineHeight: 1.55 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer progress bar */}
        <div style={{ padding: '16px 32px 20px', borderTop: '1px solid rgba(37,99,235,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#6366F1', borderRadius: 5, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', minWidth: 32, textAlign: 'right' as const }}>{pct}%</span>
          </div>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>This usually takes 30–60 seconds. Please don't close this window.</p>
        </div>
      </div>

    </div>
  )
}

function VideoOptionCard({
  video, recommended, selected, onSelect, rating, onRate, jobTitle,
}: {
  video: { video_id: string; title: string; channel: string; duration_minutes: number; thumbnail_url: string; url: string }
  recommended: boolean
  selected: boolean
  onSelect: () => void
  rating?: 'relevant' | 'not_relevant'
  onRate?: (r: 'relevant' | 'not_relevant') => void
  jobTitle?: string
}) {
  return (
    <div style={{
      flex: 1, minWidth: 180, borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
      border: selected ? '1.5px solid #6366F1' : '1px solid #F1F5F9',
      background: 'white',
      transition: 'border-color 0.15s',
    }}
      onClick={onSelect}
    >
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#F3F4F6' }}>
        <img src={video.thumbnail_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {recommended && (
          <span style={{
            position: 'absolute', top: 6, left: 6,
            fontSize: 9.5, fontWeight: 700, color: 'white',
            background: 'rgba(99,102,241,0.92)', padding: '3px 7px', borderRadius: 5,
          }}>
            Recommended
          </span>
        )}
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          width: 18, height: 18, borderRadius: '50%',
          background: selected ? '#6366F1' : 'rgba(255,255,255,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected ? <CheckCircle2 size={12} color="white" /> : <Circle size={11} color="#9CA3AF" />}
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </p>
        <p style={{ fontSize: 10.5, color: '#9CA3AF', margin: '4px 0 0' }}>{video.channel} · {video.duration_minutes}m</p>
      </div>

      {/* Rating row — only shown on selected card */}
      {selected && onRate && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderTop: '1px solid #F1F5F9',
            background: '#FAFAFA',
          }}
        >
          <span style={{ fontSize: 10, color: '#9CA3AF', flex: 1 }}>
            {jobTitle ? `For ${jobTitle}?` : 'Relevant?'}
          </span>
          <button
            onClick={() => onRate('relevant')}
            title="Relevant for this job"
            style={{
              background: rating === 'relevant' ? '#DCFCE7' : 'none',
              border: 'none', borderRadius: 5, padding: '3px 5px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
              transition: 'background 0.15s',
            }}
          >
            <ThumbsUp size={11} color={rating === 'relevant' ? '#16A34A' : '#9CA3AF'} />
          </button>
          <button
            onClick={() => onRate('not_relevant')}
            title="Not relevant for this job"
            style={{
              background: rating === 'not_relevant' ? '#FEE2E2' : 'none',
              border: 'none', borderRadius: 5, padding: '3px 5px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
              transition: 'background 0.15s',
            }}
          >
            <ThumbsDown size={11} color={rating === 'not_relevant' ? '#DC2626' : '#9CA3AF'} />
          </button>
        </div>
      )}
    </div>
  )
}

function ResourceCard({
  resource, done, onToggle, loading, onRateVideo, videoRating, jobTitle,
}: {
  resource: PlanResource
  done: boolean
  onToggle: () => void
  loading: boolean
  onRateVideo?: (videoId: string, rating: 'relevant' | 'not_relevant') => void
  videoRating?: VideoRating
  jobTitle?: string
}) {
  const [selectedVideoId, setSelectedVideoId] = useState(resource.recommended_video_id)

  if (resource.type === 'youtube' && resource.video_options && resource.video_options.length > 0) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <button
            onClick={onToggle}
            disabled={loading}
            style={{
              background: done ? '#16A34A' : 'white', borderRadius: '50%',
              border: done ? 'none' : '1.5px solid #D1D5DB', cursor: loading ? 'wait' : 'pointer',
              width: 19, height: 19, padding: 0, marginTop: 2, flexShrink: 0, opacity: loading ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={done ? 'Mark as incomplete' : 'Mark as done'}
          >
            {done && <CheckCircle2 size={17} color="white" style={{ marginLeft: -1, marginTop: -1 }} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2937' }}>{resource.title}</span>
              {done && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 20 }}>
                  Completed
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '3px 0 0', lineHeight: 1.5 }}>{resource.description}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 29 }}>
          {resource.video_options.map(v => (
            <VideoOptionCard
              key={v.video_id}
              video={v}
              recommended={v.video_id === resource.recommended_video_id}
              selected={v.video_id === selectedVideoId}
              onSelect={() => setSelectedVideoId(v.video_id)}
              rating={videoRating?.video_id === v.video_id ? videoRating.rating : undefined}
              onRate={onRateVideo ? (r) => onRateVideo(v.video_id, r) : undefined}
              jobTitle={jobTitle}
            />
          ))}
        </div>
        {selectedVideoId && (
          <a
            href={resource.video_options.find(v => v.video_id === selectedVideoId)?.url ?? resource.url}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, paddingLeft: 29,
              fontSize: 12.5, fontWeight: 600, color: '#6366F1', textDecoration: 'none',
            }}
          >
            <PlayCircle size={13} /> Watch selected video <ExternalLink size={10} />
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0' }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={loading}
        style={{
          background: done ? '#16A34A' : 'white', borderRadius: '50%',
          border: done ? 'none' : '1.5px solid #D1D5DB', cursor: loading ? 'wait' : 'pointer',
          width: 19, height: 19, padding: 0, marginTop: 2, flexShrink: 0, opacity: loading ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={done ? 'Mark as incomplete' : 'Mark as done'}
      >
        {done && <CheckCircle2 size={17} color="white" style={{ marginLeft: -1, marginTop: -1 }} />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2937' }}>
              {resource.title}
            </span>
            {done && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 20 }}>
                Completed
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '3px 0 0', lineHeight: 1.5 }}>
            {resource.description}
          </p>
        </div>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12.5, fontWeight: 600, color: '#6366F1',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            textDecoration: 'none', whiteSpace: 'nowrap', marginTop: 1,
          }}
        >
          {resource.type === 'youtube' ? 'Watch' : 'View Resource'}
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  )
}

function ModuleCard({
  mod, progress, onToggleResource, togglingId, forceOpen, highlighted, isCurrent, jobId, quizProgress, jobTitle, onAskAI, onRateVideo,
}: {
  mod: PlanModule
  progress: Record<string, { done: boolean; video_rating?: VideoRating }>
  onToggleResource: (resourceId: string, done: boolean) => void
  togglingId: string | null
  forceOpen?: boolean
  highlighted?: boolean
  isCurrent?: boolean
  jobId: string
  quizProgress?: QuizProgress
  jobTitle?: string
  onAskAI?: (prompt: string) => void
  onRateVideo?: (resourceId: string, videoId: string, rating: 'relevant' | 'not_relevant') => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (forceOpen || isCurrent) setOpen(true)
  }, [forceOpen, isCurrent])
  const pct = moduleProgress(mod, progress)
  const donePct = Math.round(pct)
  const doneCount = mod.resources.filter(r => progress[r.id]?.done).length

  // 3-segment progress dashes, like the reference's flat topic rows
  const segments = [0, 1, 2].map(i => donePct >= (i + 1) * 34 || (i === 0 && donePct > 0))

  return (
    <div
      id={`job-module-${skillKey(mod.skill)}`}
      style={{
        borderBottom: '1px solid rgba(37,99,235,0.08)',
        background: isCurrent ? 'rgba(37,99,235,0.02)' : 'transparent',
      }}
    >
      {/* Module header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '16px 0',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}
      >
        <div style={{ color: '#9CA3AF', flexShrink: 0, display: 'flex' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>
              Topic {mod.priority}: <strong style={{ fontWeight: 700, color: '#111827' }}>{mod.skill}</strong>
            </span>
            {mod._scheduleStart != null && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#1E3A5F',
                background: '#EEF4FF', border: '1px solid #C7D9F8',
                padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
              }}>
                Day {mod._scheduleStart}–{mod._scheduleEnd}
              </span>
            )}
            {isCurrent && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#2563EB',
                background: '#DBEAFE', border: '1px solid #BFDBFE',
                padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
              }}>
                ▶ Continue here
              </span>
            )}
            {highlighted && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6366F1', background: '#EEF2FF', padding: '2px 8px', borderRadius: 20 }}>
                Focus
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{doneCount}/{mod.resources.length}</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {segments.map((filled, i) => (
              <div key={i} style={{ width: 26, height: 5, borderRadius: 3, background: filled ? (pct === 100 ? '#16A34A' : '#6366F1') : '#E5E7EB' }} />
            ))}
          </div>
        </div>
      </button>

      {/* Resource list */}
      {open && (
        <div style={{ paddingLeft: 28, paddingBottom: 18 }}>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '0 0 8px', lineHeight: 1.55 }}>
            {mod.why_important}
          </p>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '14px 0 2px' }}>
            Subtopics
          </p>
          <div>
            {mod.resources.map((res, i) => (
              <div key={res.id} style={{ borderTop: i > 0 ? '1px solid #F1F5F9' : 'none' }}>
                <ResourceCard
                  resource={res}
                  done={!!progress[res.id]?.done}
                  loading={togglingId === res.id}
                  onToggle={() => onToggleResource(res.id, !progress[res.id]?.done)}
                  videoRating={progress[res.id]?.video_rating}
                  onRateVideo={onRateVideo ? (videoId, rating) => onRateVideo(res.id, videoId, rating) : undefined}
                  jobTitle={jobTitle}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', paddingTop: 12 }}>
            <button
              onClick={() => navigate(`/app/quiz/${jobId}/${mod.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', padding: 0,
                fontSize: 13, fontWeight: 600,
                color: quizProgress?.passed ? '#16A34A' : '#6366F1', cursor: 'pointer',
              }}
            >
              {quizProgress?.passed
                ? <><CheckCircle2 size={14} /> Quiz passed — {quizProgress.score_pct}%</>
                : mod.quiz?.questions?.length
                  ? <><Zap size={14} /> Take Quiz</>
                  : <><Zap size={14} /> Generate Quiz</>}
            </button>
            {onAskAI && (
              <button
                onClick={() => onAskAI(buildAskAIPrompt(mod, jobTitle))}
                title="Ask BeginablAI to explain this topic"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', padding: 0,
                  fontSize: 13, fontWeight: 600,
                  color: '#9333EA', cursor: 'pointer',
                }}
              >
                <Sparkles size={14} /> Ask AI
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function JobLearningPlanPanel({ activeJobId, activeJobTitle, activeCompany, highlightSkill, onlyMatching, onAskAI }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [pollingActive, setPollingActive] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Scroll to (and visually highlight) the module matching the selected skill subtopic —
  // not needed when nested inline per-subtopic (onlyMatching), since there's nothing to scroll past.
  useEffect(() => {
    if (!highlightSkill || onlyMatching) return
    const el = document.getElementById(`job-module-${skillKey(highlightSkill)}`)
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
      return () => clearTimeout(t)
    }
  }, [highlightSkill, onlyMatching])

  const { data, isLoading } = useQuery({
    queryKey: ['job-learning-plan', activeJobId],
    queryFn: () => jobPlanApi.get(activeJobId),
    refetchInterval: pollingActive ? 3000 : false,
  })

  // Keep polling in sync with the plan's actual status — needed both when our own
  // mutation kicks off generation AND when generation was triggered elsewhere (e.g.
  // the Dashboard "Generate Roadmap" button), in which case we only discover
  // status === 'generating' from this query itself, not from a local mutation.
  useEffect(() => {
    if (data?.status === 'generating') {
      setPollingActive(true)
    }
    if (data?.status === 'ready' || data?.status === 'failed') {
      setPollingActive(false)
    }
  }, [data?.status])

  const generateMutation = useMutation({
    mutationFn: () => jobPlanApi.generate(activeJobId),
    onMutate: () => setPollingActive(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-learning-plan', activeJobId] })
    },
    onError: () => setPollingActive(false),
  })

  const cancelGenerationMutation = useMutation({
    mutationFn: () => jobPlanApi.remove(activeJobId),
    onSuccess: () => {
      setPollingActive(false)
      qc.invalidateQueries({ queryKey: ['job-learning-plan', activeJobId] })
      qc.invalidateQueries({ queryKey: ['job-plans-all'] })
    },
  })

  // Self-healing: a "ready" plan generated before real-video enrichment existed
  // is stale data, not a valid result — regenerate it automatically, once,
  // instead of silently showing broken/old-format content.
  useEffect(() => {
    if (
      data?.status === 'ready' &&
      data.stale &&
      !generateMutation.isPending
    ) {
      generateMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status, data?.stale, activeJobId])

  const rateVideoMutation = useMutation({
    mutationFn: ({ resourceId, videoId, rating }: { resourceId: string; videoId: string; rating: 'relevant' | 'not_relevant' }) =>
      jobPlanApi.rateVideo(activeJobId, resourceId, videoId, rating),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-learning-plan', activeJobId] })
    },
  })

  const progressMutation = useMutation({
    mutationFn: ({ resourceId, done }: { resourceId: string; done: boolean }) =>
      jobPlanApi.markProgress(activeJobId, resourceId, done),
    onMutate: async ({ resourceId, done }) => {
      setTogglingId(resourceId)
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['job-learning-plan', activeJobId] })
      const prev = qc.getQueryData<typeof data>(['job-learning-plan', activeJobId])
      if (prev) {
        qc.setQueryData(['job-learning-plan', activeJobId], {
          ...prev,
          progress: {
            ...prev.progress,
            [resourceId]: { done, done_at: done ? new Date().toISOString() : null },
          },
        })
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['job-learning-plan', activeJobId], ctx.prev)
    },
    onSettled: () => {
      setTogglingId(null)
      qc.invalidateQueries({ queryKey: ['job-learning-plan', activeJobId] })
    },
  })

  // Values needed by the auto-scroll effect below — computed unconditionally (with
  // optional chaining) so the hook order never changes across the early-return
  // render states (loading/not_generated/generating/failed) vs. the "ready" state.
  const { data: profile } = useOnboardingProfile()
  const plan = data?.status === 'ready' ? data.plan : undefined
  const progress = data?.progress ?? {}
  const scheduledModules = plan
    ? attachSchedule([...plan.modules].sort((a, b) => a.priority - b.priority), profile?.weekly_study_hours)
    : []
  const { done, pct } = totalProgress(plan?.modules ?? [], progress)

  // First module that isn't 100% complete — shown only when the user has started the plan.
  const anyDone = done > 0
  const currentModule = anyDone && pct < 100
    ? scheduledModules.find(m => moduleProgress(m, progress) < 100)
    : null

  // Auto-scroll to the current module on first render (not when a skill is already highlighted).
  useEffect(() => {
    if (!currentModule || highlightSkill) return
    const el = document.getElementById(`job-module-${skillKey(currentModule.skill)}`)
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
      return () => clearTimeout(t)
    }
  }, [currentModule?.id, highlightSkill])

  // ── Render states ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: '#94A3B8', fontSize: 13 }}>
        <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
        Loading plan…
      </div>
    )
  }

  // Not generated yet
  if (!data || data.status === 'not_generated') {
    return (
      <div style={{
        background: '#FAF7F1',
        border: '1px solid #F1EAE0', borderRadius: 14, padding: '24px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Target size={24} color="white" />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
          Get your personalised learning roadmap
        </h3>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 18px', maxWidth: 360, lineHeight: 1.5 }}>
          BeginablAI will analyse the skill gaps between your profile and{' '}
          <strong>{activeJobTitle ?? 'this job'}</strong> at <strong>{activeCompany ?? 'the company'}</strong>,
          then generate a step-by-step plan with YouTube courses and reading material to close every gap.
        </p>
        {generateMutation.isError && (
          <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>
            {(generateMutation.error as any)?.response?.data?.detail ?? 'Failed to start. Please try again.'}
          </p>
        )}
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', color: 'white',
            border: 'none', borderRadius: 10, padding: '11px 22px',
            fontSize: 14, fontWeight: 700, cursor: generateMutation.isPending ? 'wait' : 'pointer',
            opacity: generateMutation.isPending ? 0.7 : 1,
          }}
        >
          {generateMutation.isPending
            ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Generating…</>
            : <><Zap size={15} /> Generate My Roadmap</>
          }
        </button>
      </div>
    )
  }

  // Generating (polling)
  if (data.status === 'generating') {
    const lastUpdate = data.updated_at ?? data.generated_at
    const elapsedMs = lastUpdate ? Date.now() - new Date(lastUpdate).getTime() : 0
    const stuck = elapsedMs > 45_000

    return (
      <GenerationProgress
        step={data.generation_step ?? 'agenda'}
        detail={data.generation_detail}
        jobTitle={activeJobTitle}
        stuck={stuck}
        regenerating={generateMutation.isPending}
        onRegenerate={() => generateMutation.mutate()}
        cancelling={cancelGenerationMutation.isPending}
        onClose={() => {
          if (window.confirm('Stop generating this roadmap? Progress so far will be discarded.')) {
            cancelGenerationMutation.mutate()
          }
        }}
      />
    )
  }

  // Failed
  if (data.status === 'failed') {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 16px',
      }}>
        <AlertCircle size={16} color="#EF4444" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', margin: 0 }}>Plan generation failed</p>
          <p style={{ fontSize: 12, color: '#B91C1C', margin: '4px 0 10px' }}>{data.error ?? 'Unknown error'}</p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#EF4444', color: 'white', border: 'none',
              borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      </div>
    )
  }

  // Ready — plan/progress/scheduledModules/done/pct/currentModule already computed above
  // (before the early returns, to keep hook order stable). No hooks are called below this
  // point, so this guard is a safe plain early return, not a hook-order hazard.
  if (!plan) return null
  const totalDays = scheduledModules.at(-1)?._scheduleEnd ?? 0
  const total = scheduledModules.flatMap(m => m.resources).length

  const skillKeyFilter = highlightSkill ? skillKey(highlightSkill) : null
  const matchingModule = skillKeyFilter
    ? scheduledModules.find(m => skillKey(m.skill) === skillKeyFilter)
    : null

  if (onlyMatching) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matchingModule ? (
          <ModuleCard
            mod={matchingModule}
            progress={progress}
            togglingId={togglingId}
            forceOpen
            highlighted={false}
            jobId={activeJobId}
            jobTitle={activeJobTitle}
            quizProgress={progress[`quiz_${matchingModule.id}`] as any}
            onToggleResource={(resourceId, done) => progressMutation.mutate({ resourceId, done })}
            onRateVideo={(resourceId, videoId, rating) => rateVideoMutation.mutate({ resourceId, videoId, rating })}
            onAskAI={onAskAI}
          />
        ) : (
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            This skill isn't part of your generated learning plan yet — try regenerating the plan after your profile updates.
          </p>
        )}
      </div>
    )
  }

  return (
    <div>

      {/* Plain header — title + stats, no card */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px', fontFamily: 'Hind, sans-serif' }}>
            {plan.job_title}
          </h2>
          <p style={{ fontSize: 13.5, color: '#9CA3AF', margin: 0 }}>
            A learning path for {plan.company}
          </p>
        </div>
        <button
          onClick={() => navigate(`/app/jobs/${activeJobId}`)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12.5, fontWeight: 700, color: '#6366F1',
            background: '#EEF2FF', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
          }}
        >
          <ExternalLink size={13} />View job & apply
        </button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 0', borderBottom: '1px solid rgba(37,99,235,0.08)', marginBottom: 4,
      }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Path Curriculum</p>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>
            {plan.modules.length} Topics · {total} Resources · {done}/{total} done
            {totalDays > 0 && <> · <strong style={{ color: '#1E3A5F' }}>{totalDays}-day plan</strong></>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#16A34A' : '#6366F1' }}>{pct}%</span>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            title="Regenerate plan"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'none', border: 'none',
              cursor: 'pointer', color: '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#F3F4F6' }}
            onMouseOut={e => { e.currentTarget.style.background = 'none' }}
          >
            <RefreshCw size={14} style={generateMutation.isPending ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          </button>
        </div>
      </div>

      {/* Module list */}
      <div>
        {scheduledModules
          .map(mod => {
            const isHighlighted = !!highlightSkill && skillKey(mod.skill) === skillKey(highlightSkill)
            return (
              <ModuleCard
                key={mod.id}
                mod={mod}
                progress={progress}
                togglingId={togglingId}
                forceOpen={isHighlighted}
                highlighted={isHighlighted}
                isCurrent={currentModule?.id === mod.id}
                jobId={activeJobId}
                jobTitle={activeJobTitle}
                quizProgress={progress[`quiz_${mod.id}`] as any}
                onToggleResource={(resourceId, done) => progressMutation.mutate({ resourceId, done })}
                onRateVideo={(resourceId, videoId, rating) => rateVideoMutation.mutate({ resourceId, videoId, rating })}
                onAskAI={onAskAI}
              />
            )
          })
        }
      </div>
    </div>
  )
}
