import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKrsDashboard, useLiveJobs, usePrepareJob, useUnprepareJob } from '../hooks/useKrs'
import { MapPin, Map, BookOpen, ExternalLink, X, CheckCircle2, TrendingUp, Zap, Target, ArrowUpRight, Sparkles, BriefcaseBusiness, ChevronRight, Bell, Wifi, Mic, FileText } from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import AppSidebar from '@/components/layout/AppSidebar'
import JobAnalysisDrawer from '@/components/JobAnalysisDrawer'
import { resumeApi } from '@/api/resume'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { applyToJob, getMyApplications } from '@/api/matching'
import { jobPlanApi } from '@/api/jobPlan'

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

// ── Job spotlight (single large card, one job at a time) ──────────────────────
function JobSpotlight({ job, onOpen, onApply, onPrepare, onGenerateResume, onMockInterview, onOpenResume, isPreparing, isApplied }: {
  job: LiveJob; onOpen: () => void; onApply: () => void; onPrepare: () => void
  onGenerateResume: () => void; onMockInterview: () => void; onOpenResume: () => void
  isPreparing?: boolean; isApplied?: boolean
}) {
  const [c1, c2] = sectorColor(job.sector)
  const salary = formatSalary(job.salary_min, job.salary_max)

  return (
    <div style={{
      background: 'white', borderRadius: 24, overflow: 'hidden',
      border: '1.5px solid rgba(226,232,240,0.8)',
      boxShadow: '0 8px 32px rgba(15,23,42,0.06)',
      animation: 'cardIn 0.4s cubic-bezier(0.34,1.1,0.64,1) both',
    }}>
      {/* ── Header banner ── */}
      <div style={{ background: `linear-gradient(135deg, ${c1}, #15130F)`, padding: '26px 28px 22px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', top: -70, right: -60, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
              {job.company_name.charAt(0)}
            </div>
            <div>
              <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 21, fontWeight: 900, color: 'white', marginBottom: 3, cursor: 'pointer' }} onClick={onOpen}>{job.title}</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{job.company_name}</p>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 14, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 900, color: 'white', fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{job.match_score}%</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>match</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18, position: 'relative' }}>
          {job.sector && <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>{job.sector}</span>}
          {job.location && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'rgba(255,255,255,0.16)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.22)' }}><MapPin size={11} />{job.location}</span>}
          {job.job_type && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'rgba(255,255,255,0.16)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.22)', textTransform: 'capitalize' }}><Wifi size={11} />{job.job_type.replace('_', ' ')}</span>}
          {job.employment_type && <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.16)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.22)', textTransform: 'capitalize' }}>{job.employment_type.replace('_', ' ')}</span>}
        </div>
      </div>

      {/* ── Salary + skill overlap bar ── */}
      <div style={{ padding: '18px 28px', borderBottom: '1px solid #F1F5F9' }}>
        {salary && (
          <p style={{ fontSize: 14, color: '#374151', fontWeight: 700, marginBottom: job.skill_overlap !== undefined ? 14 : 0 }}>
            ₹{salary} LPA
          </p>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>
            <span>Skill overlap</span>
            <span>{job.skill_overlap}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 7, background: '#F1F5F9', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${job.skill_overlap}%`, background: `linear-gradient(90deg, ${c1}, ${c2 === '#15130F' ? c1 : c2})`, borderRadius: 7, transition: 'width 0.7s ease' }} />
          </div>
        </div>
      </div>

      {/* ── About this role ── */}
      {job.description && (
        <div style={{ padding: '18px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>About this role</p>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8 }}>{job.description}</p>
        </div>
      )}

      {/* ── Required skills ── */}
      {job.required_skills.length > 0 && (
        <div style={{ padding: '18px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Required skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {job.required_skills.map(sk => (
              <span key={sk} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, background: '#FAF7F1', color: '#15130F', border: '1px solid #F1EAE0' }}>{sk}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Three action cards ── */}
      <div style={{ padding: '18px 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, borderBottom: '1px solid #F1F5F9' }}>
        {/* Resume */}
        <div style={{ background: '#FAF7F1', border: '1.5px solid #F1EAE0', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <FileText size={14} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#15130F', margin: 0 }}>Resume</p>
            <p style={{ fontSize: 11, color: '#4A453D', margin: '3px 0 0', lineHeight: 1.5 }}>Tailor and optimise your resume for this role.</p>
          </div>
          <button onClick={onOpenResume} style={{
            marginTop: 'auto', height: 34, borderRadius: 9, border: 'none',
            background: '#3B82F6', color: 'white',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <FileText size={11} /> Open Resume
          </button>
        </div>

        {/* Generate Roadmap */}
        <div style={{ background: '#FAF7F1', border: '1.5px solid #F1EAE0', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Map size={14} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#15130F', margin: 0 }}>Generate Roadmap</p>
            <p style={{ fontSize: 11, color: '#4A453D', margin: '3px 0 0', lineHeight: 1.5 }}>AI-powered learning roadmap tailored to this role.</p>
          </div>
          <button onClick={onGenerateResume} style={{
            marginTop: 'auto', height: 34, borderRadius: 9, border: 'none',
            background: '#3B82F6', color: 'white',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <Map size={11} /> Generate
          </button>
        </div>

        {/* Mock Interview */}
        <div style={{ background: '#FAF7F1', border: '1.5px solid #F1EAE0', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Mic size={14} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#15130F', margin: 0 }}>Mock Interview</p>
            <p style={{ fontSize: 11, color: '#4A453D', margin: '3px 0 0', lineHeight: 1.5 }}>AI interviewer roleplay with a detailed scorecard.</p>
          </div>
          <button onClick={onMockInterview} style={{
            marginTop: 'auto', height: 34, borderRadius: 9, border: 'none',
            background: '#3B82F6', color: 'white',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <Mic size={11} /> Start
          </button>
        </div>
      </div>

      {/* ── Apply CTA ── */}
      <div style={{ padding: '18px 28px', display: 'flex', gap: 10 }}>
        <button onClick={isApplied ? undefined : onApply} disabled={isApplied} style={{
          flex: 1, height: 46, borderRadius: 13,
          background: isApplied ? 'rgba(16,185,129,0.08)' : `linear-gradient(135deg, ${c1}, #15130F)`,
          color: isApplied ? '#059669' : 'white',
          border: isApplied ? '1.5px solid rgba(16,185,129,0.25)' : 'none',
          fontSize: 14, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: isApplied ? 'none' : `0 4px 18px ${c1}45`, transition: 'all 0.2s',
        }}>
          {isApplied ? <><CheckCircle2 size={14} /> Applied</> : <><ArrowUpRight size={14} /> Apply Now</>}
        </button>
      </div>
    </div>
  )
}

