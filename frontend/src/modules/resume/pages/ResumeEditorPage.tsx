import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi, type ResumeSection } from '@/api/resume'
import PageHeader from '@/shared/layouts/PageHeader'
import { ActivePrepBanner } from '@/components/ActivePrepBanner'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import ResumeCopilotPanel from '@/modules/resume/components/ResumeCopilotPanel'
import VersionDrawer from '@/modules/resume/components/VersionDrawer'
import ResumeInsightsPanel from '@/modules/resume/components/ResumeInsightsPanel'
import { useAutosave } from '@/shared/hooks/useAutosave'
import { useDragReorder, type DragReorderHandlers } from '@/shared/hooks/useDragReorder'
import { NAVY, INK, INK_SFT as INK_S, MUTED, CREAM, BORDER, colors, shadows } from '@/design-system/tokens'
import {
  ArrowLeft, Wand2, BarChart2, FileText, Plus,
  Download, Trash2, GripVertical, X, Clock, Loader2,
} from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  summary:        'Professional Summary',
  experience:     'Work Experience',
  education:      'Education',
  skills:         'Skills',
  achievements:   'Achievements',
  projects:       'Projects',
  certifications: 'Certifications',
  languages:      'Languages',
}
const SECTION_ORDER = ['summary','experience','education','skills','certifications','projects','achievements','languages']
const ALL_SECTION_TYPES = Object.keys(SECTION_LABELS)

/** Normalise both `items` and `entries` arrays so every editor works regardless of source shape */
function arr(obj: any, ...keys: string[]): any[] {
  if (!obj) return []
  for (const k of keys) {
    if (Array.isArray(obj[k]) && obj[k].length > 0) return obj[k]
  }
  return []
}

/** Deterministic, client-side completeness check — not an AI guess, just "is this field empty/thin". */
function sectionIssues(section: ResumeSection): number {
  const t = section.section_type
  const c = section.content as any
  if (t === 'summary') return (!c?.text || c.text.trim().length < 60) ? 1 : 0
  if (t === 'experience') {
    const items = arr(c, 'items', 'entries')
    if (!items.length) return 1
    return items.reduce((n: number, job: any) => {
      let bad = 0
      if (!job.title) bad++
      if (!(job.company || job.organization)) bad++
      const bullets = job.bullets || job.responsibilities || []
      bad += bullets.filter((b: string) => !b || b.trim().length < 25).length
      return n + bad
    }, 0)
  }
  if (t === 'education') {
    const items = arr(c, 'items', 'entries')
    return items.reduce((n: number, edu: any) => n + ((!edu.degree ? 1 : 0) + (!edu.institution ? 1 : 0)), 0)
  }
  if (t === 'skills') {
    const total = ['technical', 'soft', 'domain', 'tools'].reduce(
      (n, k) => n + (Array.isArray(c?.[k]) ? c[k].length : 0), 0,
    )
    return total < 3 ? 1 : 0
  }
  if (t === 'projects' || t === 'certifications' || t === 'languages') {
    const items = arr(c, 'items', 'entries')
    return items.filter((it: any) => !it || (typeof it === 'string' ? !it.trim() : !(it.name || it.title || it.language))).length
  }
  if (t === 'achievements') {
    const items = arr(c, 'items', 'entries')
    return items.filter((a: string) => !a || !a.trim()).length
  }
  return 0
}

// ─── shared inline-editing primitives ────────────────────────────────────────

