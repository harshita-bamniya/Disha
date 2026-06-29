import { Link } from 'react-router-dom'
import { Clock, CheckCircle2, Phone, ArrowRight, ArrowLeft } from 'lucide-react'

export default function EmployerPendingPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 16px',
      background: 'linear-gradient(135deg, #F8FBFF 0%, #EEF4FF 50%, #F5F3EE 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* BG orbs */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', top: '-100px', right: '-100px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,197,253,0.07) 0%, transparent 70%)', bottom: '-80px', left: '-80px', pointerEvents: 'none' }} />

      {/* Back to home */}
      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
          fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 16,
        }}>
          <ArrowLeft size={14} />Back to home
        </Link>
      </div>

      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
        }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 18 }}>D</span>
        </div>
        <span style={{ fontFamily: 'Hind, sans-serif', fontWeight: 800, fontSize: 22, color: '#1E3A5F' }}>BeginablAI</span>
      </Link>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
        borderRadius: 24, border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: '0 20px 60px rgba(30,58,95,0.1), 0 4px 16px rgba(30,58,95,0.06)',
        padding: '40px 36px', textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,197,253,0.15))',
          border: '1px solid rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={32} color="#3B82F6" />
        </div>

        <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 26, fontWeight: 900, color: '#1E3A5F', marginBottom: 10, letterSpacing: '-0.3px' }}>
          Registration submitted!
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 28 }}>
          Your company account has been created and your phone is verified. Our team will review your application within <strong style={{ color: '#3B82F6' }}>24–48 hours</strong>.
        </p>

        {/* Steps */}
        <div style={{
          background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 28, textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {[
            { icon: <CheckCircle2 size={16} color="#3B82F6" />, text: 'Phone number verified', done: true },
            { icon: <Clock size={16} color="#F59E0B" />, text: 'Account under admin review (24–48 hrs)', done: false },
            { icon: <Phone size={16} color="#9CA3AF" />, text: "You'll receive an SMS once approved", done: false },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: item.done ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 14, color: item.done ? '#3B82F6' : '#374151', fontWeight: item.done ? 600 : 400, paddingTop: 4 }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        <Link to="/auth/login" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', height: 48, borderRadius: 14, fontSize: 15, fontWeight: 700,
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          color: 'white', textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
          transition: 'all 0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.45)' }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)' }}
        >
          Go to login <ArrowRight size={16} />
        </Link>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF', position: 'relative', zIndex: 1 }}>
        Questions? Contact us at <a href="mailto:support@dishaai.in" style={{ color: '#3B82F6', textDecoration: 'none' }}>support@dishaai.in</a>
      </p>
    </div>
  )
}
