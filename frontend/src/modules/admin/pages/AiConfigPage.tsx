import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, ChevronDown, ChevronRight, Plus, Zap, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { adminApi } from '@/api/admin'
import type { PromptTemplateEntry, PromptTemplateDetail } from '@/api/admin'
import { Badge, Spinner, Empty } from '@/modules/admin/shared/adminUI'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'


// ── Types ──────────────────────────────────────────────────────────────────────

type UseCaseGroup = {
  use_case: string
  model_hint: string | null
  versions: PromptTemplateEntry[]
}

const PROMPT_TYPE_COLOR: Record<string, string> = {
  system: 'blue',
  user: 'purple',
  assistant: 'green',
}

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-5':   'Sonnet 5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-opus-4-8':   'Opus 4.8',
}

// ── Inline notification banner ─────────────────────────────────────────────────

type Notif = { type: 'success' | 'error'; message: string }

function NotifBanner({ notif, onDismiss }: { notif: Notif; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 text-sm mb-6" style={{
      padding: '12px 16px',
      borderRadius: 10,
      border: notif.type === 'success' ? '1px solid #86EFAC' : '1px solid #FCA5A5',
      background: notif.type === 'success' ? '#F0FDF4' : '#FEF2F2',
      color: notif.type === 'success' ? '#15803D' : '#DC2626',
    }}>
      {notif.type === 'success'
        ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
        : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      <p className="flex-1">{notif.message}</p>
      <button onClick={onDismiss} aria-label="Dismiss"><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
    </div>
  )
}

// ── Prompt edit modal ──────────────────────────────────────────────────────────

type EditModalProps = {
  useCase: string
  modelHint: string | null
  basePrompt?: PromptTemplateDetail | null
  onClose: () => void
  onSaved: () => void
}

const MODEL_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
]

function EditModal({ useCase, modelHint, basePrompt, onClose, onSaved }: EditModalProps) {
  const qc = useQueryClient()
  const [content, setContent] = useState(basePrompt?.content ?? '')
  const [name, setName] = useState(basePrompt?.name ?? '')
  const [model, setModel] = useState(modelHint ?? '')
  const [notes, setNotes] = useState(basePrompt?.notes ?? '')
  const [promptType, setPromptType] = useState<'system' | 'user' | 'assistant'>(
    basePrompt?.prompt_type ?? 'system',
  )

  const create = useMutation({
    mutationFn: () =>
      adminApi.createPrompt({
        name,
        use_case: useCase,
        prompt_type: promptType,
        content,
        model_hint: model || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'prompts'] })
      onSaved()
    },
  })

  const charCount = content.length

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 672, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 900, color: colors.text.ink }}>New version — <span style={{ color: colors.brand.navy }}>{useCase}</span></p>
            <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>Publishing this version will deactivate the current active version.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: colors.text.muted }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Prompt name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. career_match_v3"
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Prompt type</label>
              <select
                value={promptType}
                onChange={e => setPromptType(e.target.value as 'system' | 'user' | 'assistant')}
                style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, background: '#fff', outline: 'none' }}
              >
                <option value="system">System</option>
                <option value="user">User</option>
                <option value="assistant">Assistant</option>
              </select>
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Model hint</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, background: '#fff', outline: 'none' }}
              >
                {MODEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink }}>Prompt content</label>
              <span style={{ fontSize: 10, color: colors.text.muted }}>{charCount.toLocaleString()} chars</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={14}
              placeholder="Enter the full prompt text…"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, fontFamily: 'monospace', outline: 'none', resize: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, marginBottom: 4, display: 'block' }}>Notes <span style={{ fontWeight: 400, color: colors.text.muted }}>(optional)</span></label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why this version? What changed?"
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 14, outline: 'none' }}
            />
          </div>

          {create.isError && (
            <p style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '8px 12px' }}>
              {(create.error as any)?.response?.data?.detail ?? 'Failed to create prompt version.'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!content.trim() || !name.trim()}
            onClick={() => create.mutate()}
          >Publish version</Button>
        </div>
      </div>
    </div>
  )
}

