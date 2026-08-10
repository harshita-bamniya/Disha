/**
 * Phase 8 — Application Form Builder (Employer)
 * Per-job form builder: sections, questions, knockout rules, settings, publish.
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Settings2,
  Send, Save, X, AlertTriangle, Check, GripVertical, Eye,
  BookOpen, FileText, Zap,
} from 'lucide-react'
import {
  applicationFormsApi,
  type ApplicationFormOut, type FormSectionOut, type QuestionOut,
  type QuestionIn, type KnockoutRuleIn, type FormSectionIn, type FormSettingsIn,
} from '@/api/applicationForms'
import { getApiError } from '@/api/client'
import { C } from '../ds'
import { colors, radius } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import PageHeader from '@/shared/layouts/PageHeader'

const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${colors.border.default}`, borderRadius: 7, fontSize: 13, color: colors.text.ink, background: colors.surface.card, cursor: 'pointer' }

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  { value: 'short_text',         label: 'Short Text' },
  { value: 'long_text',          label: 'Long Text' },
  { value: 'number',             label: 'Number' },
  { value: 'email',              label: 'Email' },
  { value: 'phone',              label: 'Phone' },
  { value: 'date',               label: 'Date' },
  { value: 'dropdown',           label: 'Dropdown' },
  { value: 'multi_select',       label: 'Multi Select' },
  { value: 'radio',              label: 'Radio' },
  { value: 'yes_no',             label: 'Yes / No' },
  { value: 'file_upload',        label: 'File Upload' },
  { value: 'url',                label: 'URL' },
  { value: 'linkedin_url',       label: 'LinkedIn URL' },
  { value: 'github_url',         label: 'GitHub URL' },
  { value: 'portfolio_url',      label: 'Portfolio URL' },
  { value: 'experience_years',   label: 'Years of Experience' },
  { value: 'salary_expectation', label: 'Salary Expectation' },
  { value: 'notice_period',      label: 'Notice Period' },
  { value: 'work_authorization', label: 'Work Authorization' },
  { value: 'visa_sponsorship',   label: 'Visa Sponsorship' },
  { value: 'relocation',         label: 'Relocation' },
  { value: 'remote_preference',  label: 'Remote Preference' },
  { value: 'availability',       label: 'Availability' },
  { value: 'checkbox',           label: 'Checkbox' },
]

const COMPLIANCE_TYPES = new Set([
  'work_authorization', 'visa_sponsorship',
])

const KNOCKOUT_ACTIONS = [
  { value: 'auto_reject',  label: 'Auto-Reject',  color: '#DC2626' },
  { value: 'auto_tag',     label: 'Auto-Tag',      color: '#D97706' },
  { value: 'alert',        label: 'Alert Recruiter',color: '#2563EB' },
  { value: 'label',        label: 'Label',          color: '#7C3AED' },
  { value: 'auto_advance', label: 'Auto-Advance',   color: '#059669' },
]

const OPERATORS = [
  { value: 'equals',        label: 'equals' },
  { value: 'not_equals',    label: 'not equals' },
  { value: 'greater_than',  label: 'greater than' },
  { value: 'less_than',     label: 'less than' },
  { value: 'contains',      label: 'contains' },
]

const RESUME_CONFIG_OPTIONS = [
  { value: 'required',  label: 'Required' },
  { value: 'optional',  label: 'Optional' },
  { value: 'hidden',    label: 'Hidden' },
  { value: 'auto_fill', label: 'Auto-fill from profile' },
]

const COVER_LETTER_OPTIONS = [
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
  { value: 'hidden',   label: 'Hidden' },
]

// ── Blank defaults ─────────────────────────────────────────────────────────────

const BLANK_QUESTION: QuestionIn = {
  question_type: 'short_text',
  label: '',
  hint_text: null,
  placeholder: null,
  is_required: false,
  character_limit: null,
  options_json: null,
}

const DEFAULT_SETTINGS: FormSettingsIn = {
  resume_config: 'required',
  require_cover_letter: 'optional',
  require_portfolio: 'hidden',
  require_work_authorization: false,
  allow_attachments: false,
  max_attachment_size_mb: 10,
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === 'published') return { label: 'Published', bg: C.greenBg, color: C.green }
  return { label: 'Draft', bg: '#F3F4F6', color: C.ink2 }
}

function hasOptions(qt: string) {
  return ['dropdown', 'multi_select', 'radio', 'checkbox'].includes(qt)
}

// ── Question Editor Modal ─────────────────────────────────────────────────────

function QuestionModal({
  initial, sectionId, onSave, onClose,
}: {
  initial?: QuestionOut | null
  sectionId: string
  onSave: (q: QuestionIn) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<QuestionIn>(
    initial
      ? {
          question_type: initial.question_type,
          label: initial.label,
          hint_text: initial.hint_text,
          placeholder: initial.placeholder,
          is_required: initial.is_required,
          character_limit: initial.character_limit,
          options_json: initial.options_json,
        }
      : { ...BLANK_QUESTION }
  )
  const [optionInput, setOptionInput] = useState('')

  const update = (patch: Partial<QuestionIn>) => setForm(f => ({ ...f, ...patch }))

  function addOption() {
    const val = optionInput.trim()
    if (!val) return
    const opts = form.options_json ?? []
    update({ options_json: [...opts, { value: val.toLowerCase().replace(/\s+/g, '_'), label: val }] })
    setOptionInput('')
  }

  function removeOption(idx: number) {
    const opts = [...(form.options_json ?? [])]
    opts.splice(idx, 1)
    update({ options_json: opts.length ? opts : null })
  }

  const valid = form.label.trim().length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div style={{ background: colors.surface.card, borderRadius: radius.xl, padding: 24, width: '100%', maxWidth: 520, border: `1px solid ${colors.border.default}`, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: 0 }}>
            {initial ? 'Edit Question' : 'Add Question'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={14} /></Button>
        </div>

        {/* Question type */}
        <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Question Type</label>
        <select
          value={form.question_type}
          onChange={e => update({ question_type: e.target.value, options_json: hasOptions(e.target.value) ? (form.options_json ?? []) : null })}
          style={{ ...selectStyle, width: '100%', marginBottom: 14 }}
        >
          {QUESTION_TYPES.map(qt => (
            <option key={qt.value} value={qt.value}>{qt.label}</option>
          ))}
        </select>

        {/* Label */}
        <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Question Label *</label>
        <input
          value={form.label}
          onChange={e => update({ label: e.target.value })}
          placeholder="e.g. How many years of experience do you have?"
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        {/* Hint text */}
        <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Hint / Helper Text</label>
        <input
          value={form.hint_text ?? ''}
          onChange={e => update({ hint_text: e.target.value || null })}
          placeholder="Optional explanation shown below the field"
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        {/* Options for choice-based types */}
        {hasOptions(form.question_type) && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Options</label>
            {(form.options_json ?? []).map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 13, color: C.ink1 }}>{opt.label}</span>
                <Button variant="ghost" size="icon" onClick={() => removeOption(i)} aria-label="Remove option"><X size={12} /></Button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <input
                value={optionInput}
                onChange={e => setOptionInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                placeholder="Type option and press Enter or Add"
                style={{ ...inputStyle, flex: 1 }}
              />
              <Button variant="outline" size="sm" onClick={addOption} style={{ flexShrink: 0 }}>Add</Button>
            </div>
          </>
        )}

        {/* Character limit */}
        {['short_text', 'long_text'].includes(form.question_type) && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Character Limit</label>
            <input
              type="number"
              value={form.character_limit ?? ''}
              onChange={e => update({ character_limit: e.target.value ? Number(e.target.value) : null })}
              placeholder="Leave blank for no limit"
              style={{ ...inputStyle, marginBottom: 14 }}
            />
          </>
        )}

        {/* Required toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={form.is_required}
            onChange={e => update({ is_required: e.target.checked })}
          />
          <span style={{ fontSize: 13, color: C.ink1 }}>Required field</span>
        </label>

        {/* Compliance warning */}
        {COMPLIANCE_TYPES.has(form.question_type) && (
          <div style={{ display: 'flex', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7, padding: '8px 12px', marginBottom: 16 }}>
            <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>
              Compliance fields cannot have knockout rules and are never used for scoring.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => valid && onSave(form)} disabled={!valid}>
            {initial ? 'Save Changes' : 'Add Question'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Knockout Rule Modal ───────────────────────────────────────────────────────

function KnockoutModal({
  question, initial, onSave, onDelete, onClose,
}: {
  question: QuestionOut
  initial: KnockoutRuleIn | null
  onSave: (r: KnockoutRuleIn) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<KnockoutRuleIn>(
    initial ?? { operator: 'equals', threshold_value: '', action: 'auto_reject', tag_name: null, priority: 0 }
  )
  const update = (patch: Partial<KnockoutRuleIn>) => setForm(f => ({ ...f, ...patch }))
  const valid = form.threshold_value.trim().length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div style={{ background: colors.surface.card, borderRadius: radius.xl, padding: 24, width: '100%', maxWidth: 460, border: `1px solid ${colors.border.default}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: 0 }}>Knockout Rule</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={14} /></Button>
        </div>
        <p style={{ fontSize: 12, color: C.ink2, marginBottom: 18 }}>
          For: <strong>{question.label}</strong>
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>When answer</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <select value={form.operator} onChange={e => update({ operator: e.target.value })} style={{ ...selectStyle, flex: 1 }}>
            {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
          <input
            value={form.threshold_value}
            onChange={e => update({ threshold_value: e.target.value })}
            placeholder="threshold value"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Then action</label>
        <select value={form.action} onChange={e => update({ action: e.target.value })} style={{ ...selectStyle, width: '100%', marginBottom: 14 }}>
          {KNOCKOUT_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        {form.action === 'auto_tag' && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Tag Name</label>
            <input
              value={form.tag_name ?? ''}
              onChange={e => update({ tag_name: e.target.value || null })}
              placeholder="e.g. strong-candidate"
              style={{ ...inputStyle, marginBottom: 14 }}
            />
          </>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Priority (higher = evaluated first)</label>
        <input
          type="number"
          min={0}
          value={form.priority ?? 0}
          onChange={e => update({ priority: Number(e.target.value) })}
          style={{ ...inputStyle, marginBottom: 20 }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {initial && (
            <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 border-red-600">
              <Trash2 size={13} />Remove rule
            </Button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => valid && onSave(form)} disabled={!valid}>
              Save Rule
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section Editor ────────────────────────────────────────────────────────────

function SectionTitleEdit({
  section, onSave, onCancel,
}: { section: FormSectionOut; onSave: (b: FormSectionIn) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(section.title)
  const [desc, setDesc] = useState(section.description ?? '')
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
      <div style={{ flex: 1 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} placeholder="Section title" />
        <input value={desc} onChange={e => setDesc(e.target.value)} style={inputStyle} placeholder="Optional description" />
      </div>
      <Button variant="primary" size="sm" onClick={() => onSave({ title, description: desc || null, section_type: section.section_type })}
        aria-label="Save section title"><Check size={13} /></Button>
      <Button variant="outline" size="sm" onClick={onCancel} aria-label="Cancel editing"><X size={13} /></Button>
    </div>
  )
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({
  settings, formId, onSaved,
}: {
  settings: ApplicationFormOut['settings_json']
  formId: string
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormSettingsIn>({
    resume_config: settings.resume_config ?? 'required',
    require_cover_letter: settings.require_cover_letter ?? 'optional',
    require_portfolio: settings.require_portfolio ?? 'hidden',
    require_work_authorization: settings.require_work_authorization ?? false,
    allow_attachments: settings.allow_attachments ?? false,
    max_attachment_size_mb: settings.max_attachment_size_mb ?? 10,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const update = (patch: Partial<FormSettingsIn>) => setForm(f => ({ ...f, ...patch }))

  async function save() {
    setSaving(true); setErr(null)
    try {
      await applicationFormsApi.updateForm(formId, form)
      qc.invalidateQueries({ queryKey: ['form-builder'] })
      onSaved()
    } catch (e) {
      setErr(getApiError(e, 'Failed to save settings.'))
    } finally {
      setSaving(false)
    }
  }

  const row = (label: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${colors.border.default}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Settings2 size={14} color={C.ink2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink1 }}>Form Settings</span>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {row('Resume Upload', (
          <select value={form.resume_config} onChange={e => update({ resume_config: e.target.value })} style={{ ...selectStyle, width: '100%' }}>
            {RESUME_CONFIG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {row('Cover Letter', (
          <select value={form.require_cover_letter} onChange={e => update({ require_cover_letter: e.target.value })} style={{ ...selectStyle, width: '100%' }}>
            {COVER_LETTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {row('', (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.allow_attachments} onChange={e => update({ allow_attachments: e.target.checked })} />
            <span style={{ fontSize: 13, color: C.ink1 }}>Allow additional attachments</span>
          </label>
        ))}
        {err && <p style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{err}</p>}
        <Button variant="primary" size="sm" onClick={save} disabled={saving} loading={saving} fullWidth>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question, sectionId, isFirst, isLast,
  onEdit, onDelete, onMoveUp, onMoveDown, onKnockout,
}: {
  question: QuestionOut
  sectionId: string
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onKnockout: () => void
}) {
  const typeLabel = QUESTION_TYPES.find(t => t.value === question.question_type)?.label ?? question.question_type
  const isCompliance = question.is_compliance_protected
  const hasKnockout = !!question.knockout_rule

  return (
    <div style={{
      background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: 8,
      padding: '10px 14px', marginBottom: 6,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <GripVertical size={14} color={C.ink3} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink1 }}>{question.label}</span>
          {question.is_required && (
            <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>*Required</span>
          )}
          {isCompliance && (
            <span style={{ fontSize: 10, background: '#EFF6FF', color: '#2563EB', fontWeight: 600, borderRadius: 4, padding: '1px 5px' }}>compliance</span>
          )}
          {hasKnockout && (
            <span style={{
              fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 5px',
              background: KNOCKOUT_ACTIONS.find(a => a.value === question.knockout_rule!.action)?.color + '18',
              color: KNOCKOUT_ACTIONS.find(a => a.value === question.knockout_rule!.action)?.color,
            }}>
              {KNOCKOUT_ACTIONS.find(a => a.value === question.knockout_rule!.action)?.label}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: C.ink3 }}>{typeLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={isFirst} aria-label="Move up"
          style={{ opacity: isFirst ? 0.3 : 1, border: `1px solid ${C.border}` }}><ChevronUp size={12} /></Button>
        <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={isLast} aria-label="Move down"
          style={{ opacity: isLast ? 0.3 : 1, border: `1px solid ${C.border}` }}><ChevronDown size={12} /></Button>
        {!isCompliance && (
          <Button variant="ghost" size="icon" onClick={onKnockout} aria-label="Edit knockout rule"
            style={{ borderColor: hasKnockout ? colors.state.info : colors.border.default, color: hasKnockout ? colors.state.info : colors.text.inkSoft, border: `1px solid ${hasKnockout ? colors.state.info : colors.border.default}` }}>
            <Zap size={12} />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit question"
          style={{ border: `1px solid ${C.border}` }}><Settings2 size={12} /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete question"
          style={{ color: C.red, border: `1px solid ${C.redBg}` }}><Trash2 size={12} /></Button>
      </div>
    </div>
  )
}

// ── Section Block ─────────────────────────────────────────────────────────────

function SectionBlock({
  section, formId, isFirst, isLast, totalSections,
  onRefresh,
}: {
  section: FormSectionOut
  formId: string
  isFirst: boolean
  isLast: boolean
  totalSections: number
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [editingTitle, setEditingTitle] = useState(false)
  const [addingQ, setAddingQ] = useState(false)
  const [editingQ, setEditingQ] = useState<QuestionOut | null>(null)
  const [knockoutQ, setKnockoutQ] = useState<QuestionOut | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['form-builder'] })
    onRefresh()
  }

  // Section mutations
  const updateSection = useMutation({
    mutationFn: (body: FormSectionIn) => applicationFormsApi.updateSection(section.id, body),
    onSuccess: () => { setEditingTitle(false); invalidate() },
  })

  const deleteSection = useMutation({
    mutationFn: () => applicationFormsApi.deleteSection(section.id),
    onSuccess: invalidate,
  })

  const moveSection = useMutation({
    mutationFn: (direction: 'up' | 'down') => {
      const newIdx = direction === 'up' ? section.order_index - 1 : section.order_index + 1
      return applicationFormsApi.reorderSections(formId, [
        { section_id: section.id, order_index: newIdx },
      ])
    },
    onSuccess: invalidate,
  })

  // Question mutations
  const addQuestion = useMutation({
    mutationFn: (body: QuestionIn) => applicationFormsApi.addQuestion(section.id, body),
    onSuccess: () => { setAddingQ(false); invalidate() },
  })

  const updateQuestion = useMutation({
    mutationFn: ({ id, body }: { id: string; body: QuestionIn }) => applicationFormsApi.updateQuestion(id, body),
    onSuccess: () => { setEditingQ(null); invalidate() },
  })

  const deleteQuestion = useMutation({
    mutationFn: (id: string) => applicationFormsApi.deleteQuestion(id),
    onSuccess: invalidate,
  })

  const moveQuestion = useMutation({
    mutationFn: ({ qId, direction }: { qId: string; direction: 'up' | 'down' }) => {
      const q = section.questions.find(q => q.id === qId)!
      const newIdx = direction === 'up' ? q.order_index - 1 : q.order_index + 1
      return applicationFormsApi.reorderQuestions(section.id, [
        { question_id: qId, order_index: newIdx },
      ])
    },
    onSuccess: invalidate,
  })

  const setKnockout = useMutation({
    mutationFn: ({ qId, body }: { qId: string; body: KnockoutRuleIn }) =>
      applicationFormsApi.setKnockoutRule(qId, body),
    onSuccess: () => { setKnockoutQ(null); invalidate() },
  })

  const deleteKnockout = useMutation({
    mutationFn: (qId: string) => applicationFormsApi.deleteKnockoutRule(qId),
    onSuccess: () => { setKnockoutQ(null); invalidate() },
  })

  const sorted = [...section.questions].sort((a, b) => a.order_index - b.order_index)

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, overflow: 'hidden', marginBottom: 16 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${colors.border.default}` }}>
        {editingTitle ? (
          <SectionTitleEdit
            section={section}
            onSave={body => updateSection.mutate(body)}
            onCancel={() => setEditingTitle(false)}
          />
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.ink1, margin: 0 }}>{section.title}</p>
              {section.description && <p style={{ fontSize: 12, color: C.ink2, margin: '2px 0 0' }}>{section.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <Button variant="ghost" size="icon" onClick={() => moveSection.mutate('up')} disabled={isFirst} aria-label="Move section up"
                style={{ opacity: isFirst ? 0.3 : 1, border: `1px solid ${C.border}` }}><ChevronUp size={12} /></Button>
              <Button variant="ghost" size="icon" onClick={() => moveSection.mutate('down')} disabled={isLast} aria-label="Move section down"
                style={{ opacity: isLast ? 0.3 : 1, border: `1px solid ${C.border}` }}><ChevronDown size={12} /></Button>
              <Button variant="ghost" size="icon" onClick={() => setEditingTitle(true)} aria-label="Edit section title"
                style={{ border: `1px solid ${C.border}` }}><Settings2 size={12} /></Button>
              {totalSections > 1 && !section.is_locked && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(true)} aria-label="Delete section"
                  style={{ color: C.red, border: `1px solid ${C.redBg}` }}><Trash2 size={12} /></Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ padding: '12px 20px', background: C.redBg, borderBottom: `1px solid #FCA5A5`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: C.red }}>Delete this section and all its questions?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => deleteSection.mutate()}>Delete</Button>
          </div>
        </div>
      )}

      {/* Questions */}
      <div style={{ padding: '12px 16px' }}>
        {sorted.length === 0 && (
          <p style={{ fontSize: 12, color: C.ink3, textAlign: 'center', padding: '12px 0' }}>No questions yet. Add one below.</p>
        )}
        {sorted.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            sectionId={section.id}
            isFirst={i === 0}
            isLast={i === sorted.length - 1}
            onEdit={() => setEditingQ(q)}
            onDelete={() => deleteQuestion.mutate(q.id)}
            onMoveUp={() => moveQuestion.mutate({ qId: q.id, direction: 'up' })}
            onMoveDown={() => moveQuestion.mutate({ qId: q.id, direction: 'down' })}
            onKnockout={() => setKnockoutQ(q)}
          />
        ))}

        {/* Add question button */}
        <Button variant="ghost" size="sm" onClick={() => setAddingQ(true)} style={{ color: colors.state.info, marginTop: 4 }}>
          <Plus size={13} />Add Question
        </Button>
      </div>

      {/* Modals */}
      {addingQ && (
        <QuestionModal
          sectionId={section.id}
          onSave={body => addQuestion.mutate(body)}
          onClose={() => setAddingQ(false)}
        />
      )}
      {editingQ && (
        <QuestionModal
          initial={editingQ}
          sectionId={section.id}
          onSave={body => updateQuestion.mutate({ id: editingQ.id, body })}
          onClose={() => setEditingQ(null)}
        />
      )}
      {knockoutQ && (
        <KnockoutModal
          question={knockoutQ}
          initial={knockoutQ.knockout_rule
            ? {
                operator: knockoutQ.knockout_rule.operator,
                threshold_value: knockoutQ.knockout_rule.threshold_value,
                action: knockoutQ.knockout_rule.action,
                tag_name: knockoutQ.knockout_rule.tag_name,
                priority: knockoutQ.knockout_rule.priority,
              }
            : null
          }
          onSave={body => setKnockout.mutate({ qId: knockoutQ.id, body })}
          onDelete={() => deleteKnockout.mutate(knockoutQ.id)}
          onClose={() => setKnockoutQ(null)}
        />
      )}
    </div>
  )
}

