import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import JobLearningPlanPanel from '../components/JobLearningPlanPanel'
import RoadmapCounsellorPanel from '../components/RoadmapCounsellorPanel'
import { Map, Briefcase, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — no active job yet
// ─────────────────────────────────────────────────────────────────────────────
function GeneratePrompt() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', padding: 40 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Map size={36} color="white" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 10, fontFamily: 'Hind, sans-serif' }}>Your Roadmap Awaits</h2>
      <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, maxWidth: 400, marginBottom: 28 }}>
        Pick a job from your matches and click "Generate Roadmap" — we'll build a personalised, job-specific learning plan with quizzes and an AI counsellor to help you close the gap.
      </p>
      <button
        onClick={() => navigate('/app/jobs')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', color: 'white', border: 'none', borderRadius: 14, padding: '14px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(21,19,15,0.22)' }}
      >
        Browse Jobs <ArrowRight size={16} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page — just the active job's plan
// ─────────────────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  // useActivePrepJob reads from persisted Zustand store instantly (no network lag)
  const { activePrep, isLoading: prepLoading } = useActivePrepJob()
  const navigate = useNavigate()
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAF7F1 0%, #FFFFFF 55%, #F1EAE0 100%)', display: 'flex' }}>
      <AppSidebar activePath="/app/roadmap" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.8)',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
        }}>
          <button
            onClick={() => navigate('/app/roadmap/history')}
            title="Back to all roadmaps"
            style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(226,232,240,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#475569', transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.08)'; e.currentTarget.style.color = '#0F172A' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(15,23,42,0.04)'; e.currentTarget.style.color = '#475569' }}
          >
            <ArrowLeft size={15} />
          </button>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#15130F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Map size={13} color="white" />
          </div>
          <span style={{ fontFamily: 'Hind, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>My Roadmap</span>
          {activePrep && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>· {activePrep.job_title}</span>}
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <main style={{ padding: '24px 28px', flex: 1, minWidth: 0, overflowY: 'auto' }}>
            {prepLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <Loader2 size={28} color="#15130F" style={{ animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}

            {!prepLoading && !activePrep && <GeneratePrompt />}

            {!prepLoading && activePrep && (
              <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid rgba(226,232,240,0.8)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15,23,42,0.05)', maxWidth: 880 }}>
                <div style={{ background: 'linear-gradient(135deg, #15130F 0%, #1E3A5F 55%, #2563EB 100%)', padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Briefcase size={18} color="white" />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 800, color: 'white', margin: 0 }}>{activePrep.job_title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{activePrep.company_name}</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 22px' }}>
                  <JobLearningPlanPanel
                    roadmap={{ gap_skills: [], active_prep_job_id: String(activePrep.job_id), active_prep_job_title: activePrep.job_title, active_prep_job_company: activePrep.company_name } as any}
                    activeJobId={String(activePrep.job_id)}
                    activeJobTitle={activePrep.job_title}
                    activeCompany={activePrep.company_name}
                    onAskAI={setPendingQuestion}
                  />
                </div>
              </div>
            )}
          </main>

          {!prepLoading && activePrep && (
            <RoadmapCounsellorPanel
              jobId={String(activePrep.job_id)}
              jobTitle={activePrep.job_title}
              company={activePrep.company_name}
              sector={activePrep.sector}
              pendingQuestion={pendingQuestion}
              onPendingQuestionHandled={() => setPendingQuestion(null)}
            />
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
