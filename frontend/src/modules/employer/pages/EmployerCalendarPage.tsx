/**
 * Calendar — a real month-grid view of upcoming interviews (previously just
 * a flat "upcoming interviews" list with no visual calendar at all), plus a
 * Week view, an Agenda list view, a day-detail rail, tasks, and Google
 * Calendar connect.
 */
import { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { downloadInterviewIcs } from '@/api/matching'
import type { UpcomingInterviewEntry } from '@/api/matching'
import { useUpcomingInterviews } from '../hooks/useJobs'
import { inboxApi } from '@/api/inbox'
import { calendarApi } from '@/api/calendar'
import {
  CalendarDays, Clock, Video, Briefcase, User, Square, Plus, Trash2,
  ListTodo, Zap, CheckCircle2, AlertCircle, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { colors, radius, shadows } from '@/design-system/tokens'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import ErrorState from '@/shared/components/feedback/ErrorState'
import PageHeader from '@/shared/layouts/PageHeader'

// ── Date helpers ─────────────────────────────────────────────────────────────

function dateKey(d: Date): string {
  return d.toDateString()
}

function groupByDay<T extends { scheduled_at: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = dateKey(new Date(item.scheduled_at))
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - s.getDay())
  return s
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** 7 cells for the week containing `d`, starting Sunday. */
function buildWeekGrid(d: Date): Date[] {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 42 cells (6 full weeks) covering the month, padded with adjacent-month days. */
function buildMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Month grid ───────────────────────────────────────────────────────────────

function MonthGrid({ month, byDay, selectedDate, today, onSelectDate }: {
  month: Date
  byDay: Map<string, UpcomingInterviewEntry[]>
  selectedDate: Date
  today: Date
  onSelectDate: (d: Date) => void
}) {
  const cells = useMemo(() => buildMonthGrid(month), [month])

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, overflow: 'hidden' }}>
      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${colors.border.default}` }}>
        {WEEKDAY_LABELS.map(w => (
          <div key={w} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr' }}>
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month.getMonth()
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDate)
          const events = byDay.get(dateKey(day)) ?? []
          const visible = events.slice(0, 2)
          const overflow = events.length - visible.length

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              style={{
                minHeight: 92, padding: '6px 6px 8px', border: 'none', cursor: 'pointer',
                background: isSelected ? colors.state.infoBg : 'transparent',
                borderRight: (i + 1) % 7 !== 0 ? `1px solid ${colors.border.default}` : 'none',
                borderBottom: i < 35 ? `1px solid ${colors.border.default}` : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4,
                textAlign: 'left', font: 'inherit',
              }}
            >
              <span style={{
                alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                fontSize: 12, fontWeight: isToday ? 800 : 600,
                color: isToday ? '#fff' : inMonth ? colors.text.ink : colors.text.muted,
                background: isToday ? colors.brand.navy : 'transparent',
              }}>
                {day.getDate()}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visible.map(ev => (
                  <span key={ev.id} style={{
                    fontSize: 10, fontWeight: 600, color: colors.state.info,
                    background: colors.state.infoBg, borderRadius: 4, padding: '1px 5px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {new Date(ev.scheduled_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} {ev.candidate_name ?? 'Interview'}
                  </span>
                ))}
                {overflow > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: colors.text.muted, padding: '0 5px' }}>
                    +{overflow} more
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week grid ────────────────────────────────────────────────────────────────

function WeekGrid({ week, byDay, selectedDate, today, onSelectDate }: {
  week: Date
  byDay: Map<string, UpcomingInterviewEntry[]>
  selectedDate: Date
  today: Date
  onSelectDate: (d: Date) => void
}) {
  const cells = useMemo(() => buildWeekGrid(week), [week])

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDate)
          const events = byDay.get(dateKey(day)) ?? []

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              style={{
                minHeight: 340, padding: '10px 8px', border: 'none', cursor: 'pointer',
                background: isSelected ? colors.state.infoBg : 'transparent',
                borderRight: (i + 1) % 7 !== 0 ? `1px solid ${colors.border.default}` : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6,
                textAlign: 'left', font: 'inherit', verticalAlign: 'top',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {WEEKDAY_LABELS[i]}
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%',
                  fontSize: 13, fontWeight: isToday ? 800 : 600,
                  color: isToday ? '#fff' : colors.text.ink,
                  background: isToday ? colors.brand.navy : 'transparent',
                }}>
                  {day.getDate()}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {events.map(ev => (
                  <span key={ev.id} style={{
                    fontSize: 10, fontWeight: 600, color: colors.state.info,
                    background: colors.state.infoBg, borderRadius: 4, padding: '2px 5px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {new Date(ev.scheduled_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} {ev.candidate_name ?? 'Interview'}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Day detail rail ────────────────────────────────────────────────────────────

function InterviewRow({ iv }: { iv: UpcomingInterviewEntry }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border.default}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: colors.text.ink, fontVariantNumeric: 'tabular-nums' }}>
          {new Date(iv.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.text.ink, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <User size={11} color={colors.text.muted} />{iv.candidate_name ?? 'Anonymous'}
        </span>
      </div>
      <p style={{ fontSize: 11, color: colors.text.inkSoft, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Briefcase size={11} />{iv.job_title}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {iv.meeting_link && (
          <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}>
            <Video size={11} />Join
          </a>
        )}
        <button
          onClick={() => downloadInterviewIcs(iv.application_id, iv.id)}
          title="Add to calendar"
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: colors.text.inkSoft, background: colors.surface.elevated, border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
        >
          <Clock size={11} />ICS
        </button>
        <Link to={`/app/employer/pipeline/${iv.job_id}`} style={{ fontSize: 11, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}>
          View →
        </Link>
      </div>
    </div>
  )
}

function DaySchedule({ date, today, interviews }: { date: Date; today: Date; interviews: UpcomingInterviewEntry[] }) {
  const label = isSameDay(date, today)
    ? 'Today'
    : date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <CalendarDays size={14} color={colors.brand.navy} />
        <h2 style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, margin: 0 }}>{label}</h2>
      </div>
      {interviews.length === 0 ? (
        <p style={{ fontSize: 12, color: colors.text.muted, margin: '8px 0 2px' }}>No interviews scheduled.</p>
      ) : (
        <div>
          {interviews.map(iv => <InterviewRow key={iv.id} iv={iv} />)}
        </div>
      )}
    </div>
  )
}

// ── Agenda (flat list) view ────────────────────────────────────────────────────

function AgendaView({ interviews }: { interviews: UpcomingInterviewEntry[] }) {
  const groups = useMemo(() => Array.from(groupByDay(interviews).entries()), [interviews])

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: colors.text.muted, background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl }}>
        <CalendarDays size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
        <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>No upcoming interviews</p>
        <p style={{ fontSize: 13, margin: 0 }}>Interviews you schedule from a candidate's profile will show up here.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {groups.map(([day, items]) => (
        <div key={day}>
          <p style={{ fontSize: 12, fontWeight: 700, color: colors.text.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {new Date(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(iv => (
              <div key={iv.id} style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: 12, boxShadow: shadows.card, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: colors.text.ink, margin: 0 }}>
                      {new Date(iv.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div style={{ width: 1, height: 32, background: colors.border.default }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <User size={12} color={colors.text.muted} />{iv.candidate_name ?? 'Anonymous'}
                    </p>
                    <p style={{ fontSize: 11, color: colors.text.inkSoft, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Briefcase size={11} />{iv.job_title}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  {iv.meeting_link && (
                    <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}>
                      <Video size={12} />Join
                    </a>
                  )}
                  <button
                    onClick={() => downloadInterviewIcs(iv.application_id, iv.id)}
                    title="Add to calendar"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: colors.text.inkSoft, background: colors.surface.elevated, border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                  >
                    <Clock size={12} />ICS
                  </button>
                  <Link to={`/app/employer/pipeline/${iv.job_id}`} style={{ fontSize: 11, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}>
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tasks panel ────────────────────────────────────────────────────────────────

function TasksPanel() {
  const [newTitle, setNewTitle] = useState('')
  const qc = useQueryClient()
  const { data: tasks, isLoading: tasksLoading } = useQuery({ queryKey: ['employer', 'tasks'], queryFn: () => inboxApi.listTasks(false) })

  const create = useMutation({
    mutationFn: () => inboxApi.createTask(newTitle),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employer', 'tasks'] }); setNewTitle('') },
  })
  const toggle = useMutation({
    mutationFn: ({ id, is_done }: { id: string; is_done: boolean }) => inboxApi.updateTask(id, { is_done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'tasks'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => inboxApi.deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'tasks'] }),
  })

  return (
    <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ListTodo size={15} color={colors.brand.navy} />
        <h2 style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, margin: 0 }}>Tasks</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) create.mutate() }}
          placeholder="Add a follow-up…"
          style={{ flex: 1, height: 34, border: `1px solid ${colors.border.default}`, borderRadius: 8, padding: '0 10px', fontSize: 12, outline: 'none' }}
        />
        <button
          onClick={() => newTitle.trim() && create.mutate()}
          disabled={!newTitle.trim() || create.isPending}
          style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: colors.brand.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !newTitle.trim() ? 0.5 : 1, flexShrink: 0 }}
        >
          <Plus size={15} />
        </button>
      </div>

      {tasksLoading ? (
        <p style={{ fontSize: 12, color: colors.text.muted, margin: 0 }}>Loading tasks…</p>
      ) : !tasks || tasks.length === 0 ? (
        <p style={{ fontSize: 12, color: colors.text.muted, margin: 0 }}>No open tasks. You're all caught up.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px' }}>
              <button onClick={() => toggle.mutate({ id: t.id, is_done: true })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: colors.text.muted }}>
                <Square size={15} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                {(t.candidate_name || t.job_title) && (
                  <p style={{ fontSize: 10, color: colors.text.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[t.candidate_name, t.job_title].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <button onClick={() => remove.mutate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: colors.text.muted, flexShrink: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Google Calendar connect ─────────────────────────────────────────────────────

function GoogleCalendarBanner() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const gcalParam = searchParams.get('gcal')

  useEffect(() => {
    if (gcalParam) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000)
      return () => clearTimeout(t)
    }
  }, [gcalParam, setSearchParams])

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: calendarApi.getStatus,
    retry: false,
  })

  const disconnect = useMutation({
    mutationFn: calendarApi.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-status'] }),
  })

  return (
    <div>
      {gcalParam === 'connected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.state.successBg, border: '1px solid #86EFAC', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
          <CheckCircle2 size={14} color={colors.state.success} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D', flex: 1 }}>Connected! Interviews will now sync.</span>
          <button onClick={() => setSearchParams({}, { replace: true })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86EFAC' }}><X size={13} /></button>
        </div>
      )}
      {gcalParam === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.state.dangerBg, border: '1px solid #FECACA', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
          <AlertCircle size={14} color={colors.state.danger} />
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.state.danger, flex: 1 }}>Connection failed. Please try again.</span>
          <button onClick={() => setSearchParams({}, { replace: true })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FECACA' }}><X size={13} /></button>
        </div>
      )}

      <div style={{ background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: colors.state.infoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarDays size={16} color={colors.state.info} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Google Calendar</p>
            {isLoading ? (
              <p style={{ fontSize: 11, color: colors.text.muted, margin: '2px 0 0' }}>Checking…</p>
            ) : isError ? (
              <p style={{ fontSize: 11, color: colors.state.danger, margin: '2px 0 0' }}>Status unavailable</p>
            ) : status?.connected ? (
              <p style={{ fontSize: 11, color: colors.state.success, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} />Connected
              </p>
            ) : (
              <p style={{ fontSize: 11, color: colors.text.muted, margin: '2px 0 0' }}>Auto-add interviews to Google</p>
            )}
          </div>
        </div>
        {status?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid #FECACA', background: colors.state.dangerBg, color: colors.state.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={calendarApi.authorize}
            style={{ width: '100%', height: 32, borderRadius: 8, border: 'none', background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Zap size={13} />Connect
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'agenda'

export default function EmployerCalendarPage() {
  const { data, isLoading, isError } = useUpcomingInterviews(100)
  const [view, setView] = useState<ViewMode>('month')
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [viewWeek, setViewWeek] = useState(() => startOfWeek(new Date()))
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  const interviews = useMemo(() => data ?? [], [data])
  const byDay = useMemo(() => groupByDay(interviews), [interviews])
  const selectedInterviews = byDay.get(dateKey(selectedDate)) ?? []

  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const weekEnd = addDays(viewWeek, 6)
  const weekLabel = viewWeek.getMonth() === weekEnd.getMonth()
    ? `${viewWeek.getDate()} – ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${viewWeek.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const goToday = () => { setViewMonth(startOfMonth(today)); setViewWeek(startOfWeek(today)); setSelectedDate(today) }

  const handleSelectView = (v: ViewMode) => {
    if (v === 'week') setViewWeek(startOfWeek(selectedDate))
    setView(v)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Calendar"
        subtitle="Interviews and hiring schedule"
        actions={
          <div style={{ display: 'flex', gap: 6, background: colors.surface.elevated, borderRadius: radius.md, padding: 3 }}>
            {(['month', 'week', 'agenda'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => handleSelectView(v)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                  background: view === v ? colors.surface.card : 'transparent',
                  color: view === v ? colors.text.ink : colors.text.muted,
                  boxShadow: view === v ? shadows.card : 'none',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />
      <div style={{ padding: 24, width: '100%', background: colors.surface.bg, flex: 1 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : isError ? (
          <div style={{ maxWidth: 900 }}>
            <ErrorState title="Failed to load interviews" description="Could not fetch your upcoming schedule. Please try again." onRetry={() => window.location.reload()} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', maxWidth: 1180 }}>
            {/* Main: month grid or agenda list */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {view === 'month' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setViewMonth(m => addMonths(m, -1))} aria-label="Previous month" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.border.default}`, background: colors.surface.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={15} color={colors.text.inkSoft} />
                      </button>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: 0, minWidth: 160 }}>{monthLabel}</h2>
                      <button onClick={() => setViewMonth(m => addMonths(m, 1))} aria-label="Next month" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.border.default}`, background: colors.surface.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight size={15} color={colors.text.inkSoft} />
                      </button>
                    </div>
                    <button onClick={goToday} style={{ height: 30, padding: '0 14px', borderRadius: 8, border: `1px solid ${colors.border.default}`, background: colors.surface.card, color: colors.text.inkSoft, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Today
                    </button>
                  </div>
                  <MonthGrid month={viewMonth} byDay={byDay} selectedDate={selectedDate} today={today} onSelectDate={setSelectedDate} />
                </>
              ) : view === 'week' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setViewWeek(w => addDays(w, -7))} aria-label="Previous week" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.border.default}`, background: colors.surface.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={15} color={colors.text.inkSoft} />
                      </button>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.text.ink, margin: 0, minWidth: 200 }}>{weekLabel}</h2>
                      <button onClick={() => setViewWeek(w => addDays(w, 7))} aria-label="Next week" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.border.default}`, background: colors.surface.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight size={15} color={colors.text.inkSoft} />
                      </button>
                    </div>
                    <button onClick={goToday} style={{ height: 30, padding: '0 14px', borderRadius: 8, border: `1px solid ${colors.border.default}`, background: colors.surface.card, color: colors.text.inkSoft, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Today
                    </button>
                  </div>
                  <WeekGrid week={viewWeek} byDay={byDay} selectedDate={selectedDate} today={today} onSelectDate={setSelectedDate} />
                </>
              ) : (
                <AgendaView interviews={interviews} />
              )}
            </div>

            {/* Right rail */}
            <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <GoogleCalendarBanner />
              {(view === 'month' || view === 'week') && <DaySchedule date={selectedDate} today={today} interviews={selectedInterviews} />}
              <TasksPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
