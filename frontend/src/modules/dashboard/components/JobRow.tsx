import { useState } from 'react'
import { BookOpen, CheckCircle2, ArrowUpRight } from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import { tokens } from '@/design-system'

// Extracted from DashboardPage.tsx (audit L-07/Sprint 6: split the
// god-component). Same markup, same palette values.
const NAVY     = tokens.color.brand.navy
const INK      = tokens.color.brand.ink
const INK_SFT  = '#475569'
const CREAM    = tokens.color.surface.bg
const CREAM_DK = tokens.color.surface.elevated
const MUTED    = tokens.color.brand.muted
const BORDER   = tokens.color.brand.border

export default function JobRow({ job, index, onOpen, onApply, onPrepare, isPreparing, isApplied }: {
  job: LiveJob; index: number; onOpen: () => void; onApply: () => void; onPrepare: () => void; isPreparing?: boolean; isApplied?: boolean
}) {
  const [hov, setHov] = useState(false)
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
      <div style={{ width: 36, height: 36, borderRadius: 10, background: CREAM_DK, border: `1.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: NAVY, flexShrink: 0 }}>
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
          <button onClick={onPrepare} disabled={isPreparing} style={{ height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'white', border: `1.5px solid ${BORDER}`, color: NAVY, display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s' }}>
            {isPreparing ? <div style={{ width: 9, height: 9, border: `2px solid ${NAVY}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><BookOpen size={9} />{job.is_prepared ? 'Saved' : 'Prep'}</>}
          </button>
          <button onClick={isApplied ? undefined : onApply} disabled={isApplied} style={{ height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer', background: isApplied ? 'rgba(16,185,129,0.1)' : NAVY, color: isApplied ? '#059669' : 'white', border: isApplied ? '1.5px solid rgba(16,185,129,0.3)' : 'none', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s' }}>
            {isApplied ? <><CheckCircle2 size={9} /> Applied</> : <><ArrowUpRight size={9} /> Apply</>}
          </button>
        </div>
      </div>
    </div>
  )
}
