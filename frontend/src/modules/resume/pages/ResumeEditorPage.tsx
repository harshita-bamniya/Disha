import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi, type ResumeSection, type ResumeDetail } from '@/api/resume'
import AppSidebar from '@/components/layout/AppSidebar'
import { ActivePrepBanner } from '@/components/ActivePrepBanner'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import ResumeCopilotPanel from '@/modules/resume/components/ResumeCopilotPanel'
import {
  ArrowLeft, Wand2, BarChart2, FileText, Plus, Eye, Edit3,
  Download, Trash2, GripVertical, ChevronDown, ChevronUp, X,
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

/** Normalise both `items` and `entries` arrays so preview always works */
function arr(obj: any, ...keys: string[]): any[] {
  if (!obj) return []
  for (const k of keys) {
    if (Array.isArray(obj[k]) && obj[k].length > 0) return obj[k]
  }
  return []
}

// ─── per-section form editors ────────────────────────────────────────────────

function SummaryForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const s = value || {}
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={labelStyle}>Summary text</label>
      <textarea
        value={s.text || ''}
        onChange={e => onChange({ ...s, text: e.target.value })}
        placeholder="Write a 2-3 sentence professional summary highlighting your UPSC journey and target role..."
        rows={4}
        style={textareaStyle}
      />
      <label style={labelStyle}>Contact info (optional)</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          ['email', 'Email'],
          ['phone', 'Phone'],
          ['location', 'Location'],
          ['linkedin', 'LinkedIn URL'],
        ].map(([key, placeholder]) => (
          <input key={key} value={s.contact?.[key] || ''} placeholder={placeholder}
            onChange={e => onChange({ ...s, contact: { ...(s.contact || {}), [key]: e.target.value } })}
            style={inputStyle} />
        ))}
      </div>
    </div>
  )
}

function ExperienceForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (newItems: any[]) => onChange({ items: newItems })

  const addJob = () => setItems([...items, { title: '', company: '', start_date: '', end_date: '', bullets: [''] }])
  const removeJob = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateJob = (i: number, key: string, val: any) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [key]: val }
    setItems(updated)
  }
  const addBullet = (i: number) => updateJob(i, 'bullets', [...(items[i].bullets || []), ''])
  const updateBullet = (jobIdx: number, bIdx: number, val: string) => {
    const bullets = [...(items[jobIdx].bullets || [])]
    bullets[bIdx] = val
    updateJob(jobIdx, 'bullets', bullets)
  }
  const removeBullet = (jobIdx: number, bIdx: number) => {
    updateJob(jobIdx, 'bullets', (items[jobIdx].bullets || []).filter((_: any, idx: number) => idx !== bIdx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((job, i) => (
        <div key={i} style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, border: '1px solid #E2E8F0', position: 'relative' }}>
          <button onClick={() => removeJob(i)} style={deleteSmallBtn} title="Remove job">
            <X size={12} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={labelStyle}>Job title</label><input value={job.title || ''} onChange={e => updateJob(i, 'title', e.target.value)} placeholder="e.g. Policy Analyst" style={inputStyle} /></div>
            <div><label style={labelStyle}>Company / Organisation</label><input value={job.company || job.organization || ''} onChange={e => updateJob(i, 'company', e.target.value)} placeholder="e.g. UPSC Self-prep" style={inputStyle} /></div>
            <div><label style={labelStyle}>Start date</label><input value={job.start_date || job.start || ''} onChange={e => updateJob(i, 'start_date', e.target.value)} placeholder="e.g. Jun 2021" style={inputStyle} /></div>
            <div><label style={labelStyle}>End date</label><input value={job.end_date || job.end || ''} onChange={e => updateJob(i, 'end_date', e.target.value)} placeholder="Present" style={inputStyle} /></div>
          </div>
          <label style={labelStyle}>Key responsibilities / bullets</label>
          {(job.bullets || ['']).map((b: string, bi: number) => (
            <div key={bi} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
              <span style={{ marginTop: 8, color: '#94A3B8', flexShrink: 0 }}>•</span>
              <input value={b} onChange={e => updateBullet(i, bi, e.target.value)} placeholder="Start with an action verb..." style={{ ...inputStyle, flex: 1 }} />
              {(job.bullets || ['']).length > 1 && (
                <button onClick={() => removeBullet(i, bi)} style={deleteSmallBtn}><X size={11} /></button>
              )}
            </div>
          ))}
          <button onClick={() => addBullet(i)} style={addLineBtn}>+ Add bullet</button>
        </div>
      ))}
      <button onClick={addJob} style={addBlockBtn}><Plus size={13} /> Add Job / Role</button>
    </div>
  )
}

function EducationForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const addEdu = () => setItems([...items, { degree: '', field: '', institution: '', year: '', grade: '' }])
  const removeEdu = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateEdu = (i: number, key: string, val: string) => {
    const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((edu, i) => (
        <div key={i} style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, border: '1px solid #E2E8F0', position: 'relative' }}>
          <button onClick={() => removeEdu(i)} style={deleteSmallBtn}><X size={12} /></button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>Degree</label><input value={edu.degree || ''} onChange={e => updateEdu(i, 'degree', e.target.value)} placeholder="B.Tech / B.A / M.A..." style={inputStyle} /></div>
            <div><label style={labelStyle}>Field of Study</label><input value={edu.field || edu.field_of_study || ''} onChange={e => updateEdu(i, 'field', e.target.value)} placeholder="Computer Science / History..." style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Institution</label><input value={edu.institution || ''} onChange={e => updateEdu(i, 'institution', e.target.value)} placeholder="University / College name" style={inputStyle} /></div>
            <div><label style={labelStyle}>Year of passing</label><input value={edu.year || edu.graduation_year || ''} onChange={e => updateEdu(i, 'year', e.target.value)} placeholder="2022" style={inputStyle} /></div>
            <div><label style={labelStyle}>Grade / CGPA (optional)</label><input value={edu.grade || ''} onChange={e => updateEdu(i, 'grade', e.target.value)} placeholder="8.4 CGPA / First Class" style={inputStyle} /></div>
          </div>
        </div>
      ))}
      <button onClick={addEdu} style={addBlockBtn}><Plus size={13} /> Add Education</button>
    </div>
  )
}

function SkillsForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const s = value || {}
  const groups = [
    ['technical', 'Technical Skills', 'e.g. Data Analysis, MS Excel, Python, Research'],
    ['soft',      'Soft Skills',      'e.g. Communication, Leadership, Critical Thinking'],
    ['domain',    'Domain Knowledge', 'e.g. Governance, Public Policy, Finance'],
    ['tools',     'Tools & Software', 'e.g. MS Office, Google Workspace, Tableau'],
  ] as const

  const updateGroup = (key: string, raw: string) => {
    onChange({ ...s, [key]: raw.split(',').map(x => x.trim()).filter(Boolean) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>Enter skills separated by commas</p>
      {groups.map(([key, label, placeholder]) => (
        <div key={key}>
          <label style={labelStyle}>{label}</label>
          <input
            value={(s[key] || []).join(', ')}
            onChange={e => updateGroup(key, e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
          />
        </div>
      ))}
    </div>
  )
}

function AchievementsForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: string[] = arr(value, 'items', 'entries')
  const setItems = (v: string[]) => onChange({ items: v })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ marginTop: 9, color: '#94A3B8', flexShrink: 0 }}>•</span>
          <input value={item} onChange={e => { const u = [...items]; u[i] = e.target.value; setItems(u) }}
            placeholder="e.g. Cleared UPSC Prelims 2023 — top 2% nationally" style={{ ...inputStyle, flex: 1 }} />
          {items.length > 1 && <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={deleteSmallBtn}><X size={11} /></button>}
        </div>
      ))}
      <button onClick={() => setItems([...items, ''])} style={addLineBtn}>+ Add achievement</button>
    </div>
  )
}

function ProjectsForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const update = (i: number, key: string, val: string) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((p, i) => (
        <div key={i} style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, border: '1px solid #E2E8F0', position: 'relative' }}>
          <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={deleteSmallBtn}><X size={12} /></button>
          <div><label style={labelStyle}>Project name</label><input value={p.name || p.title || ''} onChange={e => update(i, 'name', e.target.value)} placeholder="Project title" style={inputStyle} /></div>
          <div style={{ marginTop: 8 }}><label style={labelStyle}>Technologies / Skills used</label><input value={Array.isArray(p.tech) ? p.tech.join(', ') : (p.tech || '')} onChange={e => update(i, 'tech', e.target.value)} placeholder="e.g. Python, Research, Policy Analysis" style={inputStyle} /></div>
          <div style={{ marginTop: 8 }}><label style={labelStyle}>Description</label><textarea value={p.description || ''} onChange={e => update(i, 'description', e.target.value)} rows={2} placeholder="What did you build/do and what was the impact?" style={textareaStyle} /></div>
        </div>
      ))}
      <button onClick={() => setItems([...items, { name: '', tech: '', description: '' }])} style={addBlockBtn}><Plus size={13} /> Add Project</button>
    </div>
  )
}

function CertificationsForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const update = (i: number, key: string, val: string) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={typeof c === 'string' ? c : (c.name || '')} onChange={e => update(i, 'name', e.target.value)} placeholder="Certification name" style={{ ...inputStyle, flex: 2 }} />
          <input value={c.issuer || ''} onChange={e => update(i, 'issuer', e.target.value)} placeholder="Issuer" style={{ ...inputStyle, flex: 1.5 }} />
          <input value={c.year || ''} onChange={e => update(i, 'year', e.target.value)} placeholder="Year" style={{ ...inputStyle, flex: 0.7 }} />
          {items.length > 1 && <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={deleteSmallBtn}><X size={11} /></button>}
        </div>
      ))}
      <button onClick={() => setItems([...items, { name: '', issuer: '', year: '' }])} style={addLineBtn}>+ Add certification</button>
    </div>
  )
}

function LanguagesForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const items: any[] = arr(value, 'items', 'entries')
  const setItems = (v: any[]) => onChange({ items: v })
  const update = (i: number, key: string, val: string) => { const u = [...items]; u[i] = { ...u[i], [key]: val }; setItems(u) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={typeof l === 'string' ? l : (l.language || '')} onChange={e => update(i, 'language', e.target.value)} placeholder="Language (e.g. Hindi)" style={{ ...inputStyle, flex: 2 }} />
          <select value={l.proficiency || 'Professional'} onChange={e => update(i, 'proficiency', e.target.value)} style={{ ...inputStyle, flex: 1.5 }}>
            {['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {items.length > 1 && <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={deleteSmallBtn}><X size={11} /></button>}
        </div>
      ))}
      <button onClick={() => setItems([...items, { language: '', proficiency: 'Professional' }])} style={addLineBtn}>+ Add language</button>
    </div>
  )
}

function SectionFormRouter({ section, onChange }: { section: ResumeSection; onChange: (v: any) => void }) {
  const t = section.section_type
  const content = section.content as any
  if (t === 'summary')        return <SummaryForm value={content} onChange={onChange} />
  if (t === 'experience')     return <ExperienceForm value={content} onChange={onChange} />
  if (t === 'education')      return <EducationForm value={content} onChange={onChange} />
  if (t === 'skills')         return <SkillsForm value={content} onChange={onChange} />
  if (t === 'achievements')   return <AchievementsForm value={content} onChange={onChange} />
  if (t === 'projects')       return <ProjectsForm value={content} onChange={onChange} />
  if (t === 'certifications') return <CertificationsForm value={content} onChange={onChange} />
  if (t === 'languages')      return <LanguagesForm value={content} onChange={onChange} />
  return <p style={{ fontSize: 12, color: '#94A3B8' }}>No editor for this section type.</p>
}

