import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlayCircle, BookOpen, ExternalLink, CheckCircle2, Circle,
  Clock, Zap, RefreshCw, Loader2, AlertCircle, ChevronDown,
  ChevronUp, Briefcase, Target, Save, Check,
} from 'lucide-react'
import { jobPlanApi, type GenerationDetail, type GenerationStep, type PlanModule, type PlanResource } from '@/api/jobPlan'
import type { RoadmapOut } from '@/api/roadmap'

interface Props {
  roadmap: RoadmapOut
  /** The job the user is currently prepping for */
  activeJobId: string
  activeJobTitle?: string
  activeCompany?: string
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

function ProgressRing({ pct, size = 40 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const stroke = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct === 100 ? '#22C55E' : '#2563EB'} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={stroke}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s' }}
      />
    </svg>
  )
}

function ResourceIcon({ type }: { type: string }) {
  if (type === 'youtube') return <PlayCircle size={14} color="#EF4444" />
  if (type === 'course') return <Zap size={14} color="#8B5CF6" />
  return <BookOpen size={14} color="#3B82F6" />
}

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
      title: 'DISHA AI is Creating Your Learning Path',
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
      title: 'DISHA AI is Curating Your Resources',
      subtitle: 'Searching for real, watchable videos — not just search links',
      lines,
    }
  }
  return {
    title: 'DISHA AI is Finalizing Your Roadmap',
    subtitle: detail?.modules_planned ? `Saving your ${detail.modules_planned}-module roadmap` : 'Saving your roadmap',
    lines: ['Double-checking every module has working resources', 'Writing your roadmap to your dashboard'],
  }
}

