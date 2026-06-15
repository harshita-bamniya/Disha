import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { xpApi } from '@/api/xp'
import { Target, Zap, ArrowRight, Loader } from 'lucide-react'

export default function DailyMissionCard() {
  const navigate = useNavigate()
  const { data: mission, isLoading } = useQuery({
    queryKey: ['daily-mission'],
    queryFn: xpApi.getDailyMission,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div style={{
        background: 'rgba(249,115,22,0.05)',
        border: '1px solid rgba(249,115,22,0.18)',
        borderRadius: 16, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Loader size={16} style={{ color: '#F97316', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#94A3B8' }}>Loading today's mission...</span>
      </div>
    )
  }

  if (!mission) return null

  const handleCta = () => {
    const path = mission.cta_path
    if (path.startsWith('/')) {
      navigate(path.split('?')[0])
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.04))',
      border: '1px solid rgba(249,115,22,0.22)',
      borderRadius: 16, padding: '18px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(249,115,22,0.06)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #F97316, #EA580C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
        }}>
          <Target size={17} color="white" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Today's Mission
            </span>
            {mission.xp_reward > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700, color: '#F59E0B',
                background: 'rgba(245,158,11,0.12)',
                padding: '2px 7px', borderRadius: 20,
              }}>
                <Zap size={9} />+{mission.xp_reward} XP
              </span>
            )}
          </div>

          <p style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F', marginBottom: 4, lineHeight: 1.3 }}>
            {mission.title}
          </p>
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 12 }}>
            {mission.description}
          </p>

          <button
            onClick={handleCta}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              color: 'white', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              boxShadow: '0 3px 10px rgba(249,115,22,0.3)',
              transition: 'transform 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {mission.cta_label}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