// ─── section card with drag, delete, collapse ────────────────────────────────
function SectionCard({
  section, resumeId, index, onUpdate, onDelete, onDragStart, onDragOver, onDrop,
}: {
  section: ResumeSection
  resumeId: string
  index: number
  onUpdate: () => void
  onDelete: () => void
  onDragStart: (i: number) => void
  onDragOver: (e: React.DragEvent, i: number) => void
  onDrop: (i: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<any>(section.content)
  const [improving, setImproving] = useState(false)
  const qc = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: () => resumeApi.upsertSection(resumeId, { section_type: section.section_type, content: draft }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['resume', resumeId] }); onUpdate() },
  })

  const improveMutation = useMutation({
    mutationFn: () => { setImproving(true); return resumeApi.aiImproveSection(resumeId, section.id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resume', resumeId] }); onUpdate() },
    onSettled: () => setImproving(false),
  })

  // reset draft when section content changes externally
  const handleOpen = () => {
    setDraft(section.content)
    setOpen(o => !o)
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      style={{
        background: 'white', borderRadius: 12, overflow: 'hidden',
        border: '1.5px solid rgba(226,232,240,0.9)', marginBottom: 8,
        cursor: 'grab',
      }}
    >
      {/* header */}
      <div style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        background: open ? '#F0FDF4' : 'rgba(248,250,252,0.9)',
        borderBottom: open ? '1px solid #BBF7D0' : 'none',
      }}>
        <GripVertical size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
          {SECTION_LABELS[section.section_type] ?? section.section_type}
        </span>
        {section.ai_improved && (
          <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, background: '#F3E8FF', padding: '2px 7px', borderRadius: 10 }}>AI</span>
        )}
        {/* AI improve */}
        <button onClick={() => improveMutation.mutate()} disabled={improving} title="Improve with AI"
          style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
          {improving ? <div style={{ width: 10, height: 10, border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Wand2 size={12} />}
        </button>
        {/* delete */}
        <button onClick={onDelete} title="Delete section"
          style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
          <Trash2 size={12} />
        </button>
        {/* expand */}
        <button onClick={handleOpen}
          style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(226,232,240,0.8)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* form */}
      {open && (
        <div style={{ padding: '14px 14px 12px' }}>
          <SectionFormRouter
            section={{ ...section, content: draft as Record<string, unknown> }}
            onChange={setDraft}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => setOpen(false)}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#64748B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              style={{ padding: '7px 16px', borderRadius: 8, background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: saveMutation.isPending ? 0.7 : 1 }}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── resume preview ───────────────────────────────────────────────────────────
// Renders one section by type — order is driven by the sections array itself
function RenderSection({ section }: { section: ResumeSection }) {
  const c = section.content as any
  const t = section.section_type

  if (t === 'summary' && c?.text) return (
    <PreviewSection title="Professional Summary">
      <p style={{ margin: 0, textAlign: 'justify' }}>{c.text}</p>
    </PreviewSection>
  )

  if (t === 'experience') {
    const jobs = arr(c, 'items', 'entries')
    if (!jobs.length) return null
    return (
      <PreviewSection title="Work Experience">
        {jobs.map((job: any, i: number) => (
          <div key={i} style={{ marginBottom: i < jobs.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>{job.title || job.role}</span>
              <span style={{ fontSize: 11, color: '#64748B' }}>{job.start_date || job.start} – {job.end_date || job.end || 'Present'}</span>
            </div>
            {(job.company || job.organization) && (
              <div style={{ fontSize: 11.5, color: '#475569', fontStyle: 'italic' }}>
                {job.company || job.organization}{job.location ? ` · ${job.location}` : ''}
              </div>
            )}
            {arr({ bullets: job.bullets || job.responsibilities }, 'bullets').length > 0 && (
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {arr({ bullets: job.bullets || job.responsibilities }, 'bullets').map((b: string, j: number) => (
                  <li key={j} style={{ marginBottom: 2 }}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </PreviewSection>
    )
  }

  if (t === 'education') {
    const edus = arr(c, 'items', 'entries')
    if (!edus.length) return null
    return (
      <PreviewSection title="Education">
        {edus.map((edu: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <span style={{ fontWeight: 700 }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</span>
              {edu.institution && <div style={{ fontSize: 11.5, color: '#475569' }}>{edu.institution}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B' }}>
              <div>{edu.year || edu.graduation_year}</div>
              {edu.grade && <div>{edu.grade}</div>}
            </div>
          </div>
        ))}
      </PreviewSection>
    )
  }

  if (t === 'skills' && c && Object.keys(c).length > 0) {
    const groups: [string, string][] = [['technical','Technical'],['soft','Soft Skills'],['domain','Domain'],['tools','Tools']]
    const lines = groups.filter(([k]) => Array.isArray(c[k]) && c[k].length > 0)
    const flat = arr(c, 'items', 'entries')
    if (!lines.length && !flat.length) return null
    return (
      <PreviewSection title="Skills">
        {lines.length > 0
          ? lines.map(([k, label]) => <p key={k} style={{ margin: '0 0 3px' }}><strong>{label}:</strong> {(c[k] as string[]).join(', ')}</p>)
          : <p style={{ margin: 0 }}>{flat.join(', ')}</p>
        }
      </PreviewSection>
    )
  }

  if (t === 'certifications') {
    const items = arr(c, 'items', 'entries')
    if (!items.length) return null
    return (
      <PreviewSection title="Certifications">
        {items.map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>{typeof item === 'string' ? item : `${item.name}${item.issuer ? ` — ${item.issuer}` : ''}`}</span>
            {item.year && <span style={{ fontSize: 11, color: '#64748B' }}>{item.year}</span>}
          </div>
        ))}
      </PreviewSection>
    )
  }

  if (t === 'projects') {
    const items = arr(c, 'items', 'entries')
    if (!items.length) return null
    return (
      <PreviewSection title="Projects">
        {items.map((p: any, i: number) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{p.name || p.title}</span>
            {p.tech && <span style={{ fontSize: 11, color: '#64748B' }}> · {Array.isArray(p.tech) ? p.tech.join(', ') : p.tech}</span>}
            {p.description && <p style={{ margin: '2px 0 0' }}>{p.description}</p>}
          </div>
        ))}
      </PreviewSection>
    )
  }

  if (t === 'achievements') {
    const items = arr(c, 'items', 'entries')
    if (!items.length) return null
    return (
      <PreviewSection title="Key Achievements">
        <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
          {items.map((a: string, i: number) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
        </ul>
      </PreviewSection>
    )
  }

  if (t === 'languages') {
    const items = arr(c, 'items', 'entries')
    if (!items.length) return null
    return (
      <PreviewSection title="Languages">
        <p style={{ margin: 0 }}>
          {items.map((l: any) => typeof l === 'string' ? l : `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`).join('  ·  ')}
        </p>
      </PreviewSection>
    )
  }

  return null
}

function ResumePreview({ sections, resume }: { sections: ResumeSection[]; resume: ResumeDetail }) {
  const summarySection = sections.find(s => s.section_type === 'summary')
  const contact = (summarySection?.content as any)?.contact

  // Extract candidate name: first word(s) of summary text before " is " or " are ", fallback to title
  const summaryText: string = (summarySection?.content as any)?.text || ''
  const nameFromSummary = summaryText.match(/^([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,3})/)?.[1] || ''
  const candidateName = nameFromSummary || resume.career_track_name || resume.title

  if (sections.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#94A3B8', gap: 12 }}>
      <FileText size={48} strokeWidth={1} />
      <p style={{ fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif' }}>Resume preview will appear here</p>
      <p style={{ fontSize: 12, fontFamily: 'sans-serif', textAlign: 'center', maxWidth: 240 }}>Click <strong>AI Generate</strong> or add sections manually.</p>
    </div>
  )

  return (
    <div
      className="resume-paper"
      style={{
        /* A4 at 96 dpi = 794 × 1123 px */
        width: 794,
        minHeight: 1123,
        fontFamily: '"Times New Roman", Georgia, serif',
        fontSize: 12,
        color: '#111',
        padding: '56px 60px',
        lineHeight: 1.6,
        boxSizing: 'border-box',
        background: 'white',
      }}
    >
      {/* header — candidate name prominent, target role as subtitle */}
      <div style={{ textAlign: 'center', marginBottom: 22, borderBottom: '2.5px solid #1E3A5F', paddingBottom: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1E3A5F', margin: '0 0 3px', letterSpacing: 0.5, fontFamily: '"Helvetica Neue",Arial,sans-serif' }}>
          {candidateName.toUpperCase()}
        </h1>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: '0 0 5px', fontFamily: 'sans-serif', letterSpacing: 0.3 }}>
          {resume.title.replace(/my resume/i, '').trim()}
        </p>
        {contact && (
          <p style={{ fontSize: 10.5, color: '#64748B', margin: 0, fontFamily: 'sans-serif' }}>
            {[contact.email, contact.phone, contact.location, contact.linkedin].filter(Boolean).join('  ·  ')}
          </p>
        )}
      </div>

      {/* sections in drag order */}
      {sections.map(sec => <RenderSection key={sec.id} section={sec} />)}
    </div>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 11.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#1E3A5F', margin: '0 0 7px', borderBottom: '1px solid #CBD5E1', paddingBottom: 3, fontFamily: '"Helvetica Neue",Arial,sans-serif' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── shared micro-styles ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid #E2E8F0',
  fontSize: 12, color: '#0F172A', outline: 'none', background: 'white',
  boxSizing: 'border-box',
}
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #E2E8F0',
  fontSize: 12, color: '#0F172A', outline: 'none', resize: 'vertical', lineHeight: 1.6,
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
}
const deleteSmallBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)',
  background: 'rgba(220,38,38,0.04)', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0,
}
const addLineBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#2563EB', fontSize: 12,
  fontWeight: 700, cursor: 'pointer', padding: '4px 0',
}
const addBlockBtn: React.CSSProperties = {
  width: '100%', padding: '8px', borderRadius: 9, border: '1.5px dashed #BFDBFE',
  background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function ResumeEditorPage() {
  const { resumeId } = useParams<{ resumeId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [addSection, setAddSection] = useState(false)
  const [newSectionType, setNewSectionType] = useState('skills')
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview')
  const { activePrep } = useActivePrepJob()

  // A4 preview scale — shrinks the 794px sheet to fit smaller containers
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  useEffect(() => {
    const container = previewContainerRef.current
    if (!container) return
    const update = () => {
      const available = container.clientWidth - 48
      setPreviewScale(Math.min(1, available / 794))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [activeTab])

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

  // drag state
  const dragIdx = useRef<number | null>(null)
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
            (a, b) => SECTION_ORDER.indexOf(a.section_type) - SECTION_ORDER.indexOf(b.section_type)
          )
        }
        // Rebuild: keep user's order but add new sections at bottom, remove deleted ones
        const existing = new Map(prev.map(s => [s.id, s]))
        const serverIds = new Set(resume.sections.map(s => s.id))
        // Update content of existing, keep order
        const updated = prev
          .filter(s => serverIds.has(s.id))
          .map(s => resume.sections.find(r => r.id === s.id) ?? s)
        // Add newly created sections
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
    if (!score) return '#94A3B8'
    if (score >= 80) return '#16A34A'
    if (score >= 60) return '#D97706'
    return '#DC2626'
  }

  // drag reorder — optimistic UI update + persist to server
  const handleDragStart = (i: number) => { dragIdx.current = i }
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault() }
  const handleDrop = useCallback((toIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) return
    const updated = [...sections]
    const [moved] = updated.splice(dragIdx.current, 1)
    updated.splice(toIdx, 0, moved)
    setSections(updated)
    dragIdx.current = null

    // Persist new sort_order values to server
    const payload = updated.map((s, idx) => ({ section_id: s.id, sort_order: idx }))
    resumeApi.reorderSections(resumeId!, payload).catch(() => {
      // On failure, re-sync from server
      qc.invalidateQueries({ queryKey: ['resume', resumeId] })
    })
  }, [sections, resumeId, qc])

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: '#F0F7FF', display: 'flex' }}>
      <AppSidebar activePath="/app/resume" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
  if (!resume) return null

  const existingTypes = new Set(sections.map(s => s.section_type))
  const availableTypes = ALL_SECTION_TYPES.filter(t => !existingTypes.has(t))

  return (
    <div style={{ minHeight: '100vh', background: '#F0F7FF', display: 'flex' }}>
      <AppSidebar activePath="/app/resume" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* top bar */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(37,99,235,0.08)',
          padding: '0 24px', height: 64,
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button onClick={() => navigate('/app/resume')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#9CA3AF' }}>
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {resume.title}
          </span>

          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3, marginLeft: 8, gap: 2 }}>
            {(['preview', 'edit'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#0F172A' : '#94A3B8',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(15,23,42,0.1)' : 'none',
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
              }}>
                {tab === 'preview' ? <Eye size={12} /> : <Edit3 size={12} />}
                {tab === 'preview' ? 'Preview' : 'Edit'}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {resume.ats_score !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${atsColor(resume.ats_score)}10`, border: `1px solid ${atsColor(resume.ats_score)}25`, borderRadius: 20, padding: '4px 11px' }}>
                <BarChart2 size={12} color={atsColor(resume.ats_score)} />
                <span style={{ fontSize: 12, fontWeight: 800, color: atsColor(resume.ats_score) }}>ATS {resume.ats_score}</span>
              </div>
            )}
            <button onClick={() => setCopilotOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
              background: '#6366F1',
              color: 'white', border: 'none',
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              boxShadow: '0 3px 10px rgba(124,58,237,0.3)',
            }}>
              <Wand2 size={13} />AI Generate
            </button>
          </div>
        </header>

        {/* body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* LEFT: sections editor */}
          <div style={{
            width: activeTab === 'edit' ? '100%' : 360,
            minWidth: 280,
            maxWidth: activeTab === 'edit' ? '100%' : 400,
            borderRight: '1px solid rgba(226,232,240,0.8)',
            overflowY: 'auto',
            padding: '16px 14px',
            background: '#F8FAFC',
          }}>
            <ActivePrepBanner showSwitch />

            {sections.length > 0 ? (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
                  {sections.length} sections · drag <GripVertical size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> to reorder
                </p>
                {sections.map((sec, i) => (
                  <SectionCard
                    key={sec.id}
                    section={sec}
                    resumeId={resumeId!}
                    index={i}
                    onUpdate={() => qc.invalidateQueries({ queryKey: ['resume', resumeId] })}
                    onDelete={() => {
                      if (confirm(`Delete "${SECTION_LABELS[sec.section_type]}"?`)) {
                        deleteSectionMutation.mutate(sec.id)
                        setSections(prev => prev.filter(s => s.id !== sec.id))
                      }
                    }}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </>
            ) : (
              <div style={{ background: 'white', borderRadius: 14, padding: 24, textAlign: 'center', border: '1.5px dashed rgba(226,232,240,0.8)', marginBottom: 14 }}>
                <FileText size={36} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No sections yet</p>
                <p style={{ fontSize: 12, color: '#94A3B8' }}>Click <strong>AI Generate</strong> to build your resume automatically.</p>
              </div>
            )}

            {availableTypes.length > 0 && (
              <button onClick={() => setAddSection(v => !v)} style={{ ...addBlockBtn, marginTop: 4 }}>
                <Plus size={13} /> Add Section
              </button>
            )}

            {addSection && (
              <div style={{ marginTop: 10, background: 'white', borderRadius: 12, border: '1.5px solid #E2E8F0', padding: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Choose section type</p>
                <select value={newSectionType} onChange={e => setNewSectionType(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
                  {availableTypes.map(t => <option key={t} value={t}>{SECTION_LABELS[t] ?? t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAddSection(false)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#64748B' }}>Cancel</button>
                  <button onClick={() => addSectionMutation.mutate()} disabled={addSectionMutation.isPending} style={{ flex: 1, padding: '7px', borderRadius: 8, background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Add</button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: preview */}
          {activeTab === 'preview' && (
            <div ref={previewContainerRef} style={{ flex: 1, overflow: 'auto', background: '#CBD5E1', padding: '28px 24px' }}>
              {/* toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, maxWidth: 794, margin: '0 auto 16px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Live Preview — A4</span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, background: downloading ? '#F1F5F9' : 'white', border: '1.5px solid #E2E8F0', color: '#374151', fontSize: 12, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer', boxShadow: '0 1px 4px rgba(15,23,42,0.08)', opacity: downloading ? 0.7 : 1 }}
                >
                  <Download size={12} /> {downloading ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
              {/* A4 sheet — scaled to fit container, scrollable on very small viewports */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{
                  width: 794,
                  margin: '0 auto',
                  boxShadow: '0 8px 40px rgba(15,23,42,0.25)',
                  transformOrigin: 'top center',
                  transform: `scale(${previewScale})`,
                  marginBottom: previewScale < 1 ? `${1123 * (previewScale - 1)}px` : undefined,
                }}>
                  <ResumePreview sections={sections} resume={resume} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media print {
          body > * { display: none !important; }
          .resume-paper { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>

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
            setActiveTab('preview')
          }}
        />
      )}
    </div>
  )
}

function getDefaultContent(type: string): Record<string, unknown> {
  if (type === 'summary')        return { text: '' }
  if (type === 'experience')     return { items: [{ title: '', company: '', start_date: '', end_date: 'Present', bullets: [''] }] }
  if (type === 'education')      return { items: [{ degree: '', field: '', institution: '', year: '' }] }
  if (type === 'skills')         return { technical: [], soft: [], domain: [] }
  if (type === 'achievements')   return { items: [''] }
  if (type === 'projects')       return { items: [{ name: '', tech: '', description: '' }] }
  if (type === 'certifications') return { items: [{ name: '', issuer: '', year: '' }] }
  if (type === 'languages')      return { items: [{ language: '', proficiency: 'Professional' }] }
  return {}
}
