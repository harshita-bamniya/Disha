import { useEffect, useState } from 'react'
import {
  CheckCircle2, X, ExternalLink, ListChecks,
} from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { krsApi } from '@/api/krs'

interface Props {
  job: LiveJob
  kScore: number
  onClose: () => void
  /** Pass undefined to hide Remove button (e.g. when opened from dashboard) */
  onRemove?: () => void
  onApply: () => void
}

export default function JobAnalysisDrawer({ job, kScore, onClose, onRemove, onApply }: Props) {
  const haveCount = job.skills_you_have.length
  const gapCount  = job.skills_to_develop.length
  const total     = job.required_skills.length
  const readyPct  = total > 0 ? Math.round((haveCount / total) * 100) : 0

  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [aiError, setAiError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setAiLoading(true)
    setAiError(false)
    setAiSummary(null)
    krsApi.getJobFitAnalysis({
      job_title: job.title,
      company_name: job.company_name,
      description: job.description,
      required_skills: job.required_skills,
      skills_you_have: job.skills_you_have,
      skills_to_develop: job.skills_to_develop,
      min_k_score: job.min_k_score,
      k_score: kScore,
    })
      .then(res => { if (!cancelled) setAiSummary(res.summary) })
      .catch(() => { if (!cancelled) setAiError(true) })
      .finally(() => { if (!cancelled) setAiLoading(false) })
    return () => { cancelled = true }
  }, [job.id])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 18,
        width: '100%', maxWidth: 800, maxHeight: '90vh',
        boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #818CF8, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 16,
            }}>{job.company_name.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                {job.title}
              </p>
              <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '3px 0 0' }}>
                at <strong style={{ color: '#4B5563' }}>{job.company_name}</strong>
              </p>
            </div>
          </div>

          {/* Match ring */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <svg width={56} height={56} viewBox="0 0 56 56">
              <circle cx={28} cy={28} r={23} fill="none" stroke="#F1F5F9" strokeWidth={5} />
              <circle cx={28} cy={28} r={23} fill="none" stroke="#6366F1" strokeWidth={5}
                strokeDasharray={`${2 * Math.PI * 23}`}
                strokeDashoffset={`${2 * Math.PI * 23 * (1 - readyPct / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text x={28} y={32} textAnchor="middle" fill="#111827" fontSize={12} fontWeight={700}>{readyPct}%</text>
            </svg>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Why you fit / don't fit — AI-generated */}
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
              color: readyPct >= 70 ? '#16A34A' : readyPct >= 40 ? '#D97706' : '#DC2626',
            }}>
              {readyPct >= 70 ? 'Why this role fits you' : readyPct >= 40 ? 'You have a partial fit' : 'Why this role is a stretch right now'}
            </p>
            {aiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 12, width: '100%', background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.3s ease-in-out infinite' }} />
                <div style={{ height: 12, width: '92%', background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.3s ease-in-out infinite' }} />
                <div style={{ height: 12, width: '70%', background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.3s ease-in-out infinite' }} />
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.7, margin: 0 }}>
                {aiSummary ?? (aiError
                  ? `You have ${haveCount} of the ${total} required skills (${readyPct}% ready). Couldn't generate a detailed analysis right now — please try again in a moment.`
                  : '')}
              </p>
            )}
          </div>

          {/* Required skills */}
          <div style={{ paddingTop: 18, borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ListChecks size={14} color="#6366F1" />
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', margin: 0 }}>Skills this role asks for ({total})</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.required_skills.map(sk => {
                const has = job.skills_you_have.includes(sk)
                return (
                  <span key={sk} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: has ? '#ECFDF5' : '#F0F4FF',
                    color: has ? '#059669' : '#4F46E5',
                  }}>{has ? '✓ ' : '+ '}{sk}</span>
                )
              })}
            </div>
          </div>

          {/* Two-column: have / missing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, paddingTop: 18, borderTop: '1px solid #F1F5F9' }}>
            {/* Skills you have */}
            <div style={{ paddingRight: 20, borderRight: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <CheckCircle2 size={14} color="#16A34A" />
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', margin: 0 }}>Skills you have</p>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#16A34A' }}>{haveCount}/{total}</span>
              </div>
              {job.skills_you_have.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>None of the required skills yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {job.skills_you_have.map(sk => (
                    <span key={sk} style={{ padding: '3px 9px', background: '#ECFDF5', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#059669' }}>✓ {sk}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Skills you don't have */}
            <div style={{ paddingLeft: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <X size={14} color="#6366F1" />
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', margin: 0 }}>Skills you don't have</p>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#4F46E5' }}>{gapCount}/{total}</span>
              </div>
              {job.skills_to_develop.length === 0 ? (
                <div style={{ padding: '8px 0' }}>
                  <CheckCircle2 size={22} color="#16A34A" style={{ marginBottom: 6 }} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', margin: 0 }}>You have all required skills!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {job.skills_to_develop.map(sk => (
                    <span key={sk} style={{ padding: '4px 10px', background: '#F0F4FF', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#4F46E5' }}>+ {sk}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px 32px 20px', display: 'flex', gap: 10, flexShrink: 0 }}>
          {onRemove && (
            <button onClick={onRemove} style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', borderRadius: 11,
              border: '1.5px solid #E2E8F0', background: 'white', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#6B7280' }}
            ><X size={13} /> Remove</button>
          )}
          <button onClick={onClose} style={{
            height: 42, padding: '0 18px', borderRadius: 11,
            border: '1.5px solid #E2E8F0', background: 'white', fontSize: 13, fontWeight: 600, color: '#6B7280', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC' }}
            onMouseOut={e => { e.currentTarget.style.background = 'white' }}
          >Cancel</button>
          <button onClick={onApply} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            height: 42, borderRadius: 11,
            background: 'white', border: '1.5px solid #BFDBFE',
            fontSize: 13, fontWeight: 700, color: '#2563EB', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.08)', transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)' }}
          ><ExternalLink size={13} /> Apply Now</button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}
