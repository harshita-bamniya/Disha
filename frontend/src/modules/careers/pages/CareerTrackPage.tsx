import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Circle,
  IndianRupee,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useCareerTrack, useDeselectTrack, useSelectTrack } from '../hooks/useCareers'
import { getApiError } from '@/api/client'
import AppSidebar from '@/components/layout/AppSidebar'

// ── Helpers ──────────────────────────────────────────────────────────────────

const GROWTH_CONFIG: Record<string, { label: string; className: string }> = {
  high: { label: 'High growth sector', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  medium: { label: 'Steady growth', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  low: { label: 'Slow growth', className: 'text-gray-600 bg-gray-50 border-gray-200' },
}

function ScoreArc({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-24 h-24 rounded-full border-4 border-dashed border-gray-200 flex items-center justify-center">
          <span className="text-xs text-gray-400 text-center leading-tight px-2">
            Complete onboarding for score
          </span>
        </div>
      </div>
    )
  }

  const color = score >= 70 ? '#3B82F6' : score >= 45 ? '#60A5FA' : '#9CA3AF'
  const label = score >= 70 ? 'Strong match' : score >= 45 ? 'Good fit' : 'Skill gap'
  const circumference = 2 * Math.PI * 38
  const dash = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="38" fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerTrackPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: track, isLoading, isError } = useCareerTrack(slug ?? '')
  const selectMutation = useSelectTrack()
  const deselectMutation = useDeselectTrack()
  const [flashMsg, setFlashMsg] = useState<string | null>(null)

  function flash(msg: string) {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(null), 2500)
  }

  async function handleToggle() {
    if (!track) return
    try {
      if (track.is_selected) {
        const res = await deselectMutation.mutateAsync(track.id)
        flash(res.message)
      } else {
        const res = await selectMutation.mutateAsync(track.id)
        flash(res.message)
      }
    } catch (err: unknown) {
      flash(getApiError(err))
    }
  }

  const isMutating = selectMutation.isPending || deselectMutation.isPending

  const growth = GROWTH_CONFIG[track?.growth_outlook ?? '']

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)', display: 'flex' }}>

      {/* ── Sidebar ── */}
      <AppSidebar activePath="/app/careers" />

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(59,130,246,0.08)',
          padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', gap: 14,
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 2px 16px rgba(30,58,95,0.04)',
        }}>
          <button onClick={() => navigate(-1)} style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#3B82F6', transition: 'all 0.2s',
          }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {track && (
              <>
                <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>{track.sector}</p>
                <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 17, fontWeight: 900, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</h1>
              </>
            )}
          </div>
        </header>

        <main style={{ padding: '28px 32px', flex: 1 }}>

          {/* Loading */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {(isError || (!isLoading && !track)) && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <p style={{ fontSize: 14, color: '#DC2626', marginBottom: 12 }}>Career track not found.</p>
              <button onClick={() => navigate('/app/careers/explore')} style={{ fontSize: 13, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                ← Back to explore
              </button>
            </div>
          )}

          {track && (
            <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Score + meta card */}
              <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 24, padding: '24px 28px', boxShadow: '0 4px 20px rgba(30,58,95,0.07)', display: 'flex', gap: 28, alignItems: 'center' }}>
                <ScoreArc score={track.match_score} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {track.salary_range && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: '#374151' }}>
                      <IndianRupee size={14} color="#9CA3AF" />{track.salary_range}
                    </div>
                  )}
                  {growth && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: '1px solid' }} className={growth.className}>
                      <TrendingUp size={12} />{growth.label}
                    </span>
                  )}
                  {track.skill_overlap !== null && (
                    <p style={{ fontSize: 13, color: '#6B7280' }}>
                      <span style={{ fontWeight: 700, color: '#374151' }}>{track.skill_overlap}%</span> of required skills matched
                    </p>
                  )}
                </div>

                {/* CTA inline on wide screens */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  <button onClick={handleToggle} disabled={isMutating} style={{
                    height: 44, padding: '0 22px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 8, cursor: isMutating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s', opacity: isMutating ? 0.6 : 1,
                    background: track.is_selected ? 'rgba(107,114,128,0.08)' : 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                    color: track.is_selected ? '#6B7280' : 'white',
                    border: track.is_selected ? '1.5px solid rgba(107,114,128,0.25)' : 'none',
                    boxShadow: track.is_selected ? 'none' : '0 4px 14px rgba(59,130,246,0.3)',
                  }}>
                    {isMutating
                      ? <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : track.is_selected
                        ? <><BookmarkCheck size={14} />Remove path</>
                        : <><Bookmark size={14} />Choose this path</>
                    }
                  </button>
                  {!track.is_selected && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={11} />Up to 2 paths
                    </p>
                  )}
                  {flashMsg && <p style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>{flashMsg}</p>}
                </div>
              </div>

              {/* Two-column layout: description + gap analysis */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* About */}
                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 4px 20px rgba(30,58,95,0.06)' }}>
                  <h2 style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>About this path</h2>
                  <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.75 }}>{track.description}</p>
                </div>

                {/* Skills gap */}
                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 4px 20px rgba(30,58,95,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h2 style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Skills gap analysis</h2>

                  {track.skills_you_have.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCircle2 size={13} />You already have ({track.skills_you_have.length})
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {track.skills_you_have.map(s => (
                          <span key={s} style={{ padding: '4px 10px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#059669' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {track.skills_to_develop.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Circle size={13} />Skills to develop ({track.skills_to_develop.length})
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {track.skills_to_develop.map(s => (
                          <span key={s} style={{ padding: '4px 10px', background: 'rgba(107,114,128,0.07)', border: '1px solid rgba(107,114,128,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {track.skills_you_have.length === 0 && track.skills_to_develop.length === 0 && (
                    <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Add your skills in your profile to see the gap analysis.</p>
                  )}
                </div>
              </div>

              {/* Example roles */}
              {track.example_roles.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.95)', borderRadius: 20, padding: '22px 24px', boxShadow: '0 4px 20px rgba(30,58,95,0.06)' }}>
                  <h2 style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BriefcaseBusiness size={13} />Example roles
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    {track.example_roles.map(role => (
                      <div key={role} style={{ fontSize: 13, fontWeight: 600, color: '#374151', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)', borderRadius: 12, padding: '10px 14px' }}>
                        {role}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UPSC fit */}
              {track.min_k_score > 0 && (
                <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 16, padding: '16px 20px', fontSize: 13, color: 'rgba(59,130,246,0.85)', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700 }}>UPSC preparation matters here.</span>{' '}
                  This track recommends a minimum UPSC knowledge score of{' '}
                  <span style={{ fontWeight: 900 }}>{track.min_k_score}/100</span> — your preparation is a direct asset.
                </div>
              )}

            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
