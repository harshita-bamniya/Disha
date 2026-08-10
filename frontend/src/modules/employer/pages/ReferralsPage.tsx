import { Share2, Clock } from 'lucide-react'
import { colors, radius } from '@/design-system/tokens'
import PageHeader from '@/shared/layouts/PageHeader'

export default function ReferralsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Referrals" subtitle="Employee referral program" />
      <div style={{ padding: '20px 28px', background: colors.surface.bg, flex: 1 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{
            background: colors.surface.card,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius.xl,
            padding: '64px 40px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: colors.surface.elevated,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Clock size={28} color={colors.text.muted} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              <Share2 size={16} color={colors.text.muted} />
              <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text.ink, margin: 0 }}>
                Referral Program — Coming Soon
              </h2>
            </div>
            <p style={{ fontSize: 14, color: colors.text.inkSoft, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
              The employee referral program is under development. You'll be able to generate shareable referral links, track referred candidates through your pipeline, and manage referral bonuses — all from this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
