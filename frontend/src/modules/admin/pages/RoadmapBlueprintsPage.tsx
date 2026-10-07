import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, AlertCircle, ExternalLink, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { getApiError } from '@/api/client'
import { colors } from '@/design-system/tokens'
import { roadmapBlueprintsApi, type BlueprintSummary, type ReviewDecision } from '@/api/roadmapBlueprints'

const GROUND_COLOR = { grounded: '#059669', partial: '#D97706', unverified: '#DC2626' } as const

function Pill({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 20, padding: '1px 8px', whiteSpace: 'nowrap' }}>{text}</span>
}

function ReviewPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const { data, isLoading, isError } = useQuery({ queryKey: ['bp-detail', id], queryFn: () => roadmapBlueprintsApi.detail(id) })
  const review = useMutation({
    mutationFn: (d: ReviewDecision) => roadmapBlueprintsApi.review(id, d, notes.trim() || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bp-list'] }); qc.invalidateQueries({ queryKey: ['bp-detail', id] }); setNotes('') },
  })
  const noteOk = notes.trim().length >= 10

  return (
    <aside style={{ background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 14, padding: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{data?.title ?? 'Blueprint'}{data ? ` · v${data.version}` : ''}</h2>
        <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      {isLoading && <p style={{ fontSize: 13 }}>Loading…</p>}
      {isError && <p role="alert" style={{ fontSize: 13, color: '#991B1B' }}>Could not load this blueprint.</p>}
      {data && (
        <div style={{ display: 'grid', gap: 14, marginTop: 10 }}>
          <section>
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Check first</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
              {data.checklist.map((c, i) => <li key={`${c.kind}-${i}`}>{c.text}</li>)}
            </ul>
          </section>
          <section>
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>What grounded it ({data.sources.roles_used?.length ?? 0} reference roles)</h3>
            <p style={{ fontSize: 12, color: colors.text.muted, margin: 0, overflowWrap: 'anywhere' }}>
              {(data.sources.roles_used ?? []).map(r => `${r.role} at ${r.company}`).join(' · ') || 'No catalogue roles matched this role family.'}
            </p>
          </section>
          <section>
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Skills ({data.graph.skills.length})</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {data.graph.skills.map(s => (
                <div key={s.id} style={{ fontSize: 12.5, borderBottom: `1px solid ${colors.border.default}`, paddingBottom: 6 }}>
                  <strong>{s.name}</strong> <span style={{ color: colors.text.muted }}>· {s.base_hours}h · in {s.evidence?.roles_matched ?? 0} of {s.evidence?.roles_total ?? 0} roles</span>
                  <div style={{ color: colors.text.muted }}>{s.why_for_role}</div>
                  {s.references.map(r => (
                    <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginRight: 10, color: colors.brand.navy }}>
                      {r.title || r.url} <ExternalLink size={11} />{r.verified === false ? ' (not auto-checked)' : ''}
                    </a>
                  ))}
                  {s.references.length === 0 && <span style={{ color: '#B45309' }}>No verified reference</span>}
                </div>
              ))}
            </div>
          </section>
          {data.review_notes && <p style={{ fontSize: 12.5, margin: 0 }}><strong>Last review note:</strong> {data.review_notes}</p>}
          <section>
            <label htmlFor="bp-notes" style={{ fontSize: 13, fontWeight: 700 }}>Review note (required to approve or request changes)</label>
            <textarea id="bp-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="What did you check? Statutes, proof tasks, links…"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 8, border: `1px solid ${colors.border.default}`, borderRadius: 8, fontSize: 13 }} />
            {review.isError && <p role="alert" style={{ fontSize: 12.5, color: '#991B1B', margin: '6px 0 0' }}>{getApiError(review.error)}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <Button size="sm" disabled={!noteOk || review.isPending} onClick={() => review.mutate('approve')}>Approve as reviewed</Button>
              <Button size="sm" variant="secondary" disabled={!noteOk || review.isPending} onClick={() => review.mutate('needs_changes')}>Needs changes</Button>
              <Button size="sm" variant="ghost" disabled={review.isPending} onClick={() => { if (window.confirm('Retire this blueprint? It will stop being used for new plans.')) review.mutate('retire') }}>Retire</Button>
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}

export default function RoadmapBlueprintsPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading, isError } = useQuery({ queryKey: ['bp-list'], queryFn: roadmapBlueprintsApi.list })
  const rows: BlueprintSummary[] = (data ?? []).filter(b => b.is_current)

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={20} />
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Roadmap blueprints</h1>
          <p style={{ fontSize: 13, color: colors.text.muted, margin: 0 }}>Drafts are usable but unreviewed. Approving records who checked it and why.</p>
        </div>
      </header>
      {isLoading && <p>Loading…</p>}
      {isError && <p role="alert" style={{ color: '#991B1B', display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={15} /> Could not load blueprints.</p>}
      {data && rows.length === 0 && <p style={{ fontSize: 14 }}>No current blueprints yet. They are drafted when a roadmap is first requested for a role.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: openId ? 'minmax(0,1fr) minmax(0,1.2fr)' : '1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map(b => (
            <button key={b.id} onClick={() => setOpenId(b.id)} style={{ textAlign: 'left', background: openId === b.id ? '#F1F5F9' : '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 12, padding: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>{b.title}</strong>
                <Pill text={b.review_status === 'reviewed' ? 'Reviewed' : 'Draft'} color={b.review_status === 'reviewed' ? '#059669' : '#B45309'} />
                <Pill text={`${b.grounding.level} ${b.grounding.skills_with_postings}/${b.grounding.skills_total}`} color={GROUND_COLOR[b.grounding.level]} />
              </div>
              <div style={{ fontSize: 12, color: colors.text.muted, marginTop: 4 }}>
                v{b.version} · {b.skills} skills · {b.total_base_hours}h · {b.roles_analyzed} reference roles · judge {b.judge_score ?? 'n/a'}
                {b.reviewed_by ? ` · reviewed by ${b.reviewed_by}` : ''}
              </div>
            </button>
          ))}
        </div>
        {openId && <ReviewPanel id={openId} onClose={() => setOpenId(null)} />}
      </div>
    </div>
  )
}
