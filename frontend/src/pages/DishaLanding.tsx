import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  blue:    '#3B82F6',
  blueDk:  '#1D4ED8',
  blueLt:  '#EFF6FF',
  blueXlt: '#F0F7FF',
  sky:     '#93C5FD',
  ink:     '#1E3A5F',
  mid:     '#475569',
  muted:   '#94A3B8',
  white:   '#FFFFFF',
  card:    '#FFFFFF',
  border:  'rgba(59,130,246,0.12)',
}

const KEYFRAMES = `
  @keyframes floatA { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
  @keyframes floatB { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-7px)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
`

// ── Tiny icons ────────────────────────────────────────────────────────────────
const Icon = {
  Menu:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  X:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Arrow:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Star:    () => <svg viewBox="0 0 24 24" fill="#FBBF24" width="13" height="13"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  Check:   () => <svg viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>,
  Play:    () => <svg viewBox="0 0 24 24" fill={C.blue} width="16" height="16"><path d="M5 3l14 9-14 9V3z"/></svg>,
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)',
      backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
      transition: 'all 0.3s',
      boxShadow: scrolled ? '0 1px 12px rgba(59,130,246,0.07)' : 'none',
    }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueDk})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(59,130,246,0.3)',
            }}>
              <span style={{ color: C.white, fontWeight: 800, fontSize: 15 }}>D</span>
            </div>
            <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 18, color: C.ink }}>DISHA AI</span>
          </Link>

          {/* Desktop links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="hidden md:flex">
            {['Features', 'How it works', 'For Employers'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`}
                style={{ fontSize: 14, color: C.mid, textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.color = C.blue}
                onMouseOut={e => e.currentTarget.style.color = C.mid}
              >{l}</a>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="hidden md:flex">
            <Link to="/auth/login" style={{
              padding: '7px 18px', borderRadius: 9, fontSize: 14, fontWeight: 600,
              color: C.blue, textDecoration: 'none', border: `1.5px solid ${C.border}`,
              background: 'transparent', transition: 'all 0.2s',
            }}
              onMouseOver={e => e.currentTarget.style.background = C.blueLt}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >Log in</Link>
            <Link to="/auth/register" style={{
              padding: '7px 20px', borderRadius: 9, fontSize: 14, fontWeight: 700,
              background: C.blue, color: C.white, textDecoration: 'none',
              boxShadow: '0 3px 12px rgba(59,130,246,0.35)', transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.background = C.blueDk; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.transform = 'translateY(0)' }}
            >Get Started</Link>
          </div>

          <button onClick={() => setOpen(!open)} style={{ background:'none', border:'none', cursor:'pointer', color: C.ink, padding: 4 }} className="md:hidden">
            {open ? <Icon.X /> : <Icon.Menu />}
          </button>
        </div>

        {open && (
          <div style={{ background: C.white, borderRadius: 14, padding: 20, marginBottom: 12, boxShadow: '0 8px 32px rgba(59,130,246,0.1)', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }} className="md:hidden">
            {['Features','How it works','For Employers'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} onClick={() => setOpen(false)}
                style={{ fontSize: 14, color: C.mid, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/auth/login" onClick={() => setOpen(false)} style={{ padding: '10px', borderRadius: 9, fontSize: 14, fontWeight: 600, color: C.blue, textDecoration: 'none', border: `1.5px solid ${C.border}`, textAlign: 'center' }}>Log in</Link>
              <Link to="/auth/register" onClick={() => setOpen(false)} style={{ padding: '10px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: C.blue, color: C.white, textDecoration: 'none', textAlign: 'center' }}>Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      background: `linear-gradient(170deg, ${C.blueXlt} 0%, #FFFFFF 55%, ${C.blueLt} 100%)`,
      paddingTop: 80, position: 'relative', overflow: 'hidden',
    }}>
      {/* Soft background blobs */}
      <div style={{ position:'absolute', width: 560, height: 560, borderRadius:'50%', background: 'radial-gradient(circle, rgba(147,197,253,0.18) 0%, transparent 70%)', top:'-100px', right:'-120px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width: 360, height: 360, borderRadius:'50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', bottom:'5%', left:'-60px', pointerEvents:'none' }} />

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '48px 24px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}
          className="lg:grid-cols-2 grid-cols-1">

          {/* Left */}
          <div style={{ animation: 'fadeUp 0.7s ease both' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(59,130,246,0.08)', border: `1px solid rgba(59,130,246,0.2)`,
              borderRadius: 100, padding: '5px 14px', marginBottom: 24,
            }}>
              <span style={{ fontSize: 14 }}>✦</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.blue }}>AI-powered career intelligence for UPSC aspirants</span>
            </div>

            <h1 style={{
              fontFamily: 'Hind, sans-serif',
              fontSize: 'clamp(28px, 3.8vw, 46px)',
              fontWeight: 800, lineHeight: 1.2,
              color: C.ink, marginBottom: 20, letterSpacing: '-0.5px',
            }}>
              Your UPSC journey{' '}
              <span style={{ color: C.blue }}>made you rare.</span>
              <br />Now let it launch your career.
            </h1>

            <p style={{ fontSize: 16, color: C.mid, lineHeight: 1.75, maxWidth: 440, marginBottom: 36 }}>
              DISHA AI matches UPSC aspirants with employers who value analytical depth and governance knowledge — turning years of preparation into a career advantage.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
              <Link to="/auth/register" style={{
                display:'inline-flex', alignItems:'center', gap: 8,
                padding: '12px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: C.blue, color: C.white, textDecoration: 'none',
                boxShadow: '0 4px 18px rgba(59,130,246,0.38)', transition: 'all 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.background = C.blueDk; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseOut={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                Start free profile <Icon.Arrow />
              </Link>
              <Link to="/auth/register/employer" style={{
                display:'inline-flex', alignItems:'center', gap: 7,
                padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${C.border}`, color: C.ink,
                textDecoration: 'none', background: C.white, transition: 'all 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue }}
                onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink }}
              >
                For employers
              </Link>
            </div>

            {/* Social proof */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex' }}>
                  {['#BFDBFE','#DDD6FE','#BBF7D0','#FDE68A'].map((c,i) => (
                    <div key={i} style={{
                      width: 30, height: 30, borderRadius: '50%', background: c,
                      border: '2px solid white', marginLeft: i ? -9 : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#475569',
                    }}>{['A','R','S','P'][i]}</div>
                  ))}
                </div>
                <span style={{ fontSize: 13, color: C.muted }}>
                  Join <strong style={{ color: C.ink }}>2,400+</strong> aspirants
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {[1,2,3,4,5].map(i => <Icon.Star key={i} />)}
                <span style={{ fontSize: 13, color: C.muted, marginLeft: 5 }}>4.9 / 5</span>
              </div>
            </div>
          </div>

          {/* Right — floating cards visual */}
          <div style={{ position:'relative', height: 460, display:'flex', alignItems:'center', justifyContent:'center' }} className="hidden lg:flex">

            {/* Soft center circle */}
            <div style={{ width: 280, height: 280, borderRadius:'50%', background: 'radial-gradient(circle, rgba(147,197,253,0.22) 0%, transparent 70%)', position:'absolute' }} />

            {/* KRS score card */}
            <div style={{
              position:'absolute', top:'6%', left:'4%',
              background: C.white, borderRadius: 18, padding: '16px 20px',
              boxShadow: '0 6px 28px rgba(59,130,246,0.1)', border: `1px solid ${C.border}`,
              minWidth: 160, animation: 'floatA 5s ease-in-out infinite',
            }}>
              <p style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom: 10 }}>KRS Score</p>
              <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
                <div style={{ position:'relative', width: 48, height: 48 }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform:'rotate(-90deg)' }}>
                    <circle cx="24" cy="24" r="19" fill="none" stroke="#EFF6FF" strokeWidth="4.5" />
                    <circle cx="24" cy="24" r="19" fill="none" stroke={C.blue} strokeWidth="4.5" strokeLinecap="round"
                      strokeDasharray={119.4} strokeDashoffset={119.4*0.28} />
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: C.ink }}>72</div>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Strong</p>
                  <p style={{ fontSize: 11, color: C.muted }}>+8 this week</p>
                </div>
              </div>
            </div>

            {/* Job match card */}
            <div style={{
              position:'absolute', top:'14%', right:'0%',
              background: C.white, borderRadius: 18, padding: '16px 18px',
              boxShadow: '0 6px 28px rgba(59,130,246,0.1)', border: `1px solid ${C.border}`,
              minWidth: 200, animation: 'floatB 6s ease-in-out 0.5s infinite',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: C.blueLt, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 16 }}>🎯</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Policy Analyst</p>
                  <p style={{ fontSize: 11, color: C.muted }}>Indicc Associates</p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Match score</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.blue }}>87%</span>
              </div>
              <div style={{ height: 5, borderRadius: 10, background: C.blueLt, overflow:'hidden' }}>
                <div style={{ width:'87%', height:'100%', background: C.blue, borderRadius: 10 }} />
              </div>
            </div>

            {/* Skills card */}
            <div style={{
              position:'absolute', bottom:'20%', left:'0%',
              background: C.white, borderRadius: 18, padding: '14px 18px',
              boxShadow: '0 6px 28px rgba(59,130,246,0.1)', border: `1px solid ${C.border}`,
              minWidth: 190, animation: 'floatA 7s ease-in-out 1s infinite',
            }}>
              <p style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom: 8 }}>Skills matched</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap: 5 }}>
                {['Policy Research','Analysis','Writing'].map(sk => (
                  <span key={sk} style={{ padding:'3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.blueLt, color: C.blue }}>✓ {sk}</span>
                ))}
              </div>
            </div>

            {/* Notification card */}
            <div style={{
              position:'absolute', bottom:'8%', right:'5%',
              background: C.white, borderRadius: 18, padding: '14px 16px',
              boxShadow: '0 6px 28px rgba(59,130,246,0.1)', border: `1px solid ${C.border}`,
              minWidth: 198, animation: 'floatB 5s ease-in-out 0.8s infinite',
            }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14, flexShrink: 0 }}>🎉</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>New job matched!</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Strategy Consultant · Delhi</p>
                  <p style={{ fontSize: 11, color:'#22C55E', fontWeight: 600, marginTop: 3 }}>92% match</p>
                </div>
              </div>
            </div>

            {/* Central phone */}
            <div style={{
              width: 164, height: 300, borderRadius: 26,
              background: `linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 100%)`,
              border: `2px solid ${C.border}`,
              boxShadow: '0 20px 60px rgba(59,130,246,0.18)',
              display:'flex', flexDirection:'column', overflow:'hidden',
              position:'relative',
            }}>
              <div style={{ padding:'16px 14px 8px', borderBottom:`1px solid ${C.border}` }}>
                <p style={{ fontSize: 9, color: C.muted, marginBottom: 1 }}>Good afternoon</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>Arjun 👋</p>
              </div>
              <div style={{ padding:'10px 14px', flex:1, display:'flex', flexDirection:'column', gap: 7 }}>
                <div style={{ background:'rgba(59,130,246,0.07)', borderRadius: 10, padding: 10 }}>
                  <p style={{ fontSize: 8, color: C.muted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom: 3 }}>KRS Score</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: C.blue }}>72</p>
                  <p style={{ fontSize: 9, color: C.mid }}>Strong profile</p>
                </div>
                {[{t:'Policy Analyst',c:'Indicc',p:87},{t:'CSR Manager',c:'Harshita',p:74}].map(j => (
                  <div key={j.t} style={{ background: C.white, borderRadius: 10, padding:'8px 10px', border:`1px solid ${C.border}` }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.ink }}>{j.t}</p>
                    <p style={{ fontSize: 8, color: C.muted }}>{j.c}</p>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: 4 }}>
                      <div style={{ flex:1, height: 3, borderRadius: 3, background: C.blueLt, overflow:'hidden', marginRight: 6 }}>
                        <div style={{ width:`${j.p}%`, height:'100%', background: C.blue, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 700, color: C.blue }}>{j.p}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Feature strip ─────────────────────────────────────────────────────────────
function FeatureStrip() {
  const items = [
    { icon: '🎯', title: 'KRS Score', desc: 'Tracks your knowledge, readiness and skills in one intelligent score.' },
    { icon: '💼', title: 'Smart Matching', desc: 'Jobs ranked by how well your UPSC profile aligns with each role.' },
    { icon: '⚡', title: 'Skill Gap Analysis', desc: 'See exactly which skills to build for each opportunity.' },
    { icon: '🗺️', title: 'Career Paths', desc: 'Explore sectors where UPSC preparation gives you a real edge.' },
  ]
  return (
    <section id="features" style={{ background: C.white, padding: '72px 24px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign:'center', marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.blue, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom: 10 }}>What you get</p>
          <h2 style={{ fontFamily:'Hind, sans-serif', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, color: C.ink, marginBottom: 12 }}>
            Built specifically for UPSC aspirants
          </h2>
          <p style={{ fontSize: 15, color: C.mid, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Every feature is designed to translate your preparation into real career advantage.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap: 20 }}>
          {items.map(item => (
            <div key={item.title} style={{
              background: C.blueXlt, borderRadius: 18, padding: '28px 24px',
              border: `1px solid ${C.border}`, transition: 'all 0.25s',
            }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(59,130,246,0.12)' }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 13, background: C.white, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 20, marginBottom: 16, boxShadow:'0 2px 8px rgba(59,130,246,0.1)' }}>{item.icon}</div>
              <h3 style={{ fontFamily:'Hind, sans-serif', fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.65 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n:'01', title:'Build your profile', desc:"Tell us your UPSC journey, skills, education and what you're looking for. Takes about 5 minutes." },
    { n:'02', title:'Get your KRS score', desc:'Our AI calculates your Knowledge, Readiness and Skills score — a single number that reflects your career readiness.' },
    { n:'03', title:'See matched jobs', desc:'Browse live openings ranked by your match score. See exactly which skills you already have.' },
    { n:'04', title:'Choose your path', desc:'Explore career tracks and pick the ones that suit your strengths and aspirations.' },
  ]
  return (
    <section id="how-it-works" style={{ background: C.blueXlt, padding: '72px 24px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign:'center', marginBottom: 52 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.blue, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom: 10 }}>How it works</p>
          <h2 style={{ fontFamily:'Hind, sans-serif', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, color: C.ink }}>Four steps to your next opportunity</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap: 24 }}>
          {steps.map((s,i) => (
            <div key={s.n} style={{ position:'relative' }}>
              {i < steps.length - 1 && (
                <div style={{ position:'absolute', top: 22, left:'calc(100% - 12px)', width: 24, height: 1, background: C.border, display:'none' }} className="lg:block" />
              )}
              <div style={{ background: C.white, borderRadius: 18, padding: '26px 22px', border: `1px solid ${C.border}`, height:'100%' }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.blue, background: C.blueLt, padding:'4px 10px', borderRadius: 20 }}>{s.n}</span>
                </div>
                <h3 style={{ fontFamily:'Hind, sans-serif', fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: C.mid, lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── For employers ─────────────────────────────────────────────────────────────
function ForEmployers() {
  const perks = [
    'Access pre-vetted UPSC-trained talent',
    'Filter by KRS score and skill gaps',
    'Post jobs and receive curated matches',
    'Reach candidates in 24 hours',
  ]
  return (
    <section id="for-employers" style={{ background: C.white, padding: '72px 24px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 60, alignItems:'center' }} className="lg:grid-cols-2 grid-cols-1">
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.blue, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom: 12 }}>For employers</p>
            <h2 style={{ fontFamily:'Hind, sans-serif', fontSize: 'clamp(22px,2.8vw,32px)', fontWeight: 800, color: C.ink, lineHeight: 1.25, marginBottom: 16 }}>
              Hire people with rare analytical depth
            </h2>
            <p style={{ fontSize: 15, color: C.mid, lineHeight: 1.7, marginBottom: 28 }}>
              UPSC aspirants bring structured thinking, policy awareness and discipline that's hard to find elsewhere. DISHA helps you reach them.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap: 12, marginBottom: 32 }}>
              {perks.map(p => (
                <div key={p} style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.blueLt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}><Icon.Check /></div>
                  <span style={{ fontSize: 14, color: C.mid }}>{p}</span>
                </div>
              ))}
            </div>
            <Link to="/auth/register/employer" style={{
              display:'inline-flex', alignItems:'center', gap: 8,
              padding: '11px 24px', borderRadius: 11, fontSize: 14, fontWeight: 700,
              background: C.blue, color: C.white, textDecoration:'none',
              boxShadow:'0 4px 16px rgba(59,130,246,0.32)', transition:'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.background = C.blueDk; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Post your first job <Icon.Arrow />
            </Link>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
            {[
              { v:'2,400+', l:'Active aspirants', icon:'👤' },
              { v:'87%',    l:'Match accuracy',   icon:'🎯' },
              { v:'140+',   l:'Employers',         icon:'🏢' },
              { v:'3 days', l:'Avg. hire time',    icon:'⚡' },
            ].map(s => (
              <div key={s.l} style={{
                background: C.blueXlt, borderRadius: 16, padding: '22px 18px',
                border: `1px solid ${C.border}`, textAlign:'center',
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                <p style={{ fontFamily:'Hind, sans-serif', fontSize: 22, fontWeight: 800, color: C.blue, marginBottom: 4 }}>{s.v}</p>
                <p style={{ fontSize: 12, color: C.muted }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CtaBanner() {
  return (
    <section style={{ background: `linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)`, padding:'64px 24px' }}>
      <div style={{ maxWidth: 620, margin:'0 auto', textAlign:'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🚀</div>
        <h2 style={{ fontFamily:'Hind, sans-serif', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, color: C.ink, marginBottom: 14 }}>
          Ready to turn your preparation into opportunity?
        </h2>
        <p style={{ fontSize: 15, color: C.mid, lineHeight: 1.7, marginBottom: 28 }}>
          Join thousands of UPSC aspirants who've discovered careers that value everything they built.
        </p>
        <Link to="/auth/register" style={{
          display:'inline-flex', alignItems:'center', gap: 8,
          padding: '13px 30px', borderRadius: 13, fontSize: 15, fontWeight: 700,
          background: C.blue, color: C.white, textDecoration:'none',
          boxShadow:'0 6px 24px rgba(59,130,246,0.35)', transition:'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.background = C.blueDk; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Start for free today <Icon.Arrow />
        </Link>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 14 }}>No credit card required · Takes 5 minutes</p>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: C.white, borderTop:`1px solid ${C.border}`, padding:'32px 24px' }}>
      <div style={{ maxWidth: 1140, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap: 16 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.blue, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>D</span>
          </div>
          <span style={{ fontFamily:'Hind, sans-serif', fontWeight: 700, fontSize: 15, color: C.ink }}>DISHA AI</span>
        </div>
        <p style={{ fontSize: 12, color: C.muted }}>© 2025 DISHA AI. Turning UPSC preparation into career advantage.</p>
        <div style={{ display:'flex', gap: 20 }}>
          {['Privacy','Terms','Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize: 12, color: C.muted, textDecoration:'none', transition:'color 0.2s' }}
              onMouseOver={e => e.currentTarget.style.color = C.blue}
              onMouseOut={e => e.currentTarget.style.color = C.muted}
            >{l}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DishaLanding() {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <Navbar />
      <Hero />
      <FeatureStrip />
      <HowItWorks />
      <ForEmployers />
      <CtaBanner />
      <Footer />
    </>
  )
}
