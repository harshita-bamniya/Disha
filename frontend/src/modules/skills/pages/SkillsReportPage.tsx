import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ArrowUpRight, ChevronRight, Zap, Brain, Target, TrendingUp, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { useKrsDashboard, useRecompute } from '@/modules/dashboard/hooks/useKrs'

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── SVG Radar Chart ───────────────────────────────────────────────────────────
function RadarChart({ scores }: { scores: { label: string; value: number; color: string }[] }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const maxR = 80
  const n = scores.length
  const levels = [25, 50, 75, 100]

  const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2

  const pointAt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy + r * Math.sin(angleOf(i)),
  })

  const toPolyPoints = (vals: number[]) =>
    vals.map((v, i) => {
      const p = pointAt(i, (v / 100) * maxR)
      return `${p.x},${p.y}`
    }).join(' ')

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Grid circles */}
      {levels.map(l => (
        <polygon key={l}
          points={Array.from({ length: n }, (_, i) => {
            const p = pointAt(i, (l / 100) * maxR)
            return `${p.x},${p.y}`
          }).join(' ')}
          fill="none" stroke="rgba(59,130,246,0.1)" strokeWidth={1}
        />
      ))}

      {/* Axes */}
      {scores.map((_, i) => {
        const p = pointAt(i, maxR)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(59,130,246,0.12)" strokeWidth={1} />
      })}

      {/* Data fill */}
      <polygon
        points={toPolyPoints(scores.map(s => s.value))}
        fill="rgba(37,99,235,0.12)"
        stroke="#2563EB"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {scores.map((s, i) => {
        const p = pointAt(i, (s.value / 100) * maxR)
        return (
          <circle key={i} cx={p.x} cy={p.y} r={5}
            fill={s.color} stroke="white" strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 4px ${s.color}88)` }}
          />
        )
      })}

      {/* Labels */}
      {scores.map((s, i) => {
        const p = pointAt(i, maxR + 22)
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 11, fontWeight: 700, fill: '#1E3A5F', fontFamily: 'Hind, sans-serif' }}>
            {s.label}
          </text>
        )
      })}
    </svg>
  )
}

// ── Big score ring ────────────────────────────────────────────────────────────
function CompositeRing({ value, run }: { value: number; run: boolean }) {
  const [dash, setDash] = useState(0)
  const counted = useCountUp(value, 1400, run)
  const size = 160
  const r = 66
  const circ = 2 * Math.PI * r

  useEffect(() => {
    if (!run) return
    const t = setTimeout(() => setDash((value / 100) * circ), 200)
    return () => clearTimeout(t)
  }, [run, value, circ])

  const color = value >= 70 ? '#059669' : value >= 40 ? '#D97706' : '#DC2626'
  const label = value >= 70 ? 'Strong' : value >= 40 ? 'Developing' : 'Early Stage'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(59,130,246,0.1)" strokeWidth={10} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.34,1.1,0.64,1)', filter: `drop-shadow(0 0 10px ${color}66)` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 38, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>
            {run ? counted : value}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginTop: 2 }}>/ 100</span>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, background: `${color}12`, padding: '4px 14px', borderRadius: 20, border: `1px solid ${color}25` }}>
        {label}
      </span>
    </div>
  )
}

// ── Sub-score card ────────────────────────────────────────────────────────────
function SubScoreCard({ label, value, color, icon, desc, run }: {
  label: string; value: number; color: string; icon: React.ReactNode; desc: string; run: boolean
}) {
  const [barW, setBarW] = useState('0%')
  const counted = useCountUp(value, 1200, run)

  useEffect(() => {
    if (!run) return
    const t = setTimeout(() => setBarW(`${value}%`), 100)
    return () => clearTimeout(t)
  }, [run, value])

  return (
    <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}12`, border: `1.5px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{label}</p>
            <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{desc}</p>
          </div>
        </div>
        <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 26, fontWeight: 900, color }}>{run ? counted : value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: `${color}10`, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: barW, background: `linear-gradient(90deg, ${color}cc, ${color})`, borderRadius: 8, transition: 'width 1.4s cubic-bezier(0.34,1.1,0.64,1)', boxShadow: `0 0 8px ${color}44` }} />
      </div>
    </div>
  )
}

// ── Career match card ─────────────────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  'Consulting': '#6366F1', 'Government': '#0EA5E9', 'NGO': '#10B981',
  'Education': '#F59E0B', 'Banking': '#8B5CF6', 'Media': '#EC4899',
  'Healthcare': '#14B8A6', 'IT': '#6366F1', 'Research': '#F97316',
  'Policy': '#0EA5E9', 'ESG': '#10B981', 'EdTech': '#F59E0B',
  'default': '#3B82F6',
}
function sectorColor(sector: string) {
  const key = Object.keys(SECTOR_COLORS).find(k => sector?.includes(k)) ?? 'default'
  return SECTOR_COLORS[key]
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SkillsReportPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useKrsDashboard()
  const recompute = useRecompute()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => setReady(true), 150)
      return () => clearTimeout(t)
    }
  }, [data])

  const composite = data ? Math.round((data.krs.k_score + data.krs.r_score + data.krs.s_score) / 3) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex' }}>
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
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={13} color="white" />
            </div>
            <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Skill Intelligence Report</span>
          </div>
          <button
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 10, background: 'white', border: '1.5px solid #E2E8F0',
              color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#374151' }}
          >
            <RefreshCw size={12} className={recompute.isPending ? 'animate-spin' : ''} />
            {recompute.isPending ? 'Recomputing…' : 'Recompute KRS'}
          </button>
        </header>

        <main style={{ padding: '24px 28px', flex: 1 }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 34, height: 34, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '14px 18px', color: '#DC2626', fontSize: 14 }}>
              Could not load your skill report. Please refresh.
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* ── HERO: Composite score + radar ── */}
              <div style={{
                background: '#DBEAFE', borderRadius: 24, padding: '28px 32px',
                border: '1.5px solid rgba(59,130,246,0.15)',
                boxShadow: '0 4px 32px rgba(59,130,246,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 28, position: 'relative', overflow: 'hidden',
                animation: 'slideDown 0.5s cubic-bezier(0.34,1.1,0.64,1) both',
              }}>
                {/* Aurora blobs */}
                <div style={{ position: 'absolute', width: 300, height: 300, top: -100, right: -50, background: '#93C5FD', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.5, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', width: 200, height: 200, bottom: -80, left: '30%', background: '#A5B4FC', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.4, pointerEvents: 'none' }} />

                {/* Left: name + composite */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
                    <Brain size={11} color="#1D4ED8" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>KRS Intelligence Score</span>
                  </div>
                  <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 28, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 6 }}>
                    {data.full_name?.split(' ')[0] ?? 'Your'}'s Skill Profile
                  </h2>
                  <p style={{ fontSize: 13, color: '#475569', marginBottom: 22, fontWeight: 500 }}>
                    {data.skills.length} verified skills · {data.matches.length} career matches
                  </p>
                  <CompositeRing value={composite} run={ready} />
                </div>

                {/* Right: radar */}
                <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.55)', borderRadius: 20, padding: '16px 20px', border: '1.5px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, textAlign: 'center' }}>Skill Radar</p>
                  <RadarChart scores={[
                    { label: 'Knowledge', value: data.krs.k_score, color: '#2563EB' },
                    { label: 'Readiness', value: data.krs.r_score, color: '#7C3AED' },
                    { label: 'Skills', value: data.krs.s_score, color: '#059669' },
                    { label: 'Coverage', value: Math.min(100, data.skills.length * 10), color: '#D97706' },
                    { label: 'Matches', value: Math.min(100, data.matches.length * 10), color: '#EC4899' },
                  ]} />
                </div>
              </div>

              {/* ── KRS SUB-SCORES ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #2563EB, #7C3AED)', borderRadius: 4 }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>KRS Breakdown</span>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <SubScoreCard
                    label="Knowledge (K)" value={data.krs.k_score} color="#2563EB" run={ready}
                    icon={<Brain size={16} />}
                    desc="Breadth & depth of UPSC subjects mastered"
                  />
                  <SubScoreCard
                    label="Readiness (R)" value={data.krs.r_score} color="#7C3AED" run={ready}
                    icon={<Target size={16} />}
                    desc="Psychological readiness for private sector"
                  />
                  <SubScoreCard
                    label="Skills (S)" value={data.krs.s_score} color="#059669" run={ready}
                    icon={<Zap size={16} />}
                    desc="How well UPSC skills map to corporate roles"
                  />
                </div>
              </div>

              {/* ── YOUR SKILLS + GAPS side by side ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

                {/* Skills you have */}
                <div style={{ background: 'white', borderRadius: 20, padding: '20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <CheckCircle2 size={15} color="#059669" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Your Verified Skills</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.08)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(5,150,105,0.15)' }}>
                      {data.skills.length} skills
                    </span>
                  </div>
                  {data.skills.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8', padding: '20px 0', textAlign: 'center' }}>
                      Complete your profile to extract skills
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {data.skills.map(sk => (
                        <span key={sk} style={{ padding: '5px 12px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#059669' }}>
                          ✓ {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skills to develop */}
                <div style={{ background: 'white', borderRadius: 20, padding: '20px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <TrendingUp size={15} color="#D97706" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Skills to Develop</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#D97706', background: 'rgba(217,119,6,0.08)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(217,119,6,0.15)' }}>
                      {data.missing_skills.length} gaps
                    </span>
                  </div>
                  {data.missing_skills.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8', padding: '20px 0', textAlign: 'center' }}>
                      No skill gaps detected — great work!
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {data.missing_skills.map(sk => (
                        <span key={sk} style={{ padding: '5px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#C2410C' }}>
                          + {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── CAREER MATCHES ── */}
              {data.matches.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #059669, #0EA5E9)', borderRadius: 4 }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Your Career Matches</span>
                    </div>
                    <button onClick={() => navigate('/app/careers/explore')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Explore all <ChevronRight size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.matches.slice(0, 5).map((match, i) => {
                      const c = sectorColor(match.track.sector)
                      return (
                        <div key={match.track.id}
                          onClick={() => navigate(`/app/careers/${match.track.slug}`)}
                          style={{
                            background: 'white', borderRadius: 16, padding: '14px 16px',
                            border: '1.5px solid rgba(226,232,240,0.8)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s',
                            animation: `rowIn 0.4s ease both`, animationDelay: `${i * 60}ms`,
                          }}
                          onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = `${c}30`; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${c}14` }}
                          onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226,232,240,0.8)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                        >
                          {/* Rank */}
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? `linear-gradient(135deg, ${c}, ${c}cc)` : `${c}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: i === 0 ? 'white' : c, flexShrink: 0 }}>
                            {i + 1}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>{match.track.title}</p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>{match.track.sector}</span>
                              {match.track.salary_range && <span style={{ fontSize: 10, color: '#64748B' }}>· {match.track.salary_range}</span>}
                              {match.skills_to_develop.slice(0, 2).map(sk => (
                                <span key={sk} style={{ padding: '1px 7px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#C2410C' }}>+ {sk}</span>
                              ))}
                            </div>
                          </div>

                          {/* Match score */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontFamily: 'Hind, sans-serif', fontSize: 20, fontWeight: 900, color: c, lineHeight: 1 }}>{match.match_score}%</p>
                            <p style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>match</p>
                          </div>

                          <ArrowUpRight size={14} color="#CBD5E1" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── INSIGHT CARDS ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 16, background: 'linear-gradient(180deg, #D97706, #EC4899)', borderRadius: 4 }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Insight Cards</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {[
                    {
                      icon: '🎯',
                      title: 'Profile Completeness',
                      body: data.profile_complete
                        ? 'Your profile is fully complete. This gives you the most accurate KRS score and job matches.'
                        : 'Complete your profile to improve your KRS score and unlock better job matches.',
                      color: data.profile_complete ? '#059669' : '#D97706',
                      badge: data.profile_complete ? 'Complete' : 'Incomplete',
                    },
                    {
                      icon: '⚡',
                      title: 'Skill Transferability',
                      body: data.krs.s_score >= 60
                        ? `Your ${data.skills.length} skills show strong transferability to private sector roles. Employers value your UPSC preparation depth.`
                        : `Adding more skills to your profile will improve your transferability score. Aim to add skills from your UPSC preparation.`,
                      color: '#6366F1',
                      badge: `S-Score: ${data.krs.s_score}`,
                    },
                    {
                      icon: '🧠',
                      title: 'Readiness Index',
                      body: data.krs.r_score >= 60
                        ? 'You show strong psychological readiness for the private sector transition. Your mindset assessment reflects adaptability.'
                        : 'Complete the mindset assessment to improve your Readiness score and get personalised career counselling.',
                      color: '#7C3AED',
                      badge: `R-Score: ${data.krs.r_score}`,
                    },
                  ].map((card, i) => (
                    <div key={i} style={{
                      background: 'white', borderRadius: 18, padding: '18px',
                      border: '1.5px solid rgba(226,232,240,0.8)',
                      boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
                      animation: `cardIn 0.5s ease both`, animationDelay: `${i * 80}ms`,
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{card.title}</p>
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: card.color, background: `${card.color}10`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${card.color}20`, whiteSpace: 'nowrap' }}>
                          {card.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── CTA: Not complete ── */}
              {!data.profile_complete && (
                <div style={{
                  background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                  borderRadius: 20, padding: '20px 24px',
                  border: '1.5px solid rgba(59,130,246,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertCircle size={20} color="#1D4ED8" />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>Complete your profile for a higher KRS score</p>
                      <p style={{ fontSize: 12, color: '#475569' }}>Each completed section improves your skill extraction accuracy and unlocks better job matches.</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/app/profile')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                    borderRadius: 11, background: '#1D4ED8', border: 'none',
                    color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(29,78,216,0.25)', whiteSpace: 'nowrap',
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
        @keyframes spin       { to { transform: rotate(360deg) } }
        @keyframes slideDown  { from { opacity:0; transform:translateY(-14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes rowIn      { from { opacity:0; transform:translateX(-14px) } to { opacity:1; transform:translateX(0) } }
        @keyframes cardIn     { from { opacity:0; transform:translateY(16px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>
    </div>
  )
}