function GenerationProgress({
  step, detail, jobTitle, stuck, onRegenerate, regenerating,
}: {
  step: GenerationStep
  detail?: GenerationDetail
  jobTitle?: string
  stuck: boolean
  onRegenerate: () => void
  regenerating: boolean
}) {
  const stepIndex = GEN_STEPS.findIndex(s => s.key === step)
  const resourcesPct = detail?.resources_total ? (detail.resources_done ?? 0) / detail.resources_total : 0.5
  const pct = Math.round(((stepIndex + resourcesPct) / GEN_STEPS.length) * 100)
  const narration = buildNarration(step, detail, jobTitle)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 28,
        width: '100%', maxWidth: 960,
        boxShadow: '0 40px 100px rgba(15,23,42,0.4)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'modalIn 0.3s cubic-bezier(0.34,1.1,0.64,1) both',
      }}>

        {/* Hero header */}
        <div style={{
          background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
          padding: '32px 36px 28px', position: 'relative', overflow: 'hidden',
        }}>
          {/* decorative blobs */}
          <div style={{ position: 'absolute', width: 300, height: 300, top: -120, right: -60, background: '#3B82F6', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 200, height: 200, bottom: -80, left: 40, background: '#7C3AED', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15, pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {/* Animated DISHA avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.08))',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 900, fontSize: 22, fontFamily: 'Hind, sans-serif',
                }}>D</div>
                <div style={{
                  position: 'absolute', bottom: -3, right: -3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#22C55E', border: '2.5px solid #15130F',
                  animation: 'pulse 2s infinite',
                }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>DISHA AI</span>
                  <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#86EFAC', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>● Live</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0, fontFamily: 'Hind, sans-serif', lineHeight: 1.2 }}>
                  Crafting your personalised roadmap
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                  Analysing skill gaps for <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{jobTitle ?? 'your target role'}</span>
                </p>
              </div>
            </div>

            {/* Progress ring */}
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <svg width={80} height={80} viewBox="0 0 80 80">
                <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={7} />
                <circle cx={40} cy={40} r={34} fill="none" stroke="white" strokeWidth={7}
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
                <text x={40} y={44} textAnchor="middle" fill="white" fontSize={15} fontWeight={900} fontFamily="Hind, sans-serif">{pct}%</text>
              </svg>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginTop: 4 }}>OVERALL</p>
            </div>
          </div>
        </div>

        {/* Body: two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 320 }}>

          {/* Left: step tracker */}
          <div style={{ padding: '28px 32px', borderRight: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 20 }}>Generation Steps</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {GEN_STEPS.map((s, i) => {
                const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming'
                return (
                  <div key={s.key} style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                        background: state === 'done' ? '#15130F' : state === 'active' ? 'linear-gradient(135deg, #1E3A5F, #2563EB)' : '#F8FAFC',
                        border: state === 'upcoming' ? '1.5px solid #E2E8F0' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: state === 'upcoming' ? '#CBD5E1' : 'white',
                        boxShadow: state === 'active' ? '0 4px 14px rgba(37,99,235,0.35)' : 'none',
                        transition: 'all 0.3s',
                      }}>
                        {state === 'done'
                          ? <Check size={16} />
                          : state === 'active'
                            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                            : <s.Icon size={16} />
                        }
                      </div>
                      {i < GEN_STEPS.length - 1 && (
                        <div style={{ width: 2, flex: 1, minHeight: 16, margin: '4px 0', background: state === 'done' ? '#15130F' : '#E2E8F0', borderRadius: 2, transition: 'background 0.4s' }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 20, paddingTop: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: state === 'upcoming' ? '#CBD5E1' : '#0F172A', margin: 0 }}>
                        {s.label}
                      </p>
                      <p style={{ fontSize: 11, margin: '3px 0 0', fontWeight: 600,
                        color: state === 'done' ? '#059669' : state === 'active' ? '#3B82F6' : '#CBD5E1',
                      }}>
                        {state === 'done' ? '✓ Complete' : state === 'active' ? '⟳ In Progress' : 'Pending'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {stuck && (
              <div style={{
                marginTop: 8, padding: '12px 16px', borderRadius: 12,
                background: '#FEF2F2', border: '1px solid #FECACA',
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
          <div style={{ padding: '28px 32px', background: '#FAFBFC' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 20 }}>What DISHA is doing now</p>

            <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 20, border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)', animation: 'pulse 1.5s infinite' }} />
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{narration.title}</p>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.6 }}>{narration.subtitle}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {narration.lines.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: '2.5px solid #3B82F6', borderTopColor: 'transparent',
                      animation: 'spin 0.9s linear infinite',
                      background: 'rgba(59,130,246,0.06)',
                    }} />
                    {i < narration.lines.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 16, margin: '4px 0', background: 'linear-gradient(to bottom, #3B82F6, #E2E8F0)', opacity: 0.4, borderRadius: 2 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', margin: 0, paddingBottom: 18, lineHeight: 1.55 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer progress bar */}
        <div style={{ padding: '16px 36px 20px', borderTop: '1px solid #F1F5F9', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #15130F, #2563EB)', borderRadius: 6, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#15130F', minWidth: 36, textAlign: 'right' as const }}>{pct}%</span>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>This usually takes 30–60 seconds. Please don't close this window.</p>
        </div>
      </div>

      <style>{`
        @keyframes modalIn { from{opacity:0;transform:scale(0.94) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 50%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }
      `}</style>
    </div>
  )
}

function VideoOptionCard({
  video, recommended, selected, onSelect,
}: {
  video: { video_id: string; title: string; channel: string; duration_minutes: number; thumbnail_url: string; url: string }
  recommended: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <div style={{
      flex: 1, minWidth: 180, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
      border: selected ? '2px solid #3B82F6' : '1.5px solid #E2E8F0',
      background: 'white', transition: 'border-color 0.15s',
    }}
      onClick={onSelect}
    >
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0F172A' }}>
        <img src={video.thumbnail_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {recommended && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', alignItems: 'center', gap: 3,
            background: '#3B82F6', color: 'white', fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 20,
          }}>
            <CheckCircle2 size={10} /> Recommended
          </span>
        )}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <PlayCircle size={28} color="white" style={{ opacity: 0.85 }} />
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </p>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '3px 0 6px' }}>{video.channel}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.08)', padding: '2px 6px', borderRadius: 6 }}>Quiz</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.08)', padding: '2px 6px', borderRadius: 6 }}>Follow-ups</span>
          </div>
          {selected
            ? <CheckCircle2 size={16} color="#3B82F6" />
            : <Circle size={16} color="#CBD5E1" />
          }
        </div>
      </div>
    </div>
  )
}

