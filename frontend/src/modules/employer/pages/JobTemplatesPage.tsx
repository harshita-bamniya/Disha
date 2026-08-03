/**
 * Job Templates — view, create (from scratch or copy from existing job), and delete saved templates.
 * Templates pre-fill the job form so recruiters don't retype the same role spec repeatedly.
 */
import { useState } from 'react'
import {
  FileSignature, Plus, Trash2, X, Briefcase, Tags, Code2,
  Clock4, GraduationCap, Sparkles, Globe, Copy,
} from 'lucide-react'
import { useJobTemplates, useCreateJobTemplate, useDeleteJobTemplate } from '../hooks/useJobs'
import { getApiError } from '@/api/client'
import type { JobTemplateEntry, JobType, EmploymentType } from '@/api/jobs'

const EMPLOYMENT_ICONS: Record<string, React.ElementType> = {
  full_time: Briefcase, part_time: Clock4, internship: GraduationCap,
  contract: FileSignature, freelance: Sparkles,
}

const JOB_TYPE_LABELS: Record<string, string> = {
  remote: 'Remote', pan_india: 'Pan India', hybrid: 'Hybrid', onsite: 'On-site',
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', internship: 'Internship',
  contract: 'Contract', freelance: 'Freelance',
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template, onDelete, canDelete,
}: {
  template: JobTemplateEntry; onDelete: () => void; canDelete: boolean
}) {
  const EmpIcon = template.employment_type ? (EMPLOYMENT_ICONS[template.employment_type] ?? Briefcase) : Briefcase

  return (
    <div style={{
      background: '#fff', borderRadius: 18, border: '1px solid rgba(37,99,235,0.09)',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'box-shadow 0.2s',
    }}
      onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(30,58,95,0.08)')}
      onMouseOut={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EmpIcon size={16} color="#3B82F6" />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>{template.name}</p>
            <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{template.title}</p>
          </div>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Trash2 size={12} color="#EF4444" />
          </button>
        )}
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {template.sector && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(124,58,237,0.07)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.12)' }}>
            {template.sector}
          </span>
        )}
        {template.job_type && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(14,165,233,0.07)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Globe size={9} />{JOB_TYPE_LABELS[template.job_type] ?? template.job_type}
          </span>
        )}
        {template.employment_type && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(5,150,105,0.07)', color: '#059669', border: '1px solid rgba(5,150,105,0.12)' }}>
            {EMPLOYMENT_LABELS[template.employment_type] ?? template.employment_type}
          </span>
        )}
        {template.min_k_score > 0 && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(30,58,95,0.07)', color: '#1E3A5F', border: '1px solid rgba(30,58,95,0.1)' }}>
            KRS ≥{template.min_k_score}
          </span>
        )}
      </div>

      {/* Skills */}
      {template.required_skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {template.required_skills.slice(0, 6).map(s => (
            <span key={s} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.06)', color: '#3B82F6' }}>{s}</span>
          ))}
          {template.required_skills.length > 6 && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, color: '#94A3B8' }}>+{template.required_skills.length - 6}</span>
          )}
        </div>
      )}

      {/* Description snippet */}
      {template.description && (
        <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {template.description}
        </p>
      )}

      <p style={{ fontSize: 10, color: '#CBD5E1', margin: 0, paddingTop: 4, borderTop: '1px solid rgba(37,99,235,0.08)' }}>
        Created {new Date(template.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  )
}

// ── Quick-create modal ────────────────────────────────────────────────────────

function CreateTemplateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateJobTemplate()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [sector, setSector] = useState('')
  const [description, setDescription] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [err, setErr] = useState('')

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !skills.includes(s)) setSkills(p => [...p, s])
    setSkillInput('')
  }

  const handleSave = () => {
    if (!name.trim() || !title.trim()) { setErr('Template name and job title are required'); return }
    create.mutate({
      name: name.trim(), title: title.trim(), description: description.trim(),
      sector: sector.trim(), required_skills: skills,
      job_type: null, employment_type: null, min_k_score: 0,
    }, {
      onSuccess: onClose,
      onError: e => setErr(getApiError(e)),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: 0 }}>New job template</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Template name', placeholder: 'e.g. Standard Policy Analyst', value: name, set: setName, required: true },
            { label: 'Job title', placeholder: 'e.g. Senior Policy Analyst', value: title, set: setTitle, required: true },
            { label: 'Sector', placeholder: 'e.g. Government & Civil Services', value: sector, set: setSector },
          ].map(({ label, placeholder, value, set, required }) => (
            <div key={label}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
              </label>
              <input
                value={value}
                onChange={e => { set(e.target.value); setErr('') }}
                placeholder={placeholder}
                style={{ width: '100%', height: 38, borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe typical responsibilities…"
              rows={4}
              style={{ width: '100%', borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '10px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Skills</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter…"
                style={{ flex: 1, height: 36, borderRadius: 9, border: '1.5px solid #E5E7EB', padding: '0 10px', fontSize: 13 }}
              />
              <button onClick={addSkill} style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={14} />
              </button>
            </div>
            {skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {skills.map(s => (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(59,130,246,0.07)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.15)' }}>
                    {s}
                    <button onClick={() => setSkills(p => p.filter(x => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 }}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={create.isPending} style={{ flex: 2, height: 40, borderRadius: 10, border: 'none', background: '#1E3A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: create.isPending ? 'not-allowed' : 'pointer', opacity: create.isPending ? 0.7 : 1 }}>
              {create.isPending ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobTemplatesPage() {
  const { data: templates, isLoading } = useJobTemplates()
  const deleteTemplate = useDeleteJobTemplate()
  const [showCreate, setShowCreate] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const totalSkills = (templates ?? []).reduce((a, t) => a + t.required_skills.length, 0)

  return (
    <div style={{ padding: '28px 20px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E3A5F', margin: 0 }}>Job Templates</h1>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Reusable job specs — fill in the form in seconds</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: '#1E3A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={14} />New template
          </button>
        </div>

        {/* Summary */}
        {(templates ?? []).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { icon: FileSignature, label: 'Templates', value: templates!.length, color: '#3B82F6' },
              { icon: Tags, label: 'Total skills', value: totalSkills, color: '#7C3AED' },
              { icon: Code2, label: 'With description', value: templates!.filter(t => t.description).length, color: '#059669' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#1E3A5F', margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0', fontWeight: 600 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tip banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 20 }}>
          <Copy size={13} color="#3B82F6" />
          <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
            <strong>Tip:</strong> You can also save a template directly from the job form using the "Save as template" button.
            Templates appear as a dropdown when posting new jobs.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 18, padding: '18px 20px', height: 160 }}>
                <div style={{ width: '60%', height: 14, borderRadius: 6, background: '#E5E7EB', marginBottom: 8 }} />
                <div style={{ width: '40%', height: 11, borderRadius: 5, background: '#F1F5F9', marginBottom: 14 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {[60, 70, 50].map((w, j) => <div key={j} style={{ width: w, height: 20, borderRadius: 20, background: '#F1F5F9' }} />)}
                </div>
              </div>
            ))}
          </div>
        ) : !templates?.length ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FileSignature size={28} color="#3B82F6" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>No templates yet</h3>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px' }}>Save time by creating reusable job spec templates for your most common roles.</p>
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 10, border: 'none', background: '#1E3A5F', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={14} />Create first template
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                canDelete={true}
                onDelete={() => setDeleteConfirm(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTemplateModal onClose={() => setShowCreate(false)} />}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 26, maxWidth: 360, width: '100%' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F', margin: '0 0 8px' }}>Delete template?</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 18px' }}>This cannot be undone. Existing jobs using this template won't be affected.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => deleteTemplate.mutate(deleteConfirm, { onSuccess: () => setDeleteConfirm(null) })}
                disabled={deleteTemplate.isPending}
                style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleteTemplate.isPending ? 0.7 : 1 }}
              >
                {deleteTemplate.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
