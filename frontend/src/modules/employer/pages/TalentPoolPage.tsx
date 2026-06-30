/**
 * Talent Pool — candidates the company has bookmarked, independent of any
 * one job posting. Lets recruiters keep a good candidate after the req
 * they applied to closes, instead of losing them entirely.
 */
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTalentPool, unsaveCandidate, type SavedCandidateOut } from '@/api/matching'
import { ArrowLeft, Star, MapPin, GraduationCap, Briefcase, X, Users } from 'lucide-react'

function CandidateRow({ candidate }: { candidate: SavedCandidateOut }) {
  const qc = useQueryClient()
  const unsaveMutation = useMutation({
    mutationFn: () => unsaveCandidate(candidate.aspirant_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['talent-pool'] }),
  })

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>{candidate.full_name ?? 'Anonymous'}</h3>
          <p style={{ fontSize: 11, color: '#64748B', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} />{[candidate.city, candidate.state].filter(Boolean).join(', ') || 'Location N/A'}
          </p>
        </div>
        <button
          onClick={() => unsaveMutation.mutate()}
          disabled={unsaveMutation.isPending}
          title="Remove from talent pool"
          style={{ width: 28, height: 28, border: 'none', background: '#F1F5F9', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <X size={14} color="#64748B" />
        </button>
      </div>

      {candidate.highest_qualification && (
        <p style={{ fontSize: 12, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <GraduationCap size={12} />{candidate.highest_qualification}
        </p>
      )}
      {candidate.last_designation && (
        <p style={{ fontSize: 12, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Briefcase size={12} />{candidate.last_designation}
        </p>
      )}

      {candidate.skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {candidate.skills.slice(0, 5).map(s => (
            <span key={s} style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.07)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.12)' }}>{s}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
        {candidate.composite !== null ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>KRS {candidate.composite}</span>
        ) : <span />}
        <span style={{ fontSize: 11, color: '#94A3B8' }}>
          Saved {new Date(candidate.saved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {candidate.saved_by_name ? ` by ${candidate.saved_by_name}` : ''}
        </span>
      </div>
    </div>
  )
}

export default function TalentPoolPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['talent-pool'], queryFn: getTalentPool })

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <Link to="/app/employer/dashboard" style={{ color: '#64748B', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={14} />Back
        </Link>
        <div style={{ width: 1, height: 24, background: '#E5E7EB' }} />
        <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={16} fill="#D97706" color="#D97706" />Talent Pool
        </h1>
        {data && <span style={{ fontSize: 12, color: '#94A3B8' }}>{data.length} saved candidate{data.length !== 1 ? 's' : ''}</span>}
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : isError ? (
          <p style={{ textAlign: 'center', color: '#DC2626', padding: 40 }}>Failed to load talent pool.</p>
        ) : !data || data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94A3B8' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>No saved candidates yet</p>
            <p style={{ fontSize: 13, margin: 0 }}>Open any candidate's profile from a job pipeline and click the star to save them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {data.map(c => <CandidateRow key={c.aspirant_id} candidate={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