/** Grows a textarea to fit its content so it never needs its own internal scrollbar
 * (which some browsers render as up/down arrow buttons — easy to mistake for a dropdown).
 * Deferred to the next animation frame so the initial (ref-time) measurement is never
 * taken before the surrounding flex layout has actually settled. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  requestAnimationFrame(() => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  })
}

function DragHandle() {
  return <GripVertical size={13} color={MUTED} style={{ flexShrink: 0, cursor: 'grab' }} />
}

function DeleteX({ onClick, size = 12, title = 'Remove' }: { onClick: () => void; size?: number; title?: string }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent',
        color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = colors.state.danger; e.currentTarget.style.background = colors.state.dangerBg }}
      onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = 'transparent' }}
    >
      <X size={size} />
    </button>
  )
}

function AddInlineBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
      color: NAVY, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '5px 2px', marginTop: 2,
    }}>
      <Plus size={12} /> Add {label}
    </button>
  )
}

function IssuePill({ count, onFix, fixing }: { count: number; onFix: () => void; fixing: boolean }) {
  if (count <= 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{
        fontSize: 10.5, fontWeight: 800, color: colors.state.warning, background: colors.state.warningBg,
        border: `1px solid ${colors.state.warning}30`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap',
      }}>
        {count} to improve
      </span>
      <button onClick={onFix} disabled={fixing} title="Improve this section with AI" style={{
        display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.25)', color: '#7C3AED', borderRadius: 20,
        padding: '3px 9px', fontSize: 10.5, fontWeight: 700, cursor: fixing ? 'wait' : 'pointer', whiteSpace: 'nowrap',
      }}>
        {fixing ? <Loader2 size={10} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Wand2 size={10} />}
        Fix with AI
      </button>
    </div>
  )
}

function TagPillRow({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  return (
    <div>
      <label style={groupLabelStyle}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {values.map((v, i) => (
          <span key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: colors.surface.elevated, color: INK, borderRadius: 20,
            padding: '4px 6px 4px 10px', fontSize: 12, fontWeight: 600,
          }}>
            {v}
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex', padding: 2 }}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add() }
            if (e.key === 'Backspace' && !draft && values.length) remove(values.length - 1)
          }}
          onBlur={add}
          placeholder="Add skill…"
          className="rsm-field"
          style={{ width: 120, fontSize: 12 }}
        />
      </div>
    </div>
  )
}

// ─── per-section inline block editors ────────────────────────────────────────

function SummaryBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const s = value || {}
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea
        className="rsm-field"
        ref={autoGrow}
        value={s.text || ''}
        onChange={e => onChange({ ...s, text: e.target.value })}
        onInput={e => autoGrow(e.currentTarget)}
        placeholder="Write a 2-3 sentence professional summary highlighting your journey and target role..."
        rows={3}
        style={{ fontSize: 13, lineHeight: 1.6, resize: 'none', overflow: 'hidden' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'], ['linkedin', 'LinkedIn URL']].map(([key, placeholder]) => (
          <input
            key={key} className="rsm-field"
            value={s.contact?.[key] || ''} placeholder={placeholder}
            onChange={e => onChange({ ...s, contact: { ...(s.contact || {}), [key]: e.target.value } })}
            style={{ fontSize: 12, color: INK_S }}
          />
        ))}
      </div>
    </div>
  )
}

function ExperienceBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (newItems: any[]) => onChange({ items: newItems })
  const jobDrag = useDragReorder(items, setItems)

  // Bullet drag state lives in ONE ref (not a hook-per-job, which would violate the rules of hooks
  // inside a .map()) — encodes which (job, bullet) pair is currently being dragged.
  const bulletDrag = useRef<{ jobIdx: number; bulletIdx: number } | null>(null)

  const addJob = () => setItems([...items, { title: '', company: '', start_date: '', end_date: 'Present', bullets: [''] }])
  const removeJob = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateJob = (i: number, key: string, val: any) => {
    const updated = [...items]; updated[i] = { ...updated[i], [key]: val }; setItems(updated)
  }
  const addBullet = (i: number) => updateJob(i, 'bullets', [...(items[i].bullets || []), ''])
  const updateBullet = (jobIdx: number, bIdx: number, val: string) => {
    const bullets = [...(items[jobIdx].bullets || [])]; bullets[bIdx] = val; updateJob(jobIdx, 'bullets', bullets)
  }
  const removeBullet = (jobIdx: number, bIdx: number) => {
    updateJob(jobIdx, 'bullets', (items[jobIdx].bullets || []).filter((_: any, idx: number) => idx !== bIdx))
  }
  const handleBulletDrop = (jobIdx: number, toIdx: number) => {
    const drag = bulletDrag.current
    bulletDrag.current = null
    if (!drag || drag.jobIdx !== jobIdx || drag.bulletIdx === toIdx) return
    const bullets = [...(items[jobIdx].bullets || [])]
    const [moved] = bullets.splice(drag.bulletIdx, 1)
    bullets.splice(toIdx, 0, moved)
    updateJob(jobIdx, 'bullets', bullets)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((job, i) => (
        <div key={i}
          draggable
          onDragStart={() => jobDrag.onDragStart(i)}
          onDragOver={jobDrag.onDragOver}
          onDrop={() => jobDrag.onDrop(i)}
          style={{ position: 'relative', paddingLeft: 18, paddingRight: 22 }}
        >
          <div style={{ position: 'absolute', left: -2, top: 6 }}><DragHandle /></div>
          <div style={{ position: 'absolute', right: 0, top: 2 }}><DeleteX onClick={() => removeJob(i)} title="Remove role" /></div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline' }}>
            <input className="rsm-field" value={job.title || ''} onChange={e => updateJob(i, 'title', e.target.value)}
              placeholder="Job title" style={{ fontWeight: 700, fontSize: 13.5, flex: '1 1 200px', color: INK }} />
            <span style={{ fontSize: 11.5, color: MUTED, display: 'flex', gap: 4, alignItems: 'center' }}>
              <input className="rsm-field" value={job.start_date || job.start || ''} onChange={e => updateJob(i, 'start_date', e.target.value)}
                placeholder="Start" style={{ width: 66, textAlign: 'right' }} />
              –
              <input className="rsm-field" value={job.end_date || job.end || ''} onChange={e => updateJob(i, 'end_date', e.target.value)}
                placeholder="Present" style={{ width: 66 }} />
            </span>
          </div>
          <input className="rsm-field" value={job.company || job.organization || ''} onChange={e => updateJob(i, 'company', e.target.value)}
            placeholder="Company / Organisation" style={{ fontSize: 12, fontStyle: 'italic', color: INK_S, marginBottom: 4 }} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(job.bullets || ['']).map((b: string, bi: number) => (
              <div key={bi}
                draggable
                onDragStart={() => { bulletDrag.current = { jobIdx: i, bulletIdx: bi } }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleBulletDrop(i, bi)}
                style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}
              >
                <span style={{ marginTop: 6 }}><DragHandle /></span>
                <span style={{ marginTop: 4, color: MUTED, flexShrink: 0 }}>•</span>
                <textarea className="rsm-field" ref={autoGrow} value={b}
                  onChange={e => updateBullet(i, bi, e.target.value)}
                  onInput={e => autoGrow(e.currentTarget)}
                  placeholder="Start with an action verb..." rows={1}
                  style={{ flex: 1, fontSize: 12.5, resize: 'none', overflow: 'hidden', lineHeight: 1.5 }}
                />
                {(job.bullets || ['']).length > 1 && <DeleteX onClick={() => removeBullet(i, bi)} />}
              </div>
            ))}
          </div>
          <AddInlineBtn onClick={() => addBullet(i)} label="bullet point" />
        </div>
      ))}
      <AddInlineBtn onClick={addJob} label="work experience" />
    </div>
  )
}

function EducationBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const drag = useDragReorder(items, setItems)
  const addEdu = () => setItems([...items, { degree: '', field: '', institution: '', year: '', grade: '' }])
  const removeEdu = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateEdu = (i: number, key: string, val: string) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((edu, i) => (
        <div key={i}
          draggable onDragStart={() => drag.onDragStart(i)} onDragOver={drag.onDragOver} onDrop={() => drag.onDrop(i)}
          style={{ position: 'relative', paddingLeft: 18, paddingRight: 22 }}
        >
          <div style={{ position: 'absolute', left: -2, top: 6 }}><DragHandle /></div>
          <div style={{ position: 'absolute', right: 0, top: 2 }}><DeleteX onClick={() => removeEdu(i)} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline' }}>
            <input className="rsm-field" value={edu.degree || ''} onChange={e => updateEdu(i, 'degree', e.target.value)}
              placeholder="Degree (e.g. B.Tech)" style={{ fontWeight: 700, fontSize: 13, flex: '1 1 160px', color: INK }} />
            <input className="rsm-field" value={edu.field || edu.field_of_study || ''} onChange={e => updateEdu(i, 'field', e.target.value)}
              placeholder="Field of study" style={{ fontSize: 12.5, flex: '1 1 160px', color: INK_S }} />
            <span style={{ fontSize: 11.5, color: MUTED, display: 'flex', gap: 6 }}>
              <input className="rsm-field" value={edu.year || edu.graduation_year || ''} onChange={e => updateEdu(i, 'year', e.target.value)}
                placeholder="Year" style={{ width: 56, textAlign: 'right' }} />
              <input className="rsm-field" value={edu.grade || ''} onChange={e => updateEdu(i, 'grade', e.target.value)}
                placeholder="Grade" style={{ width: 70 }} />
            </span>
          </div>
          <input className="rsm-field" value={edu.institution || ''} onChange={e => updateEdu(i, 'institution', e.target.value)}
            placeholder="Institution" style={{ fontSize: 12, fontStyle: 'italic', color: INK_S }} />
        </div>
      ))}
      <AddInlineBtn onClick={addEdu} label="education" />
    </div>
  )
}

function SkillsBlockEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const s = value || {}
  const groups: [string, string][] = [
    ['technical', 'Technical Skills'],
    ['soft', 'Soft Skills'],
    ['domain', 'Domain Knowledge'],
    ['tools', 'Tools & Software'],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map(([key, label]) => (
        <TagPillRow key={key} label={label} values={s[key] || []} onChange={v => onChange({ ...s, [key]: v })} />
      ))}
    </div>
  )
}

function ProjectsBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const drag = useDragReorder(items, setItems)
  const bulletDrag = useRef<{ projIdx: number; bulletIdx: number } | null>(null)

  const update = (i: number, key: string, val: any) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  // Backward-compat: older projects were saved with a single `description` paragraph
  // instead of a `bullets` array — seed one bullet from it the first time it's edited.
  const getBullets = (p: any): string[] => {
    if (Array.isArray(p.bullets) && p.bullets.length) return p.bullets
    if (p.description) return [p.description]
    return ['']
  }
  const addBullet = (i: number) => update(i, 'bullets', [...getBullets(items[i]), ''])
  const updateBullet = (i: number, bi: number, val: string) => {
    const bullets = [...getBullets(items[i])]; bullets[bi] = val; update(i, 'bullets', bullets)
  }
  const removeBullet = (i: number, bi: number) => {
    update(i, 'bullets', getBullets(items[i]).filter((_: string, idx: number) => idx !== bi))
  }
  const handleBulletDrop = (projIdx: number, toIdx: number) => {
    const d = bulletDrag.current
    bulletDrag.current = null
    if (!d || d.projIdx !== projIdx || d.bulletIdx === toIdx) return
    const bullets = [...getBullets(items[projIdx])]
    const [moved] = bullets.splice(d.bulletIdx, 1)
    bullets.splice(toIdx, 0, moved)
    update(projIdx, 'bullets', bullets)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((p, i) => {
        const bullets = getBullets(p)
        return (
          <div key={i}
            draggable onDragStart={() => drag.onDragStart(i)} onDragOver={drag.onDragOver} onDrop={() => drag.onDrop(i)}
            style={{ position: 'relative', paddingLeft: 18, paddingRight: 22 }}
          >
            <div style={{ position: 'absolute', left: -2, top: 6 }}><DragHandle /></div>
            <div style={{ position: 'absolute', right: 0, top: 2 }}><DeleteX onClick={() => setItems(items.filter((_, idx) => idx !== i))} /></div>
            <input className="rsm-field" value={p.name || p.title || ''} onChange={e => update(i, 'name', e.target.value)}
              placeholder="Project name" style={{ fontWeight: 700, fontSize: 13, color: INK }} />
            <input className="rsm-field" value={Array.isArray(p.tech) ? p.tech.join(', ') : (p.tech || '')} onChange={e => update(i, 'tech', e.target.value)}
              placeholder="Technologies used" style={{ fontSize: 12, fontStyle: 'italic', color: INK_S, marginBottom: 4 }} />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bullets.map((b, bi) => (
                <div key={bi}
                  draggable
                  onDragStart={() => { bulletDrag.current = { projIdx: i, bulletIdx: bi } }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleBulletDrop(i, bi)}
                  style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}
                >
                  <span style={{ marginTop: 6 }}><DragHandle /></span>
                  <span style={{ marginTop: 4, color: MUTED, flexShrink: 0 }}>•</span>
                  <textarea className="rsm-field" ref={autoGrow} value={b}
                    onChange={e => updateBullet(i, bi, e.target.value)}
                    onInput={e => autoGrow(e.currentTarget)}
                    placeholder="What did you build and what was the impact?" rows={1}
                    style={{ flex: 1, fontSize: 12.5, resize: 'none', overflow: 'hidden', lineHeight: 1.5 }}
                  />
                  {bullets.length > 1 && <DeleteX onClick={() => removeBullet(i, bi)} />}
                </div>
              ))}
            </div>
            <AddInlineBtn onClick={() => addBullet(i)} label="bullet point" />
          </div>
        )
      })}
      <AddInlineBtn onClick={() => setItems([...items, { name: '', tech: '', bullets: [''] }])} label="project" />
    </div>
  )
}

function CertificationsBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const drag = useDragReorder(items, setItems)
  const update = (i: number, key: string, val: string) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((c, i) => (
        <div key={i}
          draggable onDragStart={() => drag.onDragStart(i)} onDragOver={drag.onDragOver} onDrop={() => drag.onDrop(i)}
          style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 18, paddingRight: 4, position: 'relative' }}
        >
          <div style={{ position: 'absolute', left: -2 }}><DragHandle /></div>
          <input className="rsm-field" value={typeof c === 'string' ? c : (c.name || '')} onChange={e => update(i, 'name', e.target.value)}
            placeholder="Certification name" style={{ flex: 2, fontSize: 12.5, fontWeight: 600, color: INK }} />
          <input className="rsm-field" value={c.issuer || ''} onChange={e => update(i, 'issuer', e.target.value)}
            placeholder="Issuer" style={{ flex: 1.5, fontSize: 12, color: INK_S }} />
          <input className="rsm-field" value={c.year || ''} onChange={e => update(i, 'year', e.target.value)}
            placeholder="Year" style={{ flex: 0.6, fontSize: 12, color: MUTED }} />
          <DeleteX onClick={() => setItems(items.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <AddInlineBtn onClick={() => setItems([...items, { name: '', issuer: '', year: '' }])} label="certification" />
    </div>
  )
}

function LanguagesBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const drag = useDragReorder(items, setItems)
  const update = (i: number, key: string, val: string) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((l, i) => (
        <div key={i}
          draggable onDragStart={() => drag.onDragStart(i)} onDragOver={drag.onDragOver} onDrop={() => drag.onDrop(i)}
          style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 18, position: 'relative' }}
        >
          <div style={{ position: 'absolute', left: -2 }}><DragHandle /></div>
          <input className="rsm-field" value={typeof l === 'string' ? l : (l.language || '')} onChange={e => update(i, 'language', e.target.value)}
            placeholder="Language (e.g. Hindi)" style={{ flex: 2, fontSize: 12.5, fontWeight: 600, color: INK }} />
          <select className="rsm-field" value={l.proficiency || 'Professional'} onChange={e => update(i, 'proficiency', e.target.value)}
            style={{ flex: 1.5, fontSize: 12, color: INK_S }}>
            {['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <DeleteX onClick={() => setItems(items.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <AddInlineBtn onClick={() => setItems([...items, { language: '', proficiency: 'Professional' }])} label="language" />
    </div>
  )
}

function AchievementsBlock({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: string[] = arr(value, 'items', 'entries')
  const setItems = (v: string[]) => onChange({ items: v })
  const drag = useDragReorder(items, setItems)
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => (
        <div key={i}
          draggable onDragStart={() => drag.onDragStart(i)} onDragOver={drag.onDragOver} onDrop={() => drag.onDrop(i)}
          style={{ display: 'flex', gap: 6, alignItems: 'flex-start', paddingLeft: 18, position: 'relative' }}
        >
          <div style={{ position: 'absolute', left: -2, top: 4 }}><DragHandle /></div>
          <span style={{ marginTop: 5, color: MUTED, flexShrink: 0 }}>•</span>
          <input className="rsm-field" value={item} onChange={e => { const u = [...items]; u[i] = e.target.value; setItems(u) }}
            placeholder="e.g. Cleared UPSC Prelims 2023 — top 2% nationally" style={{ flex: 1, fontSize: 12.5 }} />
          {items.length > 1 && <DeleteX onClick={() => setItems(items.filter((_, idx) => idx !== i))} />}
        </div>
      ))}
      <AddInlineBtn onClick={() => setItems([...items, ''])} label="achievement" />
    </div>
  )
}

function SectionFormRouter({ section, onChange }: { section: ResumeSection; onChange: (v: any) => void }) {
  const t = section.section_type
  const content = section.content as any
  if (t === 'summary')        return <SummaryBlock value={content} onChange={onChange} />
  if (t === 'experience')     return <ExperienceBlock value={content} onChange={onChange} />
  if (t === 'education')      return <EducationBlock value={content} onChange={onChange} />
  if (t === 'skills')         return <SkillsBlockEditor value={content} onChange={onChange} />
  if (t === 'achievements')   return <AchievementsBlock value={content} onChange={onChange} />
  if (t === 'projects')       return <ProjectsBlock value={content} onChange={onChange} />
  if (t === 'certifications') return <CertificationsBlock value={content} onChange={onChange} />
  if (t === 'languages')      return <LanguagesBlock value={content} onChange={onChange} />
  return <p style={{ fontSize: 12, color: MUTED }}>No editor for this section type.</p>
}

// ─── section wrapper: drag handle, delete, issue pill, autosave ──────────────
function SectionEditor({
  section, resumeId, index, sectionDrag, onDeleted,
}: {
  section: ResumeSection
  resumeId: string
  index: number
  sectionDrag: DragReorderHandlers
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const lastSentJson = useRef(JSON.stringify(section.content))
  const [draft, setDraft] = useState<any>(section.content)
  const [improving, setImproving] = useState(false)

  // Resync local draft only when server content changed for a reason OTHER than our own
  // last autosave (AI-improve, restore-version, initial load) — otherwise every refetch
  // triggered by our own save would clobber in-progress typing.
  useEffect(() => {
    const incoming = JSON.stringify(section.content)
    if (incoming !== lastSentJson.current) {
      setDraft(section.content)
      lastSentJson.current = incoming
    }
  }, [section.content])

  const saveMutation = useMutation({
    mutationFn: (content: any) => {
      lastSentJson.current = JSON.stringify(content)
      return resumeApi.upsertSection(resumeId, { section_type: section.section_type, content })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume', resumeId] }),
  })
  const status = useAutosave(draft, (content) => saveMutation.mutateAsync(content))

  const improveMutation = useMutation({
    mutationFn: () => { setImproving(true); return resumeApi.aiImproveSection(resumeId, section.id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume', resumeId] }),
    onSettled: () => setImproving(false),
  })

  const issues = sectionIssues({ ...section, content: draft } as ResumeSection)

  return (
    <div
      draggable
      onDragStart={() => sectionDrag.onDragStart(index)}
      onDragOver={sectionDrag.onDragOver}
      onDrop={() => sectionDrag.onDrop(index)}
      style={{ marginBottom: 28 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1.5px solid ${BORDER}`, paddingBottom: 7, marginBottom: 14 }}>
        <span><DragHandle /></span>
        <h2 style={{
          flex: 1, fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
          color: NAVY, margin: 0, fontFamily: 'Hind, sans-serif',
        }}>
          {SECTION_LABELS[section.section_type] ?? section.section_type}
        </h2>
        {section.ai_improved && (
          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#7C3AED', background: '#F3E8FF', padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>AI</span>
        )}
        <IssuePill count={issues} fixing={improving} onFix={() => improveMutation.mutate()} />
        {status === 'saving' && <span style={{ fontSize: 10.5, color: MUTED, flexShrink: 0 }}>Saving…</span>}
        {status === 'saved' && <span style={{ fontSize: 10.5, color: colors.state.success, flexShrink: 0 }}>Saved</span>}
        <button onClick={onDeleted} title="Delete section" style={{
          width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0,
        }}>
          <Trash2 size={13} />
        </button>
      </div>

      <SectionFormRouter section={{ ...section, content: draft }} onChange={setDraft} />
    </div>
  )
}

// ─── shared micro-styles ──────────────────────────────────────────────────────
const groupLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
}
const addBlockBtnStyle: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: 10, border: `1.5px dashed ${NAVY}30`,
  background: colors.surface.elevated, color: NAVY, fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6,
}
const inlineStyles = `
  .rsm-field {
    width: 100%; border: 1.5px solid transparent; background: transparent;
    font: inherit; color: inherit; padding: 3px 6px; border-radius: 6px;
    outline: none; box-sizing: border-box; transition: background 0.15s, border-color 0.15s;
  }
  .rsm-field:hover { background: ${CREAM}; }
  .rsm-field:focus { background: white; border-color: ${NAVY}55; box-shadow: 0 0 0 3px ${NAVY}14; }
  .rsm-field::placeholder { color: ${MUTED}; font-weight: 400; }
`

// ─── main page ────────────────────────────────────────────────────────────────
export default function ResumeEditorPage() {
  const { resumeId } = useParams<{ resumeId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [addSection, setAddSection] = useState(false)
  const [newSectionType, setNewSectionType] = useState('skills')
  const { activePrep } = useActivePrepJob()

  async function handleDownloadPdf() {
    if (!resumeId || downloading) return
    setDownloading(true)
    try {
      const blob = await resumeApi.exportPdf(resumeId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Resume.pdf'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 1000)
    } catch {
      alert('PDF download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const [sections, setSections] = useState<ResumeSection[]>([])

  const { data: resume, isLoading } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => resumeApi.getResume(resumeId!),
    enabled: !!resumeId,
  })

  useEffect(() => {
    if (resume) {
      setSections(prev => {
        // If user has already reordered locally, only add/remove sections, don't re-sort
        if (prev.length === 0) {
          return [...resume.sections].sort(
            (a, b) => SECTION_ORDER.indexOf(a.section_type) - SECTION_ORDER.indexOf(b.section_type),
          )
        }
        const existing = new Map(prev.map(s => [s.id, s]))
        const serverIds = new Set(resume.sections.map(s => s.id))
        const updated = prev
          .filter(s => serverIds.has(s.id))
          .map(s => resume.sections.find(r => r.id === s.id) ?? s)
        for (const s of resume.sections) {
          if (!existing.has(s.id)) updated.push(s)
        }
        return updated
      })
    }
  }, [resume])

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => resumeApi.deleteSection(resumeId!, sectionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resume', resumeId] }),
  })

  const addSectionMutation = useMutation({
    mutationFn: () => resumeApi.upsertSection(resumeId!, { section_type: newSectionType, content: getDefaultContent(newSectionType) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resume', resumeId] }); setAddSection(false) },
  })

  const atsColor = (score: number | null) => {
    if (!score) return MUTED
    if (score >= 80) return colors.state.success
    if (score >= 60) return colors.state.warning
    return colors.state.danger
  }

  const persistSectionOrder = (updated: ResumeSection[]) => {
    setSections(updated)
    const payload = updated.map((s, idx) => ({ section_id: s.id, sort_order: idx }))
    resumeApi.reorderSections(resumeId!, payload).catch(() => {
      qc.invalidateQueries({ queryKey: ['resume', resumeId] })
    })
  }
  const sectionDrag = useDragReorder(sections, persistSectionOrder)

  if (isLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  if (!resume) return null

  const existingTypes = new Set(sections.map(s => s.section_type))
  const availableTypes = ALL_SECTION_TYPES.filter(t => !existingTypes.has(t))

  return (
    <>
      <PageHeader
        title={resume.title}
        back={
          <button onClick={() => navigate('/app/resume')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: MUTED }}>
            <ArrowLeft size={16} />
          </button>
        }
        actions={
          <>
            {resume.ats_score !== null && (
              <button
                onClick={() => setInsightsPanelOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: `${atsColor(resume.ats_score)}10`, border: `1px solid ${atsColor(resume.ats_score)}25`,
                  borderRadius: 20, padding: '6px 12px', cursor: 'pointer',
                }}
              >
                <BarChart2 size={12} color={atsColor(resume.ats_score)} />
                <span style={{ fontSize: 12, fontWeight: 800, color: atsColor(resume.ats_score) }}>
                  Score {resume.ats_score}
                </span>
              </button>
            )}
            <button
              onClick={() => setVersionDrawerOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: 'white', color: INK_S, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
            >
              <Clock size={12} /> History
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: downloading ? colors.surface.elevated : 'white', border: `1.5px solid ${BORDER}`, color: INK_S, fontSize: 12, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1 }}
            >
              <Download size={13} /> {downloading ? 'Generating…' : 'Download PDF'}
            </button>
          </>
        }
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', background: CREAM, padding: '20px 24px 60px' }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <ActivePrepBanner showSwitch />
          </div>

          <div style={{
            maxWidth: 820, margin: '20px auto 0', background: 'white', borderRadius: 16,
            border: `1px solid ${BORDER}`, boxShadow: shadows.card, padding: '36px 44px',
          }}>
            {sections.length > 0 ? (
              sections.map((sec, i) => (
                <SectionEditor
                  key={sec.id}
                  section={sec}
                  resumeId={resumeId!}
                  index={i}
                  sectionDrag={sectionDrag}
                  onDeleted={() => {
                    if (confirm(`Delete "${SECTION_LABELS[sec.section_type]}"?`)) {
                      deleteSectionMutation.mutate(sec.id)
                      setSections(prev => prev.filter(s => s.id !== sec.id))
                    }
                  }}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <FileText size={36} color={colors.border.strong} style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>No sections yet</p>
                <p style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Generate a starting draft with AI, or add sections manually below.</p>
                <button onClick={() => setCopilotOpen(true)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
                  background: NAVY, color: 'white', border: 'none',
                  cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                  boxShadow: shadows.button,
                }}>
                  <Wand2 size={13} />AI Generate
                </button>
              </div>
            )}

            {availableTypes.length > 0 && (
              <button onClick={() => setAddSection(v => !v)} style={addBlockBtnStyle}>
                <Plus size={13} /> Add Section
              </button>
            )}

            {addSection && (
              <div style={{ marginTop: 10, background: CREAM, borderRadius: 12, border: `1.5px solid ${BORDER}`, padding: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 10 }}>Choose section type</p>
                <select value={newSectionType} onChange={e => setNewSectionType(e.target.value)}
                  style={{ width: '100%', height: 36, borderRadius: 8, border: `1.5px solid ${BORDER}`, padding: '0 10px', fontSize: 12.5, marginBottom: 10, background: 'white', color: INK }}>
                  {availableTypes.map(t => <option key={t} value={t}>{SECTION_LABELS[t] ?? t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAddSection(false)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: INK_S }}>Cancel</button>
                  <button onClick={() => addSectionMutation.mutate()} disabled={addSectionMutation.isPending} style={{ flex: 1, padding: '7px', borderRadius: 8, background: NAVY, color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Add</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {insightsPanelOpen && (
          <ResumeInsightsPanel
            resume={resume}
            onClose={() => setInsightsPanelOpen(false)}
          />
        )}
      </div>

      {versionDrawerOpen && (
        <VersionDrawer
          resumeId={resumeId!}
          onClose={() => setVersionDrawerOpen(false)}
          onRestored={() => qc.invalidateQueries({ queryKey: ['resume', resumeId] })}
        />
      )}

      {copilotOpen && (
        <ResumeCopilotPanel
          resumeId={resumeId!}
          jobContext={{
            job_title: activePrep?.job_title,
            company_name: activePrep?.company_name,
            required_skills: activePrep?.required_skills,
            job_description: activePrep
              ? `${activePrep.job_title} at ${activePrep.company_name} in ${activePrep.sector}. Required skills: ${activePrep.required_skills.join(', ')}`
              : undefined,
          }}
          onClose={() => setCopilotOpen(false)}
          onComplete={() => {
            setCopilotOpen(false)
            qc.invalidateQueries({ queryKey: ['resume', resumeId] })
          }}
        />
      )}

      <style>{inlineStyles}</style>
    </>
  )
}

function getDefaultContent(type: string): Record<string, unknown> {
  if (type === 'summary')        return { text: '' }
  if (type === 'experience')     return { items: [{ title: '', company: '', start_date: '', end_date: 'Present', bullets: [''] }] }
  if (type === 'education')      return { items: [{ degree: '', field: '', institution: '', year: '' }] }
  if (type === 'skills')         return { technical: [], soft: [], domain: [] }
  if (type === 'achievements')   return { items: [''] }
  if (type === 'projects')       return { items: [{ name: '', tech: '', bullets: [''] }] }
  if (type === 'certifications') return { items: [{ name: '', issuer: '', year: '' }] }
  if (type === 'languages')      return { items: [{ language: '', proficiency: 'Professional' }] }
  return {}
}