// ── Compact job row ───────────────────────────────────────────────────────────
function JobRow({ job, index, onOpen, onApply, onPrepare, isPreparing, isApplied }: {
  job: LiveJob; index: number; onOpen: () => void; onApply: () => void; onPrepare: () => void; isPreparing?: boolean; isApplied?: boolean
}) {
  const [c1] = sectorColor(job.sector)
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        background: hov ? 'white' : 'rgba(255,255,255,0.85)',
        borderRadius: 14, padding: '12px 14px',
        border: hov ? `1.5px solid ${c1}28` : '1.5px solid rgba(226,232,240,0.7)',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        boxShadow: hov ? `0 8px 24px ${c1}15` : '0 1px 4px rgba(15,23,42,0.03)',
        transform: hov ? 'translateX(5px)' : 'translateX(0)',
        transition: 'all 0.22s cubic-bezier(0.34,1.1,0.64,1)',
        animation: `rowIn 0.4s ease both`,
        animationDelay: `${200 + index * 50}ms`,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: `${c1}14`, border: `1.5px solid ${c1}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 900, color: c1, flexShrink: 0,
      }}>
        {job.company_name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</h3>
          {job.growth_outlook === 'high' && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#059669', background: 'rgba(16,185,129,0.08)', padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.15)' }}>↑ High</span>}
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8' }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 900, color: c1, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{job.match_score}%</p>
          <p style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>match</p>
        </div>
        {formatSalary(job.salary_min, job.salary_max) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '3px 8px' }}>
            ₹{formatSalary(job.salary_min, job.salary_max)} LPA
          </span>
        )}
        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
          <button onClick={onPrepare} disabled={isPreparing} style={{
            height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'white', border: `1.5px solid ${c1}28`, color: c1,
            display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
          }}>
            {isPreparing
              ? <div style={{ width: 9, height: 9, border: `2px solid ${c1}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <><BookOpen size={9} />{job.is_prepared ? 'Saved' : 'Prep'}</>}
          </button>
          <button onClick={isApplied ? undefined : onApply} disabled={isApplied} style={{
            height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer',
            background: isApplied ? 'rgba(16,185,129,0.1)' : c1, color: isApplied ? '#059669' : 'white',
            border: isApplied ? '1.5px solid rgba(16,185,129,0.3)' : 'none',
            display: 'flex', alignItems: 'center', gap: 3, boxShadow: isApplied ? 'none' : `0 2px 8px ${c1}35`, transition: 'all 0.2s',
          }}>
            {isApplied ? <><CheckCircle2 size={9} /> Applied</> : <><ArrowUpRight size={9} /> Apply</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Job detail modal ──────────────────────────────────────────────────────────
function JobModal({ job, onClose, onApply, onPrepare, onGenerateResume, isPreparing, isApplied }: {
  job: LiveJob; onClose: () => void; onApply: () => void; onPrepare: () => void; onGenerateResume: () => void; isPreparing?: boolean; isApplied?: boolean
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
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onGenerateResume} style={{ width: '100%', height: 46, borderRadius: 13, background: 'linear-gradient(135deg, #15130F, #1E3A5F)', color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 18px rgba(21,19,15,0.3)', transition: 'all 0.2s' }}>
            <Map size={15} /> Generate Roadmap for This Job
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onPrepare} disabled={isPreparing} style={{ flex: 1, height: 42, borderRadius: 13, border: '1.5px solid #E2E8F0', background: job.is_prepared ? `${c1}08` : 'white', color: job.is_prepared ? c1 : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
              {isPreparing ? <div style={{ width: 14, height: 14, border: `2px solid ${c1}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><BookOpen size={13} />{job.is_prepared ? '✓ In Prep List' : 'Add to Prep List'}</>}
            </button>
            <button onClick={isApplied ? undefined : onApply} disabled={isApplied} style={{ flex: 1, height: 42, borderRadius: 13, background: isApplied ? 'rgba(16,185,129,0.08)' : `linear-gradient(135deg, ${c1}, ${c2})`, color: isApplied ? '#059669' : 'white', border: isApplied ? '1.5px solid rgba(16,185,129,0.25)' : 'none', fontSize: 13, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: isApplied ? 'none' : `0 4px 18px ${c1}45`, transition: 'all 0.2s' }}>
              {isApplied ? <><CheckCircle2 size={13} /> Applied</> : <><ExternalLink size={13} /> Apply Now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: { job: LiveJob; onClose: () => void }) {
  const [c1, c2] = sectorColor(job.sector)
  const [coverNote, setCoverNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const qc = useQueryClient()

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(job.id, coverNote.trim() || undefined),
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      qc.invalidateQueries({ queryKey: ['live-jobs'] })
    },
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(14px)', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 400, padding: 26, boxShadow: '0 24px 60px rgba(15,23,42,0.25)', animation: 'popIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
          <X size={13} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginBottom: 6 }}>Application Submitted!</h3>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
              The employer will review your profile and KRS score. You'll be notified of any updates.
            </p>
            <button onClick={onClose} style={{ marginTop: 18, padding: '10px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💼</div>
            <h3 style={{ fontFamily: 'Hind, sans-serif', fontSize: 17, fontWeight: 900, color: '#0F172A', marginBottom: 3 }}>{job.title}</h3>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>{job.company_name}</p>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 13px', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#15803D', lineHeight: 1.6, margin: 0 }}>
                Your full profile, KRS score, and skills will be shared with the employer.
              </p>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Cover note <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span>
            </label>
            <textarea
              value={coverNote}
              onChange={e => setCoverNote(e.target.value)}
              placeholder="Tell the employer why you're a great fit..."
              maxLength={1000}
              rows={3}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', color: '#1E293B', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 4 }}
            />
            <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginBottom: 16 }}>{coverNote.length}/1000</p>

            {applyMutation.isError && (
              <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
                {(applyMutation.error as any)?.response?.data?.detail || 'Failed to submit. Please try again.'}
              </p>
            )}

            <button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              style={{ width: '100%', height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${c1}, ${c2})`, color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: applyMutation.isPending ? 'not-allowed' : 'pointer', opacity: applyMutation.isPending ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 14px ${c1}40` }}
            >
              {applyMutation.isPending ? (
                <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Submitting…</>
              ) : (
                <><CheckCircle2 size={15} />Submit Application</>
              )}
            </button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 8, fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 7 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useKrsDashboard()
  const { data: liveJobs, isLoading: jobsLoading } = useLiveJobs()
  const { data: myApps } = useQuery({ queryKey: ['my-applications'], queryFn: getMyApplications })
  const appliedJobIds = new Set((myApps ?? []).map(a => a.job_id))
  const prepareJob   = usePrepareJob()
  const unprepareJob = useUnprepareJob()
  const { startPrep } = useActivePrepJob()

  const [selectedJob,    setSelectedJob]    = useState<LiveJob | null>(null)
  const [applyJob,       setApplyJob]       = useState<LiveJob | null>(null)
  const [preparingJobId, setPreparingJobId] = useState<string | null>(null)
  const [skillGapJob,    setSkillGapJob]    = useState<LiveJob | null>(null)
  const [ready,          setReady]          = useState(false)
  const [jobPage,        setJobPage]        = useState(0)
  const JOBS_PER_PAGE = 1

  useEffect(() => {
    if (data) { const t = setTimeout(() => setReady(true), 100); return () => clearTimeout(t) }
  }, [data])

  const handlePrepare = async (job: LiveJob) => {
    setPreparingJobId(job.id)
    try {
      if (job.is_prepared) await unprepareJob.mutateAsync(job.id)
      else await prepareJob.mutateAsync(job.id)
    } finally { setPreparingJobId(null) }
  }

  const handleGenerateResume = (job: LiveJob) => {
    setSelectedJob(null)
    startPrep(job.id, {
      onSuccess: () => {
        // Kick off the job-specific learning plan — previously this just set the active
        // job and navigated, landing the user on whatever old roadmap already existed with
        // nothing new generated. RoadmapPage's JobLearningPlanPanel picks up the
        // "generating" status and shows live progress.
        jobPlanApi.generate(job.id).catch(() => {})
        navigate('/app/roadmap')
      },
    })
  }

  const gapFreq: Record<string, number> = {}
  let totalReq = 0, totalHave = 0
  for (const j of liveJobs ?? []) {
    totalReq += j.required_skills.length; totalHave += j.skills_you_have.length
    for (const sk of j.skills_to_develop) { const k = sk.toLowerCase().trim(); gapFreq[k] = (gapFreq[k] ?? 0) + 1 }
  }
  const topGaps  = Object.entries(gapFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s)
  const skillPct = totalReq > 0 ? Math.round((totalHave / totalReq) * 100) : 0

  const recommendedJobs = [...(liveJobs ?? [])].sort((a, b) => b.match_score - a.match_score).slice(0, 10)
  const totalJobPages   = Math.max(1, Math.ceil(recommendedJobs.length / JOBS_PER_PAGE))
  const safeJobPage     = Math.min(jobPage, totalJobPages - 1)
  const pageJobs         = recommendedJobs.slice(safeJobPage * JOBS_PER_PAGE, safeJobPage * JOBS_PER_PAGE + JOBS_PER_PAGE)

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
                        <button onClick={() => navigate('/app/jobs')} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                          borderRadius: 11, background: '#1D4ED8', border: 'none',
                          color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(29,78,216,0.28)', transition: 'all 0.2s',
                        }}
                          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(29,78,216,0.36)' }}
                          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(29,78,216,0.28)' }}
                        >
                          <BookOpen size={12} /> Browse Jobs
                        </button>
                        <button onClick={() => navigate('/app/roadmap/history')} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                          borderRadius: 11, background: 'rgba(219,234,254,0.7)',
                          border: '1.5px solid rgba(59,130,246,0.3)',
                          color: '#1D4ED8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(59,130,246,0.08)', transition: 'all 0.2s',
                        }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#1D4ED8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                          <Target size={12} /> My Roadmap
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

              {/* ── QUICK TOOLS ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 16, background: '#15130F', borderRadius: 4 }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.2px' }}>Your Tools</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { icon: '📄', label: 'Resume', desc: 'AI resume builder', path: '/app/resume', color: '#7C3AED' },
                    { icon: '🎙️', label: 'AI Interview', desc: 'Mock interview prep', path: '/app/interview/setup', color: '#0EA5E9' },
                    { icon: '🧠', label: 'AI Counsellor', desc: 'Career coaching', path: '/app/counsellor', color: '#F59E0B' },
                  ].map(tool => (
                    <button
                      key={tool.path}
                      onClick={() => navigate(tool.path)}
                      style={{
                        background: 'white', border: '1.5px solid rgba(226,232,240,0.8)',
                        borderRadius: 16, padding: '16px 16px',
                        cursor: 'pointer', textAlign: 'left' as const,
                        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                        transition: 'all 0.2s', display: 'flex', flexDirection: 'column' as const, gap: 8,
                      }}
                      onMouseOver={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseOut={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `${tool.color}14`,
                        border: `1.5px solid ${tool.color}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                      }}>{tool.icon}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{tool.label}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{tool.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── RECOMMENDED JOBS + SIDEBAR ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px', gap: 20, alignItems: 'start' }}>

                {/* Jobs — top 10, shown one at a time */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 4, height: 16, background: '#15130F', borderRadius: 4 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.2px' }}>Top matches for you</span>
                  </div>

                  {jobsLoading && (
                    <div style={{ borderRadius: 24, overflow: 'hidden', animation: 'pulse 1.5s infinite' }}>
                      <div style={{ height: 90, background: '#CBD5E1' }} />
                      <div style={{ height: 260, background: 'rgba(255,255,255,0.8)', padding: 20 }}>
                        <div style={{ height: 10, background: '#E2E8F0', borderRadius: 6, marginBottom: 12, width: '40%' }} />
                        <div style={{ height: 16, background: '#E2E8F0', borderRadius: 6, marginBottom: 10, width: '70%' }} />
                        <div style={{ height: 10, background: '#F1F5F9', borderRadius: 6, width: '50%' }} />
                      </div>
                    </div>
                  )}

                  {!jobsLoading && pageJobs.length > 0 && (
                    <>
                      {pageJobs.map(job => (
                        <JobSpotlight key={job.id} job={job}
                          onOpen={() => setSelectedJob(job)}
                          onApply={() => setApplyJob(job)}
                          onPrepare={() => handlePrepare(job)}
                          onGenerateResume={() => handleGenerateResume(job)}
                          onMockInterview={() => startPrep(job.id, { onSuccess: () => navigate('/app/interview/setup') })}
                          onOpenResume={() => startPrep(job.id, { onSuccess: () => navigate('/app/resume') })}
                          isPreparing={preparingJobId === job.id}
                          isApplied={appliedJobIds.has(job.id)}
                        />
                      ))}

                      {/* Pagination controls */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18 }}>
                        <button
                          onClick={() => setJobPage(p => Math.max(0, p - 1))}
                          disabled={safeJobPage === 0}
                          style={{
                            width: 34, height: 34, borderRadius: 10, border: '1.5px solid #E2E8F0',
                            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: safeJobPage === 0 ? 'default' : 'pointer', opacity: safeJobPage === 0 ? 0.4 : 1,
                            color: '#475569', transition: 'all 0.2s',
                          }}
                        >
                          <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                          {safeJobPage + 1} / {totalJobPages}
                        </span>
                        <button
                          onClick={() => setJobPage(p => Math.min(totalJobPages - 1, p + 1))}
                          disabled={safeJobPage >= totalJobPages - 1}
                          style={{
                            width: 34, height: 34, borderRadius: 10, border: '1.5px solid #E2E8F0',
                            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: safeJobPage >= totalJobPages - 1 ? 'default' : 'pointer',
                            opacity: safeJobPage >= totalJobPages - 1 ? 0.4 : 1,
                            color: '#475569', transition: 'all 0.2s',
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </>
                  )}

                  {!jobsLoading && recommendedJobs.length === 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(226,232,240,0.8)', borderRadius: 20, padding: '48px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>No openings yet</p>
                      <p style={{ fontSize: 12, color: '#94A3B8' }}>Employers are posting roles — check back soon.</p>
                    </div>
                  )}
                </div>

                {/* Right sidebar — premium skill intelligence card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideInRight 0.5s ease both', animationDelay: '160ms' }}>
                  <div style={{
                    borderRadius: 22, overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 1px 4px rgba(15,23,42,0.06)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    position: 'relative',
                  }}>
                    {/* Header */}
                    <div style={{
                      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1D4ED8 100%)',
                      padding: '20px 20px 16px', position: 'relative', overflow: 'hidden',
                    }}>
                      {/* Glow blobs */}
                      <div style={{ position: 'absolute', width: 140, height: 140, top: -50, right: -40, background: '#3B82F6', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.35, pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', width: 90, height: 90, bottom: -30, left: 10, background: '#818CF8', borderRadius: '50%', filter: 'blur(36px)', opacity: 0.28, pointerEvents: 'none' }} />
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={13} color="#FCD34D" />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px' }}>Skill Intelligence</span>
                        </div>
                        <p style={{ fontSize: 17, fontWeight: 900, color: 'white', fontFamily: 'Hind, sans-serif', lineHeight: 1.25, marginBottom: 4 }}>
                          Your Gap Analysis
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                          Based on your top {liveJobs?.length ?? 0} job matches
                        </p>
                      </div>
                    </div>

                    {/* Skill coverage meter */}
                    <div style={{ background: '#F8FAFC', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skill coverage</span>
                        <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 22, fontWeight: 900, color: skillPct >= 60 ? '#059669' : skillPct >= 30 ? '#D97706' : '#DC2626' }}>{skillPct}%</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 8, background: '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 8,
                          width: `${skillPct}%`,
                          background: skillPct >= 60
                            ? 'linear-gradient(90deg, #059669, #10B981)'
                            : skillPct >= 30
                            ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                            : 'linear-gradient(90deg, #DC2626, #EF4444)',
                          transition: 'width 1.2s cubic-bezier(0.34,1.1,0.64,1)',
                          boxShadow: skillPct >= 60 ? '0 0 8px rgba(5,150,105,0.4)' : skillPct >= 30 ? '0 0 8px rgba(217,119,6,0.4)' : '0 0 8px rgba(220,38,38,0.4)',
                        }} />
                      </div>
                      <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 6, fontWeight: 500 }}>
                        {skillPct >= 60 ? 'Strong alignment with job requirements' : skillPct >= 30 ? 'Growing — add a few more skills' : 'Complete your profile to improve this'}
                      </p>
                    </div>

                    {/* Skills to build */}
                    {topGaps.length > 0 && (
                      <div style={{ background: 'white', padding: '16px 20px' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Priority Skills to Build</p>
                        <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 12, fontWeight: 500 }}>Appear most in jobs you're matched to</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {topGaps.map((sk, i) => (
                            <div key={sk} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px',
                              background: i === 0 ? 'linear-gradient(90deg, rgba(29,78,216,0.05), rgba(124,58,237,0.04))' : '#F8FAFC',
                              border: i === 0 ? '1px solid rgba(29,78,216,0.14)' : '1px solid #F1F5F9',
                              borderRadius: 10,
                              animation: 'fadeIn 0.3s ease both', animationDelay: `${i * 60}ms`,
                            }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                background: i === 0 ? 'linear-gradient(135deg, #1D4ED8, #7C3AED)' : '#E2E8F0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 900, color: i === 0 ? 'white' : '#94A3B8',
                              }}>
                                {i + 1}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? '#1E3A5F' : '#475569', flex: 1, textTransform: 'capitalize' }}>{sk}</span>
                              {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.08)', padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(124,58,237,0.15)', whiteSpace: 'nowrap' }}>Top gap</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    <div style={{ background: 'white', padding: '0 20px 18px' }}>
                      <button
                        onClick={() => {
                          const topJob = liveJobs?.[0]
                          if (topJob) setSkillGapJob(topJob)
                        }}
                        style={{
                          width: '100%', height: 40, borderRadius: 11,
                          background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
                          color: 'white', border: 'none', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          boxShadow: '0 4px 14px rgba(29,78,216,0.28)', transition: 'all 0.2s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(29,78,216,0.36)' }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(29,78,216,0.28)' }}
                      >
                        Full Skill Report <ArrowUpRight size={12} />
                      </button>
                    </div>
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
          onGenerateResume={() => handleGenerateResume(selectedJob)}
          isPreparing={preparingJobId === selectedJob?.id}
          isApplied={appliedJobIds.has(selectedJob.id)}
        />
      )}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
      {skillGapJob && (
        <JobAnalysisDrawer
          job={skillGapJob}
          kScore={data?.krs.k_score ?? 0}
          onClose={() => setSkillGapJob(null)}
          onApply={() => setSkillGapJob(null)}
        />
      )}

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
