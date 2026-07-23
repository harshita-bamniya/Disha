import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const N = {
  navy:     '#1A2744',
  navySoft: '#243359',
  ink:      '#1E3A5F',
  inkSoft:  '#475569',
  muted:    '#94A3B8',
  bg:       '#F4F5F7',
  card:     '#EAECF0',
  white:    '#FFFFFF',
}

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  variant?: 'login' | 'register' | 'employer-register' | 'forgot-password' | 'default'
  panelSide?: 'left' | 'right'
}

const PANEL_CONTENT: Record<string, { tag: string; heading: string; body: string; quote: string }> = {
  login: {
    tag: 'Welcome back',
    heading: 'Your next opportunity is waiting.',
    body: 'Log in to continue where you left off — applications, matches, and career insights built for civil service professionals.',
    quote: '"Every great career begins with showing up."',
  },
  register: {
    tag: 'Join BeginableAI',
    heading: 'Turn your preparation into a career.',
    body: 'Create your profile once. Get matched to roles that value your UPSC background, governance knowledge, and analytical mindset.',
    quote: '"Your discipline is your differentiator."',
  },
  'employer-register': {
    tag: 'Hire smarter',
    heading: 'Find talent built for governance.',
    body: 'Access a pool of analytically rigorous candidates who understand policy, public systems, and institutional thinking — right from day one.',
    quote: '"The best hires aren\'t found. They\'re matched."',
  },
  'forgot-password': {
    tag: 'Account recovery',
    heading: 'We\'ll get you back in.',
    body: 'Enter your registered email and we\'ll send you a secure link to reset your password. Takes less than a minute.',
    quote: '"A fresh start is just one click away."',
  },
  default: {
    tag: 'AI-powered career intelligence',
    heading: 'Your UPSC journey\nmade you rare.',
    body: 'Discover careers that recognise your analytical depth, governance knowledge, and discipline.',
    quote: '"Your preparation was never wasted. It made you rare."',
  },
}

export default function AuthLayout({ children, title, subtitle, variant = 'default', panelSide = 'left' }: AuthLayoutProps) {
  const panel = PANEL_CONTENT[variant] ?? PANEL_CONTENT.default
  const reversed = panelSide === 'right'
  const panelAnim = reversed ? 'slideInRight 0.45s cubic-bezier(0.22,1,0.36,1) both' : 'slideInLeft 0.45s cubic-bezier(0.22,1,0.36,1) both'
  const formAnim  = reversed ? 'slideInLeft 0.45s cubic-bezier(0.22,1,0.36,1) both'  : 'slideInRight 0.45s cubic-bezier(0.22,1,0.36,1) both'

  return (
    <>
      <style>{"@keyframes slideInLeft{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}@keyframes slideInRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}"}</style>
    <div style={{ height: '100vh', display: 'flex', flexDirection: reversed ? 'row-reverse' : 'row', background: N.bg, overflow: 'hidden' }}>

      {/* Panel — dark navy branding, fixed height, never scrolls */}
      <div style={{
        width: '42%', background: N.navy,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0, overflow: 'hidden', animation: panelAnim,
      }} className="hidden lg:flex">

        {/* Subtle texture circle */}
        <div style={{
          position: 'absolute', width: 480, height: 480, borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)', top: '-140px', right: '-140px',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,0.02)', bottom: '5%', left: '-80px',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>BeginableAI</span>
        </Link>

        {/* Middle copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(255,255,255,0.10)', border: '0.5px solid rgba(255,255,255,0.18)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 28,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.3px' }}>
              {panel.tag}
            </span>
          </div>

          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: 32, fontWeight: 800,
            color: N.white, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.4px',
            whiteSpace: 'pre-line',
          }}>
            {panel.heading}
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, maxWidth: 320 }}>
            {panel.body}
          </p>
        </div>

        {/* Bottom quote */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
          {panel.quote}
        </p>
      </div>

      {/* Form panel — scrolls independently */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', overflowY: 'auto', height: '100vh',
        animation: formAnim,
      }}>
        {/* Mobile logo */}
        <Link to="/" className="lg:hidden" style={{ textDecoration: 'none', marginBottom: 28 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: N.ink, letterSpacing: '-0.4px' }}>BeginableAI</span>
        </Link>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 440,
          background: N.white,
          borderRadius: 20,
          border: '0.5px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 24px rgba(26,39,68,0.07)',
          padding: '36px 36px',
        }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 500, color: N.inkSoft,
            textDecoration: 'none', marginBottom: 24,
            transition: 'color 0.15s',
          }}
            onMouseOver={e => e.currentTarget.style.color = N.ink}
            onMouseOut={e => e.currentTarget.style.color = N.inkSoft}
          >
            <ArrowLeft size={13} /> Back to home
          </Link>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: 24, fontWeight: 800,
              color: N.ink, marginBottom: 6, letterSpacing: '-0.3px',
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: N.inkSoft, lineHeight: 1.6 }}>{subtitle}</p>
            )}
          </div>

          {children}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: N.muted, textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
          Protected by reCAPTCHA · <a href="/privacy" style={{ color: N.muted, textDecoration: 'underline' }}>Privacy</a> · <a href="/terms" style={{ color: N.muted, textDecoration: 'underline' }}>Terms</a>
        </p>
      </div>
    </div>
    </>
  )
}
