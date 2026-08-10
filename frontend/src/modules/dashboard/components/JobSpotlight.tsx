import { useState } from 'react'
import { MapPin, Map, BookOpen, ExternalLink, X, CheckCircle2, TrendingUp, Zap, Target, ArrowUpRight, Mic, FileText } from 'lucide-react'
import { NAVY, INK, INK_SFT, MUTED, CREAM, BORDER } from '@/design-system/tokens'
import { colors } from '@/design-system/tokens'
import { formatSalary } from '@/api/jobs'
import type { LiveJob } from '@/api/krs'

export interface JobSpotlightProps {
  job: LiveJob
  onOpen: () => void
  onApply: () => void
  onPrepare: () => void
  onGenerateResume: () => void
  onViewRoadmap: () => void
  roadmapStatus?: 'generating' | 'ready' | 'failed'
  onMockInterview: () => void
  onOpenResume: () => void
  isPreparing?: boolean
  isApplied?: boolean
  isTailoringResume?: boolean
}

export function JobSpotlight({
  job, onOpen, onApply, onPrepare, onGenerateResume, onViewRoadmap,
  roadmapStatus, onMockInterview, onOpenResume, isPreparing, isApplied, isTailoringResume,
}: JobSpotlightProps) {
  const salary = formatSalary(job.salary_min, job.salary_max)
  const [hov, setHov] = useState(false)
  const ELEVATED = colors.surface.elevated

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'white', borderRadius: 18, overflow: 'hidden',
        border: `1px solid ${hov ? 'rgba(26,39,68,0.14)' : BORDER}`,
        boxShadow: hov ? '0 16px 40px rgba(15,23,42,0.10)' : '0 4px 16px rgba(15,23,42,0.05)',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: ELEVATED, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: NAVY, flexShrink: 0 }}>
              {job.company_name.charAt(0)}
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: INK, margin: 0, cursor: 'pointer' }} onClick={onOpen}>{job.title}</h2>
              <p style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 0' }}>{job.company_name}</p>
            </div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0, background: NAVY, borderRadius: 10, padding: '5px 11px' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'white', margin: 0, lineHeight: 1 }}>{job.match_score}%</p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>match</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {job.sector && <span style={{ fontSize: 11, fontWeight: 600, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 8px', borderRadius: 20 }}>{job.sector}</span>}
          {job.location && <span style={{ fontSize: 11, fontWeight: 600, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={10} />{job.location}</span>}
          {job.job_type && <span style={{ fontSize: 11, fontWeight: 600, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{job.job_type.replace('_', ' ')}</span>}
          {job.employment_type && <span style={{ fontSize: 11, fontWeight: 600, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{job.employment_type.replace('_', ' ')}</span>}
        </div>
      </div>

      {/* Salary + skill bar */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}`, background: CREAM }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          {salary ? (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>Salary range</p>
              <p style={{ fontSize: 14, color: INK, fontWeight: 800, margin: 0 }}>₹{salary} LPA</p>
            </div>
          ) : <div />}
          <div style={{ flex: 1, maxWidth: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginBottom: 5, fontWeight: 600 }}>
              <span>Skill overlap</span>
              <span style={{ color: NAVY, fontWeight: 700 }}>{job.skill_overlap}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: ELEVATED, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${job.skill_overlap}%`, background: NAVY, borderRadius: 5, transition: 'width 0.7s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      {job.description && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>About this role</p>
          <p style={{ fontSize: 12.5, color: INK_SFT, lineHeight: 1.6 }}>{job.description}</p>
        </div>
      )}

      {/* Required skills */}
      {job.required_skills.length > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>Required skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {job.required_skills.map(sk => (
              <span key={sk} style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: ELEVATED, border: `1px solid ${BORDER}`, color: INK }}>{sk}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action cards */}
      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderBottom: `1px solid ${BORDER}` }}>
        <button
          onClick={onOpenResume} disabled={isTailoringResume}
          aria-label="Tailor resume for this role"
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 10, background: 'white', border: `1px solid ${BORDER}`, cursor: isTailoringResume ? 'wait' : 'pointer', textAlign: 'left', opacity: isTailoringResume ? 0.7 : 1, transition: 'all 0.18s', width: '100%' }}
          onMouseOver={e => { e.currentTarget.style.background = CREAM; e.currentTarget.style.borderColor = 'rgba(26,39,68,0.16)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = BORDER }}
        >
          {isTailoringResume
            ? <div style={{ width: 15, height: 15, border: `2px solid ${ELEVATED}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            : <FileText size={15} color={NAVY} />}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 1px' }}>Resume</p>
            <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>Tailor for this role</p>
          </div>
        </button>

        <button
          onClick={roadmapStatus ? onViewRoadmap : onGenerateResume}
          aria-label={roadmapStatus === 'ready' ? 'View roadmap' : 'Generate roadmap'}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 10, background: roadmapStatus === 'ready' ? 'rgba(22,163,74,0.04)' : 'white', border: roadmapStatus === 'ready' ? '1px solid rgba(22,163,74,0.15)' : `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s', width: '100%' }}
          onMouseOver={e => { if (roadmapStatus !== 'ready') { e.currentTarget.style.background = CREAM; e.currentTarget.style.borderColor = 'rgba(26,39,68,0.16)' } }}
          onMouseOut={e => { if (roadmapStatus !== 'ready') { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = BORDER } }}
        >
          {roadmapStatus === 'ready'
            ? <CheckCircle2 size={15} color="#16A34A" />
            : roadmapStatus === 'generating'
              ? <div style={{ width: 15, height: 15, border: `2px solid ${ELEVATED}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              : <Map size={15} color={NAVY} />}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: roadmapStatus === 'ready' ? '#16A34A' : INK, margin: '0 0 1px' }}>
              {roadmapStatus === 'ready' ? 'Roadmap ready' : roadmapStatus === 'generating' ? 'Generating…' : 'Roadmap'}
            </p>
            <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>
              {roadmapStatus === 'ready' ? 'View your plan' : 'AI learning plan'}
            </p>
          </div>
        </button>

        <button
          onClick={onMockInterview}
          aria-label="Start mock interview"
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 10, background: 'white', border: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s', width: '100%' }}
          onMouseOver={e => { e.currentTarget.style.background = CREAM; e.currentTarget.style.borderColor = 'rgba(26,39,68,0.16)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = BORDER }}
        >
          <Mic size={15} color={NAVY} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 1px' }}>Interview</p>
            <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>Mock with AI</p>
          </div>
        </button>
      </div>

      {/* Apply CTA */}
      <div style={{ padding: '14px 20px' }}>
        {isApplied ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={14} color="#16A34A" />
            </div>
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: INK, margin: 0 }}>Application submitted</p>
              <p style={{ fontSize: 11, color: MUTED, margin: '1px 0 0' }}>You'll be notified when the employer responds.</p>
            </div>
          </div>
        ) : (
          <button onClick={onApply} style={{
            width: '100%', height: 44, borderRadius: 10,
            background: NAVY, color: 'white', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'all 0.15s',
          }}
            onMouseOver={e => { e.currentTarget.style.background = colors.brand.navySoft; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseOut={e => { e.currentTarget.style.background = NAVY; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <ArrowUpRight size={13} /> Apply now
          </button>
        )}
      </div>

      {/* Skill gap modal */}
      {false && <Target size={0} />}{/* keep import */}
    </div>
  )
}

// ── JobRow ─────────────────────────────────────────────────────────────────────

export interface JobRowProps {
  job: LiveJob
  index: number
  onOpen: () => void
  onApply: () => void
  onPrepare: () => void
  isPreparing?: boolean
  isApplied?: boolean
}

export function JobRow({ job, index, onOpen, onApply, onPrepare, isPreparing, isApplied }: JobRowProps) {
  const [hov, setHov] = useState(false)
  const ELEVATED = colors.surface.elevated
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        background: hov ? 'white' : 'rgba(255,255,255,0.85)', borderRadius: 14, padding: '12px 14px',
        border: `1.5px solid ${hov ? 'rgba(26,39,68,0.15)' : BORDER}`,
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        boxShadow: hov ? '0 8px 24px rgba(26,39,68,0.08)' : '0 1px 4px rgba(15,23,42,0.03)',
        transform: hov ? 'translateX(4px)' : 'translateX(0)',
        transition: 'all 0.22s cubic-bezier(0.34,1.1,0.64,1)',
        animation: 'rowIn 0.4s ease both', animationDelay: `${200 + index * 50}ms`,
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: ELEVATED, border: `1.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: NAVY, flexShrink: 0 }}>
        {job.company_name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</h3>
          {job.growth_outlook === 'high' && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#059669', background: 'rgba(16,185,129,0.08)', padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.15)' }}>↑ High</span>}
        </div>
        <p style={{ fontSize: 11, color: MUTED }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{job.match_score}%</p>
          <p style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>match</p>
        </div>
        {formatSalary(job.salary_min, job.salary_max) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: INK_SFT, background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '3px 8px' }}>
            ₹{formatSalary(job.salary_min, job.salary_max)} LPA
          </span>
        )}
        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
          <button onClick={onPrepare} disabled={isPreparing} aria-label={job.is_prepared ? 'Remove from prep list' : 'Add to prep list'} style={{ height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'white', border: `1.5px solid ${BORDER}`, color: NAVY, display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s' }}>
            {isPreparing ? <div style={{ width: 9, height: 9, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><BookOpen size={9} />{job.is_prepared ? 'Saved' : 'Prep'}</>}
          </button>
          <button onClick={isApplied ? undefined : onApply} disabled={isApplied} aria-label={isApplied ? 'Already applied' : 'Apply to this job'} style={{ height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer', background: isApplied ? 'rgba(16,185,129,0.1)' : NAVY, color: isApplied ? '#059669' : 'white', border: isApplied ? '1.5px solid rgba(16,185,129,0.3)' : 'none', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s' }}>
            {isApplied ? <><CheckCircle2 size={9} /> Applied</> : <><ExternalLink size={9} /> Apply</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── JobModal ───────────────────────────────────────────────────────────────────

export interface JobModalProps {
  job: LiveJob
  onClose: () => void
  onApply: () => void
  onPrepare: () => void
  onGenerateResume: () => void
  onViewRoadmap: () => void
  roadmapStatus?: 'generating' | 'ready' | 'failed'
  isPreparing?: boolean
  isApplied?: boolean
}

export function JobModal({ job, onClose, onApply, onPrepare, onGenerateResume, onViewRoadmap, roadmapStatus, isPreparing, isApplied }: JobModalProps) {
  const ELEVATED = colors.surface.elevated
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(14px)', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 28, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(15,23,42,0.3)', animation: 'popIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both' }}>
        <div style={{ background: NAVY, padding: '24px 24px 20px', borderRadius: '28px 28px 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: -60, right: -50, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'white', border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>{job.company_name.charAt(0)}</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: 'white', marginBottom: 2 }}>{job.title}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close job details" style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}><Target size={10} />{job.match_score}% match</span>
            {job.job_type && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', textTransform: 'capitalize' }}>{job.job_type}</span>}
            {job.growth_outlook === 'high' && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}>↑ High growth</span>}
            {formatSalary(job.salary_min, job.salary_max) && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>₹{formatSalary(job.salary_min, job.salary_max)} LPA</span>}
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {(job.skills_you_have.length > 0 || job.skills_to_develop.length > 0) && (
            <div style={{ background: CREAM, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={10} />Skill gap</p>
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
          {job.description && <div><p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>About this role</p><p style={{ fontSize: 14, color: INK_SFT, lineHeight: 1.8 }}>{job.description}</p></div>}
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: MUTED, paddingTop: 4, borderTop: `1px solid ${BORDER}` }}>
            <span>Posted {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {job.expires_at && <span style={{ color: new Date(job.expires_at) < new Date() ? '#DC2626' : MUTED }}>{new Date(job.expires_at) < new Date() ? '⚠ Expired' : `Closes ${new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</span>}
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={roadmapStatus ? onViewRoadmap : onGenerateResume} style={{ width: '100%', height: 46, borderRadius: 13, background: roadmapStatus === 'ready' ? '#16A34A' : NAVY, color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 18px rgba(26,39,68,0.25)', transition: 'all 0.2s' }}>
            <Map size={15} /> {roadmapStatus === 'ready' ? 'View your roadmap' : roadmapStatus === 'generating' ? 'View generation progress' : 'Generate roadmap for this job'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onPrepare} disabled={isPreparing} aria-label={job.is_prepared ? 'Remove from prep list' : 'Add to prep list'} style={{ flex: 1, height: 42, borderRadius: 13, border: `1.5px solid ${BORDER}`, background: job.is_prepared ? ELEVATED : 'white', color: INK, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
              {isPreparing ? <div style={{ width: 14, height: 14, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><BookOpen size={13} />{job.is_prepared ? '✓ In prep list' : 'Add to prep list'}</>}
            </button>
            <button onClick={isApplied ? undefined : onApply} disabled={isApplied} aria-label={isApplied ? 'Already applied' : 'Apply now'} style={{ flex: 1, height: 42, borderRadius: 13, background: isApplied ? 'rgba(16,185,129,0.08)' : NAVY, color: isApplied ? '#059669' : 'white', border: isApplied ? '1.5px solid rgba(16,185,129,0.25)' : 'none', fontSize: 13, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
              {isApplied ? <><CheckCircle2 size={13} /> Applied</> : <><ExternalLink size={13} /> Apply now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
