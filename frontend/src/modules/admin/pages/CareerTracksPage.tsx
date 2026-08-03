import { useState } from 'react'
import { Compass, Plus, Pencil, Trash2, ChevronDown, ChevronUp, AlertCircle, X } from 'lucide-react'
import {
  useAdminCareerTracks, useCreateCareerTrack, useUpdateCareerTrack, useDeleteCareerTrack,
} from '../hooks/useAdmin'
import { Spinner, Empty, Badge } from '../shared/adminUI'
import { getApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import type { CareerTrackAdminEntry } from '@/api/admin'

const N = { navy: '#1A2744', ink: '#1E3A5F', muted: '#94A3B8', cream: '#F4F5F7', creamDk: '#EAECF0' }

const EMPTY_FORM = {
  slug: '', title: '', description: '', sector: '',
  required_skills: '', min_k_score: 0, salary_range: '', growth_outlook: '', example_roles: '',
}
type TrackFormState = typeof EMPTY_FORM

const inputCls = 'w-full px-3 text-sm outline-none'
const inputStyle = { border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }

function TrackFormModal({ initial, onSave, onCancel, saving, error }: {
  initial?: CareerTrackAdminEntry | null
  onSave: (data: TrackFormState) => void
  onCancel: () => void
  saving: boolean
  error?: string | null
}) {
  const [form, setForm] = useState<TrackFormState>(
    initial ? {
      slug: initial.slug, title: initial.title, description: initial.description,
      sector: initial.sector, required_skills: initial.required_skills.join(', '),
      min_k_score: initial.min_k_score, salary_range: initial.salary_range ?? '',
      growth_outlook: initial.growth_outlook ?? '', example_roles: initial.example_roles.join(', '),
    } : EMPTY_FORM,
  )
  const set = (k: keyof TrackFormState, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!initial

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 24, width: '100%', maxWidth: 512 }}>
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: N.ink }}>{isEdit ? 'Edit career track' : 'New career track'}</h3>
          <button onClick={onCancel} style={{ color: N.muted }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Slug *</label>
              <input value={form.slug} onChange={e => set('slug', e.target.value)} disabled={isEdit} placeholder="policy-research"
                className={inputCls + ' h-9 disabled:opacity-50'} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Policy Research"
                className={inputCls + ' h-9'} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              className={inputCls + ' py-2 resize-none'} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Sector *</label>
              <input value={form.sector} onChange={e => set('sector', e.target.value)} placeholder="Consulting"
                className={inputCls + ' h-9'} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Min K-score</label>
              <input type="number" min={0} max={100} value={form.min_k_score} onChange={e => set('min_k_score', Number(e.target.value))}
                className={inputCls + ' h-9'} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Required skills * <span className="font-normal" style={{ color: N.muted }}>(comma-separated)</span></label>
            <input value={form.required_skills} onChange={e => set('required_skills', e.target.value)} placeholder="Analytical Thinking, Research"
              className={inputCls + ' h-9'} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Example roles <span className="font-normal" style={{ color: N.muted }}>(comma-separated)</span></label>
            <input value={form.example_roles} onChange={e => set('example_roles', e.target.value)} placeholder="Policy Analyst, Research Associate"
              className={inputCls + ' h-9'} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Salary range</label>
              <input value={form.salary_range} onChange={e => set('salary_range', e.target.value)} placeholder="8–20 LPA"
                className={inputCls + ' h-9'} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: N.ink }}>Growth outlook</label>
              <select value={form.growth_outlook} onChange={e => set('growth_outlook', e.target.value)}
                className={inputCls + ' h-9'} style={inputStyle}>
                <option value="">— none —</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 px-3 py-2" style={{ background: '#FEF2F2', borderRadius: 10 }}>
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 h-10 text-sm font-medium" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }}>Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.slug.trim() || !form.title.trim() || !form.description.trim() || !form.sector.trim()}
            className="flex-1 h-10 text-sm font-semibold disabled:opacity-40"
            style={{ background: N.navy, color: '#fff', borderRadius: 10, border: 'none' }}
          >{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create track'}</button>
        </div>
      </div>
    </div>
  )
}

