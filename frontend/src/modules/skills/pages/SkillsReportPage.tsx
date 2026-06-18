import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Zap, Brain, Target, TrendingUp, CheckCircle2, AlertCircle, ArrowUpRight, Sparkles, Shield, BarChart3 } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { useKrsDashboard, useRecompute } from '@/modules/dashboard/hooks/useKrs'

function useCountUp(target: number, duration = 1200, run = false) {
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
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1}
        />
      ))}
      {scores.map((_, i) => { const p = pointAt(i, maxR); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} /> })}
      <polygon points={toPolyPoints(scores.map(s => s.value))} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeLinejoin="round" />
      {scores.map((s, i) => {
        const p = pointAt(i, (s.value / 100) * maxR)
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill="white" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }} />
      })}
      {scores.map((s, i) => {
        const p = pointAt(i, maxR + 20)
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.75)', fontFamily: 'Hind, sans-serif' }}>{s.label}</text>
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
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={9} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth={9}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.34,1.1,0.64,1)', filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.5))' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 36, fontWeight: 900, color: 'white', lineHeight: 1 }}>{run ? counted : value}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: 'rgba(255,255,255,0.15)', padding: '3px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)' }}>
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
    <div style={{ background: 'white', borderRadius: 16, padding: '16px 20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}10`, border: `1.5px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{label}</p>
            <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{desc}</p>
          </div>
        </div>
        <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 28, fontWeight: 900, color }}>{run ? counted : value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 7, background: `${color}10`, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: barW, background: `linear-gradient(90deg, ${color}bb, ${color})`, borderRadius: 7, transition: 'width 1.4s cubic-bezier(0.34,1.1,0.64,1)', boxShadow: `0 0 8px ${color}44` }} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SkillsReportPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useKrsDashboard()
  const recompute = useRecompute()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (data) { const t = setTimeout(() => setReady(true), 150); return () => clearTimeout(t) }
  }, [data])

  const composite = data ? Math.round((data.krs.k_score + data.krs.r_score + data.krs.s_score) / 3) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)', display: 'flex' }}>
      <AppSidebar activePath="/app/skills/report" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={13} color="white" />
            </div>
            <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Skill Intelligence Report</span>
          </div>
          <button
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 9, background: 'white', border: '1.5px solid #E2E8F0',
              color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#15130F'; e.currentTarget.style.color = '#15130F' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#374151' }}
          >
            <RefreshCw size={12} className={recompute.isPending ? 'animate-spin' : ''} />
            {recompute.isPending ? 'Recomputing…' : 'Recompute'}
          </button>
        </header>

        <main style={{ padding: '28px', flex: 1 }}>
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 34, height: 34, border: '3px solid rgba(21,19,15,0.15)', borderTopColor: '#15130F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '14px 18px', color: '#DC2626', fontSize: 14 }}>
              Could not load your skill report. Please refresh.
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900, margin: '0 auto' }}>

              {/* ── HERO ── */}
              <div style={{
                background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)',
                borderRadius: 26, overflow: 'hidden', position: 'relative',
                boxShadow: '0 8px 32px rgba(21,19,15,0.2)',
                animation: 'slideDown 0.5s cubic-bezier(0.34,1.1,0.64,1) both',
              }}>
                <div style={{ position: 'absolute', width: 360, height: 360, top: -130, right: -80, background: '#3B82F6', borderRadius: '50%', filter: 'blur(90px)', opacity: 0.2, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', width: 220, height: 220, bottom: -70, left: '35%', background: '#6366F1', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.18, pointerEvents: 'none' }} />

                <div style={{ padding: '32px 36px', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 28 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
                      <Sparkles size={11} color="rgba(255,255,255,0.8)" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.4px' }}>KRS Intelligence Score</span>
                    </div>
                    <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: '-0.5px', marginBottom: 6 }}>
                      {data.full_name?.split(' ')[0] ?? 'Your'}'s Skill Profile
                    </h2>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontWeight: 500 }}>
                      {data.skills.length} verified skills extracted from your profile
                    </p>
                    <CompositeRing value={composite} run={ready} />
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: '18px 22px', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14, textAlign: 'center' }}>Skill Radar</p>
                    <RadarChart scores={[
                      { label: 'Knowledge', value: data.krs.k_score, color: 'white' },
                      { label: 'Readiness', value: data.krs.r_score, color: 'white' },
                      { label: 'Skills',    value: data.krs.s_score,  color: 'white' },
                      { label: 'Coverage',  value: Math.min(100, data.skills.length * 10), color: 'white' },
                    ]} />
                  </div>
                </div>

                {/* Stats strip */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 36px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Composite Score', value: `${composite}`, sub: composite >= 70 ? 'Strong' : composite >= 40 ? 'Developing' : 'Early Stage' },
                    { label: 'Skills Verified', value: `${data.skills.length}`, sub: 'extracted from profile' },
                    { label: 'Profile', value: data.profile_complete ? 'Complete' : 'Incomplete', sub: data.profile_complete ? 'All sections filled' : 'Action needed' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 900, color: 'white' }}>{s.value}</span>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{s.label}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── KRS BREAKDOWN ── */}
              <div style={{ background: 'white', borderRadius: 22, padding: '22px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #3B82F6, #15130F)', borderRadius: 4 }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>KRS Breakdown</span>
                  <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>Knowledge · Readiness · Skills</span>
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
                <div style={{ background: 'white', borderRadius: 20, padding: '20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
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
                        <span key={sk} style={{ padding: '5px 12px', background: '#FAF7F1', border: '1px solid #F1EAE0', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#15130F' }}>
                          ✓ {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skills to develop */}
                <div style={{ background: 'white', borderRadius: 20, padding: '20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
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
                        <span key={sk} style={{ padding: '5px 12px', background: '#FAF7F1', border: '1px solid #F1EAE0', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#15130F' }}>
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
                    icon: <Shield size={15} />, iconBg: '#15130F',
                    title: 'Profile Completeness',
                    body: data.profile_complete
                      ? 'Your profile is fully complete. This gives you the most accurate KRS score.'
                      : 'Complete your profile to improve your KRS score and unlock better matches.',
                    badge: data.profile_complete ? 'Complete' : 'Incomplete',
                    badgeColor: data.profile_complete ? '#059669' : '#D97706',
                    cta: data.profile_complete ? null : { label: 'Complete Profile', path: '/app/profile' },
                  },
                  {
                    icon: <Zap size={15} />, iconBg: '#15130F',
                    title: 'Skill Transferability',
                    body: data.krs.s_score >= 60
                      ? `Your ${data.skills.length} skills show strong transferability to private sector roles.`
                      : 'Add more skills from your UPSC preparation to improve your transferability score.',
                    badge: `S-Score: ${data.krs.s_score}`,
                    badgeColor: data.krs.s_score >= 60 ? '#059669' : '#D97706',
                    cta: null,
                  },
                  {
                    icon: <Brain size={15} />, iconBg: '#15130F',
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
                    background: '#FAF7F1', borderRadius: 18, padding: '18px',
                    border: '1.5px solid #F1EAE0',
                    boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
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
                        background: '#15130F', color: 'white',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        transition: 'all 0.2s',
                      }}
                        onMouseOver={e => { e.currentTarget.style.background = '#2B2722' }}
                        onMouseOut={e => { e.currentTarget.style.background = '#15130F' }}
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
                  background: 'white', borderRadius: 18, padding: '18px 22px',
                  border: '1.5px solid rgba(226,232,240,0.8)',
                  boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
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
                    boxShadow: '0 4px 14px rgba(59,130,246,0.3)', whiteSpace: 'nowrap',
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
