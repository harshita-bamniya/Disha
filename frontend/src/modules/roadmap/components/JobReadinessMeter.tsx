import { useQuery } from '@tanstack/react-query'
import { roadmapApi, type JRSBreakdown } from '@/api/roadmap'
import { Target } from 'lucide-react'

const SCORE_COLORS = [
  { min: 0,  max: 30, color: '#EF4444', label: 'Getting Started' },
  { min: 30, max: 55, color: '#F97316', label: 'Building Skills'  },
  { min: 55, max: 75, color: '#EAB308', label: 'Making Progress'  },
  { min: 75, max: 90, color: '#3B82F6', label: 'Nearly Ready'     },
  { min: 90, max: 101, color: '#10B981', label: 'Job Ready'        },
]

function getColor(score: number) {
  return SCORE_COLORS.find(b => score >= b.min && score < b.max) ?? SCORE_COLORS[0]
}

const BREAKDOWN_LABELS: Record<keyof Omit<JRSBreakdown, 'total'>, { label: string; max: number }> = {
  profile_score:         { label: 'Profile',          max: 10 },
  skill_coverage_score:  { label: 'Skill Coverage',   max: 25 },
  competence_score:      { label: 'Competence',        max: 20 },
  narrative_score:       { label: 'Narrative',         max: 15 },
  resume_score:          { label: 'Resume ATS',        max: 15 },
  interview_score:       { label: 'Interviews',        max: 15 },
}

export default function JobReadinessMeter() {
  const { data, isLoading } = useQuery({
    queryKey: ['jrs'],
    queryFn: roadmapApi.getJRS,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading || !data) {
    return (
      <div style={{ background: 'white', borderRadius: 20, padding: '24px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Target size={16} color="#2D6A4F" />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Job Readiness Score</span>
        </div>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F1F5F9', margin: '0 auto' }} />
      </div>
    )
  }

  const band = getColor(data.total)
  const circumference = 2 * Math.PI * 40
  const strokeDash = (data.total / 100) * circumference

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: '24px', border: '1.5px solid rgba(226,232,240,0.8)', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Target size={16} color="#2D6A4F" />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Job Readiness Score</span>
      </div>

      {/* Circular gauge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={band.color} strokeWidth="10"
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: band.color, lineHeight: 1, fontFamily: 'Hind, sans-serif' }}>
              {data.total}
            </span>
            <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>/100</span>
          </div>
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: `${band.color}15`, color: band.color }}>
          {band.label}
        </span>
      </div>

      {/* Breakdown bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(Object.keys(BREAKDOWN_LABELS) as Array<keyof typeof BREAKDOWN_LABELS>).map(key => {
          const { label, max } = BREAKDOWN_LABELS[key]
          const val = data[key] as number
          const pct = max > 0 ? (val / max) * 100 : 0
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: '#0F172A', fontWeight: 700 }}>
                  {val.toFixed(0)}<span style={{ color: '#CBD5E1' }}>/{max}</span>
                </span>
              </div>
              <div style={{ height: 5, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 5,
                  background: pct >= 80 ? '#10B981' : pct >= 50 ? '#3B82F6' : pct >= 25 ? '#F97316' : '#EF4444',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
