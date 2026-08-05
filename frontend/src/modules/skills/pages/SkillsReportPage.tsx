import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Zap, Brain, Target, TrendingUp, CheckCircle2, AlertCircle, ArrowUpRight, Shield, BarChart3, ClipboardList } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { useKrsDashboard, useRecompute } from '@/modules/dashboard/hooks/useKrs'
import { useOnboardingStatus } from '@/modules/onboarding/hooks/useOnboarding'

function useCountUp(target: number, duration = 1200, run = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!run) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / duration)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p >= 1) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [target, duration, run])
  return val
}

// ── Radar Chart ───────────────────────────────────────────────────────────────
function RadarChart({ scores }: { scores: { label: string; value: number; color: string }[] }) {
  const size = 200; const cx = size / 2; const cy = size / 2; const maxR = 72
  const n = scores.length
  const levels = [25, 50, 75, 100]
  const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pointAt = (i: number, r: number) => ({ x: cx + r * Math.cos(angleOf(i)), y: cy + r * Math.sin(angleOf(i)) })
  const toPolyPoints = (vals: number[]) =>
    vals.map((v, i) => { const p = pointAt(i, (v / 100) * maxR); return `${p.x},${p.y}` }).join(' ')
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {levels.map(l => (
        <polygon key={l}
          points={Array.from({ length: n }, (_, i) => { const p = pointAt(i, (l / 100) * maxR); return `${p.x},${p.y}` }).join(' ')}
          fill="none" stroke="#E2E8F0" strokeWidth={1}
        />
      ))}
      {scores.map((_, i) => { const p = pointAt(i, maxR); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E2E8F0" strokeWidth={1} /> })}
      <polygon points={toPolyPoints(scores.map(s => s.value))} fill="rgba(99,102,241,0.12)" stroke="#6366F1" strokeWidth={1.5} strokeLinejoin="round" />
      {scores.map((s, i) => {
        const p = pointAt(i, (s.value / 100) * maxR)
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill="#6366F1" />
      })}
      {scores.map((s, i) => {
        const p = pointAt(i, maxR + 20)
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }}>{s.label}</text>
      })}
    </svg>
  )
}

// ── Composite ring ────────────────────────────────────────────────────────────
function CompositeRing({ value, run }: { value: number; run: boolean }) {
  const [dash, setDash] = useState(0)
  const counted = useCountUp(value, 1400, run)
  const size = 148; const r = 60; const circ = 2 * Math.PI * r
  useEffect(() => {
    if (!run) return
    const t = setTimeout(() => setDash((value / 100) * circ), 200)
    return () => clearTimeout(t)
  }, [run, value, circ])
  const label = value >= 70 ? 'Strong' : value >= 40 ? 'Developing' : 'Early Stage'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={9} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#6366F1" strokeWidth={9}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.34,1.1,0.64,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{counted > 0 ? counted : value}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginTop: 2 }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', background: '#EEF2FF', padding: '3px 14px', borderRadius: 20 }}>
        {label}
      </span>
    </div>
  )
}

