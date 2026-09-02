import { RefreshCw } from 'lucide-react'
import { useKrsDashboard, useRecompute } from '@/modules/dashboard/hooks/useKrs'

const KRS_TILES = [
  {
    key: 'k',
    label: 'Knowledge',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: 'rgba(37,99,235,0.12)',
    what: "How broadly and deeply you've mastered UPSC subjects.",
    improve: 'Fill in your Education and UPSC Journey sections.',
    score: (d: any) => d?.krs?.k_score ?? 0,
  },
  {
    key: 'r',
    label: 'Readiness',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: 'rgba(124,58,237,0.12)',
    what: 'Your psychological preparedness for private sector work culture.',
    improve: 'Complete the Learning Setup section.',
    score: (d: any) => d?.krs?.r_score ?? 0,
  },
  {
    key: 's',
    label: 'Skills',
    color: '#059669',
    bg: '#ECFDF5',
    border: 'rgba(5,150,105,0.12)',
    what: 'How well your UPSC skills map to real corporate roles.',
    improve: 'Add more skills in the Skills section below.',
    score: (d: any) => d?.krs?.s_score ?? 0,
  },
]

export function KrsPanel() {
  const { data, isLoading } = useKrsDashboard()
  const recompute = useRecompute()

  return (
    <div style={{
      background: 'white',
      borderRadius: 20,
      border: '1px solid rgba(26,39,68,0.08)',
      boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
      padding: '18px 22px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>Your KRS Score</p>
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, maxWidth: 520 }}>
            Knowledge · Readiness · Skills — Disha uses this score to match you to the right jobs and build
            your personalised roadmap. Every profile section you complete raises it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending || isLoading}
          aria-label="Refresh KRS score"
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            background: 'none', border: '1px solid rgba(26,39,68,0.10)',
            color: '#6B7280', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RefreshCw size={11} className={recompute.isPending ? 'animate-spin' : ''} />
          {recompute.isPending ? 'Updating…' : 'Refresh'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 110, borderRadius: 14, background: '#F8FAFC', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {KRS_TILES.map(t => (
            <div key={t.key} style={{
              borderRadius: 14,
              background: t.bg,
              border: `1px solid ${t.border}`,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 2 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.score(data)}</span>
                <span style={{ fontSize: 11, color: t.color, fontWeight: 600, opacity: 0.6 }}>/100</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{t.label}</p>
              <p style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.55, marginBottom: 8 }}>{t.what}</p>
              <p style={{ fontSize: 11, color: t.color, fontWeight: 600, borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
                ↑ {t.improve}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
