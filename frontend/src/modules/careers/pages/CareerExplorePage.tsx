import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, BookOpen, Building2, MapPin, Target,
  TrendingUp, CheckCircle2, X, ExternalLink, Sparkles, Play,
} from 'lucide-react'
import { usePreparedJobs, useUnprepareJob, useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { cn } from '@/lib/utils'
import type { LiveJob } from '@/api/krs'
import { formatSalary, EMPLOYMENT_TYPE_LABELS } from '@/api/jobs'
import type { EmploymentType } from '@/api/jobs'
import AppSidebar from '@/components/layout/AppSidebar'

// ── Card 1: Why this job fits you ────────────────────────────────────────────
function WhyThisJobCard({ job, kScore }: { job: LiveJob; kScore: number }) {
  const matchLabel =
    job.match_score >= 80 ? 'Excellent fit' :
    job.match_score >= 60 ? 'Strong match' :
    job.match_score >= 40 ? 'Good potential' : 'Growth opportunity'

  const matchColor =
    job.match_score >= 80 ? 'text-primary' :
    job.match_score >= 60 ? 'text-accent' : 'text-amber-600'

  const upscRelevant = job.min_k_score > 0
  const meetsKScore  = kScore >= job.min_k_score

  return (
    <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(30,58,95,0.06)' }}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-gray-900">Why this job is right for you</h3>
      </div>

      {/* Match score + skill overlap row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Overall match</p>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-2xl font-black', matchColor)}>{job.match_score}%</span>
          </div>
          <p className={cn('text-[11px] font-semibold mt-0.5', matchColor)}>{matchLabel}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Skills ready</p>
          <span className="text-2xl font-black text-gray-800">{job.skill_overlap}%</span>
          <p className="text-[11px] text-gray-400 mt-0.5">of required skills</p>
        </div>

        {(job.salary_min || job.salary_max) && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Salary range</p>
            <span className="text-sm font-bold text-gray-800">₹{formatSalary(job.salary_min, job.salary_max)} LPA</span>
          </div>
        )}

        {job.growth_outlook && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Sector growth</p>
            <span className={cn(
              'text-sm font-bold capitalize',
              job.growth_outlook === 'high' ? 'text-primary' :
              job.growth_outlook === 'medium' ? 'text-accent' : 'text-gray-500',
            )}>
              {job.growth_outlook} ↑
            </span>
          </div>
        )}
      </div>

      {/* Skills you already have */}
      {job.skills_you_have.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-primary mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Your matching skills ({job.skills_you_have.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {job.skills_you_have.map(sk => (
              <span key={sk} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
                ✓ {sk}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* UPSC relevance */}
      {upscRelevant && (
        <div className={cn(
          'rounded-xl px-3 py-2.5 text-xs leading-relaxed',
          meetsKScore
            ? 'bg-primary/5 border border-primary/20 text-primary/80'
            : 'bg-amber-50 border border-amber-100 text-amber-800',
        )}>
          <span className="font-bold">Your UPSC preparation is an asset here.</span>{' '}
          This role values analytical and governance knowledge (min K-score: {job.min_k_score}/100).{' '}
          {meetsKScore
            ? <span className="font-semibold">Your K-score of {kScore} meets this threshold ✓</span>
            : <span>Work on building your K-score to {job.min_k_score} to fully qualify.</span>}
        </div>
      )}

      {job.skills_you_have.length === 0 && !upscRelevant && (
        <p className="text-xs text-gray-400 italic">
          Add your skills in your profile to see detailed alignment.
        </p>
      )}
    </div>
  )
}

// ── Card 2: Skills to build ───────────────────────────────────────────────────
function SkillsToBuildCard({ job }: { job: LiveJob }) {
  if (job.skills_to_develop.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Skills to build</h3>
        </div>
        <div className="text-center py-4">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-2" />
          <p className="text-sm font-semibold text-primary">You have all required skills!</p>
          <p className="text-xs text-gray-400 mt-1">You're a very strong candidate for this role.</p>
        </div>
      </div>
    )
  }

  const total = job.required_skills.length
  const gap   = job.skills_to_develop.length
  const pct   = total > 0 ? Math.round(((total - gap) / total) * 100) : 0

  return (
    <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(30,58,95,0.06)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <h3 className="text-sm font-bold text-gray-900">Skills to build</h3>
        <span className="ml-auto text-[11px] text-gray-400 font-medium">{pct}% ready</span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          You have {total - gap} of {total} required skills. Build {gap} more to be fully ready.
        </p>
      </div>

      {/* Gap skills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {job.skills_to_develop.map(sk => (
          <span key={sk} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-100">
            + {sk}
          </span>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
        <span className="font-bold">Preparation tip:</span> Focus on the skills above through online courses, certifications, or hands-on projects. Each skill you add directly improves your match score for this role.
      </div>
    </div>
  )
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: { job: LiveJob; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
            <Briefcase className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
          <p className="text-sm text-gray-500">{job.company_name}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Application tracking is coming soon. For now, apply directly through the employer's website.
          </p>
        </div>
        {job.employer_website ? (
          <a
            href={job.employer_website.startsWith('http') ? job.employer_website : `https://${job.employer_website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit {job.company_name}
          </a>
        ) : (
          <div className="flex items-center justify-center w-full h-11 bg-gray-100 text-gray-400 rounded-xl text-sm font-medium">
            No website listed — contact employer directly
          </div>
        )}
        <button onClick={onClose} className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

// ── Job detail / analysis modal (centered) ────────────────────────────────────
function JobAnalysisDrawer({
  job,
  kScore,
  onClose,
  onRemove,
  onApply,
}: {
  job: LiveJob
  kScore: number
  onClose: () => void
  onRemove: () => void
  onApply: () => void
}) {
  const matchColor =
    job.match_score >= 80 ? '#059669' :
    job.match_score >= 60 ? '#2563EB' :
    job.match_score >= 40 ? '#D97706' : '#6B7280'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      background: 'rgba(15,23,42,0.55)',
      backdropFilter: 'blur(6px)',
      animation: 'fadeInBg 0.2s ease both',
    }} onClick={onClose}>

      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 780,
          maxHeight: '90vh',
          background: '#F8FAFC',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(15,23,42,0.28)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalIn 0.28s cubic-bezier(0.34,1.1,0.64,1) both',
        }}
      >
        {/* ── Hero header band ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
          padding: '24px 28px 20px',
          position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          {/* decorative blobs */}
          <div style={{ position: 'absolute', width: 200, height: 200, top: -80, right: -40, background: '#60A5FA', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.25, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 150, height: 150, bottom: -60, left: '40%', background: '#93C5FD', borderRadius: '50%', filter: 'blur(50px)', opacity: 0.2, pointerEvents: 'none' }} />

          {/* Close button */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', zIndex: 2,
          }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
          >
            <X size={15} />
          </button>

          {/* Title area */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Company initial circle */}
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 900, color: 'white',
              }}>
                {job.company_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 40 }}>
                <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1.2, marginBottom: 5 }}>{job.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Building2 size={12} color="rgba(255,255,255,0.65)" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{job.company_name}</span>
                  {job.location && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
                      <MapPin size={12} color="rgba(255,255,255,0.65)" />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{job.location}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tags row */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20 }}>
                <Target size={11} color="white" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{job.match_score}% match</span>
              </div>
              {job.employment_type && (
                <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                  {EMPLOYMENT_TYPE_LABELS[job.employment_type as EmploymentType] ?? job.employment_type}
                </span>
              )}
              {job.growth_outlook && (
                <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                  {job.growth_outlook} growth ↑
                </span>
              )}
              {job.expires_at && new Date(job.expires_at) < new Date() && (
                <span style={{ padding: '5px 12px', background: 'rgba(220,38,38,0.25)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#FCA5A5' }}>
                  ⚠ Expired
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* Quick stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Overall Match', value: `${job.match_score}%`, color: matchColor },
              { label: 'Skills Ready', value: `${job.skill_overlap}%`, color: '#2563EB' },
              ...(job.salary_min || job.salary_max ? [{ label: 'Salary Range', value: `₹${job.salary_min ? Math.round(job.salary_min/100000) : '?'}–${job.salary_max ? Math.round(job.salary_max/100000) : '?'} LPA`, color: '#059669' }] : [{ label: 'Salary', value: 'Not listed', color: '#9CA3AF' }]),
              { label: 'Posted', value: new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), color: '#6B7280' },
            ].map((stat, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{stat.label}</p>
                <p style={{ fontFamily: 'Hind, sans-serif', fontSize: 17, fontWeight: 900, color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Two-column layout: Why fit + Skills to build */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <WhyThisJobCard job={job} kScore={kScore} />
            <SkillsToBuildCard job={job} />
          </div>

          {/* About this role */}
          <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)', marginBottom: 4 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>About this role</h3>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{job.description}</p>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div style={{
          borderTop: '1px solid rgba(226,232,240,0.8)',
          padding: '14px 28px',
          display: 'flex', gap: 12, alignItems: 'center',
          background: 'white', flexShrink: 0,
        }}>
          <button onClick={onRemove} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 42, padding: '0 18px', borderRadius: 12,
            border: '1.5px solid #E2E8F0', background: 'white',
            fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#6B7280' }}
          >
            <X size={14} /> Remove from list
          </button>
          <button onClick={onApply} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            height: 42, borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)', transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.4)' }}
            onMouseOut={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.3)' }}
          >
            <ExternalLink size={14} /> Apply Now
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Prepared job card ─────────────────────────────────────────────────────────
function PreparedJobCard({ job, onAnalyse, onStartPrep, isActivePrep }: {
  job: LiveJob
  onAnalyse: () => void
  onStartPrep: () => void
  isActivePrep: boolean
}) {
  const haveCount = job.skills_you_have.length
  const gapCount  = job.skills_to_develop.length
  const total     = job.required_skills.length

  return (
    <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(30,58,95,0.06)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{job.title}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Building2 className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">{job.company_name}</span>
            {job.location && (
              <>
                <span className="text-gray-300">·</span>
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">{job.location}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xl font-black text-primary">{job.match_score}%</span>
          <span className="text-[10px] text-gray-400">match</span>
        </div>
      </div>

      {/* Match bar */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-1.5 rounded-full bg-primary transition-all duration-700" style={{ width: `${job.match_score}%` }} />
      </div>

      {/* Skill summary */}
      {total > 0 && (
        <div className="flex items-center gap-3 text-[11px] mb-4">
          {haveCount > 0 && (
            <span className="flex items-center gap-1 text-primary font-semibold">
              <CheckCircle2 className="w-3 h-3" />{haveCount} skills matched
            </span>
          )}
          {gapCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <TrendingUp className="w-3 h-3" />{gapCount} skills to build
            </span>
          )}
        </div>
      )}

      {/* Two buttons: Skill Gap + Start Prep */}
      <div className="flex gap-2">
        <button
          onClick={onAnalyse}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          View Skill Gap
        </button>
        <button
          onClick={onStartPrep}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-colors',
            isActivePrep
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white',
          )}
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          {isActivePrep ? 'Active ✓' : 'Start Prep'}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CareerExplorePage() {
  const navigate = useNavigate()
  const { data: preparedJobs, isLoading } = usePreparedJobs()
  const { data: dashboard } = useKrsDashboard()
  const unprepareJob = useUnprepareJob()
  const { activePrep, startPrep } = useActivePrepJob()

  const [selectedJob, setSelectedJob] = useState<LiveJob | null>(null)
  const [applyJob, setApplyJob] = useState<LiveJob | null>(null)

  const kScore = dashboard?.krs.k_score ?? 0

  const handleRemove = async (job: LiveJob) => {
    await unprepareJob.mutateAsync(job.id)
    setSelectedJob(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <AppSidebar activePath="/app/careers/explore" />

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(59,130,246,0.08)',
          padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 2px 16px rgba(30,58,95,0.04)',
        }}>
          <div>
            <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: '#1E3A5F' }}>My Preparation List</h1>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>
              {isLoading ? 'Loading…' : preparedJobs && preparedJobs.length > 0
                ? `${preparedJobs.length} job${preparedJobs.length === 1 ? '' : 's'} you're actively preparing for`
                : 'No jobs added yet — find jobs on your dashboard'}
            </p>
          </div>
          <button onClick={() => navigate('/app/dashboard')} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: 'white',
            border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59,130,246,0.25)',
          }}>
            <Briefcase size={14} />Find jobs
          </button>
        </header>

        <main style={{ padding: '28px 32px', flex: 1 }}>

          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 160, borderRadius: 20, background: 'rgba(255,255,255,0.7)', animation: 'pulse 2s infinite', border: '1px solid rgba(59,130,246,0.06)' }} />
              ))}
            </div>
          )}

          {!isLoading && (!preparedJobs || preparedJobs.length === 0) && (
            <div style={{
              background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.95)', borderRadius: 24,
              padding: '60px 24px', textAlign: 'center',
              boxShadow: '0 4px 20px rgba(30,58,95,0.06)',
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>📚</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F', marginBottom: 8 }}>No jobs added yet</p>
              <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24, maxWidth: 340, margin: '0 auto 24px', lineHeight: 1.6 }}>
                Go to your dashboard, find a job you like, and click <strong style={{ color: '#3B82F6' }}>"Prepare for this Job"</strong> to add it here.
              </p>
              <button onClick={() => navigate('/app/dashboard')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: '#fff',
                border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
              }}>
                <Briefcase size={15} />See recommended jobs
              </button>
            </div>
          )}

          {!isLoading && preparedJobs && preparedJobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Tip banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)',
                borderRadius: 16, padding: '12px 18px',
              }}>
                <Sparkles size={14} color="#3B82F6" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#3B82F6' }}>
                  Click <strong>"View Skill Gap Analysis"</strong> to see your personalised prep plan for each job.
                </p>
              </div>
              {/* Cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {preparedJobs.map(job => (
                  <PreparedJobCard
                    key={job.id}
                    job={job}
                    onAnalyse={() => setSelectedJob(job)}
                    onStartPrep={() => startPrep(job.id, {
                      onSuccess: () => navigate('/app/learn'),
                    })}
                    isActivePrep={activePrep?.job_id === job.id}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedJob && (
        <JobAnalysisDrawer
          job={selectedJob}
          kScore={kScore}
          onClose={() => setSelectedJob(null)}
          onRemove={() => handleRemove(selectedJob)}
          onApply={() => { setSelectedJob(null); setApplyJob(selectedJob) }}
        />
      )}

      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
      <style>{`
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeInBg   { from{opacity:0} to{opacity:1} }
        @keyframes modalIn    { from{opacity:0;transform:scale(0.94) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  )
}
