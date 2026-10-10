import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import type { UpcomingInterview } from '@/api/employerHome'
import { card, cardSub, cardTitle } from '@/shared/components/dashboard/styles'
import { accents } from '@/shared/components/dashboard/palette'
import Avatar from '@/shared/components/data-display/Avatar'

const TZ = 'Asia/Kolkata'
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)   // 2026-10-11

/** "Today, 2:00 pm", "Tomorrow, 10:30 am", "Mon 13 Oct, 4:00 pm": always in India time. */
function when(iso: string): { day: string; time: string; today: boolean } {
  const d = new Date(iso)
  const now = new Date()
  const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }).format(d).toLowerCase()
  const tomorrow = new Date(now.getTime() + 86_400_000)
  if (dayKey(d) === dayKey(now)) return { day: 'Today', time, today: true }
  if (dayKey(d) === dayKey(tomorrow)) return { day: 'Tomorrow', time, today: false }
  return { day: new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(d), time, today: false }
}

export default function UpcomingInterviewsCard({ items }: { items: UpcomingInterview[] }) {
  const navigate = useNavigate()
  return (
    <section style={{ ...card, overflow: 'hidden' }} aria-labelledby="upcoming-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 20px 12px', gap: 12 }}>
        <div>
          <h2 id="upcoming-title" style={cardTitle}>Upcoming interviews</h2>
          <p style={cardSub}>{items.length === 0 ? 'Nothing scheduled' : 'Next on the calendar, India time'}</p>
        </div>
        <button onClick={() => navigate('/app/employer/calendar')} aria-label="Open calendar"
          style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: accents.violet.bg, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarDays size={16} color={accents.violet.fg} aria-hidden />
        </button>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, padding: '0 20px 20px', fontSize: 13, color: colors.text.inkSoft }}>Interviews you schedule appear here with the time and the candidate.</p>
      ) : items.map(it => {
        const w = when(it.scheduled_at)
        return (
          <button key={`${it.application_id}-${it.scheduled_at}`} onClick={() => navigate(`/app/employer/pipeline/${it.job_id}`)}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '11px 20px', background: 'transparent', border: 'none', borderTop: `1px solid ${colors.border.default}`, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            onMouseOver={e => (e.currentTarget.style.background = colors.surface.bg)}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
            <Avatar name={it.candidate} size={36} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: colors.text.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.candidate}</span>
              <span style={{ display: 'block', fontSize: 12, color: colors.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.job_title}{it.reschedule_requested && <b style={{ color: accents.amber.fg, marginLeft: 6 }}>Asked to reschedule</b>}
              </span>
            </span>
            <span style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: w.today ? accents.indigo.fg : colors.text.inkSoft }}>{w.day}</span>
              <span style={{ display: 'block', fontSize: 12, color: colors.text.muted }}>{w.time}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
