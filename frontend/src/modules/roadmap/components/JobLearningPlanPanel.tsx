import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlayCircle, BookOpen, ExternalLink, CheckCircle2, Circle,
  Clock, Zap, RefreshCw, Loader2, AlertCircle, ChevronDown,
  ChevronUp, Briefcase, Target,
} from 'lucide-react'
import { jobPlanApi, type PlanModule, type PlanResource } from '@/api/jobPlan'
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
        stroke={pct === 100 ? '#22C55E' : '#2D6A4F'} strokeWidth={5}
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

function ResourceCard({
  resource, done, onToggle, loading,
}: {
  resource: PlanResource
  done: boolean
  onToggle: () => void
  loading: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: done ? 'rgba(34,197,94,0.05)' : '#FAFAFA',
      border: done ? '1px solid rgba(34,197,94,0.25)' : '1px solid #E2E8F0',
      transition: 'all 0.2s',
    }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={loading}
        style={{
          background: 'none', border: 'none', cursor: loading ? 'wait' : 'pointer',
          padding: 0, marginTop: 1, flexShrink: 0, opacity: loading ? 0.5 : 1,
          color: done ? '#22C55E' : '#CBD5E1',
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
              fontSize: 11, fontWeight: 600, color: '#2D6A4F',
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
  const [open, setOpen] = useState(mod.priority <= 2)
  const pct = moduleProgress(mod, progress)

  return (
    <div style={{
      border: '1px solid #E2E8F0', borderRadius: 14,
      background: pct === 100 ? 'rgba(34,197,94,0.03)' : '#fff',
      overflow: 'hidden',
    }}>
      {/* Module header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}
      >
        <ProgressRing pct={pct} size={38} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: '#F1F5F9', color: '#475569',
            }}>
              #{mod.priority}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{mod.skill}</span>
            {pct === 100 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={12} /> Done
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0' }}>{mod.why_important}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {mod.estimated_hours}h
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {mod.resources.filter(r => progress[r.id]?.done).length}/{mod.resources.length} resources done
            </span>
          </div>
        </div>

        <div style={{ color: '#94A3B8', flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Resource list */}
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        background: 'linear-gradient(135deg, #F0FDF4, #F8FAFC)',
        border: '1px solid #BBDDD1', borderRadius: 14, padding: '24px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, #2D6A4F, #40916C)',
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
            background: 'linear-gradient(135deg, #2D6A4F, #40916C)', color: 'white',
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
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 16px', gap: 12, textAlign: 'center',
      }}>
        <Loader2 size={28} color="#2D6A4F" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
          DISHA AI is building your roadmap…
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
          Analysing skill gaps and finding the best resources for {activeJobTitle ?? 'this job'}
        </p>
      </div>
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
    <div>
      {/* Plan header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(45,106,79,0.06), rgba(64,145,108,0.04))',
        border: '1px solid rgba(45,106,79,0.15)', borderRadius: 14,
        padding: '16px 18px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Briefcase size={14} color="#2D6A4F" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#2D6A4F' }}>
                {plan.job_title} · {plan.company}
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
              {plan.summary}
            </p>
            {/* Overall progress bar */}
            <div style={{ height: 6, background: '#E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: pct === 100 ? '#22C55E' : 'linear-gradient(90deg, #2D6A4F, #40916C)',
                borderRadius: 6, transition: 'width 0.5s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                {done}/{total} resources completed · {plan.total_estimated_hours}h total
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#22C55E' : '#2D6A4F' }}>
                {pct}%
              </span>
            </div>
          </div>
          {/* Regenerate button */}
          <button
            onClick={() => {
              if (window.confirm('Regenerate plan? This will reset your current progress view (progress is preserved in DB).')) {
                generateMutation.mutate()
              }
            }}
            disabled={generateMutation.isPending}
            title="Regenerate plan"
            style={{
              background: 'none', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '6px 10px', cursor: 'pointer', color: '#94A3B8',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, flexShrink: 0,
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Module list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
