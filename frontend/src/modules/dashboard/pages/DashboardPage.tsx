import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKrsDashboard, useLiveJobs, usePrepareJob, useUnprepareJob } from '../hooks/useKrs'
import { MapPin, Map, BookOpen, ExternalLink, X, CheckCircle2, TrendingUp, Zap, Target, ArrowUpRight, Sparkles, ChevronRight, Bell, Mic, FileText, ClipboardList, Mail } from 'lucide-react'
import { useOnboardingStatus } from '@/modules/onboarding/hooks/useOnboarding'
import type { LiveJob } from '@/api/krs'
import { formatSalary } from '@/api/jobs'
import AppSidebar from '@/components/layout/AppSidebar'
import JobAnalysisDrawer from '@/components/JobAnalysisDrawer'
import { resumeApi } from '@/api/resume'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { applyToJob, getMyApplications } from '@/api/matching'
import { jobPlanApi } from '@/api/jobPlan'
import { getApiError } from '@/api/client'
import { authApi } from '@/api/auth'
import ProfileCompletionCard from '../components/ProfileCompletionCard'

const SECTOR_COLORS: Record<string, [string, string]> = {
  'Consulting': ['#6366F1', '#818CF8'],
  'Government': ['#0EA5E9', '#38BDF8'],
  'NGO':        ['#10B981', '#34D399'],
  'Education':  ['#F59E0B', '#FBbf24'],
  'Banking':    ['#8B5CF6', '#A78BFA'],
  'Media':      ['#EC4899', '#F472B6'],
  'Healthcare': ['#14B8A6', '#2DD4BF'],
  'IT':         ['#6366F1', '#818CF8'],
  'Research':   ['#F97316', '#FB923C'],
  default:      ['#3B82F6', '#60A5FA'],
}
function sectorColor(sector: string): [string, string] {
  const key = Object.keys(SECTOR_COLORS).find(k => sector?.includes(k)) ?? 'default'
  return SECTOR_COLORS[key]
}

