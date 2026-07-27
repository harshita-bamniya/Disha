import type { ScoreBreakdown } from '@/api/resume'

const CRITERIA: { key: keyof Omit<ScoreBreakdown, 'overall'>; label: string }[] = [
  { key: 'ats_compatibility', label: 'ATS Compatibility' },
  { key: 'keyword_coverage',  label: 'Keyword Coverage' },
  { key: 'impact',            label: 'Impact & Verbs' },
  { key: 'completeness',      label: 'Completeness' },
  { key: 'readability',       label: 'Readability' },
  { key: 'formatting',        label: 'Formatting' },
]

function scoreColor(score: number) {
  if (score >= 75) return '#16A34A'
  if (score >= 50) return '#D97706'
  return '#DC2626'
}

interface Props {
  breakdown: ScoreBreakdown
  compact?: boolean
}

export default function ScoreBreakdownCard({ breakdown, compact = false }: Props) {
  const overall = breakdown.overall

  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* overall score header */}
      <div style={{
        background: `linear-gradient(135deg, ${scoreColor(overall)}15, ${scoreColor(overall)}08)`,
        borderBottom: `1px solid ${scoreColor(overall)}20`,
        padding: compact ? '12px 14px' : '16px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: compact ? 44 : 54, height: compact ? 44 : 54,
          borderRadius: '50%',
          border: `3px solid ${scoreColor(overall)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: compact ? 14 : 18, fontWeight: 900, color: scoreColor(overall) }}>
            {overall}
          </span>
        </div>
        <div>
          <div style={{ fontSize: compact ? 12 : 14, fontWeight: 800, color: '#0F172A' }}>
            Overall Score
          </div>
          <div style={{ fontSize: 11, color: scoreColor(overall), fontWeight: 700 }}>
            {overall >= 75 ? 'Excellent' : overall >= 50 ? 'Good' : 'Needs Work'}
          </div>
        </div>
      </div>

      {/* criteria breakdown */}
      <div style={{ padding: compact ? '10px 14px' : '14px 18px', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
        {CRITERIA.map(({ key, label }) => {
          const criterion = breakdown[key]
          if (!criterion) return null
          const isNA = key === 'keyword_coverage' && criterion.score === 0
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: isNA ? '#94A3B8' : scoreColor(criterion.score),
                }}>
                  {isNA ? 'N/A' : criterion.score}
                </span>
              </div>
              {/* progress bar */}
              <div style={{ height: 5, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 3 }}>
                <div style={{
                  height: '100%',
                  width: isNA ? '0%' : `${criterion.score}%`,
                  background: isNA ? '#CBD5E1' : scoreColor(criterion.score),
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              {!compact && (
                <p style={{ fontSize: 10.5, color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                  {criterion.explanation}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
