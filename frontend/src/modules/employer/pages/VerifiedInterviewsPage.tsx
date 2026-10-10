import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import {
  employerVerifiedApi, type Competency, type EmployerInvitation, type InterviewTemplate, type TemplateInput,
} from '@/api/verifiedInterview'
import { getAllApplicants } from '@/api/matching'
import type { InterviewLanguage } from '@/api/interview'
import PageHeader from '@/shared/layouts/PageHeader'
import Tabs from '@/shared/components/navigation/Tabs'
import Card from '@/shared/components/data-display/Card'
import Badge from '@/shared/components/data-display/Badge'
import Button from '@/shared/components/primitives/Button'
import EmptyState from '@/shared/components/feedback/EmptyState'
import Spinner from '@/shared/components/feedback/Spinner'
import { colors } from '@/design-system/tokens'

const { text, border } = colors

const TABS = [
  { key: 'results', label: 'Results' },
  { key: 'invite', label: 'Invite candidates' },
  { key: 'templates', label: 'Interviews' },
]

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${border.medium}`, borderRadius: 7,
  fontSize: 13, color: text.ink, background: colors.surface.card, boxSizing: 'border-box', fontFamily: 'inherit',
}
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: text.inkSoft, marginBottom: 6 }

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'
}

const STATUS_BADGE: Record<string, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  invited: 'blue', started: 'amber', completed: 'green', declined: 'gray', expired: 'gray',
}
const BAND_BADGE: Record<string, 'green' | 'blue' | 'amber' | 'gray'> = {
  'Strong fit': 'green', 'Good fit': 'blue', 'Developing': 'amber', 'Not yet a fit': 'gray', 'Needs human review': 'amber', 'Incomplete': 'amber',
}

// ── Results ───────────────────────────────────────────────────────────────────

function ResultsTab({ rows, loading }: { rows: EmployerInvitation[]; loading: boolean }) {
  const navigate = useNavigate()
  if (loading) return <Spinner centered />
  if (rows.length === 0) {
    return <EmptyState title="No interviews sent yet" description="Invite a candidate who applied to one of your jobs, and their result will appear here once they've finished and shared it." />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <Card key={r.id} padding={14} hoverable={r.result_available} onClick={r.result_available ? () => navigate(`/app/employer/verified-interviews/${r.id}`) : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: text.ink }}>{r.candidate_name}</div>
              <div style={{ fontSize: 12, color: text.muted }}>{r.template_title} · {r.role}</div>
            </div>
            <Badge color={STATUS_BADGE[r.status] ?? 'gray'}>{r.status}</Badge>
            {r.fit_band && <Badge color={BAND_BADGE[r.fit_band] ?? 'gray'}>{r.fit_band}</Badge>}
            {r.questions_planned != null && <span style={{ fontSize: 12, color: text.muted }}>{r.questions_answered ?? 0}/{r.questions_planned} answered</span>}
            {r.decision && <Badge color="gray">{r.decision}</Badge>}
            {r.status === 'completed' && !r.result_available && (
              <span style={{ fontSize: 12, color: text.muted }}>Not shared with you</span>
            )}
            {r.result_available && <Button size="sm" variant="outline" onClick={() => navigate(`/app/employer/verified-interviews/${r.id}`)}>View scorecard</Button>}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Invite ────────────────────────────────────────────────────────────────────

function InviteTab({ templates, invitations }: { templates: InterviewTemplate[]; invitations: EmployerInvitation[] }) {
  const queryClient = useQueryClient()
  const [templateId, setTemplateId] = useState('')
  const [search, setSearch] = useState('')
  const [days, setDays] = useState(7)
  const [message, setMessage] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employer', 'applicants-for-invite'],
    queryFn: () => getAllApplicants({ limit: 100 }),
  })
  const invitedApplications = new Set(invitations.filter(i => i.template_id === templateId).map(i => i.application_id))
  const items = (data?.items ?? []).filter(a =>
    !search || (a.full_name ?? '').toLowerCase().includes(search.toLowerCase()) || a.job_title.toLowerCase().includes(search.toLowerCase()))

  const inviteMutation = useMutation({
    mutationFn: (applicationId: string) => employerVerifiedApi.invite({ template_id: templateId, application_id: applicationId, expires_in_days: days }),
    onSuccess: () => { setMessage('Invitation sent.'); queryClient.invalidateQueries({ queryKey: ['verified-invitations'] }) },
    onError: err => setMessage(apiError(err)),
  })

  if (templates.length === 0) {
    return <EmptyState title="Create an interview first" description="Open the Interviews tab, set the competencies and any questions of your own, then come back to invite candidates." />
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={label} htmlFor="vi-template">Interview</label>
          <select id="vi-template" style={input} value={templateId} onChange={e => { setTemplateId(e.target.value); setMessage(null) }}>
            <option value="" disabled>Choose an interview</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title} ({t.role})</option>)}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="vi-days">Open for</label>
          <select id="vi-days" style={input} value={days} onChange={e => setDays(Number(e.target.value))}>
            {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="vi-search">Search applicants</label>
          <input id="vi-search" style={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or job" />
        </div>
      </div>
      {message && <p role="status" style={{ fontSize: 13, color: text.inkSoft, margin: '0 0 12px' }}>{message}</p>}

      {isLoading ? <Spinner centered /> : items.length === 0 ? (
        <EmptyState title="No applicants found" description="Only people who applied to one of your jobs can be invited." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(a => {
            const done = invitedApplications.has(a.application_id)
            return (
              <Card key={a.application_id} padding={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text.ink }}>{a.full_name ?? 'Candidate'}</div>
                    <div style={{ fontSize: 12, color: text.muted }}>{a.job_title}</div>
                  </div>
                  <Button size="sm" variant={done ? 'outline' : 'primary'} disabled={!templateId || done || inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate(a.application_id)}>
                    {done ? 'Invited' : 'Invite'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Interviews (templates) ───────────────────────────────────────────────────

const EMPTY_FORM: TemplateInput = {
  title: '', role: '', language: 'en', duration_minutes: 15,
  competencies: [{ skill: '', weight: 50, must_have: false }, { skill: '', weight: 50, must_have: false }],
  custom_questions: [],
}

function TemplateForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<TemplateInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) => setForm(f => ({ ...f, [key]: value }))
  const setComp = (i: number, patch: Partial<Competency>) =>
    set('competencies', form.competencies.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  const draftMutation = useMutation({
    mutationFn: () => employerVerifiedApi.draftCompetencies(form.role, form.language),
    onSuccess: comps => set('competencies', comps.slice(0, 8)),
    onError: err => setError(apiError(err)),
  })
  const saveMutation = useMutation({
    mutationFn: () => employerVerifiedApi.createTemplate({
      ...form,
      competencies: form.competencies.filter(c => c.skill.trim()),
      custom_questions: form.custom_questions.filter(q => q.trim()),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['verified-templates'] }); onDone() },
    onError: err => setError(apiError(err)),
  })

  const valid = form.title.trim().length > 1 && form.role.trim().length > 1 && form.competencies.some(c => c.skill.trim())

  return (
    <Card padding={20}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: text.ink, margin: '0 0 14px' }}>New interview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div><label style={label} htmlFor="t-title">Name</label><input id="t-title" style={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="ESG analyst screen" maxLength={150} /></div>
        <div><label style={label} htmlFor="t-role">Role</label><input id="t-role" style={input} value={form.role} onChange={e => set('role', e.target.value)} placeholder="ESG Analyst" maxLength={150} /></div>
        <div>
          <label style={label} htmlFor="t-lang">Language</label>
          <select id="t-lang" style={input} value={form.language} onChange={e => set('language', e.target.value as InterviewLanguage)}>
            <option value="en">English</option><option value="hi">Hindi</option><option value="hinglish">Hinglish</option>
          </select>
        </div>
        <div>
          <label style={label} htmlFor="t-dur">Length</label>
          <select id="t-dur" style={input} value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))}>
            {[10, 15, 20].map(m => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: text.ink }}>What to assess</span>
        <Button size="sm" variant="outline" disabled={form.role.trim().length < 2 || draftMutation.isPending} onClick={() => draftMutation.mutate()}>
          {draftMutation.isPending ? 'Suggesting…' : 'Suggest from role'}
        </Button>
      </div>
      {form.competencies.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <input aria-label={`Competency ${i + 1}`} style={{ ...input, flex: '3 1 200px' }} value={c.skill} onChange={e => setComp(i, { skill: e.target.value })} placeholder="e.g. Materiality assessment" maxLength={100} />
          <input aria-label={`Weight ${i + 1}`} type="number" min={1} max={100} style={{ ...input, flex: '0 0 80px' }} value={c.weight} onChange={e => setComp(i, { weight: Number(e.target.value) })} />
          <label style={{ fontSize: 12, color: text.inkSoft, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={c.must_have} onChange={e => setComp(i, { must_have: e.target.checked })} /> Must have
          </label>
          <button aria-label={`Remove competency ${i + 1}`} onClick={() => set('competencies', form.competencies.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: text.muted }} disabled={form.competencies.length <= 1}>
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      ))}
      {form.competencies.length < 8 && (
        <Button size="sm" variant="outline" onClick={() => set('competencies', [...form.competencies, { skill: '', weight: 20, must_have: false }])}>
          <Plus size={12} style={{ marginRight: 4 }} aria-hidden /> Add competency
        </Button>
      )}

      <div style={{ margin: '20px 0 8px', fontSize: 13, fontWeight: 700, color: text.ink }}>Your own questions (up to 3, optional)</div>
      <p style={{ fontSize: 12, color: text.muted, margin: '0 0 8px' }}>
        Questions must relate to doing the job. Anything about age, marital status, family plans, religion, caste, gender, health or origin is not allowed.
      </p>
      {[0, 1, 2].map(i => (
        <textarea key={i} aria-label={`Your question ${i + 1}`} style={{ ...input, marginBottom: 8, minHeight: 56 }} maxLength={400}
          value={form.custom_questions[i] ?? ''} placeholder={`Question ${i + 1}`}
          onChange={e => { const qs = [...form.custom_questions]; qs[i] = e.target.value; set('custom_questions', qs) }} />
      ))}

      {error && <p role="alert" style={{ fontSize: 13, color: colors.state.danger, margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button size="sm" disabled={!valid || saveMutation.isPending} onClick={() => { setError(null); saveMutation.mutate() }}>
          {saveMutation.isPending ? 'Saving…' : 'Save interview'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  )
}

function TemplatesTab({ templates, loading }: { templates: InterviewTemplate[]; loading: boolean }) {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const archive = useMutation({
    mutationFn: (id: string) => employerVerifiedApi.archiveTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['verified-templates'] }),
  })

  if (creating) return <TemplateForm onDone={() => setCreating(false)} />
  return (
    <div>
      <div style={{ marginBottom: 14 }}><Button size="sm" onClick={() => setCreating(true)}><Plus size={12} style={{ marginRight: 4 }} aria-hidden /> New interview</Button></div>
      {loading ? <Spinner centered /> : templates.length === 0 ? (
        <EmptyState title="No interviews yet" description="Choose what to assess and add up to three questions of your own." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <Card key={t.id} padding={14}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: text.ink }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: text.muted, margin: '2px 0 6px' }}>{t.role} · {t.duration_minutes} min · {t.language}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {t.competencies.map(c => <Badge key={c.skill} color="gray">{c.skill}{c.must_have ? ' (must have)' : ''}</Badge>)}
                    {t.custom_questions.length > 0 && <Badge color="blue">{t.custom_questions.length} custom question{t.custom_questions.length === 1 ? '' : 's'}</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={archive.isPending}
                  onClick={() => { if (window.confirm('Archive this interview? Existing invitations are unaffected.')) archive.mutate(t.id) }}>Archive</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VerifiedInterviewsPage() {
  const [tab, setTab] = useState('results')
  const templatesQ = useQuery({ queryKey: ['verified-templates'], queryFn: employerVerifiedApi.listTemplates })
  const invitationsQ = useQuery({ queryKey: ['verified-invitations'], queryFn: employerVerifiedApi.listInvitations })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="AI Interviews" subtitle="Structured interviews with an evidence-linked scorecard. You decide, the AI never does." />
      <div style={{ padding: '0 28px' }}><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
      <div style={{ padding: '20px 28px 40px', maxWidth: 960 }}>
        {tab === 'results' && <ResultsTab rows={invitationsQ.data ?? []} loading={invitationsQ.isLoading} />}
        {tab === 'invite' && <InviteTab templates={templatesQ.data ?? []} invitations={invitationsQ.data ?? []} />}
        {tab === 'templates' && <TemplatesTab templates={templatesQ.data ?? []} loading={templatesQ.isLoading} />}
      </div>
    </div>
  )
}