export default function CareerTracksPage() {
  const { data: tracks, isLoading } = useAdminCareerTracks()
  const createMutation = useCreateCareerTrack()
  const updateMutation = useUpdateCareerTrack()
  const deleteMutation = useDeleteCareerTrack()
  const [showForm, setShowForm]         = useState(false)
  const [editTarget, setEditTarget]     = useState<CareerTrackAdminEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CareerTrackAdminEntry | null>(null)
  const [formError, setFormError]       = useState<string | null>(null)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const parseComma = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

  const handleSave = (form: TrackFormState) => {
    setFormError(null)
    const payload = {
      slug: form.slug.trim(), title: form.title.trim(), description: form.description.trim(),
      sector: form.sector.trim(), required_skills: parseComma(form.required_skills),
      min_k_score: Number(form.min_k_score), salary_range: form.salary_range.trim() || null,
      growth_outlook: form.growth_outlook.trim() || null, example_roles: parseComma(form.example_roles),
    }
    if (editTarget) {
      updateMutation.mutate({ trackId: editTarget.id, payload }, {
        onSuccess: () => { setEditTarget(null); setShowForm(false) },
        onError: (e: unknown) => setFormError(getApiError(e, 'Failed to save')),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => setShowForm(false),
        onError: (e: unknown) => setFormError(getApiError(e, 'Failed to save')),
      })
    }
  }

  const growthColor = (g: string | null) => g === 'high' ? 'green' : g === 'medium' ? 'amber' : 'gray'

  return (
    <section className="flex flex-col gap-6">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: N.ink, fontFamily: 'Hind, sans-serif', letterSpacing: '-0.3px' }}>Career Tracks</h1>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: N.cream }}>
          <h2 className="text-sm font-bold" style={{ color: N.ink }}>All Tracks</h2>
          <button onClick={() => { setEditTarget(null); setFormError(null); setShowForm(true) }}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold"
            style={{ background: N.navy, color: '#fff', borderRadius: 10, border: 'none' }}>
            <Plus className="w-3.5 h-3.5" /> New track
          </button>
        </div>

        {isLoading ? <Spinner /> : !tracks || tracks.length === 0 ? (
          <Empty icon={Compass} text="No career tracks yet" />
        ) : (
          <>
            {tracks.map((track, idx) => {
              const expanded = expandedId === track.id
              return (
                <div key={track.id} className="px-4 py-3" style={{ borderBottom: idx < tracks.length - 1 ? '1px solid rgba(0,0,0,0.06)' : undefined, background: idx % 2 === 0 ? '#fff' : N.cream }}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExpandedId(expanded ? null : track.id)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0">
                      {expanded ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: N.muted }} /> : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: N.muted }} />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{track.title}</p>
                          <Badge color={growthColor(track.growth_outlook)}>{track.growth_outlook ?? 'n/a'}</Badge>
                        </div>
                        <p className="text-xs" style={{ color: N.muted }}>{track.sector} · min K {track.min_k_score} · {track.aspirant_count} aspirants</p>
                      </div>
                    </button>
                    {track.salary_range && <span className="text-xs shrink-0 hidden sm:block" style={{ color: N.muted }}>{track.salary_range}</span>}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditTarget(track); setFormError(null); setShowForm(true) }}
                        className="p-1.5 transition-colors" style={{ borderRadius: 8 }}
                        onMouseOver={e => (e.currentTarget.style.background = N.creamDk)}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                        <Pencil className="w-3.5 h-3.5" style={{ color: N.muted }} />
                      </button>
                      <button onClick={() => setDeleteTarget(track)}
                        className="p-1.5 transition-colors" style={{ borderRadius: 8 }}
                        onMouseOver={e => (e.currentTarget.style.background = '#FEF2F2')}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 ml-6 flex flex-col gap-2">
                      <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>{track.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {track.required_skills.map(s => (
                          <span key={s} className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ background: N.creamDk, color: N.ink }}>{s}</span>
                        ))}
                      </div>
                      {track.example_roles.length > 0 && (
                        <p className="text-xs" style={{ color: N.muted }}>Roles: {track.example_roles.join(' · ')}</p>
                      )}
                      <p className="text-xs font-mono" style={{ color: N.muted }}>slug: {track.slug}</p>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="px-4 py-2.5" style={{ background: N.cream, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p className="text-xs" style={{ color: N.muted }}>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <TrackFormModal
          initial={editTarget}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
          saving={createMutation.isPending || updateMutation.isPending}
          error={formError}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', padding: 24, maxWidth: 384, width: '100%' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: N.ink }}>Delete career track?</h3>
            <p className="text-sm mb-5" style={{ color: N.muted }}>
              <span className="font-semibold" style={{ color: N.ink }}>"{deleteTarget.title}"</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-10 text-sm font-medium" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, background: '#fff', color: N.ink }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })} disabled={deleteMutation.isPending}
                className="flex-1 h-10 text-sm font-semibold disabled:opacity-40"
                style={{ background: '#EF4444', color: '#fff', borderRadius: 10, border: 'none' }}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
