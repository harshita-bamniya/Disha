import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CalendarClock, CheckCircle2, ChevronRight, ClipboardEdit, FileSignature, Inbox, Plus, type LucideIcon } from 'lucide-react'
import { employerHomeApi, type EmployerAttention, type EmployerAttentionKey } from '@/api/employerHome'
import { shortAge } from '@/shared/components/dashboard/styles'

const ICONS: Record<EmployerAttentionKey, LucideIcon> = {
  new_applications: Inbox, needs_feedback: ClipboardEdit, reschedule_requests: CalendarClock,
  offers_waiting: FileSignature, interviews_today: CalendarCheck,
}

/** One short line under each count, saying why it is on the list. */
function detail(row: EmployerAttention['rows'][number], t: EmployerAttention['targets']): string {
  switch (row.key) {
    case 'new_applications':
      return row.overdue > 0 ? `${row.overdue} past the ${t.first_look_days}-day target` : `Oldest ${shortAge(row.oldest_age_hours)}`
    case 'needs_feedback': return 'Log feedback or mark a no-show'
    case 'reschedule_requests': return 'Candidates asked for another time'
    case 'offers_waiting': return `Oldest sent ${shortAge(row.oldest_age_hours)} ago`
    case 'interviews_today': return row.note ?? ''
  }
}

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const dateLine = () =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date())

/** The top of the page: a plain-language summary of the day and the things that need the team, as action cards. */
export default function HeroBanner({ companyName, canPost, onPostJob }: { companyName: string; canPost: boolean; onPostJob: () => void }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['employer', 'home', 'attention'],
    queryFn: employerHomeApi.attention,
    refetchInterval: 60_000,
  })
  const rows = data?.rows ?? []
  const waiting = rows.find(r => r.key === 'new_applications')?.count ?? 0
  const today = rows.find(r => r.key === 'interviews_today')?.count ?? 0
  const summary = isLoading ? 'Checking what needs your team…'
    : rows.length === 0 ? 'You are all caught up. New applications and interviews will show up here.'
    : [waiting > 0 ? `${waiting} candidate${waiting === 1 ? ' is' : 's are'} waiting for a first look` : '',
       today > 0 ? `${today} interview${today === 1 ? ' is' : 's are'} on today` : '']
      .filter(Boolean).join(' and ') || 'A few things need your team.'

  return (
    <section aria-label="Today" style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '26px 28px 24px', color: '#fff',
      background: 'linear-gradient(125deg, #17234A 0%, #1F3270 52%, #2B4A9B 100%)',
      boxShadow: '0 10px 30px rgba(23,35,74,0.22)',
    }}>
      <span aria-hidden style={{ position: 'absolute', right: -60, top: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14), rgba(255,255,255,0) 68%)' }} />
      <span aria-hidden style={{ position: 'absolute', right: 140, bottom: -110, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.22), rgba(96,165,250,0) 70%)' }} />

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.62)' }}>{dateLine()} · {companyName}</p>
          <h2 style={{ margin: '6px 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: '#fff' }}>{greeting()}</h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', maxWidth: 560 }}>{summary}</p>
        </div>
        {canPost && (
          <button onClick={onPostJob}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#17234A', background: '#fff' }}>
            <Plus size={15} strokeWidth={2.6} aria-hidden />Post a job
          </button>
        )}
      </div>

      <div style={{ position: 'relative', marginTop: 20 }}>
        {rows.length === 0 && !isLoading ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={16} color="#6EE7B7" aria-hidden />Nothing is waiting on you
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {rows.map(row => {
              const Icon = ICONS[row.key]
              const urgent = row.level === 'urgent'
              return (
                <button key={row.key} onClick={() => navigate(row.link)} aria-label={`${row.label}: ${row.count}. ${detail(row, data!.targets)}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', padding: '14px 15px 13px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#fff',
                    background: urgent ? 'rgba(251,146,60,0.16)' : 'rgba(255,255,255,0.09)',
                    border: `1px solid ${urgent ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.15)'}`,
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = urgent ? 'rgba(251,146,60,0.24)' : 'rgba(255,255,255,0.16)')}
                  onMouseOut={e => (e.currentTarget.style.background = urgent ? 'rgba(251,146,60,0.16)' : 'rgba(255,255,255,0.09)')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                    <Icon size={15} color={urgent ? '#FDBA74' : 'rgba(255,255,255,0.9)'} strokeWidth={2.2} aria-hidden />
                    <span style={{ flex: 1 }}>{row.label}</span>
                    <ChevronRight size={15} color="rgba(255,255,255,0.5)" aria-hidden />
                  </span>
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.05 }}>{row.count}</span>
                  <span style={{ fontSize: 12, color: urgent ? '#FED7AA' : 'rgba(255,255,255,0.64)' }}>{detail(row, data!.targets)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
