import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, BookOpen, Building2, MapPin,
  TrendingUp, CheckCircle2, X, ExternalLink, Play, Zap, ArrowUpRight, Sparkles,
} from 'lucide-react'
import { usePreparedJobs, useUnprepareJob, useKrsDashboard } from '@/modules/dashboard/hooks/useKrs'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import AppSidebar from '@/components/layout/AppSidebar'
import JobAnalysisDrawer from '@/components/JobAnalysisDrawer'

// ── Prepared job card ─────────────────────────────────────────────────────────
function PreparedJobCard({ job, onAnalyse, onStartPrep, isActivePrep }: {
  job: LiveJob; onAnalyse: () => void; onStartPrep: () => void; isActivePrep: boolean
}) {
  const [hov, setHov] = useState(false)
  const haveCount = job.skills_you_have.length
  const gapCount  = job.skills_to_develop.length
  const total     = job.required_skills.length
  const readyPct  = total > 0 ? Math.round((haveCount / total) * 100) : 0

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'white',
        border: hov ? '1.5px solid #15130F' : '1.5px solid rgba(226,232,240,0.8)',
        borderRadius: 22, overflow: 'hidden',
        boxShadow: hov ? '0 16px 40px rgba(21,19,15,0.12)' : '0 4px 16px rgba(15,23,42,0.05)',
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.34,1.1,0.64,1)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Gradient header */}
      <div style={{ background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 60%, #2563EB 100%)', padding: '18px 20px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: -40, right: -30, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'white', lineHeight: 1.3, marginBottom: 4 }}>{job.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <Building2 size={10} color="rgba(255,255,255,0.5)" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{job.company_name}</span>
              {job.location && (<><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><MapPin size={10} color="rgba(255,255,255,0.5)" /><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{job.location}</span></>)}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10, padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: 'white', lineHeight: 1 }}>{job.match_score}%</p>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>match</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', position: 'relative' }}>
          {job.sector && <span style={{ padding: '3px 9px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{job.sector}</span>}
          {job.employment_type && <span style={{ padding: '3px 9px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>{job.employment_type.replace('_', ' ')}</span>}
          {job.growth_outlook === 'high' && <span style={{ padding: '3px 9px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>↑ High growth</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {formatSalary(job.salary_min, job.salary_max) && (
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>₹{formatSalary(job.salary_min, job.salary_max)} LPA</p>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skill readiness</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#15130F' }}>{readyPct}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 5, background: '#F1F5F9', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${readyPct}%`, background: 'linear-gradient(90deg, #3B82F6, #15130F)', borderRadius: 5, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {total > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {haveCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#059669' }}>
                <CheckCircle2 size={9} />{haveCount} matched
              </span>
            )}
            {gapCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#D97706' }}>
                <TrendingUp size={9} />{gapCount} to build
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <button onClick={onAnalyse} style={{
            flex: 1, height: 36, borderRadius: 9, border: '1.5px solid #E2E8F0',
            background: 'white', color: '#15130F', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#15130F' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
          ><BookOpen size={12} /> Skill Gap</button>
          <button onClick={onStartPrep} style={{
            flex: 1, height: 36, borderRadius: 9, border: 'none',
            background: isActivePrep ? '#15130F' : '#3B82F6',
            color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
            onMouseOver={e => { e.currentTarget.style.opacity = '0.88' }}
            onMouseOut={e => { e.currentTarget.style.opacity = '1' }}
          ><Play size={12} style={{ marginLeft: 1 }} />{isActivePrep ? 'In Progress' : 'Activate'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: { job: LiveJob; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 22, width: '100%', maxWidth: 380, padding: '26px', boxShadow: '0 32px 80px rgba(15,23,42,0.25)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
          <X size={12} />
        </button>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 18, fontWeight: 900, color: 'white' }}>
          {job.company_name.charAt(0)}
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>{job.title}</h3>
        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>{job.company_name}</p>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', marginBottom: 18, fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
          Application tracking coming soon. Apply directly through the employer's website for now.
        </div>
        {job.employer_website ? (
          <a href={job.employer_website.startsWith('http') ? job.employer_website : `https://${job.employer_website}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 44, background: 'linear-gradient(135deg, #3B82F6, #15130F)', color: 'white', borderRadius: 12, textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(21,19,15,0.22)' }}>
            <ExternalLink size={14} /> Visit {job.company_name}
          </a>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 44, background: '#F8FAFC', borderRadius: 12, fontSize: 12, color: '#94A3B8', border: '1px solid #E2E8F0' }}>
            No website listed — contact employer directly
          </div>
        )}
        <button onClick={onClose} style={{ width: '100%', marginTop: 10, fontSize: 11, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 7 }}>Close</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CareerExplorePage() {
  const navigate = useNavigate()
  const { data: preparedJobs, isLoading } = usePreparedJobs()
  const { data: dashboard } = useKrsDashboard()
  const unprepareJob = useUnprepareJob()
  const { activePrep, startPrep } = useActivePrepJob()

  const [selectedJob, setSelectedJob] = useState<LiveJob | null>(null)
  const [applyJob, setApplyJob] = useState<LiveJob | null>(null)

  const kScore = dashboard?.krs.k_score ?? 0

  const handleRemove = async (job: LiveJob) => {
    await unprepareJob.mutateAsync(job.id)
    setSelectedJob(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)', display: 'flex' }}>
      <AppSidebar activePath="/app/careers/explore" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={13} color="white" />
            </div>
            <div>
              <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>My Preparation List</span>
              <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 10, fontWeight: 500 }}>
                {isLoading ? '' : preparedJobs && preparedJobs.length > 0
                  ? `${preparedJobs.length} job${preparedJobs.length === 1 ? '' : 's'} in prep`
                  : 'No jobs added yet'}
              </span>
            </div>
          </div>
          <button onClick={() => navigate('/app/dashboard')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 9, background: '#3B82F6', border: 'none',
            color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)', transition: 'all 0.2s',
          }}>
            <Zap size={12} /> Find Jobs
          </button>
        </header>

        <main style={{ padding: '28px', flex: 1 }}>

          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 300, borderRadius: 22, background: 'rgba(255,255,255,0.7)', animation: 'pulse 2s infinite', border: '1.5px solid rgba(226,232,240,0.6)' }} />
              ))}
            </div>
          )}

          {!isLoading && (!preparedJobs || preparedJobs.length === 0) && (
            <div style={{
              background: 'white', border: '1.5px solid rgba(226,232,240,0.8)',
              borderRadius: 24, padding: '64px 24px', textAlign: 'center',
              boxShadow: '0 4px 20px rgba(15,23,42,0.05)', maxWidth: 480, margin: '60px auto',
            }}>
              <div style={{ width: 60, height: 60, borderRadius: 18, background: '#FAF7F1', border: '1.5px solid #F1EAE0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <BookOpen size={26} color="#15130F" />
              </div>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>No jobs in your prep list</p>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 28, lineHeight: 1.7 }}>
                Go to your dashboard, find a job you like, and click <strong style={{ color: '#3B82F6' }}>"Set as Prep Job"</strong> to add it here.
              </p>
              <button onClick={() => navigate('/app/dashboard')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', borderRadius: 11, fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg, #3B82F6, #15130F)', color: 'white',
                border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,19,15,0.22)',
              }}>
                <Zap size={14} /> See recommended jobs
              </button>
            </div>
          )}

          {!isLoading && preparedJobs && preparedJobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)',
                borderRadius: 14, padding: '11px 16px',
              }}>
                <Sparkles size={13} color="#3B82F6" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                  Click <strong style={{ color: '#15130F' }}>Skill Gap</strong> to see your personalised skill gap analysis. Use <strong style={{ color: '#15130F' }}>Activate</strong> to start your AI prep roadmap.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {preparedJobs.map(job => (
                  <PreparedJobCard
                    key={job.id}
                    job={job}
                    onAnalyse={() => setSelectedJob(job)}
                    onStartPrep={() => startPrep(job.id, { onSuccess: () => navigate('/app/learn') })}
                    isActivePrep={activePrep?.job_id === job.id}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <button onClick={() => navigate('/app/dashboard')} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                  borderRadius: 10, background: 'white', border: '1.5px solid #E2E8F0',
                  color: '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = '#15130F'; e.currentTarget.style.color = '#15130F' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B' }}
                >
                  <ArrowUpRight size={13} /> Add more jobs from Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedJob && (
        <JobAnalysisDrawer
          job={selectedJob} kScore={kScore}
          onClose={() => setSelectedJob(null)}
          onRemove={() => handleRemove(selectedJob)}
          onApply={() => { setSelectedJob(null); setApplyJob(selectedJob) }}
        />
      )}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}

      <style>{`
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  )
}
