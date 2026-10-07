import { useState } from 'react'
import {
  Target, CalendarDays, Clock, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp,
  CheckCircle2, Circle, Briefcase, MessageSquare, FileText, PlayCircle, BookOpen, Hammer, Flag, ListChecks,
} from 'lucide-react'
import type {
  JobPlan, JobSearchKit, PlanModule, PlanPhase, PlanSchedule, ProofTask, ScheduleTask,
} from '@/api/jobPlan'
import { NAVY, INK, INK_SFT, MUTED, colors } from '@/design-system/tokens'

const ELEVATED = colors.surface.elevated
const BORDER = colors.border.default
const SUCCESS = colors.state.success
const WARN = colors.state.warning
const WARN_BG = colors.state.warningBg
const INFO = colors.state.info
const INFO_BG = colors.state.infoBg

type Progress = Record<string, { done?: boolean } | undefined>

const card: React.CSSProperties = {
  border: `1px solid ${BORDER}`, borderRadius: 14, background: 'white', padding: '18px 20px',
}
const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtHours(h: number) {
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`
}

// ── Goal card ─────────────────────────────────────────────────────────────────

export function GoalCard({ plan }: { plan: JobPlan }) {
  const goal = plan.goal
  const sched = plan.schedule
  if (!goal || !sched) return null
  const bp = plan.blueprint
  const finish = fmtDate(sched.projected_finish)

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <Target size={16} color={NAVY} />
        <span style={{ fontSize: 15, fontWeight: 800, color: INK }}>Your goal: be job-ready as {goal.role}</span>
        {bp && (
          <span
            title={bp.review_status === 'reviewed'
              ? 'This role blueprint was reviewed by a domain expert.'
              : 'This role blueprint is a draft built partly from general market knowledge. It is pending expert review.'}
            style={{
              fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              color: bp.review_status === 'reviewed' ? SUCCESS : INFO,
              background: bp.review_status === 'reviewed' ? `${SUCCESS}14` : INFO_BG,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <ShieldCheck size={11} />
            {bp.review_status === 'reviewed' ? 'Expert-reviewed blueprint' : 'Blueprint pending expert review'}
          </span>
        )}
      </div>

      {plan.summary && <p style={{ fontSize: 13, color: INK_SFT, margin: '0 0 14px', lineHeight: 1.6 }}>{plan.summary}</p>}

      {bp?.grounding && bp.grounding.level !== 'grounded' && (
        <div role="note" style={{ background: INFO_BG, border: `1px solid ${INFO}33`, borderRadius: 10, padding: '9px 12px', margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.55, color: INK_SFT }}>
          <strong style={{ color: INK }}>Heads up:</strong> only {bp.grounding.skills_with_postings} of {bp.grounding.skills_total} skills
          in this plan&apos;s blueprint appear in job postings we hold. The rest come from general market knowledge, so use the
          detail as a guide, not as this employer&apos;s requirement.
        </div>
      )}

      {plan.strengths_for_posting && plan.strengths_for_posting.length > 0 && (
        <div style={{ margin: '0 0 14px' }}>
          <p style={eyebrow}>What you already bring to this job</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {plan.strengths_for_posting.map(st => (
              <span
                key={st.requirement}
                style={{ fontSize: 11.5, fontWeight: 600, color: INK, background: `${SUCCESS}12`, border: `1px solid ${SUCCESS}30`, borderRadius: 20, padding: '3px 10px' }}
              >
                {st.requirement} <span style={{ color: MUTED, fontWeight: 500 }}>· {st.covered_by}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Stat icon={<Clock size={14} />} label="Total effort" value={fmtHours(goal.total_hours)} sub={`${plan.modules.length} topics · ${plan.phases?.filter(p => !p.skipped).length ?? 0} phases`} />
        <Stat icon={<CalendarDays size={14} />} label="At your pace" value={`${sched.weeks_needed} weeks`} sub={`${sched.weekly_hours} h/week → done by ${finish}`} />
        {goal.target_date && (
          <Stat
            icon={<Flag size={14} />} label="Your target"
            value={fmtDate(goal.target_date) ?? ''}
            sub={sched.feasible ? 'On track' : 'Not reachable at this pace'}
            tone={sched.feasible ? 'ok' : 'warn'}
          />
        )}
      </div>

      {!sched.feasible && sched.options.length > 0 && (
        <div style={{ background: WARN_BG, border: `1px solid ${WARN}40`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: INK, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} color={WARN} />
            This roadmap needs {sched.weeks_needed} weeks at {sched.weekly_hours} h/week, but your target leaves {sched.weeks_available}.
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, listStyle: 'disc', fontSize: 12.5, color: INK_SFT, lineHeight: 1.6 }}>
            {sched.options.map(o => <li key={o.type}>{o.label}</li>)}
          </ul>
        </div>
      )}
      {sched.load_note && <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>{sched.load_note}</p>}
      {sched.day_note && <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>{sched.day_note}</p>}
      {sched.deadline_note && <p style={{ fontSize: 12.5, color: INK_SFT, fontWeight: 600, margin: '0 0 12px' }}>{sched.deadline_note}</p>}

      {goal.job_ready_definition.length > 0 && (
        <>
          <p style={eyebrow}>Job-ready means</p>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 13, color: INK_SFT, lineHeight: 1.65 }}>
            {goal.job_ready_definition.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </>
      )}

      {plan.known_skills && plan.known_skills.length > 0 && (
        <p style={{ fontSize: 12, color: MUTED, margin: '14px 0 0', lineHeight: 1.6 }}>
          <CheckCircle2 size={12} color={SUCCESS} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Already covered by your profile, so skipped: {plan.known_skills.map(k => k.skill).join(' · ')}
        </p>
      )}
    </div>
  )
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div style={{ background: colors.surface.bg, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: tone === 'warn' ? WARN : INK, margin: '3px 0 1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: tone === 'ok' ? SUCCESS : tone === 'warn' ? WARN : MUTED }}>{sub}</div>}
    </div>
  )
}

// ── Phase header + exit gate ──────────────────────────────────────────────────

export function PhaseHeader({
  phase, index, modules, progress,
}: { phase: PlanPhase; index: number; modules: PlanModule[]; progress: Progress }) {
  const done = modules.filter(m => moduleDone(m, progress)).length
  return (
    <div style={{ margin: '26px 0 6px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: 'white', background: NAVY, borderRadius: 20, padding: '2px 10px',
      }}>PHASE {index + 1}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>{phase.name}</span>
      <span style={{ fontSize: 12, color: MUTED }}>{done}/{modules.length} topics · {fmtHours(phase.hours)}</span>
      {phase.goal && <p style={{ flexBasis: '100%', fontSize: 12.5, color: INK_SFT, margin: '2px 0 0' }}>{phase.goal}</p>}
    </div>
  )
}

export function ExitGate({
  phase, passed, onToggle, loading,
}: { phase: PlanPhase; passed: boolean; onToggle: () => void; loading?: boolean }) {
  return (
    <div style={{
      margin: '10px 0 4px', padding: '12px 14px', borderRadius: 12,
      border: `1px dashed ${passed ? SUCCESS : BORDER}`, background: passed ? `${SUCCESS}0A` : colors.surface.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onToggle} disabled={loading} aria-label={passed ? 'Mark gate as not passed' : 'Mark gate as passed'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: passed ? SUCCESS : MUTED }}
        >
          {passed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0 }}>
            Exit gate — {phase.name}
            <span style={{ fontWeight: 500, color: MUTED }}> · {phase.gate.type.replace('_', ' ')} · ~{fmtHours(phase.gate.hours)}</span>
          </p>
          <p style={{ fontSize: 12.5, color: INK_SFT, margin: '2px 0 0' }}>{phase.gate.description}</p>
        </div>
      </div>
      {phase.gate.pass_criteria.length > 0 && (
        <ul style={{ margin: '8px 0 0 28px', padding: 0, listStyle: 'disc', fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          {phase.gate.pass_criteria.map((c, i) => <li key={i} style={{ marginLeft: 14 }}>{c}</li>)}
        </ul>
      )}
    </div>
  )
}

// ── Proof task inside a module ────────────────────────────────────────────────

export function ProofBlock({
  proof, hours, done, onToggle, loading,
}: { proof: ProofTask; hours?: number; done: boolean; onToggle: () => void; loading?: boolean }) {
  return (
    <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: colors.surface.bg, border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onToggle} disabled={loading} aria-label={done ? 'Mark proof as not done' : 'Mark proof as done'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: done ? SUCCESS : MUTED }}
        >
          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...eyebrow, margin: 0 }}>Prove it · {proof.type.replace('_', ' ')}{hours ? ` · ~${fmtHours(hours)}` : ''}</p>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: '2px 0 0' }}>{proof.title}</p>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: INK_SFT, margin: '8px 0 0', lineHeight: 1.6 }}>{proof.brief}</p>
      {proof.rubric.length > 0 && (
        <>
          <p style={{ ...eyebrow, margin: '10px 0 4px' }}>How it's judged</p>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 12.5, color: INK_SFT, lineHeight: 1.6 }}>
            {proof.rubric.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}

// ── Module meta (status, hours, market evidence) ──────────────────────────────

export function ModuleMeta({ mod }: { mod: PlanModule }) {
  const chips: Array<{ text: string; color: string; bg: string }> = []
  if (mod.status === 'review') chips.push({ text: 'Refresher', color: INFO, bg: INFO_BG })
  if (mod.status === 'partial') chips.push({ text: 'Builds on your background', color: INFO, bg: INFO_BG })
  if (mod.review_flag) chips.push({ text: 'Reviewer: generic', color: WARN, bg: WARN_BG })
  const ev = mod.evidence
  return (
    <>
      {chips.map(c => (
        <span key={c.text} title={c.text === 'Reviewer: generic' ? mod.review_flag : undefined} style={{ fontSize: 10, fontWeight: 700, color: c.color, background: c.bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {c.text}
        </span>
      ))}
      <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>~{fmtHours(mod.estimated_hours)}</span>
      {ev && (ev.roles_total ?? 0) >= 3 && (ev.roles_matched ?? 0) > 0 && (
        <span title="Share of the reference roles in our research catalogue (roles organisations hire UPSC aspirants for) that ask for this skill" style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>
          · in {ev.roles_matched} of {ev.roles_total} roles
        </span>
      )}
      {ev && !(ev.roles_total) && ev.postings_total >= 10 && ev.postings_matched > 0 && (
        <span title="Share of real job postings on our platform that mention this skill" style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>
          · in {ev.postings_matched} of {ev.postings_total} postings
        </span>
      )}
    </>
  )
}

// ── Weekly schedule ───────────────────────────────────────────────────────────

const TASK_ICON: Record<ScheduleTask['type'], React.ReactNode> = {
  watch: <PlayCircle size={13} />, read: <BookOpen size={13} />, project: <Hammer size={13} />, quiz: <ListChecks size={13} />, gate: <Flag size={13} />,
}

/** "Mon–Fri", "Sat, Sun" or "every day" for the learner's study days. */
function daysLabel(days: string[]): string {
  if (days.length >= 7) return 'every day'
  if (days.length === 5 && days[0] === 'Mon' && days[4] === 'Fri') return 'Mon–Fri'
  return days.join(', ')
}

/** One-line summary of the learner's rhythm, e.g. "Mon–Fri · 1 h sittings · about 4 sittings a week". */
function rhythm(schedule: PlanSchedule): string | null {
  const parts: string[] = []
  if (schedule.study_days?.length) parts.push(daysLabel(schedule.study_days))
  if (schedule.session_hours) {
    const len = schedule.session_hours < 1 ? `${Math.round(schedule.session_hours * 60)} min` : `${schedule.session_hours} h`
    parts.push(`${len} sittings`)
    if (schedule.sessions_per_week) parts.push(`about ${schedule.sessions_per_week} a week`)
  }
  return parts.length ? parts.join(' · ') : null
}

export function ScheduleSection({ schedule, progress }: { schedule: PlanSchedule; progress: Progress }) {
  const [open, setOpen] = useState(false)
  const currentWeek = schedule.weeks.find(w => w.tasks.some(t => !progress[t.resource_id]?.done))?.week ?? null
  const visible = open ? schedule.weeks : schedule.weeks.filter(w => w.week === currentWeek)

  return (
    <Section title="Your weekly plan" icon={<CalendarDays size={15} />}
      meta={[`${schedule.weeks_needed} weeks · ${schedule.weekly_hours} h/week`, rhythm(schedule)].filter(Boolean).join(' · ')}
      open={open} onToggle={() => setOpen(o => !o)} toggleLabel={open ? 'Show current week' : 'Show all weeks'}>
      {visible.length === 0 && <p style={{ fontSize: 13, color: SUCCESS, margin: 0 }}>Every task is done — nice work.</p>}
      {visible.map(w => (
        <div key={w.week} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 6px' }}>
            Week {w.week}
            <span style={{ fontWeight: 500, color: MUTED }}> · from {fmtDate(w.starts_on)} · {fmtHours(w.hours)}</span>
            {w.week === currentWeek && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: INFO, background: INFO_BG, padding: '2px 8px', borderRadius: 20 }}>THIS WEEK</span>}
          </p>
          {w.tasks.map((t, i) => {
            const done = !!progress[t.resource_id]?.done
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', color: done ? MUTED : INK_SFT, fontSize: 12.5 }}>
                <span style={{ color: done ? SUCCESS : NAVY, display: 'flex' }}>{done ? <CheckCircle2 size={13} /> : TASK_ICON[t.type]}</span>
                <span style={{ flex: 1, minWidth: 0, textDecoration: done ? 'line-through' : 'none' }}>
                  {t.title}{t.parts ? ` (part ${t.part}/${t.parts})` : ''}
                </span>
                {t.day && <span style={{ color: MUTED, flexShrink: 0, fontSize: 11, fontWeight: 600 }}>{t.day}</span>}
                <span style={{ color: MUTED, flexShrink: 0 }}>{fmtHours(t.hours)}{t.sessions && t.sessions > 1 ? ` · ${t.sessions} sittings` : ''}</span>
              </div>
            )
          })}
        </div>
      ))}
    </Section>
  )
}

// ── Job-search kit ────────────────────────────────────────────────────────────

export function JobSearchKitSection({ kit }: { kit: JobSearchKit }) {
  const [open, setOpen] = useState(false)
  const bullets = kit.resume_bullets_from_proofs?.length ? kit.resume_bullets_from_proofs : kit.resume_bullet_templates
  return (
    <Section title="Job-search kit" icon={<Briefcase size={15} />}
      meta={`${kit.interview_questions.length} interview questions · resume bullets · where to apply`}
      open={open} onToggle={() => setOpen(o => !o)} toggleLabel={open ? 'Collapse' : 'Open'}>
      {kit.salary_range_lpa && kit.salary_range_lpa.based_on_postings >= 3 && (
        <p style={{ fontSize: 13, color: INK, margin: '0 0 14px' }}>
          <strong>Salary range on our platform:</strong> ₹{kit.salary_range_lpa.min}–{kit.salary_range_lpa.max} LPA
          <span style={{ color: MUTED }}> (from {kit.salary_range_lpa.based_on_postings} posting{kit.salary_range_lpa.based_on_postings > 1 ? 's' : ''})</span>
        </p>
      )}
      {kit.salary_benchmark && (
        <p style={{ fontSize: 13, color: INK, margin: '0 0 14px' }}>
          <strong>Entry-level pay, research estimate:</strong> ₹{kit.salary_benchmark.min}–{kit.salary_benchmark.max} LPA
          <span style={{ color: MUTED }}> (median of {kit.salary_benchmark.n} {kit.salary_benchmark.basis === 'reference_roles' ? 'similar reference roles' : 'benchmark rows'} in our research data, not an offer)</span>
        </p>
      )}
      {kit.location_fit && (
        <p style={{ fontSize: 13, color: INK, margin: '0 0 14px' }}>
          <strong>Your preferred {kit.location_fit.preferred.length > 1 ? 'cities' : 'city'} ({kit.location_fit.preferred.join(', ')}):</strong>{' '}
          {kit.location_fit.roles_matching} of {kit.location_fit.roles_total} similar reference roles list {kit.location_fit.roles_matching === 1 ? 'it' : 'one'}
          <span style={{ color: MUTED }}> (research data, not openings)</span>
        </p>
      )}
      <KitList icon={<MessageSquare size={13} />} title="Likely interview questions" items={kit.interview_questions} ordered />
      <KitList icon={<FileText size={13} />} title="Resume bullets from your proof tasks" items={bullets} />
      <KitList icon={<Briefcase size={13} />} title="Where to apply" items={kit.where_to_apply} />
      <KitList icon={<CheckCircle2 size={13} />} title="Profile checklist" items={kit.profile_checklist} />
    </Section>
  )
}

function KitList({ icon, title, items, ordered }: { icon: React.ReactNode; title: string; items: string[]; ordered?: boolean }) {
  if (!items?.length) return null
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ ...eyebrow, display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{title}</p>
      <Tag style={{ margin: 0, paddingLeft: 20, listStyle: ordered ? 'decimal' : 'disc', fontSize: 13, color: INK_SFT, lineHeight: 1.7 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </Tag>
    </div>
  )
}

// ── shared collapsible section ────────────────────────────────────────────────

function Section({
  title, icon, meta, open, onToggle, toggleLabel, children,
}: {
  title: string; icon: React.ReactNode; meta?: string; open: boolean; onToggle: () => void; toggleLabel: string; children: React.ReactNode
}) {
  return (
    <div style={{ ...card, marginTop: 20 }}>
      <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <span style={{ color: NAVY, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: INK }}>{title}</span>
        {meta && <span style={{ fontSize: 12, color: MUTED, flex: 1 }}>{meta}</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {toggleLabel}{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      <div style={{ marginTop: 14, borderTop: `1px solid ${ELEVATED}`, paddingTop: 14 }}>{children}</div>
    </div>
  )
}

// ── shared progress helpers (proof counts as work) ────────────────────────────

export function moduleDone(mod: PlanModule, progress: Progress): boolean {
  const items = mod.resources.map(r => r.id)
  if (mod.proof) items.push(`proof-${mod.id}`)
  return items.length > 0 && items.every(id => progress[id]?.done)
}


// ── Optional skills (not asked for by this posting) ──────────────────────────

export function OptionalSkillsCard({ items }: { items: NonNullable<JobPlan['stretch_modules']> }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div style={{ ...card, marginTop: 18 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: INK, flex: 1 }}>
          Beyond this posting ({items.length} optional skills)
        </span>
        {open ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
      </button>
      <p style={{ fontSize: 12.5, color: INK_SFT, margin: '6px 0 0', lineHeight: 1.55 }}>
        This role usually involves these, but the job posting doesn&apos;t ask for them, so they are not in your schedule.
        Learn them later if you want to go further.
      </p>
      {open && (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(it => (
            <li key={it.skill} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{it.skill}</span>
                <span style={{ fontSize: 11.5, color: MUTED, whiteSpace: 'nowrap' }}>~{fmtHours(it.base_hours)}</span>
              </div>
              <p style={{ fontSize: 12, color: INK_SFT, margin: '3px 0 0', lineHeight: 1.5 }}>{it.why_for_role}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Things to double-check ───────────────────────────────────────────────────

export function PlanNotices({ plan }: { plan: JobPlan }) {
  const [open, setOpen] = useState(false)
  const warnings = plan.quality?.warnings ?? []
  const corrections = plan.quality?.corrections ?? []
  const total = warnings.length + corrections.length
  if (total === 0) return null
  return (
    <div style={{ ...card, marginTop: 18, background: WARN_BG, border: `1px solid ${WARN}33` }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <AlertTriangle size={15} color={WARN} />
        <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, flex: 1 }}>Things to double-check ({total})</span>
        {open ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
      </button>
      {open && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, listStyle: 'disc', fontSize: 12.5, color: INK_SFT, lineHeight: 1.65 }}>
          {corrections.map(c => <li key={c}>Updated automatically: {c}</li>)}
          {warnings.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  )
}