// ── Job spotlight (single large card, one job at a time) ──────────────────────
function JobSpotlight({ job, onOpen, onApply, onPrepare, onGenerateResume, onViewRoadmap, roadmapStatus, onMockInterview, onOpenResume, isPreparing, isApplied, isTailoringResume }: {
  job: LiveJob; onOpen: () => void; onApply: () => void; onPrepare: () => void
  onGenerateResume: () => void; onViewRoadmap: () => void; roadmapStatus?: 'generating' | 'ready' | 'failed'
  onMockInterview: () => void; onOpenResume: () => void
  isPreparing?: boolean; isApplied?: boolean; isTailoringResume?: boolean
}) {
  const salary = formatSalary(job.salary_min, job.salary_max)
  const [hov, setHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'white', borderRadius: 18, overflow: 'hidden',
        border: `1px solid ${hov ? '#DBEAFE' : '#EEF2F9'}`,
        boxShadow: hov
          ? '0 20px 44px rgba(15,23,42,0.12), 0 4px 12px rgba(37,99,235,0.10)'
          : '0 10px 28px rgba(15,23,42,0.07), 0 2px 6px rgba(15,23,42,0.04)',
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* ── Header ── */}
      <div style={{ padding: '22px 26px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 13, background: '#EFF6FF',
              border: '1px solid #DBEAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#3B82F6', flexShrink: 0,
              boxShadow: '0 4px 10px rgba(37,99,235,0.12)',
            }}>
              {job.company_name.charAt(0)}
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0, cursor: 'pointer' }} onClick={onOpen}>{job.title}</h2>
              <p style={{ fontSize: 13, color: '#64748B', margin: '3px 0 0' }}>{job.company_name}</p>
            </div>
          </div>
          <div style={{
            textAlign: 'center', flexShrink: 0, background: '#EFF6FF', border: '1px solid #DBEAFE',
            borderRadius: 12, padding: '7px 14px',
            boxShadow: '0 4px 10px rgba(37,99,235,0.12)',
          }}>
            <p style={{ fontSize: 19, fontWeight: 800, color: '#3B82F6', margin: 0, lineHeight: 1 }}>{job.match_score}%</p>
            <p style={{ fontSize: 9.5, color: '#60A5FA', fontWeight: 700, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>match</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {job.sector && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #F1F5F9', padding: '4px 11px', borderRadius: 20 }}>{job.sector}</span>}
          {job.location && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #F1F5F9', padding: '4px 11px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{job.location}</span>}
          {job.job_type && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #F1F5F9', padding: '4px 11px', borderRadius: 20, textTransform: 'capitalize' }}>{job.job_type.replace('_', ' ')}</span>}
          {job.employment_type && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #F1F5F9', padding: '4px 11px', borderRadius: 20, textTransform: 'capitalize' }}>{job.employment_type.replace('_', ' ')}</span>}
        </div>
      </div>

      {/* ── Salary + skill overlap bar ── */}
      <div style={{ padding: '20px 26px', borderBottom: '1px solid #F1F5F9', background: 'linear-gradient(180deg, #FAFBFF, #FFFFFF)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          {salary ? (
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>Salary range</p>
              <p style={{ fontSize: 17, color: '#0F172A', fontWeight: 800, margin: 0 }}>₹{salary} LPA</p>
            </div>
          ) : <div />}
          <div style={{ flex: 1, maxWidth: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748B', marginBottom: 7, fontWeight: 600 }}>
              <span>Skill overlap</span>
              <span style={{ color: '#3B82F6', fontWeight: 700 }}>{job.skill_overlap}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: '#E2E8F0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${job.skill_overlap}%`, background: 'linear-gradient(90deg, #93C5FD, #3B82F6)', borderRadius: 6, transition: 'width 0.7s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── About this role ── */}
      {job.description && (
        <div style={{ padding: '18px 26px', borderBottom: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 9 }}>About this role</p>
          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7 }}>{job.description}</p>
        </div>
      )}

      {/* ── Required skills ── */}
      {job.required_skills.length > 0 && (
        <div style={{ padding: '18px 26px', borderBottom: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Required skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {job.required_skills.map(sk => (
              <span key={sk} style={{ fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 20, background: '#F0F4FF', border: '1px solid #E0E7FF', color: '#6366F1' }}>{sk}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Three action cards ── */}
      <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, borderBottom: '1px solid #F1F5F9' }}>
        {/* Resume */}
        <div className="dash-action-card" style={{
          background: 'white', border: '1px solid #EEF2F9', borderRadius: 16, padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 10,
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)', transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(150deg, #60A5FA, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
            boxShadow: '0 4px 10px rgba(37,99,235,0.25)',
          }}>
            <FileText size={16} />
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: '0 0 3px' }}>Resume</p>
            <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.55 }}>Tailor and optimise your resume for this role.</p>
          </div>
          <button onClick={onOpenResume} disabled={isTailoringResume} style={{
            marginTop: 'auto', height: 36, borderRadius: 10, border: '1.5px solid #BFDBFE',
            background: 'white', color: '#3B82F6', opacity: isTailoringResume ? 0.7 : 1,
            fontSize: 12, fontWeight: 700, cursor: isTailoringResume ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            {isTailoringResume
              ? <><div style={{ width: 11, height: 11, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating…</>
              : <><FileText size={12} /> Open Resume</>}
          </button>
        </div>

        {/* Generate Roadmap — once a plan exists for this job, never re-trigger generation */}
        <div className="dash-action-card" style={{
          background: 'white', border: '1px solid #EEF2F9', borderRadius: 16, padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 10,
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)', transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: roadmapStatus === 'ready' ? 'linear-gradient(150deg, #34D399, #16A34A)' : 'linear-gradient(150deg, #60A5FA, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
            boxShadow: roadmapStatus === 'ready' ? '0 4px 10px rgba(22,163,74,0.25)' : '0 4px 10px rgba(37,99,235,0.25)',
          }}>
            {roadmapStatus === 'ready' ? <CheckCircle2 size={16} /> : <Map size={16} />}
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: '0 0 3px' }}>
              {roadmapStatus === 'ready' ? 'Roadmap Ready' : roadmapStatus === 'generating' ? 'Generating Roadmap' : 'Generate Roadmap'}
            </p>
            <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.55 }}>
              {roadmapStatus === 'ready'
                ? "You've already built a learning roadmap for this role."
                : roadmapStatus === 'generating'
                  ? 'BeginablAI is putting your roadmap together right now.'
                  : 'AI-powered learning roadmap tailored to this role.'}
            </p>
          </div>
          <button onClick={roadmapStatus ? onViewRoadmap : onGenerateResume} style={{
            marginTop: 'auto', height: 36, borderRadius: 10,
            border: roadmapStatus === 'ready' ? '1.5px solid #BBF7D0' : '1.5px solid #BFDBFE',
            background: 'white', color: roadmapStatus === 'ready' ? '#16A34A' : '#3B82F6',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            {roadmapStatus === 'ready'
              ? <><CheckCircle2 size={12} /> View Roadmap</>
              : roadmapStatus === 'generating'
                ? <><div style={{ width: 11, height: 11, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> View Progress</>
                : <><Map size={12} /> Generate</>}
          </button>
        </div>

        {/* Mock Interview */}
        <div className="dash-action-card" style={{
          background: 'white', border: '1px solid #EEF2F9', borderRadius: 16, padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 10,
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)', transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(150deg, #A78BFA, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
            boxShadow: '0 4px 10px rgba(124,58,237,0.25)',
          }}>
            <Mic size={16} />
          </div>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: '0 0 3px' }}>Mock Interview</p>
            <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.55 }}>AI interviewer roleplay with a detailed scorecard.</p>
          </div>
          <button onClick={onMockInterview} style={{
            marginTop: 'auto', height: 36, borderRadius: 10, border: '1.5px solid #DDD6FE',
            background: 'white', color: '#7C3AED',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <Mic size={12} /> Start
          </button>
        </div>
      </div>

      {/* ── Apply CTA ── */}
      <div style={{ padding: '18px 26px' }}>
        {isApplied ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={17} color="#16A34A" />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: 0 }}>Application submitted</p>
              <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 0' }}>You'll be notified when the employer responds.</p>
            </div>
          </div>
        ) : (
          <button onClick={onApply} style={{
            width: '100%', height: 48, borderRadius: 12,
            background: 'white', color: '#3B82F6', border: '1.5px solid #BFDBFE',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 2px 8px rgba(37,99,235,0.08)',
            transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
          }}
            onMouseOver={e => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#93C5FD' }}
            onMouseOut={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#BFDBFE' }}
          >
            <ArrowUpRight size={15} /> Apply Now
          </button>
        )}
      </div>
    </div>
  )
}

// ── Compact job row ───────────────────────────────────────────────────────────
function JobRow({ job, index, onOpen, onApply, onPrepare, isPreparing, isApplied }: {
  job: LiveJob; index: number; onOpen: () => void; onApply: () => void; onPrepare: () => void; isPreparing?: boolean; isApplied?: boolean
}) {
  const [c1] = sectorColor(job.sector)
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        background: hov ? 'white' : 'rgba(255,255,255,0.85)',
        borderRadius: 14, padding: '12px 14px',
        border: hov ? `1.5px solid ${c1}28` : '1.5px solid rgba(226,232,240,0.7)',
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        boxShadow: hov ? `0 8px 24px ${c1}15` : '0 1px 4px rgba(15,23,42,0.03)',
        transform: hov ? 'translateX(5px)' : 'translateX(0)',
        transition: 'all 0.22s cubic-bezier(0.34,1.1,0.64,1)',
        animation: `rowIn 0.4s ease both`,
        animationDelay: `${200 + index * 50}ms`,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: `${c1}14`, border: `1.5px solid ${c1}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 900, color: c1, flexShrink: 0,
      }}>
        {job.company_name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</h3>
          {job.growth_outlook === 'high' && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#059669', background: 'rgba(16,185,129,0.08)', padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.15)' }}>↑ High</span>}
        </div>
        <p style={{ fontSize: 11, color: '#94A3B8' }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 900, color: c1, fontFamily: 'Hind, sans-serif', lineHeight: 1 }}>{job.match_score}%</p>
          <p style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>match</p>
        </div>
        {formatSalary(job.salary_min, job.salary_max) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '3px 8px' }}>
            ₹{formatSalary(job.salary_min, job.salary_max)} LPA
          </span>
        )}
        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
          <button onClick={onPrepare} disabled={isPreparing} style={{
            height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'white', border: `1.5px solid ${c1}28`, color: c1,
            display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
          }}>
            {isPreparing
              ? <div style={{ width: 9, height: 9, border: `2px solid ${c1}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <><BookOpen size={9} />{job.is_prepared ? 'Saved' : 'Prep'}</>}
          </button>
          <button onClick={isApplied ? undefined : onApply} disabled={isApplied} style={{
            height: 28, padding: '0 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer',
            background: isApplied ? 'rgba(16,185,129,0.1)' : c1, color: isApplied ? '#059669' : 'white',
            border: isApplied ? '1.5px solid rgba(16,185,129,0.3)' : 'none',
            display: 'flex', alignItems: 'center', gap: 3, boxShadow: isApplied ? 'none' : `0 2px 8px ${c1}35`, transition: 'all 0.2s',
          }}>
            {isApplied ? <><CheckCircle2 size={9} /> Applied</> : <><ArrowUpRight size={9} /> Apply</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Job detail modal ──────────────────────────────────────────────────────────
function JobModal({ job, onClose, onApply, onPrepare, onGenerateResume, onViewRoadmap, roadmapStatus, isPreparing, isApplied }: {
  job: LiveJob; onClose: () => void; onApply: () => void; onPrepare: () => void; onGenerateResume: () => void
  onViewRoadmap: () => void; roadmapStatus?: 'generating' | 'ready' | 'failed'
  isPreparing?: boolean; isApplied?: boolean
}) {
  const [c1, c2] = sectorColor(job.sector)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(14px)', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 28, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(15,23,42,0.3)', animation: 'popIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both' }}>
        <div style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, padding: '24px 24px 20px', borderRadius: '28px 28px 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', top: -60, right: -50, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'white', border: '1.5px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {job.company_name.charAt(0)}
              </div>
              <div>
                <h2 style={{ fontFamily: 'Hind, sans-serif', fontSize: 18, fontWeight: 900, color: 'white', marginBottom: 2 }}>{job.title}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}><Target size={10} />{job.match_score}% match</span>
            {job.job_type && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.2)', textTransform: 'capitalize' }}>{job.job_type}</span>}
            {job.growth_outlook === 'high' && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>↑ High growth</span>}
            {formatSalary(job.salary_min, job.salary_max) && <span style={{ padding: '4px 11px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}>₹{formatSalary(job.salary_min, job.salary_max)} LPA</span>}
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {(job.skills_you_have.length > 0 || job.skills_to_develop.length > 0) && (
            <div style={{ background: `${c1}07`, borderRadius: 16, padding: 16, border: `1px solid ${c1}15` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={10} />Skill gap</p>
              {job.skills_you_have.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} />You have ({job.skills_you_have.length})</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{job.skills_you_have.map(sk => <span key={sk} style={{ padding: '3px 9px', background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#059669' }}>✓ {sk}</span>)}</div>
                </div>
              )}
              {job.skills_to_develop.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: '#D97706', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={11} />Build ({job.skills_to_develop.length})</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{job.skills_to_develop.map(sk => <span key={sk} style={{ padding: '3px 9px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#D97706' }}>+ {sk}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {job.description && <div><p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>About this role</p><p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8 }}>{job.description}</p></div>}
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#94A3B8', paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
            <span>Posted {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {job.expires_at && <span style={{ color: new Date(job.expires_at) < new Date() ? '#DC2626' : '#94A3B8' }}>{new Date(job.expires_at) < new Date() ? '⚠ Expired' : `Closes ${new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</span>}
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={roadmapStatus ? onViewRoadmap : onGenerateResume} style={{ width: '100%', height: 46, borderRadius: 13, background: roadmapStatus === 'ready' ? '#16A34A' : 'linear-gradient(135deg, #15130F, #1E3A5F)', color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 18px rgba(21,19,15,0.3)', transition: 'all 0.2s' }}>
            <Map size={15} /> {roadmapStatus === 'ready' ? 'View Your Roadmap' : roadmapStatus === 'generating' ? 'View Generation Progress' : 'Generate Roadmap for This Job'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onPrepare} disabled={isPreparing} style={{ flex: 1, height: 42, borderRadius: 13, border: '1.5px solid #E2E8F0', background: job.is_prepared ? `${c1}08` : 'white', color: job.is_prepared ? c1 : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
              {isPreparing ? <div style={{ width: 14, height: 14, border: `2px solid ${c1}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <><BookOpen size={13} />{job.is_prepared ? '✓ In Prep List' : 'Add to Prep List'}</>}
            </button>
            <button onClick={isApplied ? undefined : onApply} disabled={isApplied} style={{ flex: 1, height: 42, borderRadius: 13, background: isApplied ? 'rgba(16,185,129,0.08)' : 'white', color: isApplied ? '#059669' : c1, border: isApplied ? '1.5px solid rgba(16,185,129,0.25)' : `1.5px solid ${c1}40`, fontSize: 13, fontWeight: 700, cursor: isApplied ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: isApplied ? 'none' : `0 2px 8px ${c1}15`, transition: 'all 0.2s' }}>
              {isApplied ? <><CheckCircle2 size={13} /> Applied</> : <><ExternalLink size={13} /> Apply Now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Apply modal ───────────────────────────────────────────────────────────────
function ApplyModal({ job, onClose }: { job: LiveJob; onClose: () => void }) {
  const [c1, c2] = sectorColor(job.sector)
  const [coverNote, setCoverNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const qc = useQueryClient()

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(job.id, coverNote.trim() || undefined),
    onSuccess: () => {
      setSubmitted(true)
      qc.invalidateQueries({ queryKey: ['my-applications'] })
      qc.invalidateQueries({ queryKey: ['live-jobs'] })
    },
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(14px)', animation: 'fadeIn 0.2s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 400, padding: 26, boxShadow: '0 24px 60px rgba(15,23,42,0.25)', animation: 'popIn 0.3s cubic-bezier(0.34,1.5,0.64,1) both', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
          <X size={13} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginBottom: 6 }}>Application Submitted!</h3>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
              The employer will review your profile and KRS score. You'll be notified of any updates.
            </p>
            <button onClick={onClose} style={{ marginTop: 18, padding: '10px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💼</div>
            <h3 style={{ fontFamily: 'Hind, sans-serif', fontSize: 17, fontWeight: 900, color: '#0F172A', marginBottom: 3 }}>{job.title}</h3>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>{job.company_name}</p>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 13px', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#15803D', lineHeight: 1.6, margin: 0 }}>
                Your full profile, KRS score, and skills will be shared with the employer.
              </p>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Cover note <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span>
            </label>
            <textarea
              value={coverNote}
              onChange={e => setCoverNote(e.target.value)}
              placeholder="Tell the employer why you're a great fit..."
              maxLength={1000}
              rows={3}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', color: '#1E293B', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 4 }}
            />
            <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginBottom: 16 }}>{coverNote.length}/1000</p>

            {applyMutation.isError && (
              <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
                {(applyMutation.error as any)?.response?.data?.detail || 'Failed to submit. Please try again.'}
              </p>
            )}

            <button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              style={{ width: '100%', height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${c1}, ${c2})`, color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: applyMutation.isPending ? 'not-allowed' : 'pointer', opacity: applyMutation.isPending ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 14px ${c1}40` }}
            >
              {applyMutation.isPending ? (
                <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Submitting…</>
              ) : (
                <><CheckCircle2 size={15} />Submit Application</>
              )}
            </button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 8, fontSize: 12, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 7 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, error } = useKrsDashboard()
  const { data: liveJobs, isLoading: jobsLoading } = useLiveJobs()
  const { data: onboarding } = useOnboardingStatus()
  const { data: myApps } = useQuery({ queryKey: ['my-applications'], queryFn: getMyApplications })
  const appliedJobIds = new Set((myApps ?? []).map(a => a.job_id))
  // Tracks which jobs already have a generated roadmap, so the card can offer
  // "View Roadmap" instead of letting the user keep re-triggering generation.
  const { data: jobPlans } = useQuery({ queryKey: ['job-plans-all'], queryFn: jobPlanApi.getAllMine })
  const roadmapStatusByJobId: Record<string, 'generating' | 'ready' | 'failed'> = {}
  for (const p of jobPlans ?? []) roadmapStatusByJobId[p.job_id] = p.status
  const prepareJob   = usePrepareJob()
  const unprepareJob = useUnprepareJob()
  const { startPrep } = useActivePrepJob()

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 5 * 60 * 1000 })
  const [emailVerifSent, setEmailVerifSent] = useState(false)
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false)
  const sendVerifMutation = useMutation({
    mutationFn: authApi.sendEmailVerification,
    onSuccess: () => setEmailVerifSent(true),
  })
  const showEmailBanner = !emailBannerDismissed && !!currentUser?.email && !currentUser.email_verified

  const [selectedJob,    setSelectedJob]    = useState<LiveJob | null>(null)
  const [applyJob,       setApplyJob]       = useState<LiveJob | null>(null)
  const [preparingJobId, setPreparingJobId] = useState<string | null>(null)
  const [skillGapJob,    setSkillGapJob]    = useState<LiveJob | null>(null)
  const [jobPage,        setJobPage]        = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const JOBS_PER_PAGE = 1

  const onboardingStep = onboarding?.current_step ?? 1
  const onboardingDone = onboarding?.is_completed ?? false
  const showOnboardingBanner = !bannerDismissed && !onboardingDone && onboardingStep >= 2 && onboardingStep < 7
  const onboardingPct = Math.round(((onboardingStep - 1) / 6) * 100)

  const handlePrepare = async (job: LiveJob) => {
    setPreparingJobId(job.id)
    try {
      if (job.is_prepared) await unprepareJob.mutateAsync(job.id)
      else await prepareJob.mutateAsync(job.id)
    } finally { setPreparingJobId(null) }
  }

  const handleGenerateResume = (job: LiveJob) => {
    setSelectedJob(null)
    startPrep(job.id, {
      onSuccess: () => {
        // Kick off the job-specific learning plan — previously this just set the active
        // job and navigated, landing the user on whatever old roadmap already existed with
        // nothing new generated. RoadmapPage's JobLearningPlanPanel picks up the
        // "generating" status and shows live progress.
        jobPlanApi.generate(job.id).catch(() => {})
        qc.invalidateQueries({ queryKey: ['job-plans-all'] })
        navigate('/app/roadmap')
      },
    })
  }

  // A roadmap already exists for this job — just switch to it, never regenerate.
  const handleViewRoadmap = (job: LiveJob) => {
    setSelectedJob(null)
    startPrep(job.id, { onSuccess: () => navigate('/app/roadmap') })
  }

  // Mock Interview from a job card scopes just this one interview session to that job —
  // it does NOT touch the active prep job (only Generate Roadmap / switching roadmaps does
  // that). Job context travels via route state instead of the shared active-prep pointer.
  const handleMockInterview = (job: LiveJob) => {
    navigate('/app/interview/setup', {
      state: {
        jobContext: {
          job_title: job.title,
          company_name: job.company_name,
          required_skills: job.required_skills,
          skills_to_develop: job.skills_to_develop,
        },
      },
    })
  }

  // Resume from a job card auto-creates a resume tailored to that specific job and opens
  // it — same as the job detail page's "Tailored Resume" action. Doesn't touch active prep.
  const [tailoringResumeJobId, setTailoringResumeJobId] = useState<string | null>(null)
  const [tailorResumeError, setTailorResumeError] = useState<string | null>(null)
  const handleTailoredResume = async (job: LiveJob) => {
    setTailoringResumeJobId(job.id)
    setTailorResumeError(null)
    try {
      const newResume = await resumeApi.createResume({ title: `${job.title} — ${job.company_name}` })
      await resumeApi.aiGenerateResume(newResume.id, {
        job_title: job.title,
        company_name: job.company_name,
        required_skills: job.required_skills,
        job_description: job.description,
      })
      navigate(`/app/resume/${newResume.id}`)
    } catch (err: any) {
      setTailorResumeError(err?.response?.data?.detail ?? 'Failed to generate resume. Please try again.')
    } finally {
      setTailoringResumeJobId(null)
    }
  }

  const gapFreq: Record<string, number> = {}
  let totalReq = 0, totalHave = 0
  for (const j of liveJobs ?? []) {
    totalReq += j.required_skills.length; totalHave += j.skills_you_have.length
    for (const sk of j.skills_to_develop) { const k = sk.toLowerCase().trim(); gapFreq[k] = (gapFreq[k] ?? 0) + 1 }
  }
  const topGaps  = Object.entries(gapFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s)
  const skillPct = totalReq > 0 ? Math.round((totalHave / totalReq) * 100) : 0

  const recommendedJobs = [...(liveJobs ?? [])].sort((a, b) => b.match_score - a.match_score).slice(0, 10)
  const totalJobPages   = Math.max(1, Math.ceil(recommendedJobs.length / JOBS_PER_PAGE))
  const safeJobPage     = Math.min(jobPage, totalJobPages - 1)
  const pageJobs         = recommendedJobs.slice(safeJobPage * JOBS_PER_PAGE, safeJobPage * JOBS_PER_PAGE + JOBS_PER_PAGE)

  return (
    <div style={{ minHeight: '100vh', background: 'white', display: 'flex' }}>
      <AppSidebar activePath="/app/dashboard" />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* ── Top bar ── */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #F1F5F9',
          padding: '0 32px', height: 66,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #818CF8, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(99,102,241,0.3)',
            }}>
              <Sparkles size={15} color="white" />
            </div>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: '#111827' }}>Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
              <Bell size={17} />
            </button>
            <button onClick={() => navigate('/app/profile')} style={{
              background: '#EEF2FF', border: 'none', padding: '8px 16px', borderRadius: 10,
              color: '#6366F1', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Edit Profile <ArrowUpRight size={12} />
            </button>
          </div>
        </header>

        <main style={{ padding: '32px 32px 48px', flex: 1, background: '#FAFBFD' }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {error && (
            getApiError(error).toLowerCase().includes('onboarding incomplete') ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
                  border: '1px solid #E0E7FF', borderRadius: 18, padding: '32px 28px', textAlign: 'center',
                }}>
                  <Sparkles size={28} color="#6366F1" style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>
                    Complete your profile to unlock job matches
                  </p>
                  <p style={{ fontSize: 13, color: '#64748B', maxWidth: 380, margin: '0 auto' }}>
                    Your KRS score and tailored job recommendations need a bit more info — add a few
                    details from the checklist to the right and they'll appear here automatically.
                  </p>
                </div>
                <ProfileCompletionCard />
              </div>
            ) : (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', color: '#DC2626', fontSize: 14 }}>
                Could not load. Please refresh.
              </div>
            )
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* ── Email verification banner ── */}
              {showEmailBanner && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14,
                  padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <Mail size={18} color="#D97706" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {emailVerifSent ? (
                      <p style={{ fontSize: 13, color: '#92400E', margin: 0, fontWeight: 600 }}>
                        Verification email sent to <strong>{currentUser?.email}</strong> — check your inbox.
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
                        <strong>Verify your email</strong> — {currentUser?.email} is unverified.
                        Some notifications won't reach you until this is done.
                      </p>
                    )}
                  </div>
                  {!emailVerifSent && (
                    <button
                      onClick={() => sendVerifMutation.mutate()}
                      disabled={sendVerifMutation.isPending}
                      style={{
                        flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: '#D97706', color: 'white', fontSize: 12.5, fontWeight: 700,
                        cursor: sendVerifMutation.isPending ? 'not-allowed' : 'pointer',
                        opacity: sendVerifMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {sendVerifMutation.isPending ? 'Sending…' : 'Send Link'}
                    </button>
                  )}
                  <button
                    onClick={() => setEmailBannerDismissed(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D97706', padding: 2, flexShrink: 0, display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* ── Onboarding progress banner ── */}
              {showOnboardingBanner && (
                <div style={{
                  background: 'linear-gradient(135deg, #EEF2FF, #F0FDF4)',
                  border: '1px solid #C7D2FE',
                  borderRadius: 14, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ClipboardList size={16} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B', margin: '0 0 4px' }}>
                      Your profile is {onboardingPct}% complete
                    </p>
                    <div style={{ height: 5, borderRadius: 5, background: '#E0E7FF', overflow: 'hidden', maxWidth: 240 }}>
                      <div style={{ height: '100%', width: `${onboardingPct}%`, background: 'linear-gradient(90deg, #6366F1, #818CF8)', borderRadius: 5, transition: 'width 0.6s ease' }} />
                    </div>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                      Complete your profile to unlock better job matches and your KRS score.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/app/onboarding/step/${onboardingStep}`)}
                    style={{
                      padding: '8px 16px', borderRadius: 9, border: 'none',
                      background: '#6366F1', color: 'white',
                      fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    Continue <ChevronRight size={13} />
                  </button>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0, display: 'flex' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* ── RECOMMENDED JOBS + SIDEBAR ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>

                {/* Jobs — top 10, shown one at a time */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Top matches for you</p>
                    {!jobsLoading && recommendedJobs.length > 0 && (
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{recommendedJobs.length} roles found</span>
                    )}
                  </div>

                  {tailorResumeError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', color: '#DC2626', fontSize: 12, marginBottom: 14 }}>
                      {tailorResumeError}
                    </div>
                  )}

                  {jobsLoading && (
                    <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid #EEF2F9', boxShadow: '0 10px 28px rgba(15,23,42,0.06)' }}>
                      <div style={{ height: 90, background: '#F1F5F9', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ height: 260, background: 'white', padding: 22 }}>
                        <div style={{ height: 10, background: '#F1F5F9', borderRadius: 6, marginBottom: 12, width: '40%', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ height: 16, background: '#F1F5F9', borderRadius: 6, marginBottom: 10, width: '70%', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ height: 10, background: '#F1F5F9', borderRadius: 6, width: '50%', animation: 'pulse 1.5s infinite' }} />
                      </div>
                    </div>
                  )}

                  {!jobsLoading && pageJobs.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      {/* Side nav arrows — float over the card edges so users don't need to scroll down */}
                      <button
                        onClick={() => setJobPage(p => Math.max(0, p - 1))}
                        disabled={safeJobPage === 0}
                        aria-label="Previous job"
                        style={{
                          position: 'absolute', left: -18, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
                          width: 38, height: 38, borderRadius: '50%', border: '1px solid #EEF2F9',
                          background: safeJobPage === 0 ? '#F8FAFC' : 'white',
                          boxShadow: safeJobPage === 0 ? 'none' : '0 8px 20px rgba(15,23,42,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: safeJobPage === 0 ? 'default' : 'pointer',
                          color: safeJobPage === 0 ? '#CBD5E1' : '#6366F1', transition: 'all 0.2s',
                        }}
                      >
                        <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                      <button
                        onClick={() => setJobPage(p => Math.min(totalJobPages - 1, p + 1))}
                        disabled={safeJobPage >= totalJobPages - 1}
                        aria-label="Next job"
                        style={{
                          position: 'absolute', right: -18, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
                          width: 38, height: 38, borderRadius: '50%', border: '1px solid #EEF2F9',
                          background: safeJobPage >= totalJobPages - 1 ? '#F8FAFC' : 'white',
                          boxShadow: safeJobPage >= totalJobPages - 1 ? 'none' : '0 8px 20px rgba(15,23,42,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: safeJobPage >= totalJobPages - 1 ? 'default' : 'pointer',
                          color: safeJobPage >= totalJobPages - 1 ? '#CBD5E1' : '#6366F1', transition: 'all 0.2s',
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>

                      {pageJobs.map(job => (
                        <JobSpotlight key={job.id} job={job}
                          onOpen={() => setSelectedJob(job)}
                          onApply={() => setApplyJob(job)}
                          onPrepare={() => handlePrepare(job)}
                          onGenerateResume={() => handleGenerateResume(job)}
                          onViewRoadmap={() => handleViewRoadmap(job)}
                          roadmapStatus={roadmapStatusByJobId[job.id]}
                          onMockInterview={() => handleMockInterview(job)}
                          onOpenResume={() => handleTailoredResume(job)}
                          isPreparing={preparingJobId === job.id}
                          isApplied={appliedJobIds.has(job.id)}
                          isTailoringResume={tailoringResumeJobId === job.id}
                        />
                      ))}

                      {/* Page indicator dots */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                        {Array.from({ length: totalJobPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setJobPage(i)}
                            aria-label={`Go to job ${i + 1}`}
                            style={{
                              width: i === safeJobPage ? 18 : 6, height: 6, borderRadius: 3, border: 'none',
                              background: i === safeJobPage ? '#6366F1' : '#E2E8F0',
                              cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!jobsLoading && recommendedJobs.length === 0 && (
                    <div style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>No openings yet</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF' }}>Employers are posting roles — check back soon.</p>
                    </div>
                  )}
                </div>

                {/* Right sidebar — profile completion + skill intelligence */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
                <ProfileCompletionCard />
                <div style={{
                  background: 'white', border: '1px solid #EEF2F9', borderRadius: 18, padding: '20px',
                  boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(150deg, #A78BFA, #7C3AED)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 3px 8px rgba(124,58,237,0.25)',
                    }}>
                      <Zap size={13} color="white" />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Your Gap Analysis</p>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '6px 0 18px' }}>
                    Based on your top {liveJobs?.length ?? 0} job matches
                  </p>

                  {/* Skill coverage meter */}
                  <div style={{ paddingBottom: 18, borderBottom: '1px solid #F4F6F9', marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#9CA3AF' }}>Skill coverage</span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: skillPct >= 60 ? '#16A34A' : skillPct >= 30 ? '#D97706' : '#DC2626' }}>{skillPct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 6, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 6,
                        width: `${skillPct}%`,
                        background: skillPct >= 60 ? 'linear-gradient(90deg, #34D399, #16A34A)' : skillPct >= 30 ? 'linear-gradient(90deg, #FBBF24, #D97706)' : 'linear-gradient(90deg, #F87171, #DC2626)',
                        transition: 'width 1s ease',
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 9, lineHeight: 1.5 }}>
                      {skillPct >= 60 ? 'Strong alignment with job requirements' : skillPct >= 30 ? 'Growing — add a few more skills' : 'Complete your profile to improve this'}
                    </p>
                  </div>

                  {/* Skills to build */}
                  {topGaps.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Priority Skills to Build</p>
                      <p style={{ fontSize: 10.5, color: '#9CA3AF', marginBottom: 12 }}>Appear most in jobs you're matched to</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {topGaps.map((sk, i) => (
                          <div key={sk} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 9px', borderRadius: 10,
                            background: i === 0 ? '#F5F3FF' : 'transparent',
                          }}>
                            <span style={{
                              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                              background: i === 0 ? 'linear-gradient(150deg, #A78BFA, #7C3AED)' : '#F1F5F9',
                              color: i === 0 ? 'white' : '#9CA3AF',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700,
                            }}>{i + 1}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: i === 0 ? '#111827' : '#4B5563', flex: 1, textTransform: 'capitalize' }}>{sk}</span>
                            {i === 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#7C3AED' }}>TOP GAP</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={() => {
                      const topJob = liveJobs?.[0]
                      if (topJob) setSkillGapJob(topJob)
                    }}
                    style={{
                      width: '100%', background: '#EEF2FF', border: 'none', borderRadius: 11, padding: '11px 0',
                      fontSize: 12.5, fontWeight: 700, color: '#6366F1', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    Full Skill Report <ArrowUpRight size={13} />
                  </button>
                </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedJob && (
        <JobModal job={selectedJob} onClose={() => setSelectedJob(null)}
          onApply={() => { setSelectedJob(null); setApplyJob(selectedJob) }}
          onPrepare={() => { setSelectedJob(null); handlePrepare(selectedJob).catch(() => {}) }}
          onGenerateResume={() => handleGenerateResume(selectedJob)}
          onViewRoadmap={() => handleViewRoadmap(selectedJob)}
          roadmapStatus={roadmapStatusByJobId[selectedJob.id]}
          isPreparing={preparingJobId === selectedJob?.id}
          isApplied={appliedJobIds.has(selectedJob.id)}
        />
      )}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
      {skillGapJob && (
        <JobAnalysisDrawer
          job={skillGapJob}
          kScore={data?.krs.k_score ?? 0}
          onClose={() => setSkillGapJob(null)}
          onApply={() => setSkillGapJob(null)}
        />
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes rowIn { from { opacity:0; transform:translateX(-14px) } to { opacity:1; transform:translateX(0) } }
        @keyframes popIn { from { opacity:0; transform:scale(0.86) translateY(16px) } to { opacity:1; transform:scale(1) translateY(0) } }
        .dash-link-btn { position: relative; }
        .dash-link-btn::after { content: ''; position: absolute; left: 0; bottom: -3px; width: 0; height: 1.5px; background: #6366F1; transition: width 0.2s ease; }
        .dash-link-btn:hover::after { width: 100%; }
        .dash-action-card:hover { transform: translateY(-2px); border-color: #DBEAFE; box-shadow: 0 10px 24px rgba(15,23,42,0.08); }
      `}</style>
    </div>
  )
}
