import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppSidebar from '@/components/layout/AppSidebar'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import JobLearningPlanPanel from '../components/JobLearningPlanPanel'
import RoadmapCounsellorPanel from '../components/RoadmapCounsellorPanel'
import { Map, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

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
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex' }}>
      <AppSidebar activePath="/app/roadmap" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #F1F5F9',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button
            onClick={() => navigate('/app/roadmap/history')}
            title="Back to all roadmaps"
            style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#6B7280', transition: 'background 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#F3F4F6' }}
            onMouseOut={e => { e.currentTarget.style.background = 'none' }}
          >
            <ArrowLeft size={17} />
          </button>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #818CF8, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Map size={15} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: '#111827', margin: 0 }}>My Roadmap</p>
            {activePrep && <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: 0 }}>Your AI job assistant</p>}
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <main style={{ padding: '32px 36px', flex: 1, minWidth: 0, overflowY: 'auto' }}>
            {prepLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <Loader2 size={28} color="#6366F1" style={{ animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}

            {!prepLoading && !activePrep && <GeneratePrompt />}

            {!prepLoading && activePrep && (
              <div style={{ maxWidth: 760 }}>
                <JobLearningPlanPanel
                  roadmap={{ gap_skills: [], active_prep_job_id: String(activePrep.job_id), active_prep_job_title: activePrep.job_title, active_prep_job_company: activePrep.company_name } as any}
                  activeJobId={String(activePrep.job_id)}
                  activeJobTitle={activePrep.job_title}
                  activeCompany={activePrep.company_name}
                  onAskAI={setPendingQuestion}
                />
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