// ── Use-case group card ────────────────────────────────────────────────────────

function UseCaseCard({ group }: { group: UseCaseGroup }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [editingVersion, setEditingVersion] = useState<PromptTemplateDetail | null | undefined>(undefined)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const activate = useMutation({
    mutationFn: (id: string) => adminApi.activatePromptVersion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'prompts'] }),
  })

  const activeCount = group.versions.filter(v => v.is_active).length

  const handleToggle = async (v: PromptTemplateEntry) => {
    setLoadingId(v.id)
    try { await activate.mutateAsync(v.id) } finally { setLoadingId(null) }
  }

  const handleEditClick = async (v: PromptTemplateEntry) => {
    setEditingVersion(null)
    const detail = await adminApi.getPrompt(v.id)
    setEditingVersion(detail)
  }

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {/* Group header */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-3 text-left"
          style={{ padding: '16px 20px' }}
          onMouseOver={e => (e.currentTarget.style.background = colors.surface.bg)}
          onMouseOut={e => (e.currentTarget.style.background = '#fff')}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot className="w-4 h-4" style={{ color: colors.text.ink }} />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 14, fontWeight: 900, color: colors.text.ink }}>{group.use_case}</p>
            <p style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>
              {group.versions.length} version{group.versions.length !== 1 ? 's' : ''}
              {activeCount > 0 && ` · ${activeCount} active${activeCount === 2 ? ' (A/B)' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {group.model_hint && (
              <span style={{ fontSize: 11, fontWeight: 600, color: colors.text.muted, background: colors.surface.bg, padding: '2px 8px', borderRadius: 6 }}>
                {MODEL_LABELS[group.model_hint] ?? group.model_hint}
              </span>
            )}
            {activeCount === 2 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', background: '#EDE9FE', padding: '2px 8px', borderRadius: 6 }}>A/B</span>
            )}
            {expanded ? <ChevronDown className="w-4 h-4" style={{ color: colors.text.muted }} /> : <ChevronRight className="w-4 h-4" style={{ color: colors.text.muted }} />}
          </div>
        </button>

        {/* Version list */}
        {expanded && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            {group.versions.map((v, idx) => (
              <div
                key={v.id}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  borderBottom: idx !== group.versions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 10, background: colors.surface.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: colors.text.muted }}>v{v.version}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span style={{ fontSize: 14, fontWeight: 700, color: colors.text.ink }}>{v.name}</span>
                    <Badge color={PROMPT_TYPE_COLOR[v.prompt_type] ?? 'gray'}>{v.prompt_type}</Badge>
                    {v.is_active && <Badge color="green">Active</Badge>}
                    {v.model_hint && (
                      <span style={{ fontSize: 10, color: colors.text.muted, fontWeight: 500 }}>{MODEL_LABELS[v.model_hint] ?? v.model_hint}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: colors.text.muted, fontFamily: 'monospace', lineHeight: 1.6 }} className="line-clamp-3 whitespace-pre-wrap break-all">
                    {v.content_preview}
                  </p>
                  {v.notes && <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 4, fontStyle: 'italic' }}>{v.notes}</p>}
                  <p style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>
                    {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(v)}
                    disabled={loadingId === v.id || activate.isPending}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 600,
                      border: 'none',
                      opacity: (loadingId === v.id || activate.isPending) ? 0.5 : 1,
                      background: v.is_active ? '#F0FDF4' : colors.surface.bg,
                      color: v.is_active ? '#15803D' : colors.text.muted,
                    }}
                  >
                    {loadingId === v.id ? '…' : v.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEditClick(v)}
                    style={{ padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: colors.surface.elevated, color: colors.text.ink, border: 'none' }}
                  >
                    New version
                  </button>
                </div>
              </div>
            ))}

            <div style={{ padding: '12px 20px', background: colors.surface.bg, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <button
                onClick={() => setEditingVersion(undefined)}
                className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 600, color: colors.brand.navy, background: 'transparent', border: 'none' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add new version from scratch
              </button>
            </div>
          </div>
        )}
      </div>

      {editingVersion !== undefined && (
        editingVersion === null ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <EditModal
            useCase={group.use_case}
            modelHint={group.model_hint}
            basePrompt={editingVersion}
            onClose={() => setEditingVersion(undefined)}
            onSaved={() => setEditingVersion(undefined)}
          />
        )
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AiConfigPage() {
  const qc = useQueryClient()
  const [notif, setNotif] = useState<Notif | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)
  const [backfillLoading, setBackfillLoading] = useState(false)

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['admin', 'prompts'],
    queryFn: adminApi.listPrompts,
    staleTime: 30_000,
  })

  const groups: UseCaseGroup[] = []
  if (prompts) {
    const map = new Map<string, UseCaseGroup>()
    for (const p of prompts) {
      if (!map.has(p.use_case)) {
        map.set(p.use_case, { use_case: p.use_case, model_hint: p.model_hint, versions: [] })
      }
      map.get(p.use_case)!.versions.push(p)
      if (p.is_active && p.model_hint) map.get(p.use_case)!.model_hint = p.model_hint
    }
    groups.push(...map.values())
    groups.sort((a, b) => a.use_case.localeCompare(b.use_case))
  }

  const handleSeed = async () => {
    setSeedLoading(true)
    try {
      const res = await adminApi.seedPrompts()
      qc.invalidateQueries({ queryKey: ['admin', 'prompts'] })
      setNotif({ type: 'success', message: res.message })
    } catch {
      setNotif({ type: 'error', message: 'Failed to seed prompts. Check backend logs.' })
    } finally {
      setSeedLoading(false)
    }
  }

  const handleBackfill = async () => {
    setBackfillLoading(true)
    try {
      const res = await adminApi.backfillEmbeddings()
      setNotif({
        type: 'success',
        message: `Backfill queued: ${res.jobs_queued} job(s) and ${res.profiles_queued} profile(s). Already-embedded rows were skipped.`,
      })
    } catch {
      setNotif({ type: 'error', message: 'Backfill failed. Check Celery worker and backend logs.' })
    } finally {
      setBackfillLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot className="w-5 h-5" style={{ color: colors.text.ink }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.text.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>AI Configuration</h1>
            <p style={{ fontSize: 14, color: colors.text.muted }}>Manage prompt templates, model hints, and embedding backfill. Changes take effect on the next AI call.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackfill}
            disabled={backfillLoading}
            className="flex items-center gap-1.5"
            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: colors.text.ink, fontSize: 14, fontWeight: 600, opacity: backfillLoading ? 0.5 : 1 }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', backfillLoading && 'animate-spin')} />
            {backfillLoading ? 'Queueing…' : 'Backfill Embeddings'}
          </button>
          <button
            onClick={handleSeed}
            disabled={seedLoading}
            className="flex items-center gap-1.5"
            style={{ padding: '8px 16px', borderRadius: 10, background: colors.brand.navy, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', opacity: seedLoading ? 0.5 : 1 }}
          >
            <Zap className="w-3.5 h-3.5" />
            {seedLoading ? 'Seeding…' : 'Seed Defaults'}
          </button>
        </div>
      </div>

      {notif && <NotifBanner notif={notif} onDismiss={() => setNotif(null)} />}

      {/* A/B info pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surface.bg, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '10px 16px', marginBottom: 24, fontSize: 12, color: colors.text.ink, fontWeight: 500 }}>
        <span style={{ fontWeight: 700, color: colors.brand.navy }}>A/B testing:</span>
        Up to 2 versions per use case can be active simultaneously. Activate a second version to run an A/B test; deactivate one to promote a winner.
      </div>

      {isLoading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Empty icon={Bot} text="No prompt templates yet. Click 'Seed Defaults' to load the built-in prompts." />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(g => <UseCaseCard key={g.use_case} group={g} />)}
        </div>
      )}
    </div>
  )
}