function ResourceCard({
  resource, done, onToggle, loading,
}: {
  resource: PlanResource
  done: boolean
  onToggle: () => void
  loading: boolean
}) {
  const [selectedVideoId, setSelectedVideoId] = useState(resource.recommended_video_id)

  if (resource.type === 'youtube' && resource.video_options && resource.video_options.length > 0) {
    return (
      <div style={{
        padding: '12px', borderRadius: 12,
        background: done ? 'rgba(59,130,246,0.04)' : '#FAFAFA',
        border: done ? '1px solid rgba(59,130,246,0.25)' : '1px solid #E2E8F0',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <button
            onClick={onToggle}
            disabled={loading}
            style={{
              background: 'none', border: 'none', cursor: loading ? 'wait' : 'pointer',
              padding: 0, marginTop: 1, flexShrink: 0, opacity: loading ? 0.5 : 1,
              color: done ? '#3B82F6' : '#CBD5E1',
            }}
            title={done ? 'Mark as incomplete' : 'Mark as done'}
          >
            {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: done ? '#6B7280' : '#111827', textDecoration: done ? 'line-through' : 'none' }}>
              {resource.title}
            </span>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0', lineHeight: 1.4 }}>{resource.description}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {resource.video_options.map(v => (
            <VideoOptionCard
              key={v.video_id}
              video={v}
              recommended={v.video_id === resource.recommended_video_id}
              selected={v.video_id === selectedVideoId}
              onSelect={() => setSelectedVideoId(v.video_id)}
            />
          ))}
        </div>
        {selectedVideoId && (
          <a
            href={resource.video_options.find(v => v.video_id === selectedVideoId)?.url ?? resource.url}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
              fontSize: 12, fontWeight: 700, color: '#3B82F6', textDecoration: 'none',
            }}
          >
            Watch selected video <ExternalLink size={11} />
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: done ? 'rgba(59,130,246,0.04)' : '#FAFAFA',
      border: done ? '1px solid rgba(59,130,246,0.25)' : '1px solid #E2E8F0',
      transition: 'all 0.2s',
    }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={loading}
        style={{
          background: 'none', border: 'none', cursor: loading ? 'wait' : 'pointer',
          padding: 0, marginTop: 1, flexShrink: 0, opacity: loading ? 0.5 : 1,
          color: done ? '#3B82F6' : '#CBD5E1',
        }}
        title={done ? 'Mark as incomplete' : 'Mark as done'}
      >
        {done
          ? <CheckCircle2 size={18} />
          : <Circle size={18} />
        }
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ResourceIcon type={resource.type} />
          <span style={{
            fontSize: 13, fontWeight: 600, color: done ? '#6B7280' : '#111827',
            textDecoration: done ? 'line-through' : 'none',
          }}>
            {resource.title}
          </span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {resource.channel_or_source}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0', lineHeight: 1.4 }}>
          {resource.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} /> {resource.duration_minutes} min
          </span>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11, fontWeight: 600, color: '#3B82F6',
              display: 'flex', alignItems: 'center', gap: 3,
              textDecoration: 'none',
            }}
          >
            {resource.type === 'youtube' ? 'Watch on YouTube' : 'Read / Search'}
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  )
}

