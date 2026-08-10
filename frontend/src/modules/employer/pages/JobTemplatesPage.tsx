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
import Button from '@/shared/components/primitives/Button'
import { colors, radius } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import ErrorState from '@/shared/components/feedback/ErrorState'

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
      background: colors.surface.card, borderRadius: radius.xl, border: `1px solid ${colors.border.default}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}
      onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,23,42,0.08)'; e.currentTarget.style.borderColor = colors.border.medium }}
      onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = colors.border.default }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EmpIcon size={16} color={colors.text.ink} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, margin: 0 }}>{template.name}</p>
            <p style={{ fontSize: 11, color: colors.text.inkSoft, margin: '2px 0 0' }}>{template.title}</p>
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
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: colors.state.infoBg, color: colors.state.info, border: `1px solid rgba(37,99,235,0.15)` }}>
            {template.sector}
          </span>
        )}
        {template.job_type && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: colors.surface.elevated, color: colors.text.inkSoft, border: `1px solid ${colors.border.default}`, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Globe size={9} />{JOB_TYPE_LABELS[template.job_type] ?? template.job_type}
          </span>
        )}
        {template.employment_type && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: colors.state.successBg, color: colors.state.success, border: `1px solid rgba(22,163,74,0.15)` }}>
            {EMPLOYMENT_LABELS[template.employment_type] ?? template.employment_type}
          </span>
        )}
        {template.min_k_score > 0 && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(30,58,95,0.07)', color: colors.text.ink, border: `1px solid ${colors.border.default}` }}>
            KRS ≥{template.min_k_score}
          </span>
        )}
      </div>

      {/* Skills */}
      {template.required_skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {template.required_skills.slice(0, 6).map(s => (
            <span key={s} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: colors.surface.elevated, color: colors.text.inkSoft }}>{s}</span>
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

      <p style={{ fontSize: 10, color: colors.text.muted, margin: 0, paddingTop: 4, borderTop: `1px solid ${colors.border.default}` }}>
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
      <div style={{ background: colors.surface.card, borderRadius: radius['2xl'], padding: 28, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.15)', border: `1px solid ${colors.border.default}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: 0 }}>New job template</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text.muted }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Template name', placeholder: 'e.g. Standard Policy Analyst', value: name, set: setName, required: true },
            { label: 'Job title', placeholder: 'e.g. Senior Policy Analyst', value: title, set: setTitle, required: true },
            { label: 'Sector', placeholder: 'e.g. Government & Civil Services', value: sector, set: setSector },
          ].map(({ label, placeholder, value, set, required }) => (
            <div key={label}>
              <label style={{ fontSize: 11, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>
                {label}{required && <span style={{ color: colors.state.danger }}> *</span>}
              </label>
              <input
                value={value}
                onChange={e => { set(e.target.value); setErr('') }}
                placeholder={placeholder}
                style={{ width: '100%', height: 38, borderRadius: radius.md, border: `1px solid ${colors.border.default}`, padding: '0 12px', fontSize: 13, boxSizing: 'border-box', color: colors.text.ink, outline: 'none' }}
              />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe typical responsibilities…"
              rows={4}
              style={{ width: '100%', borderRadius: radius.md, border: `1px solid ${colors.border.default}`, padding: '10px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: colors.text.ink, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: colors.text.inkSoft, display: 'block', marginBottom: 4 }}>Skills</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter…"
                style={{ flex: 1, height: 36, borderRadius: radius.md, border: `1px solid ${colors.border.default}`, padding: '0 10px', fontSize: 13, color: colors.text.ink, outline: 'none' }}
              />
              <button onClick={addSkill} style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: colors.brand.navy, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={14} />
              </button>
            </div>
            {skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {skills.map(s => (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: colors.surface.elevated, color: colors.text.inkSoft, border: `1px solid ${colors.border.default}` }}>
                    {s}
                    <button onClick={() => setSkills(p => p.filter(x => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 }}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {err && <p style={{ fontSize: 12, color: colors.state.danger, margin: 0 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" style={{ flex: 2 }} onClick={handleSave} loading={create.isPending}>Save template</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobTemplatesPage() {
  const { data: templates, isLoading, isError, refetch } = useJobTemplates()
  const deleteTemplate = useDeleteJobTemplate()
  const [showCreate, setShowCreate] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const totalSkills = (templates ?? []).reduce((a, t) => a + t.required_skills.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="Job Templates"
        subtitle="Reusable job specs — fill in the form in seconds"
        actions={<Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} />New template</Button>}
      />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>

        {/* Summary */}
        {(templates ?? []).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { icon: FileSignature, label: 'Templates', value: templates!.length },
              { icon: Tags, label: 'Total skills', value: totalSkills },
              { icon: Code2, label: 'With description', value: templates!.filter(t => t.description).length },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: colors.surface.card, borderRadius: radius.lg, padding: '12px 16px', border: `1px solid ${colors.border.default}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={colors.text.ink} />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 900, color: colors.text.ink, margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 10, color: colors.text.muted, margin: '2px 0 0', fontWeight: 600 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tip banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: radius.md, background: colors.state.infoBg, border: `1px solid ${colors.border.default}`, marginBottom: 16 }}>
          <Copy size={13} color={colors.brand.navy} />
          <p style={{ fontSize: 12, color: colors.text.inkSoft, margin: 0 }}>
            <strong>Tip:</strong> You can also save a template directly from the job form using the "Save as template" button.
            Templates appear as a dropdown when posting new jobs.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: colors.surface.card, borderRadius: 18, padding: '18px 20px', height: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton width="60%" height={14} radius={6} />
                <Skeleton width="40%" height={11} radius={5} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[60, 70, 50].map((w, j) => <Skeleton key={j} width={w} height={20} radius={20} />)}
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load templates"
            description="Could not fetch your job templates. Please try again."
            onRetry={() => refetch()}
          />
        ) : !templates?.length ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: colors.surface.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FileSignature size={28} color={colors.text.muted} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: '0 0 8px' }}>No templates yet</h3>
            <p style={{ fontSize: 13, color: colors.text.muted, margin: '0 0 20px' }}>Save time by creating reusable job spec templates for your most common roles.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={14} />Create first template
            </Button>
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
          <div style={{ background: colors.surface.card, borderRadius: radius.xl, padding: 26, maxWidth: 360, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.15)', border: `1px solid ${colors.border.default}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.text.ink, margin: '0 0 8px' }}>Delete template?</h3>
            <p style={{ fontSize: 13, color: colors.text.inkSoft, margin: '0 0 18px' }}>This cannot be undone. Existing jobs using this template won't be affected.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" loading={deleteTemplate.isPending} onClick={() => deleteTemplate.mutate(deleteConfirm, { onSuccess: () => setDeleteConfirm(null) })}>Delete</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
