import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKrsDashboard, useLiveJobs, usePrepareJob, useUnprepareJob } from '../hooks/useKrs'
import { MapPin, BookOpen, ExternalLink, X, CheckCircle2, TrendingUp, Zap, Target, ArrowUpRight, Sparkles, BriefcaseBusiness, ChevronRight, Bell } from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import AppSidebar from '@/components/layout/AppSidebar'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const SECTOR_COLORS: Record<string, [string, string]> = {
  'Consulting': ['#6366F1', '#818CF8'],
  'Government': ['#0EA5E9', '#38BDF8'],
  'NGO':        ['#10B981', '#34D399'],
  'Education':  ['#F59E0B', '#FBbf24'],
  'Banking':    ['#8B5CF6', '#A78BFA'],
  'Media':      ['#EC4899', '#F472B6'],
  'Healthcare': ['#14B8A6', '#2DD4BF'],
  'IT':         ['#6366F1', '#818CF8'],
  'Research':   ['#F97316', '#FB923C'],
  default:      ['#3B82F6', '#60A5FA'],
}
function sectorColor(sector: string): [string, string] {
  const key = Object.keys(SECTOR_COLORS).find(k => sector?.includes(k)) ?? 'default'
  return SECTOR_COLORS[key]
}

function useCountUp(target: number, duration = 1000, run = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf: number
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, run])
  return val
}

// ── Animated score ring ───────────────────────────────────────────────────────
function ScoreRing({ value, label, color, size = 72, run }: {
  value: number; label: string; color: string; size?: number; run: boolean
}) {
  const [dash, setDash] = useState(0)
  const counted = useCountUp(value, 1000, run)
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  useEffect(() => {
    if (!run) return
    const t = setTimeout(() => setDash((value / 100) * circ), 150)
    return () => clearTimeout(t)
  }, [run, value, circ])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth={5} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.34,1.1,0.64,1)', filter: `drop-shadow(0 0 6px ${color}88)` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: size * 0.26, fontWeight: 900, color: '#0F172A', fontFamily: 'Hind, sans-serif', letterSpacing: '-1px' }}>
            {run ? counted : value}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: color, letterSpacing: '0.6px', textTransform: 'uppercase', opacity: 0.85 }}>{label}</span>
    </div>
  )
}

