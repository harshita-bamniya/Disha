import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resumeApi, type ResumeDetail, type ScoreBreakdown } from '@/api/resume'
import ScoreBreakdownCard from './ScoreBreakdownCard'
import KeywordGapList from './KeywordGapList'
import { BarChart2, Tag, Lightbulb, X, Target } from 'lucide-react'

type Tab = 'score' | 'keywords' | 'recommendations'

interface Recommendation {
  icon: string
  text: string
  priority: 'high' | 'medium' | 'low'
}

function buildRecommendations(resume: ResumeDetail): Recommendation[] {
  const recs: Recommendation[] = []
  const bd = resume.score_breakdown
  if (!bd) return recs

  if (bd.keyword_coverage.score === 0) {
    recs.push({ priority: 'high', icon: '🎯', text: 'Set a job target to unlock keyword scoring and tailored recommendations.' })
  }
  if (bd.ats_compatibility.score < 80) {
    const missing = bd.ats_compatibility.explanation
    recs.push({ priority: 'high', icon: '📋', text: missing })
  }
  if (bd.impact.score < 60) {
    recs.push({ priority: 'high', icon: '⚡', text: 'Strengthen experience bullets: add action verbs (Led, Built, Reduced) and quantify outcomes with numbers.' })
  }
  if (bd.formatting.score < 60) {
    recs.push({ priority: 'medium', icon: '📝', text: bd.formatting.explanation })
  }
  if (bd.completeness.score < 70) {
    recs.push({ priority: 'medium', icon: '📦', text: 'Expand thin sections — add more detail to experience and skills.' })
  }
  if (bd.readability.score < 70) {
    recs.push({ priority: 'low', icon: '✍️', text: bd.readability.explanation })
  }
  if (recs.length === 0) {
    recs.push({ priority: 'low', icon: '✅', text: 'Resume is in great shape! Set a job target to get keyword-specific recommendations.' })
  }
  return recs
}

const PRIORITY_COLORS = {
  high:   { dot: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
  medium: { dot: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  low:    { dot: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

interface Props {
  resume: ResumeDetail
  onClose: () => void
}

export default function ResumeInsightsPanel({ resume, onClose }: Props) {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('score')
  const [jobDescription, setJobDescription] = useState<string>(resume.score_breakdown?.keyword_coverage.explanation.includes('No job target') ? '' : '')
  const [showJdInput, setShowJdInput] = useState(false)
  const [jdDraft, setJdDraft] = useState('')

  const setTargetMutation = useMutation({
    mutationFn: (jd: string) => resumeApi.setJobTarget(resume.id, { job_description: jd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resume', resume.id] })
      setJobDescription(jdDraft)
      setShowJdInput(false)
    },
  })

  const recommendations = buildRecommendations(resume)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'score',           label: 'Score',           icon: <BarChart2 size={12} /> },
    { id: 'keywords',        label: 'Keywords',        icon: <Tag size={12} /> },
    { id: 'recommendations', label: 'Suggestions',     icon: <Lightbulb size={12} /> },
  ]

  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: '#F4F5F7', borderLeft: '1px solid rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* panel header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          AI Insights
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* job target bar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', background: 'white' }}>
        {!showJdInput ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={12} color="#1A2744" />
            <span style={{ flex: 1, fontSize: 11, color: '#64748B' }}>
              {jobDescription ? 'Job target set' : 'No job target'}
            </span>
            <button
              onClick={() => setShowJdInput(true)}
              style={{ fontSize: 11, color: '#1A2744', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {jobDescription ? 'Change' : 'Set target'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={jdDraft}
              onChange={e => setJdDraft(e.target.value)}
              placeholder="Paste job description or key requirements..."
              rows={3}
              autoFocus
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid rgba(26,39,68,0.2)', fontSize: 11, resize: 'none', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowJdInput(false)}
                style={{ flex: 1, padding: '5px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: 'white', color: '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={() => setTargetMutation.mutate(jdDraft)}
                disabled={!jdDraft.trim() || setTargetMutation.isPending}
                style={{ flex: 2, padding: '5px', borderRadius: 7, background: '#1A2744', color: 'white', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, opacity: !jdDraft.trim() || setTargetMutation.isPending ? 0.6 : 1 }}
              >
                {setTargetMutation.isPending ? 'Saving…' : 'Save Target'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #E2E8F0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer',
              background: 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #1A2744' : '2px solid transparent',
              color: activeTab === tab.id ? '#1A2744' : '#94A3B8',
              fontSize: 10.5, fontWeight: 700,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>

        {/* Score tab */}
        {activeTab === 'score' && (
          resume.score_breakdown
            ? <ScoreBreakdownCard breakdown={resume.score_breakdown} />
            : <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 24 }}>Add sections to see your score breakdown.</p>
        )}

        {/* Keywords tab */}
        {activeTab === 'keywords' && (
          <KeywordGapList
            resumeId={resume.id}
            jobDescription={jobDescription || null}
          />
        )}

        {/* Recommendations tab */}
        {activeTab === 'recommendations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
              {recommendations.length} suggestion{recommendations.length !== 1 ? 's' : ''}
            </p>
            {recommendations.map((rec, i) => {
              const s = PRIORITY_COLORS[rec.priority]
              return (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: s.bg, border: `1px solid ${s.border}`,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{rec.icon}</span>
                  <span style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.5 }}>{rec.text}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
