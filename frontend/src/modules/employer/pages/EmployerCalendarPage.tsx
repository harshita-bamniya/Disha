/**
 * Calendar — upcoming interviews across all jobs, grouped by day.
 * Previously interview scheduling existed only as a status flag buried in
 * each job's pipeline; this is the first place a recruiter can see their
 * whole interview schedule in one screen.
 */
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { downloadInterviewIcs } from '@/api/matching'
import { useUpcomingInterviews } from '../hooks/useJobs'
import { inboxApi } from '@/api/inbox'
import { calendarApi } from '@/api/calendar'
import { CalendarDays, Clock, Video, Briefcase, User, Square, Plus, Trash2, ListTodo, Zap, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import ErrorState from '@/shared/components/feedback/ErrorState'
import PageHeader from '@/shared/layouts/PageHeader'

function groupByDay(items: { scheduled_at: string }[]) {
  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key = new Date(item.scheduled_at).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return Array.from(groups.entries())
}

function TasksPanel() {
  const [newTitle, setNewTitle] = useState('')
  const qc = useQueryClient()
  const { data: tasks } = useQuery({ queryKey: ['employer', 'tasks'], queryFn: () => inboxApi.listTasks(false) })

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
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ListTodo size={15} color={colors.brand.navy} />
        <h2 style={{ fontSize: 13, fontWeight: 800, color: colors.text.ink, margin: 0 }}>Tasks</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) create.mutate() }}
          placeholder="Add a follow-up, e.g. 'Call back Priya about offer'…"
          style={{ flex: 1, height: 34, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '0 10px', fontSize: 12, outline: 'none' }}
        />
        <button
          onClick={() => newTitle.trim() && create.mutate()}
          disabled={!newTitle.trim() || create.isPending}
          style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: colors.brand.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !newTitle.trim() ? 0.5 : 1 }}
        >
          <Plus size={15} />
        </button>
      </div>

      {!tasks || tasks.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No open tasks. You're all caught up.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px' }}>
              <button onClick={() => toggle.mutate({ id: t.id, is_done: true })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#94A3B8' }}>
                <Square size={15} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: colors.text.ink, margin: 0 }}>{t.title}</p>
                {(t.candidate_name || t.job_title) && (
                  <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>{[t.candidate_name, t.job_title].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <button onClick={() => remove.mutate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#CBD5E1' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GoogleCalendarBanner() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const gcalParam = searchParams.get('gcal')

  // Clear the query param after showing the toast
  useEffect(() => {
    if (gcalParam) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000)
      return () => clearTimeout(t)
    }
  }, [gcalParam, setSearchParams])

  const { data: status, isLoading } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: calendarApi.getStatus,
  })

  const disconnect = useMutation({
    mutationFn: calendarApi.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-status'] }),
  })

  if (isLoading) return null

  return (
    <div style={{ marginBottom: 20 }}>
      {/* OAuth result toast */}
      {gcalParam === 'connected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <CheckCircle2 size={15} color="#16A34A" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D', flex: 1 }}>Google Calendar connected! Interviews will now sync automatically.</span>
          <button onClick={() => setSearchParams({}, { replace: true })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86EFAC' }}><X size={14} /></button>
        </div>
      )}
      {gcalParam === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <AlertCircle size={15} color="#DC2626" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', flex: 1 }}>Google Calendar connection failed. Please try again.</span>
          <button onClick={() => setSearchParams({}, { replace: true })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FECACA' }}><X size={14} /></button>
        </div>
      )}

      {/* Connection card */}
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Google Calendar icon */}
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarDays size={18} color={colors.state.info} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0 }}>Google Calendar</p>
            {status?.connected ? (
              <p style={{ fontSize: 11, color: '#16A34A', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} />Connected · interviews auto-sync
              </p>
            ) : (
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                Connect to auto-add interviews to your Google Calendar
              </p>
            )}
          </div>
        </div>
        {status?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={calendarApi.authorize}
            style={{ height: 32, padding: '0 16px', borderRadius: 8, border: 'none', background: colors.brand.navy, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Zap size={13} />Connect
          </button>
        )}
      </div>
    </div>
  )
}

export default function EmployerCalendarPage() {
  const { data, isLoading, isError } = useUpcomingInterviews(50)

  const groups = data ? groupByDay(data) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Calendar" subtitle="Upcoming interviews and schedule" />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 24, width: '100%' }}>
        <GoogleCalendarBanner />
        <TasksPanel />
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load interviews" description="Could not fetch your upcoming schedule. Please try again." onRetry={() => window.location.reload()} />
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94A3B8' }}>
            <CalendarDays size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>No upcoming interviews</p>
            <p style={{ fontSize: 13, margin: 0 }}>Interviews you schedule from a candidate's profile will show up here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groups.map(([day, items]) => (
              <div key={day}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  {new Date(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(iv => (
                    <div key={iv.id} style={{ background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ textAlign: 'center', minWidth: 52 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, color: colors.text.ink, margin: 0 }}>
                            {new Date(iv.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div style={{ width: 1, height: 32, background: '#F1F5F9' }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: colors.text.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <User size={12} color="#94A3B8" />{iv.candidate_name ?? 'Anonymous'}
                          </p>
                          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Briefcase size={11} />{iv.job_title}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {iv.meeting_link && (
                          <a href={iv.meeting_link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}>
                            <Video size={12} />Join
                          </a>
                        )}
                        <button
                          onClick={() => downloadInterviewIcs(iv.application_id, iv.id)}
                          title="Add to calendar"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748B', background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                        >
                          <Clock size={12} />ICS
                        </button>
                        <Link
                          to={`/app/employer/pipeline/${iv.job_id}`}
                          style={{ fontSize: 11, fontWeight: 700, color: colors.state.info, textDecoration: 'none' }}
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
