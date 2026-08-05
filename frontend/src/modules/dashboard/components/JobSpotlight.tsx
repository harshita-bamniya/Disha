import { useState } from 'react'
import { MapPin, CheckCircle2, FileText, Map, Mic, ArrowUpRight } from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import { tokens } from '@/design-system'

// Extracted from DashboardPage.tsx (audit L-07/Sprint 6: split the
// god-component). Same markup, same palette values.
const NAVY     = tokens.color.brand.navy
const NAVY_SFT = '#243359'
const INK      = tokens.color.brand.ink
const INK_SFT  = '#475569'
const CREAM    = tokens.color.surface.bg
const CREAM_DK = tokens.color.surface.elevated
const MUTED    = tokens.color.brand.muted
const BORDER   = tokens.color.brand.border

export default function JobSpotlight({ job, onOpen, onApply, onPrepare, onGenerateResume, onViewRoadmap,
  roadmapStatus, onMockInterview, onOpenResume, isPreparing, isApplied, isTailoringResume }: {
  job: LiveJob; onOpen: () => void; onApply: () => void; onPrepare: () => void
  onGenerateResume: () => void; onViewRoadmap: () => void
  roadmapStatus?: 'generating' | 'ready' | 'failed'
  onMockInterview: () => void; onOpenResume: () => void
  isPreparing?: boolean; isApplied?: boolean; isTailoringResume?: boolean
}) {
  const salary = formatSalary(job.salary_min, job.salary_max)
  const [hov, setHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'white', borderRadius: tokens.radius.xl, overflow: 'hidden',
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
            <div style={{ width: 40, height: 40, borderRadius: 11, background: CREAM_DK, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: NAVY, flexShrink: 0 }}>
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
            <div style={{ height: 5, borderRadius: 5, background: CREAM_DK, overflow: 'hidden' }}>
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
              <span key={sk} style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: CREAM_DK, border: `1px solid ${BORDER}`, color: INK }}>{sk}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action cards */}
      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderBottom: `1px solid ${BORDER}` }}>
        <button
          onClick={onOpenResume} disabled={isTailoringResume}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 10, background: 'white', border: `1px solid ${BORDER}`, cursor: isTailoringResume ? 'wait' : 'pointer', textAlign: 'left', opacity: isTailoringResume ? 0.7 : 1, transition: 'all 0.18s', width: '100%' }}
          onMouseOver={e => { e.currentTarget.style.background = CREAM; e.currentTarget.style.borderColor = 'rgba(26,39,68,0.16)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = BORDER }}
        >
          {isTailoringResume
            ? <div style={{ width: 15, height: 15, border: `2px solid ${CREAM_DK}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            : <FileText size={15} color={NAVY} />}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 1px' }}>Resume</p>
            <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>Tailor for this role</p>
          </div>
        </button>

        <button
          onClick={roadmapStatus ? onViewRoadmap : onGenerateResume}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 10, background: roadmapStatus === 'ready' ? 'rgba(22,163,74,0.04)' : 'white', border: roadmapStatus === 'ready' ? '1px solid rgba(22,163,74,0.15)' : `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s', width: '100%' }}
          onMouseOver={e => { if (roadmapStatus !== 'ready') { e.currentTarget.style.background = CREAM; e.currentTarget.style.borderColor = 'rgba(26,39,68,0.16)' } }}
          onMouseOut={e => { if (roadmapStatus !== 'ready') { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = BORDER } }}
        >
          {roadmapStatus === 'ready'
            ? <CheckCircle2 size={15} color="#16A34A" />
            : roadmapStatus === 'generating'
              ? <div style={{ width: 15, height: 15, border: `2px solid ${CREAM_DK}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
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
            onMouseOver={e => { e.currentTarget.style.background = NAVY_SFT; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseOut={e => { e.currentTarget.style.background = NAVY; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <ArrowUpRight size={13} /> Apply now
          </button>
        )}
      </div>
    </div>
  )
}
