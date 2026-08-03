import { Share2, Clock } from 'lucide-react'

export default function ReferralsPage() {
  return (
    <div style={{ padding: '28px 20px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={16} color="#6366F1" />Referrals
          </h1>
        </div>

        <div style={{
          background: 'white', border: '1px solid #E5E9F2', borderRadius: 20,
          padding: '64px 40px', textAlign: 'center',
          boxShadow: '0 10px 30px rgba(15,23,42,0.07)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Clock size={28} color="#6366F1" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
            Referral Program — Coming Soon
          </h2>
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
            The employee referral program is under development. You'll be able to generate shareable referral links, track referred candidates through your pipeline, and manage referral bonuses — all from this page.
          </p>
        </div>

      </div>
    </div>
  )
}
