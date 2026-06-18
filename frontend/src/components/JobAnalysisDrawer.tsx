import {
  Building2, MapPin, Target, TrendingUp, CheckCircle2,
  X, ExternalLink, Sparkles,
} from 'lucide-react'
import type { LiveJob } from '@/api/krs'
import { formatSalary, EMPLOYMENT_TYPE_LABELS } from '@/api/jobs'
import type { EmploymentType } from '@/api/jobs'

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
  const meetsKScore = kScore >= job.min_k_score

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)',
      animation: 'fadeInBg 0.2s ease both',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 800, maxHeight: '90vh',
        background: '#F8FAFC', borderRadius: 26,
        boxShadow: '0 40px 100px rgba(15,23,42,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'modalIn 0.28s cubic-bezier(0.34,1.1,0.64,1) both',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', padding: '26px 28px 22px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', width: 220, height: 220, top: -80, right: -50, background: '#3B82F6', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.22, pointerEvents: 'none' }} />
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 9,
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 2, transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
          ><X size={14} /></button>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'white' }}>
                {job.company_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1.2, marginBottom: 4 }}>{job.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Building2 size={11} color="rgba(255,255,255,0.5)" />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{job.company_name}</span>
                  {job.location && (<><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><MapPin size={11} color="rgba(255,255,255,0.5)" /><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{job.location}</span></>)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'white' }}>
                <Target size={11} />{job.match_score}% match
              </span>
              {job.employment_type && <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{EMPLOYMENT_TYPE_LABELS[job.employment_type as EmploymentType] ?? job.employment_type}</span>}
              {job.growth_outlook && <span style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{job.growth_outlook} growth ↑</span>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'Match Score', value: `${job.match_score}%`, color: '#15130F' },
              { label: 'Skills Ready', value: `${readyPct}%`, color: '#059669' },
              { label: 'Salary', value: formatSalary(job.salary_min, job.salary_max) ? `₹${formatSalary(job.salary_min, job.salary_max)} LPA` : 'Not listed', color: '#374151' },
              { label: 'Posted', value: new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), color: '#64748B' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                <p style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>{s.label}</p>
                <p style={{ fontFamily: 'Hind, sans-serif', fontSize: 17, fontWeight: 900, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Two-column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Why it fits */}
            <div style={{ background: 'white', borderRadius: 18, padding: '18px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={13} color="white" />
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>Why this role fits you</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Overall match', value: `${job.match_score}%`, color: '#15130F' },
                  { label: 'Skills ready', value: `${job.skill_overlap}%`, color: '#2563EB' },
                ].map((s, i) => (
                  <div key={i} style={{ background: '#FAF7F1', borderRadius: 10, padding: '10px 12px', border: '1px solid #F1EAE0' }}>
                    <p style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{s.label}</p>
                    <p style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
              {job.skills_you_have.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={10} />Your matching skills ({job.skills_you_have.length})
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {job.skills_you_have.map(sk => (
                      <span key={sk} style={{ padding: '3px 9px', background: '#FAF7F1', border: '1px solid #F1EAE0', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#15130F' }}>✓ {sk}</span>
                    ))}
                  </div>
                </div>
              )}
              {job.min_k_score > 0 && (
                <div style={{ background: meetsKScore ? 'rgba(5,150,105,0.06)' : '#FFFBEB', border: `1px solid ${meetsKScore ? 'rgba(5,150,105,0.18)' : '#FDE68A'}`, borderRadius: 10, padding: '10px 12px', fontSize: 11, color: meetsKScore ? '#059669' : '#92400E', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700 }}>UPSC knowledge valued.</span> Min K-score: {job.min_k_score}/100.{' '}
                  {meetsKScore ? <span>Your score of {kScore} meets this ✓</span> : <span>Build to {job.min_k_score} to fully qualify.</span>}
                </div>
              )}
            </div>

            {/* Skills to build */}
            <div style={{ background: 'white', borderRadius: 18, padding: '18px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={13} color="white" />
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>Skills to build</p>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#059669' }}>{readyPct}% ready</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ height: 6, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', width: `${readyPct}%`, background: 'linear-gradient(90deg, #3B82F6, #15130F)', borderRadius: 6, transition: 'width 0.8s ease' }} />
                </div>
                <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{haveCount} of {total} ready · {gapCount} to develop</p>
              </div>
              {job.skills_to_develop.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                  <CheckCircle2 size={26} color="#059669" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>You have all required skills!</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {job.skills_to_develop.map(sk => (
                      <span key={sk} style={{ padding: '4px 10px', background: '#FAF7F1', border: '1px solid #F1EAE0', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#15130F' }}>+ {sk}</span>
                    ))}
                  </div>
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px', fontSize: 10, color: '#92400E', lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 700 }}>Tip:</span> Each skill you add directly improves your match score for this role.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* About this role */}
          {job.description && (
            <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>About this role</p>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{job.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(226,232,240,0.8)', padding: '14px 28px', display: 'flex', gap: 10, background: 'white', flexShrink: 0 }}>
          {onRemove && (
            <button onClick={onRemove} style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px', borderRadius: 11,
              border: '1.5px solid #E2E8F0', background: 'white', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer', transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#6B7280' }}
            ><X size={13} /> Remove</button>
          )}
          <button onClick={onApply} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            height: 42, borderRadius: 11, border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #15130F)',
            fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(21,19,15,0.22)', transition: 'all 0.2s',
          }}
            onMouseOver={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(21,19,15,0.32)' }}
            onMouseOut={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(21,19,15,0.22)' }}
          ><ExternalLink size={13} /> Apply Now</button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInBg { from{opacity:0} to{opacity:1} }
        @keyframes modalIn  { from{opacity:0;transform:scale(0.94) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  )
}