// ── Template Save Modal ───────────────────────────────────────────────────────

function SaveTemplateModal({ formId, onClose }: { formId: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true); setErr(null)
    try {
      await applicationFormsApi.saveAsTemplate(formId, name.trim(), desc.trim() || undefined)
      setDone(true)
    } catch (e) {
      setErr(getApiError(e, 'Failed to save template.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div style={{ background: colors.surface.card, borderRadius: radius.xl, padding: 24, width: '100%', maxWidth: 420, border: `1px solid ${colors.border.default}` }}>
        {done ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Check size={18} color={C.green} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: 0 }}>Template Saved</h3>
            </div>
            <p style={{ fontSize: 13, color: C.ink2, marginBottom: 16 }}>You can now reuse this form configuration for other jobs.</p>
            <Button variant="primary" size="sm" onClick={onClose} fullWidth>Done</Button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink1, margin: 0 }}>Save as Template</h3>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={14} /></Button>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Template Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Engineering Application" style={{ ...inputStyle, marginBottom: 12 }} />
            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 4 }}>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" style={{ ...inputStyle, marginBottom: 16 }} />
            {err && <p style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={onClose} fullWidth>Cancel</Button>
              <Button variant="primary" size="sm" onClick={save} disabled={!name.trim() || saving} loading={saving} fullWidth>
                {saving ? 'Saving…' : 'Save Template'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FormBuilderPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showSettings, setShowSettings] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishSuccess, setPublishSuccess] = useState(false)

  // Fetch draft form (creates one if not exists via fallback)
  const { data: form, isLoading, error, refetch } = useQuery({
    queryKey: ['form-builder', jobId],
    queryFn: async () => {
      try {
        return await applicationFormsApi.getDraftForm(jobId!)
      } catch {
        // No form yet — create a blank draft
        return applicationFormsApi.createForm(jobId!)
      }
    },
    enabled: !!jobId,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['form-builder', jobId] })
  }, [qc, jobId])

  // Add section
  const addSection = useMutation({
    mutationFn: () =>
      applicationFormsApi.addSection(form!.id, {
        title: `Section ${(form?.sections.length ?? 0) + 1}`,
        section_type: 'questions',
      }),
    onSuccess: invalidate,
  })

  // Publish
  const publish = useMutation({
    mutationFn: () => applicationFormsApi.publishForm(form!.id),
    onSuccess: () => {
      setPublishSuccess(true)
      setPublishError(null)
      invalidate()
      setTimeout(() => setPublishSuccess(false), 3000)
    },
    onError: (e) => setPublishError(getApiError(e, 'Publish failed.')),
  })

  if (!jobId) return null

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: colors.surface.bg }}>
        <Spinner />
      </div>
    )
  }

  if (error && !form) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: colors.surface.bg }}>
        <ErrorState title="Failed to load form" description={getApiError(error, 'Failed to load form.')} onRetry={refetch} />
      </div>
    )
  }

  const badge = statusBadge(form?.status ?? 'draft')
  const sortedSections = [...(form?.sections ?? [])].sort((a, b) => a.order_index - b.order_index)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header: back + status + actions */}
      <PageHeader
        title="Form Builder"
        subtitle={form?.status === 'published' ? `v${form.version}` : undefined}
        back={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={14} />
          </Button>
        }
        below={
          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 99, padding: '2px 8px', background: badge.bg, color: badge.color, display: 'inline-block', marginTop: 6 }}>
            {badge.label}
          </span>
        }
        actions={<>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(v => !v)}
            style={{ background: showSettings ? colors.state.infoBg : undefined, color: showSettings ? colors.state.info : undefined }}>
            <Settings2 size={13} />Settings
          </Button>
          {form && (
            <Button variant="outline" size="sm" onClick={() => setShowTemplateModal(true)}>
              <Save size={13} />Save Template
            </Button>
          )}
          {form && (
            <Button variant="primary" size="sm"
              onClick={() => { setPublishError(null); publish.mutate() }}
              disabled={publish.isPending} loading={publish.isPending}
              style={{ background: colors.brand.navy }}>
              <Send size={13} />{publish.isPending ? 'Publishing…' : 'Publish Form'}
            </Button>
          )}
        </>}
      />

      {/* Publish feedback */}
      {publishSuccess && (
        <div style={{ background: C.greenBg, borderBottom: `1px solid #BBF7D0`, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} color={C.green} />
          <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>Form published successfully. Candidates can now apply.</span>
        </div>
      )}
      {publishError && (
        <div style={{ background: C.redBg, borderBottom: `1px solid #FCA5A5`, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} color={C.red} />
          <span style={{ fontSize: 13, color: C.red }}>{publishError}</span>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, padding: '20px 28px', background: colors.surface.bg }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>

          {/* Settings panel (collapsible) */}
          {showSettings && form && (
            <SettingsPanel
              settings={form.settings_json}
              formId={form.id}
              onSaved={() => setShowSettings(false)}
            />
          )}

          {/* Info bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} color={C.ink3} />
              <span style={{ fontSize: 12, color: C.ink2 }}>{sortedSections.length} section{sortedSections.length !== 1 ? 's' : ''}</span>
            </div>
            <span style={{ color: C.border }}>·</span>
            <span style={{ fontSize: 12, color: C.ink2 }}>
              {sortedSections.reduce((n, s) => n + s.questions.length, 0)} question{sortedSections.reduce((n, s) => n + s.questions.length, 0) !== 1 ? 's' : ''}
            </span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ fontSize: 12, color: C.ink3 }}>
              <Zap size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              {sortedSections.reduce((n, s) => n + s.questions.filter(q => q.knockout_rule).length, 0)} knockout rule{sortedSections.reduce((n, s) => n + s.questions.filter(q => q.knockout_rule).length, 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Sections */}
          {sortedSections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: colors.surface.card, border: `2px dashed ${colors.border.default}`, borderRadius: radius.xl }}>
              <BookOpen size={32} color={C.ink3} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: C.ink1, marginBottom: 6 }}>No sections yet</p>
              <p style={{ fontSize: 13, color: C.ink2, marginBottom: 18 }}>Add a section to start building your application form.</p>
              <Button variant="primary" size="sm" onClick={() => addSection.mutate()} disabled={addSection.isPending} loading={addSection.isPending}>
                <Plus size={14} />Add First Section
              </Button>
            </div>
          ) : (
            <>
              {sortedSections.map((section, i) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  formId={form!.id}
                  isFirst={i === 0}
                  isLast={i === sortedSections.length - 1}
                  totalSections={sortedSections.length}
                  onRefresh={invalidate}
                />
              ))}
              <Button variant="outline" size="sm" onClick={() => addSection.mutate()} disabled={addSection.isPending} fullWidth style={{ marginTop: 8 }}>
                <Plus size={13} />Add Section
              </Button>
            </>
          )}

          {/* Legend */}
          <div style={{ marginTop: 24, padding: '12px 16px', background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Knockout Action Legend</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              {KNOCKOUT_ACTIONS.map(a => (
                <div key={a.value} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.ink2 }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Template save modal */}
      {showTemplateModal && form && (
        <SaveTemplateModal formId={form.id} onClose={() => setShowTemplateModal(false)} />
      )}
    </div>
  )
}