// ── Job card (new design) ─────────────────────────────────────────────────────
function JobCard({ job, onOpen, onApply, onPrepare, isPreparing, delay }: {
  job: LiveJob; onOpen: () => void; onApply: () => void; onPrepare: () => void; isPreparing?: boolean; delay: number
}) {
  const [c1, c2] = sectorColor(job.sector)
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'white' : 'rgba(255,255,255,0.92)',
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        border: hov ? `1.5px solid ${c1}30` : '1.5px solid rgba(226,232,240,0.8)',
        boxShadow: hov ? `0 16px 40px ${c1}22, 0 4px 12px rgba(0,0,0,0.06)` : '0 2px 10px rgba(15,23,42,0.05)',
        transform: hov ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'all 0.28s cubic-bezier(0.34,1.1,0.64,1)',
        animation: `cardIn 0.5s cubic-bezier(0.34,1.1,0.64,1) both`,
        animationDelay: `${delay}ms`,
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onOpen}
    >
      {/* Top accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />

      <div style={{ padding: '16px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${c1}18, ${c2}28)`,
              border: `1.5px solid ${c1}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: c1,
            }}>
              {job.company_name.charAt(0)}
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 1 }}>{job.company_name}</p>
              {job.location && <p style={{ fontSize: 10, color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: 2 }}><MapPin size={8} />{job.location}</p>}
            </div>
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            borderRadius: 10, padding: '4px 9px',
            display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: 'white', fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{job.match_score}%</span>
          </div>
        </div>

        {/* Title */}
        <h3 style={{ fontFamily: 'Hind, sans-serif', fontSize: 14, fontWeight: 800, color: '#0F172A', lineHeight: 1.3, margin: 0 }}>{job.title}</h3>

        {/* Skill tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {job.skills_you_have.slice(0, 2).map(sk => (
            <span key={sk} style={{ padding: '2px 8px', background: `${c1}0f`, borderRadius: 20, fontSize: 10, fontWeight: 600, color: c1, border: `1px solid ${c1}1f` }}>✓ {sk}</span>
          ))}
          {job.skills_to_develop.slice(0, 1).map(sk => (
            <span key={sk} style={{ padding: '2px 8px', background: '#FFF7ED', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#D97706', border: '1px solid #FDE68A' }}>+ {sk}</span>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${c1}10` }}>
          {formatSalary(job.salary_min, job.salary_max)
            ? <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>₹{formatSalary(job.salary_min, job.salary_max)} LPA</span>
            : <span />}
          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            <button onClick={onPrepare} disabled={isPreparing} style={{
              height: 28, padding: '0 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: job.is_prepared ? `${c1}12` : 'white', border: `1.5px solid ${c1}28`, color: c1,
              display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
            }}>
              {isPreparing
                ? <div style={{ width: 10, height: 10, border: `2px solid ${c1}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <><BookOpen size={10} />{job.is_prepared ? 'Saved' : 'Prep'}</>}
            </button>
            <button onClick={onApply} style={{
              height: 28, padding: '0 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: `linear-gradient(135deg, ${c1}, ${c2})`, color: 'white', border: 'none',
              display: 'flex', alignItems: 'center', gap: 3,
              boxShadow: `0 3px 10px ${c1}40`, transition: 'all 0.2s',
            }}>
              Apply <ArrowUpRight size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Job detail modal ──────────────────────────────────────────────────────────
function JobModal({ job, onClose, onApply, onPrepare, isPreparing }: {
  job: LiveJob; onClose: () => void; onApply: () => void; onPrepare: () => void; isPreparing?: boolean
}) {
  const [c1, c2] = sectorColor(job.sector)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(14px)', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 28, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(15,23,42,0.3)', animation: 'popIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both' }}>
        <div style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, padding: '24px 24px 20px', borderRadius: '28px 28px 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', top: -60, right: -50, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {job.company_name.charAt(0)}
              </div>
              <div>
                <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: 'white', marginBottom: 2 }}>{job.title}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}><Target size={10} />{job.match_score}% match</span>
            {job.job_type && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.2)', textTransform: 'capitalize' }}>{job.job_type}</span>}
            {job.growth_outlook === 'high' && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>↑ High growth</span>}
            {formatSalary(job.salary_min, job.salary_max) && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>₹{formatSalary(job.salary_min, job.salary_max)} LPA</span>}
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {(job.skills_you_have.length > 0 || job.skills_to_develop.length > 0) && (
            <div style={{ background: `${c1}07`, borderRadius: 16, padding: 16, border: `1px solid ${c1}15` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={10} />Skill gap</p>
              {job.skills_you_have.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} />You have ({job.skills_you_have.length})</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{job.skills_you_have.map(sk => <span key={sk} style={{ padding: '3px 9px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#059669' }}>✓ {sk}</span>)}</div>
                </div>
              )}
              {job.skills_to_develop.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: '#D97706', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} />Build ({job.skills_to_develop.length})</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{job.skills_to_develop.map(sk => <span key={sk} style={{ padding: '3px 9px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#D97706' }}>+ {sk}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {job.description && <div><p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>About this role</p><p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8 }}>{job.description}</p></div>}
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#94A3B8', paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
            <span>Posted {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {job.expires_at && <span style={{ color: new Date(job.expires_at) < new Date() ? '#DC2626' : '#94A3B8' }}>{new Date(job.expires_at) < new Date() ? '⚠ Expired' : `Closes ${new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</span>}
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
          <button onClick={onPrepare} disabled={isPreparing} style={{ flex: 1, height: 46, borderRadius: 13, border: '1.5px solid #E2E8F0', background: job.is_prepared ? `${c1}08` : 'white', color: job.is_prepared ? c1 : '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
            {isPreparing ? <div style={{ width: 14, height: 14, border: `2px solid ${c1}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><BookOpen size={14} />{job.is_prepared ? '✓ In Prep List' : 'Add to Prep List'}</>}
          </button>
          <button onClick={onApply} style={{ flex: 1, height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${c1}, ${c2})`, color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: `0 4px 18px ${c1}45`, transition: 'all 0.2s' }}>
            <ExternalLink size={14} /> Apply Now
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: { job: LiveJob; onClose: () => void }) {
  const [c1, c2] = sectorColor(job.sector)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(14px)', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 360, padding: 26, boxShadow: '0 24px 60px rgba(15,23,42,0.25)', animation: 'popIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}><X size={13} /></button>
        <div style={{ fontSize: 32, marginBottom: 12 }}>💼</div>
        <h3 style={{ fontFamily: 'Hind, sans-serif', fontSize: 17, fontWeight: 900, color: '#0F172A', marginBottom: 3 }}>{job.title}</h3>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>{job.company_name}</p>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '11px 13px', marginBottom: 18 }}>
          <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>Application tracking coming soon. Apply directly through the employer's website.</p>
        </div>
        {job.employer_website
          ? <a href={job.employer_website.startsWith('http') ? job.employer_website : `https://${job.employer_website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${c1}, ${c2})`, color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: `0 4px 14px ${c1}40` }}>
              <ExternalLink size={13} /> Visit {job.company_name}
            </a>
          : <div style={{ textAlign: 'center', padding: '12px', background: '#F1F5F9', borderRadius: 12, color: '#94A3B8', fontSize: 13 }}>No website — contact employer directly</div>}
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 7 }}>Close</button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useKrsDashboard()
  const { data: liveJobs, isLoading: jobsLoading } = useLiveJobs()
  const prepareJob   = usePrepareJob()
  const unprepareJob = useUnprepareJob()

  const [selectedJob,    setSelectedJob]    = useState<LiveJob | null>(null)
  const [applyJob,       setApplyJob]       = useState<LiveJob | null>(null)
  const [preparingJobId, setPreparingJobId] = useState<string | null>(null)
  const [ready,          setReady]          = useState(false)

  useEffect(() => {
    if (data) { const t = setTimeout(() => setReady(true), 100); return () => clearTimeout(t) }
  }, [data])

  const handlePrepare = async (job: LiveJob) => {
    setPreparingJobId(job.id)
    try {
      if (job.is_prepared) await unprepareJob.mutateAsync(job.id)
      else { await prepareJob.mutateAsync(job.id); navigate('/app/careers/explore') }
    } finally { setPreparingJobId(null) }
  }

  const gapFreq: Record<string, number> = {}
  let totalReq = 0, totalHave = 0
  for (const j of liveJobs ?? []) {
    totalReq += j.required_skills.length; totalHave += j.skills_you_have.length
    for (const sk of j.skills_to_develop) { const k = sk.toLowerCase().trim(); gapFreq[k] = (gapFreq[k] ?? 0) + 1 }
  }
  const topGaps  = Object.entries(gapFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s)
  const skillPct = totalReq > 0 ? Math.round((totalHave / totalReq) * 100) : 0

  const featuredJobs = liveJobs?.slice(0, 3) ?? []
  const moreJobs     = liveJobs?.slice(3) ?? []

  const kLoaded = useCountUp(data?.krs.k_score ?? 0, 1000, ready)
  const rLoaded = useCountUp(data?.krs.r_score ?? 0, 1000, ready)
  const sLoaded = useCountUp(data?.krs.s_score ?? 0, 1000, ready)

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
      <AppSidebar activePath="/app/dashboard" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* ── Top bar ── */}
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
          animation: 'slideDown 0.4s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={13} color="white" />
            </div>
            <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ width: 36, height: 36, borderRadius: 10, background: 'white', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#3B82F6' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B' }}
            >
              <Bell size={14} />
            </button>
            <button onClick={() => navigate('/app/profile')} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
              color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              boxShadow: '0 3px 12px rgba(59,130,246,0.3)', transition: 'all 0.2s',
            }}>
              Edit Profile <ArrowUpRight size={11} />
            </button>
          </div>
        </header>

        <main style={{ padding: '24px 28px', flex: 1 }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 34, height: 34, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '14px 18px', color: '#DC2626', fontSize: 14 }}>
              Could not load. Please refresh.
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* ── HERO BANNER ── */}
              <div style={{
                borderRadius: 26, overflow: 'hidden', position: 'relative',
                background: '#DBEAFE',
                boxShadow: '0 4px 32px rgba(59,130,246,0.15), 0 1px 4px rgba(15,23,42,0.04)',
                border: '1.5px solid rgba(59,130,246,0.15)',
                animation: 'slideDown 0.5s cubic-bezier(0.34,1.1,0.64,1) both',
                minHeight: 220,
              }}>
                {/* ── Aurora blobs (large morphing colored shapes) ── */}
                <div style={{ position: 'absolute', width: 520, height: 520, top: -200, right: -120, background: '#93C5FD', borderRadius: '50%', filter: 'blur(90px)', opacity: 0.65, pointerEvents: 'none', animation: 'morphA 9s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', width: 380, height: 380, top: -80, left: -100, background: '#93C5FD', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.45, pointerEvents: 'none', animation: 'morphB 11s ease-in-out 1.5s infinite' }} />
                <div style={{ position: 'absolute', width: 300, height: 300, bottom: -100, left: '38%', background: '#60A5FA', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.45, pointerEvents: 'none', animation: 'morphC 8s ease-in-out 3s infinite' }} />


                {/* ── Orbiting dot ring (top-right corner) ── */}
                <div style={{ position: 'absolute', width: 200, height: 200, top: -40, right: 220, pointerEvents: 'none', animation: 'spinSlow 18s linear infinite' }}>
                  {[0,60,120,180,240,300].map(deg => (
                    <div key={deg} style={{
                      position: 'absolute', width: 8, height: 8, borderRadius: '50%',
                      background: deg % 120 === 0 ? '#3B82F6' : '#A5B4FC',
                      top: `${50 + 44 * Math.sin(deg * Math.PI / 180)}%`,
                      left: `${50 + 44 * Math.cos(deg * Math.PI / 180)}%`,
                      transform: 'translate(-50%,-50%)',
                      boxShadow: deg % 120 === 0 ? '0 0 8px #3B82F688' : 'none',
                      opacity: 0.6,
                    }} />
                  ))}
                </div>
                <div style={{ position: 'absolute', width: 130, height: 130, top: 10, right: 255, pointerEvents: 'none', animation: 'spinSlow 12s linear reverse infinite' }}>
                  {[0,90,180,270].map(deg => (
                    <div key={deg} style={{
                      position: 'absolute', width: 5, height: 5, borderRadius: '50%',
                      background: '#6366F1', opacity: 0.5,
                      top: `${50 + 44 * Math.sin(deg * Math.PI / 180)}%`,
                      left: `${50 + 44 * Math.cos(deg * Math.PI / 180)}%`,
                      transform: 'translate(-50%,-50%)',
                    }} />
                  ))}
                </div>

                {/* ── Content ── */}
                <div style={{ padding: '32px 36px', position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 28 }}>

                    {/* Left */}
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B98188', animation: 'pulseGreen 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>AI Career Intelligence</span>
                      </div>
                      <h2 style={{
                        fontFamily: 'Hind, sans-serif', fontSize: 32, fontWeight: 900,
                        color: '#0F172A', letterSpacing: '-0.8px', marginBottom: 8, lineHeight: 1.15,
                        animation: ready ? 'slideInLeft 0.6s ease both' : 'none',
                      }}>
                        {greeting()},&nbsp;
                        <span style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                          {data.full_name?.split(' ')[0] ?? 'Aspirant'}
                        </span>
                        &nbsp;👋
                      </h2>
                      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 22, fontWeight: 500 }}>
                        {data.skills.length} skills · {liveJobs?.length ?? 0} personalised job matches
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => navigate('/app/careers/explore')} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                          borderRadius: 11, background: '#1D4ED8', border: 'none',
                          color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(29,78,216,0.28)', transition: 'all 0.2s',
                        }}
                          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(29,78,216,0.36)' }}
                          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(29,78,216,0.28)' }}
                        >
                          <BookOpen size={12} /> Prep List
                        </button>
                        <button onClick={() => navigate('/app/careers')} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                          borderRadius: 11, background: 'rgba(219,234,254,0.7)',
                          border: '1.5px solid rgba(59,130,246,0.3)',
                          color: '#1D4ED8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(59,130,246,0.08)', transition: 'all 0.2s',
                        }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#1D4ED8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                          <Target size={12} /> Career Paths
                        </button>
                      </div>
                    </div>

                    {/* Right: KRS rings */}
                    <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.45)', borderRadius: 20, padding: '20px 26px', border: '1.5px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }}>
                      <ScoreRing label="Knowledge" value={data.krs.k_score} color="#2563EB" run={ready} />
                      <div style={{ width: 1, background: 'rgba(59,130,246,0.15)', margin: '0 4px' }} />
                      <ScoreRing label="Readiness" value={data.krs.r_score} color="#7C3AED" run={ready} />
                      <div style={{ width: 1, background: 'rgba(59,130,246,0.15)', margin: '0 4px' }} />
                      <ScoreRing label="Skills"    value={data.krs.s_score} color="#059669" run={ready} />
                    </div>
                  </div>

                  {/* Stats strip */}
                  <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(59,130,246,0.08)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Job Matches',    value: liveJobs?.length ?? 0,  icon: <BriefcaseBusiness size={13} color="#3B82F6" />, color: '#1D4ED8' },
                      { label: 'Avg Match Score', value: liveJobs?.length ? `${Math.round(liveJobs.reduce((s, j) => s + j.match_score, 0) / liveJobs.length)}%` : '—', icon: <Target size={13} color="#7C3AED" />, color: '#7C3AED' },
                      { label: 'Skill Coverage', value: `${skillPct}%`,          icon: <Zap size={13} color="#059669" />,    color: '#059669' },
                    ].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', background: 'rgba(219,234,254,0.65)', borderRadius: 20, border: '1px solid rgba(59,130,246,0.18)', backdropFilter: 'blur(6px)' }}>
                        {s.icon}
                        <span style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: 'Hind, sans-serif' }}>{s.value}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── FEATURED JOBS (3-column cards) ── */}
              {!jobsLoading && featuredJobs.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #3B82F6, #6366F1)', borderRadius: 4 }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.2px' }}>Top matches for you</span>
                    </div>
                    <button onClick={() => navigate('/app/careers')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>
                      View all <ChevronRight size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {featuredJobs.map((job, i) => (
                      <JobCard key={job.id} job={job} delay={60 + i * 70}
                        onOpen={() => setSelectedJob(job)}
                        onApply={() => setApplyJob(job)}
                        onPrepare={() => handlePrepare(job)}
                        isPreparing={preparingJobId === job.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Skeletons */}
              {jobsLoading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ borderRadius: 20, overflow: 'hidden', animation: 'pulse 1.5s infinite' }}>
                      <div style={{ height: 4, background: '#CBD5E1' }} />
                      <div style={{ height: 160, background: 'rgba(255,255,255,0.8)', padding: 16 }}>
                        <div style={{ height: 10, background: '#E2E8F0', borderRadius: 6, marginBottom: 10, width: '60%' }} />
                        <div style={{ height: 14, background: '#E2E8F0', borderRadius: 6, marginBottom: 8 }} />
                        <div style={{ height: 10, background: '#F1F5F9', borderRadius: 6, width: '40%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── MORE JOBS + SIDEBAR ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px', gap: 20, alignItems: 'start' }}>

                {/* Jobs list */}
                <div>
                  {moreJobs.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #8B5CF6, #EC4899)', borderRadius: 4 }} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.2px' }}>More opportunities</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        {moreJobs.map((job, i) => (
                          <JobCard key={job.id} job={job} delay={80 + i * 60}
                            onOpen={() => setSelectedJob(job)}
                            onApply={() => setApplyJob(job)}
                            onPrepare={() => handlePrepare(job)}
                            isPreparing={preparingJobId === job.id}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {!jobsLoading && (!liveJobs || liveJobs.length === 0) && (
                    <div style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(226,232,240,0.8)', borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>No openings yet</p>
                      <p style={{ fontSize: 12, color: '#94A3B8' }}>Employers are posting roles — check back soon.</p>
                    </div>
                  )}
                </div>

                {/* Right sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideInRight 0.5s ease both', animationDelay: '160ms' }}>

                  {/* KRS breakdown */}
                  <div style={{ background: 'white', borderRadius: 20, padding: 18, border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>KRS Breakdown</p>
                    </div>
                    {[
                      { label: 'Knowledge', val: ready ? kLoaded : data.krs.k_score, color: '#3B82F6', track: 'rgba(59,130,246,0.12)' },
                      { label: 'Readiness', val: ready ? rLoaded : data.krs.r_score, color: '#8B5CF6', track: 'rgba(139,92,246,0.12)' },
                      { label: 'Skills',    val: ready ? sLoaded : data.krs.s_score, color: '#10B981', track: 'rgba(16,185,129,0.12)' },
                    ].map(s => (
                      <div key={s.label} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{s.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: 'Hind, sans-serif' }}>{s.val}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 7, background: s.track, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: ready ? `${s.val}%` : '0%',
                            background: `linear-gradient(90deg, ${s.color}cc, ${s.color})`,
                            borderRadius: 7,
                            transition: 'width 1.3s cubic-bezier(0.34,1.1,0.64,1)',
                            transitionDelay: s.label === 'Knowledge' ? '0ms' : s.label === 'Readiness' ? '180ms' : '360ms',
                            boxShadow: `0 0 8px ${s.color}55`,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Skills to build */}
                  {topGaps.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 20, padding: 18, border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Build These Skills</p>
                      </div>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
                        Coverage: <strong style={{ color: '#0F172A' }}>{skillPct}%</strong> across job matches
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {topGaps.map((sk, i) => (
                          <span key={sk} style={{
                            padding: '4px 10px', background: '#FFF7ED', border: '1px solid #FED7AA',
                            borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#C2410C',
                            animation: 'fadeIn 0.3s ease both', animationDelay: `${400 + i * 60}ms`,
                          }}>+ {sk}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div style={{ background: 'white', borderRadius: 20, padding: '14px 16px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Quick Actions</p>
                    </div>
                    {[
                      { emoji: '📚', label: 'My Prep List', sub: 'Saved job openings', path: '/app/careers/explore' },
                      { emoji: '🧭', label: 'Career Paths', sub: 'Explore tracks', path: '/app/careers' },
                      { emoji: '👤', label: 'Edit Profile', sub: 'Improve KRS score', path: '/app/profile' },
                    ].map(item => (
                      <button key={item.path} onClick={() => navigate(item.path)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 10px', borderRadius: 12, marginBottom: 2,
                        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                      }}
                        onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC' }}
                        onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 1 }}>{item.label}</p>
                          <p style={{ fontSize: 10, color: '#94A3B8' }}>{item.sub}</p>
                        </div>
                        <ChevronRight size={13} color="#CBD5E1" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedJob && (
        <JobModal job={selectedJob} onClose={() => setSelectedJob(null)}
          onApply={() => { setSelectedJob(null); setApplyJob(selectedJob) }}
          onPrepare={() => { setSelectedJob(null); handlePrepare(selectedJob).catch(() => {}) }}
          isPreparing={preparingJobId === selectedJob?.id}
        />
      )}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}

      <style>{`
        @keyframes spin        { to { transform: rotate(360deg) } }
        @keyframes fadeIn      { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideDown   { from { opacity:0; transform:translateY(-14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideInLeft { from { opacity:0; transform:translateX(-20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInRight{ from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes cardIn      { from { opacity:0; transform:translateY(20px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes rowIn       { from { opacity:0; transform:translateX(-14px) } to { opacity:1; transform:translateX(0) } }
        @keyframes popIn       { from { opacity:0; transform:scale(0.86) translateY(16px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes morphA      { 0%,100%{border-radius:60% 40% 55% 45%/50% 60% 40% 50%;transform:scale(1)} 40%{border-radius:40% 60% 35% 65%/60% 35% 65% 40%;transform:scale(1.08)} 70%{border-radius:55% 45% 60% 40%/45% 55% 45% 55%;transform:scale(0.96)} }
        @keyframes morphB      { 0%,100%{border-radius:50% 50% 60% 40%/55% 45% 55% 45%;transform:scale(1) rotate(0deg)} 50%{border-radius:65% 35% 45% 55%/40% 60% 40% 60%;transform:scale(1.1) rotate(15deg)} }
        @keyframes morphC      { 0%,100%{border-radius:55% 45% 50% 50%/60% 40% 60% 40%;transform:scale(1)} 60%{border-radius:40% 60% 65% 35%/50% 55% 45% 55%;transform:scale(1.12)} }
        @keyframes chipFloat   { 0%,100%{transform:translateY(0px);opacity:0.7} 50%{transform:translateY(-10px);opacity:0.9} }
        @keyframes spinSlow    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulseGreen  { 0%,100%{box-shadow:0 0 6px #10B98188} 50%{box-shadow:0 0 12px #10B981cc} }
      `}</style>
    </div>
  )
}
