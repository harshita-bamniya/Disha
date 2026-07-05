/**
 * Talent Pool — saved candidates with search, skill filter, and client-side folder labels.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTalentPool, unsaveCandidate, type SavedCandidateOut } from '@/api/matching'
import {
  ArrowLeft, Star, MapPin, GraduationCap, Briefcase, X, Users,
  Search, Tag, Plus, Folder,
} from 'lucide-react'

// ── Folder labels stored in localStorage ─────────────────────────────────────

const LS_KEY = 'talent_pool_labels'

function loadLabels(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}

function saveLabels(labels: Record<string, string[]>) {
  localStorage.setItem(LS_KEY, JSON.stringify(labels))
}

const PRESET_FOLDERS = ['Urgent', 'Strong Fit', 'Future Pipeline', 'Interviewed', 'Shortlisted']

// ── Candidate card ────────────────────────────────────────────────────────────

function CandidateCard({
  candidate, labels, allFolders, onToggleLabel, onRemoveLabel,
}: {
  candidate: SavedCandidateOut
  labels: string[]
  allFolders: string[]
  onToggleLabel: (label: string) => void
  onRemoveLabel: (label: string) => void
}) {
  const qc = useQueryClient()
  const unsave = useMutation({
    mutationFn: () => unsaveCandidate(candidate.aspirant_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['talent-pool'] }),
  })
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [customLabel, setCustomLabel] = useState('')

  const addCustom = () => {
    const l = customLabel.trim()
    if (l) { onToggleLabel(l); setCustomLabel('') }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>{candidate.full_name ?? 'Anonymous'}</h3>
          {(candidate.city || candidate.state) && (
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} />{[candidate.city, candidate.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={() => unsave.mutate()}
          disabled={unsave.isPending}
          title="Remove from talent pool"
          style={{ width: 28, height: 28, border: 'none', background: '#F1F5F9', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <X size={13} color="#64748B" />
        </button>
      </div>

      {/* Details */}
      {candidate.highest_qualification && (
        <p style={{ fontSize: 12, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <GraduationCap size={12} color="#3B82F6" />{candidate.highest_qualification}
        </p>
      )}
      {candidate.last_designation && (
        <p style={{ fontSize: 12, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Briefcase size={12} color="#7C3AED" />{candidate.last_designation}
        </p>
      )}

      {/* Skills */}
      {candidate.skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {candidate.skills.slice(0, 5).map(s => (
            <span key={s} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.07)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.12)' }}>{s}</span>
          ))}
          {candidate.skills.length > 5 && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, color: '#94A3B8' }}>+{candidate.skills.length - 5}</span>
          )}
        </div>
      )}

      {/* Folder labels */}
      {labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {labels.map(l => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.15)' }}>
              <Folder size={9} />{l}
              <button onClick={() => onRemoveLabel(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#D97706', lineHeight: 1, marginLeft: 2 }}><X size={9} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {candidate.composite !== null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>KRS {candidate.composite}</span>
          )}
          <span style={{ fontSize: 10, color: '#94A3B8' }}>
            Saved {new Date(candidate.saved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {candidate.saved_by_name ? ` · ${candidate.saved_by_name}` : ''}
          </span>
        </div>

        {/* Add to folder button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLabelMenu(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F8FAFC', fontSize: 11, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}
          >
            <Tag size={10} />Label
          </button>
          {showLabelMenu && (
            <div style={{
              position: 'absolute', bottom: 32, right: 0, zIndex: 20, minWidth: 180,
              background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 10,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6, padding: '0 4px' }}>Folders</p>
              {allFolders.map(f => (
                <button
                  key={f}
                  onClick={() => { onToggleLabel(f); setShowLabelMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                    padding: '6px 8px', borderRadius: 8, border: 'none',
                    background: labels.includes(f) ? 'rgba(217,119,6,0.08)' : 'transparent',
                    color: labels.includes(f) ? '#D97706' : '#374151',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Folder size={11} />{f}
                  {labels.includes(f) && <X size={10} style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                <input
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()}
                  placeholder="New folder…"
                  style={{ flex: 1, height: 28, borderRadius: 7, border: '1px solid #E5E7EB', padding: '0 8px', fontSize: 11 }}
                />
                <button onClick={addCustom} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TalentPoolPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['talent-pool'], queryFn: getTalentPool })
  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [labels, setLabels] = useState<Record<string, string[]>>(loadLabels)

  const toggleLabel = (aspirantId: string, label: string) => {
    setLabels(prev => {
      const cur = prev[aspirantId] ?? []
      const next = cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label]
      const updated = { ...prev, [aspirantId]: next }
      saveLabels(updated)
      return updated
    })
  }

  const removeLabel = (aspirantId: string, label: string) => {
    setLabels(prev => {
      const updated = { ...prev, [aspirantId]: (prev[aspirantId] ?? []).filter(l => l !== label) }
      saveLabels(updated)
      return updated
    })
  }

  // Collect all folders used across all candidates
  const allFolders = useMemo(() => {
    const used = new Set<string>()
    Object.values(labels).flat().forEach(l => used.add(l))
    PRESET_FOLDERS.forEach(f => used.add(f))
    return Array.from(used)
  }, [labels])

  const filtered = useMemo(() => {
    let list = data ?? []
    if (activeFolder) {
      list = list.filter(c => (labels[c.aspirant_id] ?? []).includes(activeFolder))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.last_designation ?? '').toLowerCase().includes(q) ||
        c.skills.some(s => s.toLowerCase().includes(q)) ||
        (c.city ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [data, search, activeFolder, labels])

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allFolders.forEach(f => {
      counts[f] = (data ?? []).filter(c => (labels[c.aspirant_id] ?? []).includes(f)).length
    })
    return counts
  }, [data, allFolders, labels])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F0FE 50%, #F5F0FF 100%)' }}>

      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,58,95,0.07)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
        <Link to="/app/employer/dashboard" style={{ color: '#64748B', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={14} />Back
        </Link>
        <div style={{ width: 1, height: 24, background: '#E5E7EB' }} />
        <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={16} fill="#D97706" color="#D97706" />Talent Pool
        </h1>
        {data && <span style={{ fontSize: 12, color: '#94A3B8' }}>{data.length} saved</span>}

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 360, marginLeft: 'auto', position: 'relative' }}>
          <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, skill, city…"
            style={{ width: '100%', height: 36, borderRadius: 10, border: '1.5px solid #E5E7EB', paddingLeft: 32, paddingRight: 12, fontSize: 13, outline: 'none', background: '#F8FAFC', boxSizing: 'border-box' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}><X size={13} /></button>}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px', display: 'flex', gap: 20 }}>

        {/* Sidebar — folders */}
        <aside style={{ width: 180, flexShrink: 0 }}>
          <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.95)', padding: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, padding: '0 4px' }}>Folders</p>
            <button
              onClick={() => setActiveFolder(null)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 8px', borderRadius: 9, border: 'none', background: activeFolder === null ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeFolder === null ? '#3B82F6' : '#374151', fontSize: 12, fontWeight: activeFolder === null ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Star size={12} />All</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>{data?.length ?? 0}</span>
            </button>
            {allFolders.filter(f => folderCounts[f] > 0 || PRESET_FOLDERS.includes(f)).map(f => (
              <button
                key={f}
                onClick={() => setActiveFolder(activeFolder === f ? null : f)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 8px', borderRadius: 9, border: 'none', background: activeFolder === f ? 'rgba(217,119,6,0.1)' : 'transparent', color: activeFolder === f ? '#D97706' : '#374151', fontSize: 12, fontWeight: activeFolder === f ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginTop: 1 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Folder size={12} />{f}</span>
                {folderCounts[f] > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>{folderCounts[f]}</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : isError ? (
            <p style={{ textAlign: 'center', color: '#DC2626', padding: 40 }}>Failed to load talent pool.</p>
          ) : !data || data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <Star size={40} fill="rgba(217,119,6,0.15)" color="#D97706" style={{ display: 'block', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F', margin: '0 0 6px' }}>No saved candidates yet</p>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Open a candidate's profile from any job pipeline and click ★ to save them here.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <Search size={32} color="#E5E7EB" style={{ display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#64748B', margin: '0 0 4px' }}>No matches found</p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{activeFolder ? `No candidates in "${activeFolder}"` : 'Try a different search term'}</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12, fontWeight: 600 }}>
                {filtered.length} candidate{filtered.length !== 1 ? 's' : ''}
                {activeFolder ? ` in "${activeFolder}"` : ''}
                {search ? ` matching "${search}"` : ''}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {filtered.map(c => (
                  <CandidateCard
                    key={c.aspirant_id}
                    candidate={c}
                    labels={labels[c.aspirant_id] ?? []}
                    allFolders={allFolders}
                    onToggleLabel={label => toggleLabel(c.aspirant_id, label)}
                    onRemoveLabel={label => removeLabel(c.aspirant_id, label)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
