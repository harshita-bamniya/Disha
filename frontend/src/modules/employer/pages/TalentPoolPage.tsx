import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTalentPool, unsaveCandidate, type SavedCandidateOut } from '@/api/matching'
import { MapPin, GraduationCap, Briefcase, X, Search, Tag, Plus, Trash2 } from 'lucide-react'
import { DS, C, initials } from '../ds'

const LS_KEY = 'talent_pool_labels'
function loadLabels(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}
function saveLabels(labels: Record<string, string[]>) {
  localStorage.setItem(LS_KEY, JSON.stringify(labels))
}

const PRESET_FOLDERS = ['Urgent', 'Strong Fit', 'Future Pipeline', 'Interviewed', 'Shortlisted']

function CandidateRow({ candidate, labels, allFolders, onToggleLabel }: {
  candidate: SavedCandidateOut; labels: string[]
  allFolders: string[]; onToggleLabel: (l: string) => void
}) {
  const qc = useQueryClient()
  const unsave = useMutation({
    mutationFn: () => unsaveCandidate(candidate.aspirant_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['talent-pool'] }),
  })
  const [showLabels, setShowLabels] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const ini = initials(candidate.full_name)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.1s' }}
      onMouseOver={e => { e.currentTarget.style.background = '#FAFAFA' }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar */}
      <div style={{ width: 36, height: 36, borderRadius: 8, background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: '-0.3px' }}>
        {ini}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: 0 }}>{candidate.full_name ?? 'Anonymous'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4, alignItems: 'center' }}>
              {(candidate.city || candidate.state) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.ink3 }}>
                  <MapPin size={10} />{[candidate.city, candidate.state].filter(Boolean).join(', ')}
                </span>
              )}
              {candidate.highest_education && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.ink3 }}>
                  <GraduationCap size={10} />{candidate.highest_education}
                </span>
              )}
              {candidate.years_of_experience != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.ink3 }}>
                  <Briefcase size={10} />{candidate.years_of_experience}y exp
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => setShowLabels(!showLabels)} style={{ ...DS.btnIcon, color: showLabels ? C.accent : C.ink3 }} title="Labels">
              <Tag size={12} />
            </button>
            <button onClick={() => unsave.mutate()} disabled={unsave.isPending} style={{ ...DS.btnIcon, color: C.red }} title="Remove">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Skills */}
        {(candidate.top_skills ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {(candidate.top_skills ?? []).slice(0, 6).map(skill => (
              <span key={skill} style={{ padding: '2px 8px', background: C.accentBg, color: C.accent, fontSize: 11, fontWeight: 500, borderRadius: 4 }}>{skill}</span>
            ))}
            {(candidate.top_skills ?? []).length > 6 && (
              <span style={{ padding: '2px 8px', background: C.borderLight, color: C.ink3, fontSize: 11, borderRadius: 4 }}>+{candidate.top_skills.length - 6}</span>
            )}
          </div>
        )}

        {/* Active labels */}
        {labels.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {labels.map(l => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#F5F3FF', color: '#7C3AED', fontSize: 11, fontWeight: 500, borderRadius: 4 }}>
                {l}
                <button onClick={() => onToggleLabel(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', padding: 0, display: 'flex' }}>
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Label picker */}
        {showLabels && (
          <div style={{ marginTop: 10, padding: 12, background: '#FAFAFA', border: `1px solid ${C.border}`, borderRadius: 7 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {allFolders.map(f => (
                <button key={f} onClick={() => onToggleLabel(f)} style={{
                  padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.border}`,
                  background: labels.includes(f) ? C.accentBg : 'transparent',
                  color: labels.includes(f) ? C.accent : C.ink2,
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}>{f}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customLabel.trim()) { onToggleLabel(customLabel.trim()); setCustomLabel('') } }}
                placeholder="Custom label…"
                style={{ ...DS.input, flex: 1 }}
              />
              <button onClick={() => { if (customLabel.trim()) { onToggleLabel(customLabel.trim()); setCustomLabel('') } }} style={DS.btnSecondary}>
                <Plus size={12} />Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TalentPoolPage() {
  const [search, setSearch]     = useState('')
  const [skillFilter, setSkill] = useState('')
  const [folderFilter, setFolder] = useState('')
  const [labels, setLabels]     = useState(loadLabels)

  const { data: pool, isLoading } = useQuery({ queryKey: ['talent-pool'], queryFn: getTalentPool })
  const candidates = pool?.candidates ?? []

  const allFolders = useMemo(() => {
    const custom = Object.values(labels).flat()
    return [...new Set([...PRESET_FOLDERS, ...custom])]
  }, [labels])

  const allSkills = useMemo(() => {
    const s = new Set<string>()
    candidates.forEach(c => (c.top_skills ?? []).forEach(sk => s.add(sk)))
    return [...s].sort()
  }, [candidates])

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      if (search && !(c.full_name ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (skillFilter && !(c.top_skills ?? []).includes(skillFilter)) return false
      if (folderFilter && !(labels[c.aspirant_id] ?? []).includes(folderFilter)) return false
      return true
    })
  }, [candidates, search, skillFilter, folderFilter, labels])

  const toggleLabel = (aspirantId: string, label: string) => {
    setLabels(prev => {
      const cur = prev[aspirantId] ?? []
      const next = cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label]
      const updated = { ...prev, [aspirantId]: next }
      saveLabels(updated)
      return updated
    })
  }

  return (
    <div style={DS.pageWrap}>
      <header style={DS.topbar}>
        <div>
          <h1 style={DS.pageTitle}>Talent Pool</h1>
          <p style={DS.pageSub}>{candidates.length} saved candidate{candidates.length !== 1 ? 's' : ''}</p>
        </div>
      </header>

      {/* Toolbar */}
      <div style={DS.toolbar}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.ink3, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates…" style={{ ...DS.input, width: 200, paddingLeft: 30 }} />
        </div>
        {allSkills.length > 0 && (
          <select value={skillFilter} onChange={e => setSkill(e.target.value)} style={DS.select}>
            <option value="">All skills</option>
            {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={folderFilter} onChange={e => setFolder(e.target.value)} style={DS.select}>
          <option value="">All labels</option>
          {allFolders.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div style={{ ...DS.content, padding: '16px 24px' }}>
        <div style={DS.card}>
          {isLoading ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: C.ink3, fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <p style={{ fontSize: 13, color: C.ink2, margin: 0 }}>No saved candidates</p>
              <p style={{ fontSize: 12, color: C.ink3, margin: 0 }}>Save candidates from the pipeline to build your talent pool.</p>
            </div>
          ) : (
            filtered.map(c => (
              <CandidateRow
                key={c.aspirant_id}
                candidate={c}
                labels={labels[c.aspirant_id] ?? []}
                allFolders={allFolders}
                onToggleLabel={label => toggleLabel(c.aspirant_id, label)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