// ── KRS score bar ─────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color, icon, desc, run }: {
  label: string; value: number; color: string; icon: React.ReactNode; desc: string; run: boolean
}) {
  const [barW, setBarW] = useState('0%')
  const counted = useCountUp(value, 1200, run)
  useEffect(() => {
    if (!run) return
    const t = setTimeout(() => setBarW(`${value}%`), 120)
    return () => clearTimeout(t)
  }, [run, value])
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid rgba(37,99,235,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{label}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>{desc}</p>
          </div>
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>{counted > 0 ? counted : value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 5, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: barW, background: color, borderRadius: 5, transition: 'width 1.4s cubic-bezier(0.34,1.1,0.64,1)' }} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SkillsReportPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useKrsDashboard()
  const recompute = useRecompute()
  const { data: onboarding } = useOnboardingStatus()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (data) { const t = setTimeout(() => setReady(true), 150); return () => clearTimeout(t) }
  }, [data])

  const composite = data ? Math.round((data.krs.k_score + data.krs.r_score + data.krs.s_score) / 3) : 0
  const onboardingIncomplete = onboarding && !onboarding.is_completed && (onboarding.current_step ?? 1) < 6
  const nextOnboardingStep = onboarding?.current_step ?? 2

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', display: 'flex' }}>
      <AppSidebar activePath="/app/skills/report" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid rgba(37,99,235,0.08)',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={14} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Skill Intelligence Report</span>
          </div>
          <button
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 9, background: 'none', border: 'none',
              color: '#6366F1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} className={recompute.isPending ? 'animate-spin' : ''} />
            {recompute.isPending ? 'Recomputing…' : 'Recompute'}
          </button>
        </header>

        <main style={{ padding: '28px', flex: 1, background: '#FAFBFD' }}>

          {/* Onboarding incomplete empty state */}
          {onboardingIncomplete && !isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
              <div style={{
                background: 'white', border: '1px solid #E5E9F2', borderRadius: 20,
                padding: '48px 40px', maxWidth: 440, textAlign: 'center',
                boxShadow: '0 10px 30px rgba(15,23,42,0.07)',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                }}>
                  <ClipboardList size={28} color="#6366F1" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                  Complete your profile to unlock your KRS score
                </h2>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 28 }}>
                  Your Skill Intelligence Report is generated from your education, work experience, and skills. Finish setting up your profile to see your personalised score.
                </p>
                <button
                  onClick={() => navigate(`/app/onboarding/step/${nextOnboardingStep}`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '11px 24px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                    color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Continue profile setup
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          )}

          {!onboardingIncomplete && isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {!onboardingIncomplete && error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '14px 18px', color: '#DC2626', fontSize: 14 }}>
              Could not load your skill report. Please refresh.
            </div>
          )}

          {!onboardingIncomplete && data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900, margin: '0 auto' }}>

              {/* ── HERO ── */}
              <div style={{
                background: 'white', border: '1px solid #E5E9F2', borderRadius: 20, padding: '26px 28px',
                boxShadow: '0 10px 30px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 28 }}>
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: '#6366F1', letterSpacing: '0.4px', marginBottom: 8 }}>KRS INTELLIGENCE SCORE</p>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      {data.full_name?.split(' ')[0] ?? 'Your'}'s Skill Profile
                    </h2>
                    <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>
                      {data.skills.length} verified skills extracted from your profile
                    </p>
                    <CompositeRing value={composite} run={ready} />
                  </div>

                  <div style={{ background: '#F8FAFC', borderRadius: 16, padding: '18px 22px', border: '1px solid #EEF1F6' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14, textAlign: 'center' }}>Skill Radar</p>
                    <RadarChart scores={[
                      { label: 'Knowledge', value: data.krs.k_score, color: '#374151' },
                      { label: 'Readiness', value: data.krs.r_score, color: '#374151' },
                      { label: 'Skills',    value: data.krs.s_score,  color: '#374151' },
                      { label: 'Coverage',  value: Math.min(100, data.skills.length * 10), color: '#374151' },
                    ]} />
                  </div>
                </div>

                {/* Stats strip */}
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(37,99,235,0.08)', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Composite Score', value: `${composite}`, sub: composite >= 70 ? 'Strong' : composite >= 40 ? 'Developing' : 'Early Stage' },
                    { label: 'Skills Verified', value: `${data.skills.length}`, sub: 'extracted from profile' },
                    { label: 'Profile', value: data.profile_complete ? 'Complete' : 'Incomplete', sub: data.profile_complete ? 'All sections filled' : 'Action needed' },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 0' }}>{s.label} · {s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── KRS BREAKDOWN ── */}
              <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1px solid #E5E9F2', boxShadow: '0 6px 18px rgba(15,23,42,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>KRS Breakdown</span>
                  <span style={{ fontSize: 11.5, color: '#9CA3AF', marginLeft: 4 }}>Knowledge · Readiness · Skills</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ScoreBar label="Knowledge (K)" value={data.krs.k_score} color="#2563EB" run={ready} icon={<Brain size={15} />} desc="Breadth & depth of UPSC subjects mastered" />
                  <ScoreBar label="Readiness (R)" value={data.krs.r_score} color="#7C3AED" run={ready} icon={<Target size={15} />} desc="Psychological readiness for private sector" />
                  <ScoreBar label="Skills (S)"    value={data.krs.s_score} color="#059669" run={ready} icon={<Zap size={15} />}   desc="How well UPSC skills map to corporate roles" />
                </div>
              </div>

              {/* ── SKILLS GRID ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Verified skills */}
                <div style={{ background: 'white', borderRadius: 18, padding: '20px', border: '1px solid #E5E9F2', boxShadow: '0 6px 18px rgba(15,23,42,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(5,150,105,0.08)', border: '1.5px solid rgba(5,150,105,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={14} color="#059669" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Verified Skills</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.07)', padding: '2px 9px', borderRadius: 20, border: '1px solid rgba(5,150,105,0.15)' }}>
                      {data.skills.length}
                    </span>
                  </div>
                  {data.skills.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8', padding: '16px 0', textAlign: 'center' }}>Complete your profile to extract skills</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {data.skills.map(sk => (
                        <span key={sk} style={{ padding: '5px 12px', background: '#F8FAFC', border: '1px solid rgba(37,99,235,0.08)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#374151' }}>
                          ✓ {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skills to develop */}
                <div style={{ background: 'white', borderRadius: 18, padding: '20px', border: '1px solid #E5E9F2', boxShadow: '0 6px 18px rgba(15,23,42,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(217,119,6,0.08)', border: '1.5px solid rgba(217,119,6,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={14} color="#D97706" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Skills to Develop</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.07)', padding: '2px 9px', borderRadius: 20, border: '1px solid rgba(217,119,6,0.15)' }}>
                      {data.missing_skills.length} gaps
                    </span>
                  </div>
                  {data.missing_skills.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8', padding: '16px 0', textAlign: 'center' }}>No skill gaps detected — great work!</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {data.missing_skills.map(sk => (
                        <span key={sk} style={{ padding: '5px 12px', background: '#F8FAFC', border: '1px solid rgba(37,99,235,0.08)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#374151' }}>
                          + {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── INSIGHT CARDS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  {
                    icon: <Shield size={15} />, iconBg: '#6366F1',
                    title: 'Profile Completeness',
                    body: data.profile_complete
                      ? 'Your profile is fully complete. This gives you the most accurate KRS score.'
                      : 'Complete your profile to improve your KRS score and unlock better matches.',
                    badge: data.profile_complete ? 'Complete' : 'Incomplete',
                    badgeColor: data.profile_complete ? '#059669' : '#D97706',
                    cta: data.profile_complete ? null : { label: 'Complete Profile', path: '/app/profile' },
                  },
                  {
                    icon: <Zap size={15} />, iconBg: '#6366F1',
                    title: 'Skill Transferability',
                    body: data.krs.s_score >= 60
                      ? `Your ${data.skills.length} skills show strong transferability to private sector roles.`
                      : 'Add more skills from your UPSC preparation to improve your transferability score.',
                    badge: `S-Score: ${data.krs.s_score}`,
                    badgeColor: data.krs.s_score >= 60 ? '#059669' : '#D97706',
                    cta: null,
                  },
                  {
                    icon: <Brain size={15} />, iconBg: '#6366F1',
                    title: 'Readiness Index',
                    body: data.krs.r_score >= 60
                      ? 'Strong psychological readiness for private sector transition.'
                      : 'Complete the mindset assessment to improve your Readiness score.',
                    badge: `R-Score: ${data.krs.r_score}`,
                    badgeColor: data.krs.r_score >= 60 ? '#059669' : '#D97706',
                    cta: data.krs.r_score < 60 ? { label: 'Take Assessment', path: '/app/profile' } : null,
                  },
                ].map((card, i) => (
                  <div key={i} style={{
                    background: 'white', borderRadius: 16, padding: '18px',
                    border: '1px solid #E5E9F2', boxShadow: '0 6px 18px rgba(15,23,42,0.05)',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    animation: `cardIn 0.5s ease both`, animationDelay: `${i * 80}ms`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        {card.icon}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: card.badgeColor, background: `${card.badgeColor}10`, padding: '3px 9px', borderRadius: 20, border: `1px solid ${card.badgeColor}22` }}>
                        {card.badge}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>{card.title}</p>
                      <p style={{ fontSize: 12, color: '#4A453D', lineHeight: 1.7 }}>{card.body}</p>
                    </div>
                    {card.cta && (
                      <button onClick={() => navigate(card.cta!.path)} style={{
                        marginTop: 'auto', height: 34, borderRadius: 9, border: 'none',
                        background: '#2563EB', color: 'white',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        transition: 'all 0.2s',
                      }}
                        onMouseOver={e => { e.currentTarget.style.background = '#1D4ED8' }}
                        onMouseOut={e => { e.currentTarget.style.background = '#2563EB' }}
                      >
                        {card.cta.label} <ArrowUpRight size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Incomplete profile CTA ── */}
              {!data.profile_complete && (
                <div style={{
                  background: 'white', borderRadius: 16, padding: '18px 22px',
                  border: '1px solid #E5E9F2', boxShadow: '0 6px 18px rgba(15,23,42,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertCircle size={18} color="#D97706" />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>Complete your profile for a higher KRS score</p>
                      <p style={{ fontSize: 12, color: '#64748B' }}>Each section improves skill extraction accuracy and unlocks better matches.</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/app/profile')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                    borderRadius: 11, background: '#3B82F6', border: 'none',
                    color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    Complete Profile <ArrowUpRight size={12} />
                  </button>
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cardIn    { from { opacity:0; transform:translateY(14px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>
    </div>
  )
}