function ModuleCard({
  mod, progress, onToggleResource, togglingId,
}: {
  mod: PlanModule
  progress: Record<string, { done: boolean }>
  onToggleResource: (resourceId: string, done: boolean) => void
  togglingId: string | null
}) {
  const [open, setOpen] = useState(false)
  const pct = moduleProgress(mod, progress)
  const donePct = Math.round(pct)
  const doneCount = mod.resources.filter(r => progress[r.id]?.done).length

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: pct === 100 ? '1.5px solid rgba(5,150,105,0.25)' : '1.5px solid rgba(226,232,240,0.8)',
      background: 'white',
      boxShadow: open ? '0 6px 24px rgba(15,23,42,0.07)' : '0 2px 8px rgba(15,23,42,0.04)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Module header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '16px 18px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
        }}
      >
        {/* Priority badge */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: pct === 100 ? '#059669' : open ? '#15130F' : '#FAF7F1',
          border: pct === 100 ? 'none' : open ? 'none' : '1.5px solid #F1EAE0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {pct === 100
            ? <CheckCircle2 size={16} color="white" />
            : <span style={{ fontSize: 12, fontWeight: 800, color: open ? 'white' : '#15130F' }}>#{mod.priority}</span>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{mod.skill}</span>
            {pct === 100 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.08)', padding: '2px 8px', borderRadius: 20 }}>
                Complete
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
            {mod.why_important}
          </p>
          {/* Mini progress bar */}
          {doneCount > 0 && doneCount < mod.resources.length && (
            <div style={{ marginTop: 6, height: 3, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', maxWidth: 120 }}>
              <div style={{ height: '100%', width: `${donePct}%`, background: 'linear-gradient(90deg, #15130F, #2563EB)', borderRadius: 3 }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' as const }}>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
              <Clock size={10} /> {mod.estimated_hours}h
            </p>
            <p style={{ fontSize: 10, color: '#CBD5E1', margin: '2px 0 0' }}>
              {doneCount}/{mod.resources.length} done
            </p>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: open ? '#15130F' : '#F8FAFC',
            border: open ? 'none' : '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: open ? 'white' : '#94A3B8',
            transition: 'all 0.2s',
          }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {/* Resource list */}
      {open && (
        <div style={{ borderTop: '1px solid #F8FAFC', padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFBFC' }}>
          {mod.resources.map(res => (
            <ResourceCard
              key={res.id}
              resource={res}
              done={!!progress[res.id]?.done}
              loading={togglingId === res.id}
              onToggle={() => onToggleResource(res.id, !progress[res.id]?.done)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function JobLearningPlanPanel({ activeJobId, activeJobTitle, activeCompany }: Props) {
  const qc = useQueryClient()
  const [pollingActive, setPollingActive] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['job-learning-plan', activeJobId],
    queryFn: () => jobPlanApi.get(activeJobId),
    refetchInterval: pollingActive ? 3000 : false,
  })

  // Stop polling once ready or failed
  useEffect(() => {
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
          DISHA AI will analyse the skill gaps between your profile and{' '}
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

  // Ready
  const plan = data.plan!
  const progress = data.progress ?? {}
  const { done, total, pct } = totalProgress(plan.modules, progress)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Overall progress summary card */}
      <div style={{ background: '#FAF7F1', border: '1.5px solid #F1EAE0', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', margin: '0 0 2px' }}>Learning Plan</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{plan.job_title} · {plan.company}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' as const }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#15130F', margin: 0, fontFamily: 'Hind, sans-serif' }}>{pct}%</p>
              <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>{done}/{total} done</p>
            </div>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              title="Regenerate plan"
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'white', border: '1.5px solid #E2E8F0',
                cursor: 'pointer', color: '#94A3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.8)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #15130F, #2563EB)',
            borderRadius: 6, transition: 'width 0.5s',
          }} />
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '6px 0 0' }}>
          {plan.total_estimated_hours}h total · {plan.modules.length} skill modules
        </p>
      </div>

      {/* Module list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.modules
          .sort((a, b) => a.priority - b.priority)
          .map(mod => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              progress={progress}
              togglingId={togglingId}
              onToggleResource={(resourceId, done) =>
                progressMutation.mutate({ resourceId, done })
              }
            />
          ))
        }
      </div>
    </div>
  )
}
