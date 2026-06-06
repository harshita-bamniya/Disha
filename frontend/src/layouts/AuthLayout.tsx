import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
        top: '-150px', right: '-150px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(147,197,253,0.1) 0%, transparent 70%)',
        bottom: '-100px', left: '-100px', pointerEvents: 'none',
      }} />

      {/* Left panel — branding (hidden on mobile) */}
      <div style={{
        width: '42%',
        background: 'linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 55%, #E0F2FE 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', position: 'relative', overflow: 'hidden',
        borderRight: '1px solid rgba(59,130,246,0.1)',
      }} className="hidden lg:flex">
        {/* Panel decorations */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(59,130,246,0.06)', top: '-100px', right: '-100px',
        }} />
        <div style={{
          position: 'absolute', width: 250, height: 250, borderRadius: '50%',
          background: 'rgba(99,102,241,0.04)', bottom: '10%', left: '-60px',
        }} />

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59,130,246,0.15)',
          }}>
            <span style={{ color: '#1D4ED8', fontWeight: 900, fontSize: 18 }}>D</span>
          </div>
          <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 22, color: '#1E3A5F' }}>DISHA AI</span>
        </Link>

        {/* Middle copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 24,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6' }}>✨ AI-Powered Career Intelligence</span>
          </div>
          <h2 style={{
            fontFamily: 'Hind, sans-serif', fontSize: 34, fontWeight: 900,
            color: '#1E3A5F', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px',
          }}>
            Your UPSC journey{'\n'}made you rare.
          </h2>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7 }}>
            Discover careers that recognise your analytical depth, governance knowledge, and discipline — all built during years of UPSC preparation.
          </p>

          {/* Mini stats */}
          <div style={{ display: 'flex', gap: 28, marginTop: 36 }}>
            {[
              { v: '2,400+', l: 'Aspirants' },
              { v: '87%',   l: 'Match rate' },
              { v: '140+',  l: 'Employers' },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#1E3A5F', fontFamily: 'Hind, sans-serif' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', position: 'relative', zIndex: 1 }}>
          "Your preparation was never wasted. It made you rare."
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
      }}>
        {/* Mobile logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }} className="lg:hidden">
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>D</span>
          </div>
          <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 20, color: '#1E3A5F' }}>DISHA AI</span>
        </Link>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 440,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1px solid rgba(59,130,246,0.1)',
          boxShadow: '0 20px 60px rgba(30,58,95,0.07), 0 4px 16px rgba(59,130,246,0.05)',
          padding: '36px 36px',
        }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: 'Hind, sans-serif', fontSize: 26, fontWeight: 900,
              color: '#1E3A5F', marginBottom: 6, letterSpacing: '-0.3px',
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF', textAlign: 'center', maxWidth: 280 }}>
          "Your preparation was never wasted. It made you rare."
        </p>
      </div>
    </div>
  )
}
