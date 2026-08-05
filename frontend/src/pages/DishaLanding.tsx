import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import heroKeyImg from '../assets/DQ_1E8UXkqqBgOzrKSzeM_uWjJ992Z.png'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  ink:      '#1E3A5F',
  inkSoft:  '#475569',
  muted:    '#94A3B8',
  cream:    '#F4F5F7',
  creamDk:  '#EAECF0',
  card:     '#FFFFFF',
  black:    '#1A2744',
  blackSoft:'#243359',
  gold:     '#1A2744',
  goldLt:   '#EAECF0',
  border:   'rgba(0,0,0,0.08)',
  borderDk: 'rgba(0,0,0,0.14)',
  white:    '#FFFFFF',
  success:  '#22C55E',
}

const KEYFRAMES = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
`

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  Menu:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  X:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Arrow:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Star:    () => <svg viewBox="0 0 24 24" fill={C.gold} width="13" height="13"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  Check:   () => <svg viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.4" width="13" height="13"><path d="M20 6L9 17l-5-5"/></svg>,
  Target:  (p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.ink} strokeWidth="1.6" width="20" height="20"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill={p?.c||C.ink}/></svg>,
  Briefcase:(p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.ink} strokeWidth="1.6" width="20" height="20"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>,
  Trend:   (p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.ink} strokeWidth="1.6" width="20" height="20"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>,
  Map:     (p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.ink} strokeWidth="1.6" width="20" height="20"><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>,
  Bell:    (p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.ink} strokeWidth="1.6" width="16" height="16"><path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5 1.5 6.5H4.5C4.5 13 6 12 6 8z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>,
  Users:   (p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.gold} strokeWidth="1.6" width="20" height="20"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16 13.2c2.3.3 4 2 4 4.3"/></svg>,
  Bullseye:(p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.gold} strokeWidth="1.6" width="20" height="20"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></svg>,
  Building:(p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/></svg>,
  Clock:   (p?: any) => <svg viewBox="0 0 24 24" fill="none" stroke={p?.c||C.gold} strokeWidth="1.6" width="20" height="20"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>,
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: '#FFFFFF',
      backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
      transition: 'all 0.3s',
      boxShadow: scrolled ? '0 1px 14px rgba(26,39,68,0.06)' : 'none',
    }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'visible' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', overflow: 'visible' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#1A2744', letterSpacing: '-0.5px' }}>BeginableAI</span>
          </Link>

          {/* Desktop links */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
              {['Features', 'How it works', 'For Employers'].map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`}
                  style={{ fontSize: 14, color: C.inkSoft, textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.color = C.ink}
                  onMouseOut={e => e.currentTarget.style.color = C.inkSoft}
                >{l}</a>
              ))}
            </div>
          )}

          {/* Desktop CTAs */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link to="/auth/login" style={{
                padding: '7px 18px', borderRadius: 9, fontSize: 14, fontWeight: 600,
                color: C.ink, textDecoration: 'none', border: `1.5px solid ${C.borderDk}`,
                background: 'transparent', transition: 'all 0.2s',
              }}
                onMouseOver={e => e.currentTarget.style.background = C.creamDk}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >Log in</Link>
              <Link to="/auth/register" style={{
                padding: '7px 20px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                background: C.black, color: C.white, textDecoration: 'none',
                boxShadow: '0 3px 12px rgba(26,39,68,0.28)', transition: 'all 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.background = C.blackSoft; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseOut={e => { e.currentTarget.style.background = C.black; e.currentTarget.style.transform = 'translateY(0)' }}
              >Get Started</Link>
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink, padding: 4 }}>
              {open ? <Icon.X /> : <Icon.Menu />}
            </button>
          )}
        </div>

        {/* Mobile menu dropdown */}
        {isMobile && open && (
          <div style={{ background: C.white, borderRadius: 14, padding: 20, marginBottom: 12, boxShadow: '0 8px 32px rgba(26,39,68,0.10)', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['Features','How it works','For Employers'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} onClick={() => setOpen(false)}
                style={{ fontSize: 14, color: C.inkSoft, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/auth/login" onClick={() => setOpen(false)} style={{ padding: '10px', borderRadius: 9, fontSize: 14, fontWeight: 600, color: C.ink, textDecoration: 'none', border: `1.5px solid ${C.borderDk}`, textAlign: 'center' }}>Log in</Link>
              <Link to="/auth/register" onClick={() => setOpen(false)} style={{ padding: '10px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: C.black, color: C.white, textDecoration: 'none', textAlign: 'center' }}>Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  const isMobile = useIsMobile()
  const isTablet = useIsMobile(1024)

  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      background: `linear-gradient(170deg, ${C.cream} 0%, #FFFFFF 55%, ${C.creamDk} 100%)`,
      paddingTop: 80, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', width: 560, height: 560, borderRadius:'50%', background: 'radial-gradient(circle, rgba(26,39,68,0.10) 0%, transparent 70%)', top:'-100px', right:'-120px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width: 360, height: 360, borderRadius:'50%', background: 'radial-gradient(circle, rgba(26,39,68,0.05) 0%, transparent 70%)', bottom:'5%', left:'-60px', pointerEvents:'none' }} />

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: isMobile ? '40px 20px' : '48px 24px', width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? '1fr' : 'minmax(0,1fr) minmax(0,1fr)',
          gap: isMobile ? 40 : 64,
          alignItems: 'center',
        }}>
          {/* Left */}
          <div style={{ animation: 'fadeUp 0.7s ease both' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: C.goldLt, border: `1px solid rgba(26,39,68,0.3)`,
              borderRadius: 100, padding: '5px 14px', marginBottom: 24,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.gold }}>AI-powered career intelligence for UPSC aspirants</span>
            </div>

            <h1 style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: isMobile ? 28 : 'clamp(28px, 3.8vw, 46px)',
              fontWeight: 800, lineHeight: 1.2,
              color: C.ink, marginBottom: 20, letterSpacing: '-0.5px',
            }}>
              Your UPSC journey{' '}
              <span style={{ color: C.gold }}>made you rare.</span>
              <br />Now let it launch your career.
            </h1>

            <p style={{ fontSize: isMobile ? 15 : 16, color: C.inkSoft, lineHeight: 1.75, maxWidth: 440, marginBottom: 36 }}>
              BeginableAI matches UPSC aspirants with employers who value analytical depth and governance knowledge — turning years of preparation into a career advantage.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
              <Link to="/auth/register" style={{
                display:'inline-flex', alignItems:'center', gap: 8,
                padding: isMobile ? '11px 22px' : '12px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: C.black, color: C.white, textDecoration: 'none',
                boxShadow: '0 6px 20px rgba(26,39,68,0.30)', transition: 'all 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.background = C.blackSoft; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseOut={e => { e.currentTarget.style.background = C.black; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                Start free profile <Icon.Arrow />
              </Link>
              <Link to="/auth/register/employer" style={{
                display:'inline-flex', alignItems:'center', gap: 7,
                padding: isMobile ? '11px 18px' : '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${C.borderDk}`, color: C.ink,
                textDecoration: 'none', background: C.white, transition: 'all 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold }}
                onMouseOut={e => { e.currentTarget.style.borderColor = C.borderDk; e.currentTarget.style.color = C.ink }}
              >
                For employers
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex' }}>
                  {['#E4D9C3','#D9CDB8','#E8E1D2','#EDD9A8'].map((c,i) => (
                    <div key={i} style={{
                      width: 30, height: 30, borderRadius: '50%', background: c,
                      border: `2px solid ${C.cream}`, marginLeft: i ? -9 : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: C.ink,
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

          {/* Right — illustration (hidden on mobile/tablet) */}
          {!isTablet && (
            <div style={{ position:'relative', width: '100%', height: 520, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img
                src={heroKeyImg}
                alt="Aspirant climbing to career success"
                style={{ width: '100%', maxWidth: 600, height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Feature strip ─────────────────────────────────────────────────────────────
function FeatureStrip() {
  const items = [
    { Icon: Icon.Target,    title: 'KRS Score', desc: 'Tracks your knowledge, readiness and skills in one intelligent score.' },
    { Icon: Icon.Briefcase, title: 'Smart Matching', desc: 'Jobs ranked by how well your UPSC profile aligns with each role.' },
    { Icon: Icon.Trend,     title: 'Skill Gap Analysis', desc: 'See exactly which skills to build for each opportunity.' },
    { Icon: Icon.Map,       title: 'Career Paths', desc: 'Explore sectors where UPSC preparation gives you a real edge.' },
  ]
  const isMobile = useIsMobile()

  return (
    <section id="features" style={{ background: C.white, padding: isMobile ? '60px 20px' : '88px 24px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign:'center', marginBottom: 56 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom: 12 }}>What you get</p>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, color: C.ink, marginBottom: 14 }}>
            Built specifically for UPSC aspirants
          </h2>
          <p style={{ fontSize: 15, color: C.inkSoft, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Every feature is designed to translate your preparation into real career advantage.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px,1fr))', gap: isMobile ? 0 : 1, background: C.border, borderRadius: 20, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          {items.map(item => (
            <div key={item.title} style={{
              background: C.white, padding: isMobile ? '28px 20px' : '36px 28px',
              transition: 'background 0.25s',
              borderBottom: isMobile ? `1px solid ${C.border}` : 'none',
            }}
              onMouseOver={e => { e.currentTarget.style.background = C.cream }}
              onMouseOut={e => { e.currentTarget.style.background = C.white }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.creamDk, display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 20 }}>
                <item.Icon c={C.ink} />
              </div>
              <h3 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.65 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const isMobile = useIsMobile()
  const steps = [
    { n:'01', Icon: Icon.Target,    title:'Build your profile', desc:"Tell us your UPSC journey, skills, education and what you're looking for. Takes about 5 minutes." },
    { n:'02', Icon: Icon.Trend,     title:'Get your KRS score', desc:'Our AI calculates your Knowledge, Readiness and Skills score — a single number that reflects your career readiness.' },
    { n:'03', Icon: Icon.Briefcase, title:'See matched jobs', desc:'Browse live openings ranked by your match score. See exactly which skills you already have.' },
    { n:'04', Icon: Icon.Map,       title:'Choose your path', desc:'Explore career tracks and pick the ones that suit your strengths and aspirations.' },
  ]
  return (
    <section id="how-it-works" style={{ background: C.creamDk, padding: isMobile ? '60px 20px' : '88px 24px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign:'center', marginBottom: 64 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, color: C.ink }}>Four steps to your next opportunity</h2>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px,1fr))', gap: 16 }}>
          {steps.map((s, i) => {
            const dark = i === 0
            return (
              <div key={s.n} style={{
                background: dark ? C.black : C.white,
                border: `0.5px solid ${dark ? C.black : C.border}`,
                borderRadius: 16, padding: '26px 22px 24px',
                transition: 'transform 0.25s ease',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.5px', display: 'block', marginBottom: 18, color: dark ? 'rgba(255,255,255,0.4)' : C.muted }}>{s.n}</span>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, marginBottom: 16,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: dark ? 'rgba(255,255,255,0.12)' : C.creamDk,
                }}>
                  <s.Icon c={dark ? C.white : C.ink} />
                </div>
                <h3 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 8, color: dark ? C.white : C.ink }}>{s.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: dark ? 'rgba(255,255,255,0.55)' : C.inkSoft }}>{s.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── For employers ─────────────────────────────────────────────────────────────
function ForEmployers() {
  const isMobile = useIsMobile()
  const perks = [
    'Access pre-vetted UPSC-trained talent',
    'Filter by KRS score and skill gaps',
    'Post jobs and receive curated matches',
    'Reach candidates in 24 hours',
  ]
  return (
    <section id="for-employers" style={{ background: C.white, padding: isMobile ? '60px 20px' : '88px 24px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 40 : 60, alignItems:'center' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom: 14 }}>For employers</p>
            <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(22px,2.8vw,34px)', fontWeight: 800, color: C.ink, lineHeight: 1.25, marginBottom: 16 }}>
              Hire people with rare analytical depth
            </h2>
            <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.7, marginBottom: 28 }}>
              UPSC aspirants bring structured thinking, policy awareness and discipline that's hard to find elsewhere. BeginablAI helps you reach them.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap: 12, marginBottom: 32 }}>
              {perks.map(p => (
                <div key={p} style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.goldLt, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}><Icon.Check /></div>
                  <span style={{ fontSize: 14, color: C.inkSoft }}>{p}</span>
                </div>
              ))}
            </div>
            <Link to="/auth/register/employer" style={{
              display:'inline-flex', alignItems:'center', gap: 8,
              padding: '11px 24px', borderRadius: 11, fontSize: 14, fontWeight: 700,
              background: C.black, color: C.white, textDecoration:'none',
              boxShadow:'0 6px 18px rgba(26,39,68,0.28)', transition:'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.background = C.blackSoft; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { e.currentTarget.style.background = C.black; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Post your first job <Icon.Arrow />
            </Link>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 18 }}>
            {[
              { v:'2,400+', l:'Active aspirants', Icon: Icon.Users },
              { v:'87%',    l:'Match accuracy',   Icon: Icon.Bullseye },
              { v:'140+',   l:'Employers',         Icon: Icon.Building },
              { v:'3 days', l:'Avg. hire time',    Icon: Icon.Clock },
            ].map(s => (
              <div key={s.l} style={{
                background: C.white, borderRadius: 18, padding: isMobile ? '20px 16px' : '26px 20px',
                border: `1px solid ${C.border}`, textAlign:'center',
                boxShadow: '0 8px 22px rgba(26,39,68,0.08)', transition: 'all 0.25s ease',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(26,39,68,0.16)'; e.currentTarget.style.borderColor = C.borderDk }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(26,39,68,0.08)'; e.currentTarget.style.borderColor = C.border }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 13, margin: '0 auto 14px', background: C.goldLt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <s.Icon c={C.gold} />
                </div>
                <p style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: isMobile ? 20 : 24, fontWeight: 800, color: C.ink, marginBottom: 4, letterSpacing:'-0.3px' }}>{s.v}</p>
                <p style={{ fontSize: 12.5, color: C.muted }}>{s.l}</p>
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
  const isMobile = useIsMobile()
  return (
    <section style={{ background: C.creamDk, padding: isMobile ? '56px 20px' : '64px 24px' }}>
      <div style={{ maxWidth: 620, margin:'0 auto', textAlign:'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: C.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', boxShadow: '0 6px 18px rgba(26,39,68,0.18)',
        }}>
          <Icon.Target c={C.gold} />
        </div>
        <h2 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, color: C.ink, marginBottom: 14 }}>
          Ready to turn your preparation into opportunity?
        </h2>
        <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.7, marginBottom: 28 }}>
          Join thousands of UPSC aspirants who've discovered careers that value everything they built.
        </p>
        <Link to="/auth/register" style={{
          display:'inline-flex', alignItems:'center', gap: 8,
          padding: '13px 30px', borderRadius: 13, fontSize: 15, fontWeight: 700,
          background: C.black, color: C.white, textDecoration:'none',
          transition:'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.background = C.blackSoft; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={e => { e.currentTarget.style.background = C.black; e.currentTarget.style.transform = 'translateY(0)' }}
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
  const isMobile = useIsMobile()
  const columns = [
    { title: 'Product',  links: ['Features', 'How it works', 'KRS Score', 'Career Paths'] },
    { title: 'Company',  links: ['About', 'Careers', 'Blog', 'Contact'] },
    { title: 'Legal',    links: ['Privacy', 'Terms', 'Security'] },
  ]
  const socials = [
    { icon: 'M 4 4 L 20 4 L 20 20 L 4 20 Z', label: 'Twitter',   path: 'M4 4h7l5 8-5 8H4l5-8z M11 4h9v16h-9' },
  ]
  return (
    <footer style={{ background: C.black }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: isMobile ? '48px 20px 24px' : '60px 32px 28px' }}>

        {/* Top grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : '1.8fr 1fr 1fr 1fr',
          gap: isMobile ? '32px 24px' : '0 40px',
          paddingBottom: 40,
          borderBottom: '0.5px solid rgba(255,255,255,0.1)',
          marginBottom: 24,
        }}>
          {/* Brand */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', display: 'block', marginBottom: 14 }}>BeginableAI</span>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, maxWidth: 240, margin: 0 }}>
              Turning years of UPSC preparation into a recognized career advantage.
            </p>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              {(['ti-brand-twitter', 'ti-brand-linkedin', 'ti-brand-instagram'] as const).map(icon => (
                <a key={icon} href="#" style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '0.5px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)', fontSize: 15, textDecoration: 'none',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = '#fff' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15">
                    {icon === 'ti-brand-twitter'   && <path d="M4 4l16 0M4 4l7 8-7 8M20 4l-7 8 7 8"/>}
                    {icon === 'ti-brand-linkedin'   && <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 11v5M8 8v.01M12 16v-5M16 16v-3a2 2 0 0 0-4 0"/></>}
                    {icon === 'ti-brand-instagram'  && <><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></>}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map(col => (
            <div key={col.title} style={{ marginTop: isMobile ? 0 : 4 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
                {col.title}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.color = '#fff'}
                    onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                  >{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>© 2025 BeginableAI. All rights reserved.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>All systems operational</span>
          </div>
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
