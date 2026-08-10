import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Briefcase, MapPin, Wifi, AlertCircle, Search,
  IndianRupee, X, ArrowUpRight,
} from 'lucide-react'
import Pagination from '@/shared/components/navigation/Pagination'
import PageHeader from '@/shared/layouts/PageHeader'
import Button from '@/shared/components/primitives/Button'
import Breadcrumb from '@/shared/components/navigation/Breadcrumb'
import { SkeletonCard } from '@/shared/components/feedback/Skeleton'
import SharedEmptyState from '@/shared/components/feedback/EmptyState'
import { NAVY, INK, INK_SFT, MUTED, CREAM, BORDER, colors } from '@/design-system/tokens'
import { getJobs, type JobListItem } from '@/api/matching'
import { jobPlanApi } from '@/api/jobPlan'
import { trackJobEvent } from '@/lib/analytics'

const INK_S    = INK_SFT
const CREAM_DK = colors.surface.elevated

// ── filter options ─────────────────────────────────────────────────────────────
const SECTORS   = ['Policy', 'ESG', 'EdTech', 'NGO', 'Consulting', 'Public Affairs', 'Research']
const JOB_TYPES = ['remote', 'pan_india', 'hybrid', 'onsite']
const SALARY_OPTS: { label: string; min: number | null }[] = [
  { label: 'Any salary',  min: null },
  { label: '₹5+ LPA',    min: 5 },
  { label: '₹10+ LPA',   min: 10 },
  { label: '₹20+ LPA',   min: 20 },
]

// ── avatar helper ──────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  ['#EEF2FF', '#4F46E5'], ['#ECFDF5', '#059669'], ['#FFF7ED', '#EA580C'],
  ['#FDF2F8', '#DB2777'], ['#F0F9FF', '#0284C7'], ['#FAF5FF', '#9333EA'],
]
function avatarColors(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] as [string, string]
}

function skillBarColor(pct: number) {
  if (pct >= 60) return '#059669'
  if (pct >= 30) return '#D97706'
  return '#DC2626'
}

// ── JobCard ────────────────────────────────────────────────────────────────────
function JobCard({ job, hasRoadmap }: { job: JobListItem; hasRoadmap: boolean }) {
  const [bg, fg] = avatarColors(job.company_name)
  const overlap = job.skill_overlap_pct ?? 0

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`,
      overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,.04)',
    }}>

      {/* ── top: logo + title + chips + match pill ── */}
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 14, borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 15, fontWeight: 800, color: fg,
          }}>
            {job.company_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.3 }}>
              {job.title}
            </p>
            <p style={{ fontSize: 11, color: MUTED, margin: '2px 0 9px', fontWeight: 500 }}>
              {job.company_name}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {job.sector && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: INK_S, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 9px', borderRadius: 20 }}>
                  {job.sector}
                </span>
              )}
              {job.location && (
                <span style={{ fontSize: 10.5, fontWeight: 500, color: INK_S, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={9} />{job.location}
                </span>
              )}
              {job.job_type && (
                <span style={{ fontSize: 10.5, fontWeight: 500, color: INK_S, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Wifi size={9} />{job.job_type.replace('_', ' ')}
                </span>
              )}
              {job.employment_type && (
                <span style={{ fontSize: 10.5, fontWeight: 500, color: INK_S, background: CREAM, border: `1px solid ${BORDER}`, padding: '3px 9px', borderRadius: 20 }}>
                  {job.employment_type.replace('_', ' ')}
                </span>
              )}
              {hasRoadmap && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: NAVY, background: CREAM_DK, border: `1px solid ${BORDER}`, padding: '3px 9px', borderRadius: 20 }}>
                  Roadmap started
                </span>
              )}
            </div>
          </div>
        </div>
        {job.match_score !== null && (
          <div style={{ background: NAVY, borderRadius: 9, padding: '6px 11px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{job.match_score}%</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '.3px', marginTop: 2 }}>match</div>
          </div>
        )}
      </div>

      {/* ── mid: salary + skill overlap bar ── */}
      <div style={{
        padding: '10px 18px', background: CREAM,
        borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Salary</div>
          {(job.salary_min || job.salary_max)
            ? (
              <div style={{ fontSize: 14, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center', gap: 1 }}>
                <IndianRupee size={12} />{job.salary_min ?? '?'}–{job.salary_max ?? '?'} LPA
              </div>
            ) : (
              <div style={{ fontSize: 12, color: MUTED }}>Not disclosed</div>
            )}
        </div>
        {job.skill_overlap_pct !== null && (
          <div style={{ flex: 1, maxWidth: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>Skill overlap</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: skillBarColor(overlap) }}>{overlap}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: CREAM_DK, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: skillBarColor(overlap), width: `${overlap}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── required skills ── */}
      {job.required_skills?.length > 0 && (
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
            Required skills
          </div>
          <div>
            {job.required_skills.slice(0, 7).map(s => (
              <span key={s} style={{
                display: 'inline-block', fontSize: 10.5, fontWeight: 600,
                padding: '3px 9px', borderRadius: 20,
                background: CREAM_DK, border: `1px solid ${BORDER}`, color: INK,
                margin: '2px 4px 0 0',
              }}>
                {s}
              </span>
            ))}
            {job.required_skills.length > 7 && (
              <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600 }}>+{job.required_skills.length - 7} more</span>
            )}
          </div>
        </div>
      )}

      {/* ── actions ── */}
      <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to={`/app/jobs/${job.id}`}
          onClick={() => trackJobEvent('job_card_click', job.id, { title: job.title, sector: job.sector ?? undefined })}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 700, color: '#fff',
            background: NAVY, borderRadius: 9, padding: '9px 18px', textDecoration: 'none',
          }}
        >
          View Details <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  )
}

// ── FilterSection ──────────────────────────────────────────────────────────────
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.6px', margin: '0 0 8px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function FilterRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '6px 9px', borderRadius: 8,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? `rgba(26,39,68,0.08)` : 'transparent',
        marginBottom: 2,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? NAVY : INK_S }}>
        {label}
      </span>
      {active && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: NAVY, flexShrink: 0 }} />
      )}
    </button>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────────
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}` }}>
      <SharedEmptyState
        icon={<Briefcase size={22} color={NAVY} />}
        title={hasFilters ? 'No jobs match these filters' : 'No jobs available yet'}
        action={
          hasFilters ? (
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              Try clearing your filters to see all available positions.
            </p>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 10,
              padding: '12px 16px', maxWidth: 400, textAlign: 'left',
            }}>
              <AlertCircle size={15} color={NAVY} style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, color: INK_S, margin: 0, lineHeight: 1.55 }}>
                Jobs are only shown after an employer account is approved by an admin.
              </p>
            </div>
          )
        }
      />
    </div>
  )
}

// ── JobsPage ───────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [sector,   setSector]   = useState('')
  const [jobType,  setJobType]  = useState('')
  const [minSal,   setMinSal]   = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [q,        setQ]        = useState('')
  const [page,     setPage]     = useState(0)
  const limit = 200
  const hasFilters = !!(sector || jobType || q || minSal !== null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', sector, jobType, q, minSal, page],
    queryFn: () => getJobs({
      sector:      sector    || undefined,
      job_type:    jobType   || undefined,
      q:           q         || undefined,
      min_salary:  minSal    ?? undefined,
      limit,
      offset:      page * limit,
    }),
  })

  const { data: jobPlans } = useQuery({ queryKey: ['job-plans-all'], queryFn: jobPlanApi.getAllMine })
  const roadmapJobIds = new Set(jobPlans?.map(p => p.job_id) ?? [])

  function clearAll() {
    setSector(''); setJobType(''); setMinSal(null); setSearchInput(''); setQ(''); setPage(0)
  }

  return (
    <>
      <PageHeader
        title="Job Opportunities"
        subtitle="Ranked by your BeginAI profile match score"
        icon={<Briefcase size={13} color={NAVY} />}
        below={<Breadcrumb items={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Jobs' }]} />}
      />

        {/* ── body: sidebar + feed ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── filter sidebar ── */}
          <aside style={{
            width: 210, flexShrink: 0,
            background: '#fff', borderRight: `1px solid ${BORDER}`,
            padding: '20px 16px', overflowY: 'auto',
          }}>
            {/* search */}
            <form
              onSubmit={e => { e.preventDefault(); setQ(searchInput.trim()); setPage(0) }}
              style={{ marginBottom: 20 }}
            >
              <div style={{ position: 'relative' }}>
                <Search size={12} color={MUTED} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); if (!e.target.value) { setQ(''); setPage(0) } }}
                  style={{
                    width: '100%', padding: '8px 28px 8px 28px',
                    border: `1px solid ${BORDER}`, borderRadius: 9,
                    fontSize: 12, outline: 'none', color: INK, background: CREAM,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = NAVY }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER }}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setQ(''); setPage(0) }}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex', padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </form>

            <FilterSection label="Sector">
              <FilterRow label="All sectors" active={!sector} onClick={() => { setSector(''); setPage(0) }} />
              {SECTORS.map(s => (
                <FilterRow key={s} label={s} active={sector === s} onClick={() => { setSector(s); setPage(0) }} />
              ))}
            </FilterSection>

            <FilterSection label="Work type">
              <FilterRow label="All types" active={!jobType} onClick={() => { setJobType(''); setPage(0) }} />
              {JOB_TYPES.map(t => (
                <FilterRow key={t} label={t.replace('_', ' ')} active={jobType === t} onClick={() => { setJobType(t); setPage(0) }} />
              ))}
            </FilterSection>

            <FilterSection label="Salary">
              {SALARY_OPTS.map(opt => (
                <FilterRow
                  key={opt.label}
                  label={opt.label}
                  active={minSal === opt.min}
                  onClick={() => { setMinSal(opt.min); setPage(0) }}
                />
              ))}
            </FilterSection>

            {hasFilters && (
              <Button variant="ghost" size="sm" fullWidth onClick={clearAll} className="text-red-500 border border-gray-200">
                <X size={12} /> Clear all filters
              </Button>
            )}
          </aside>

          {/* ── main feed ── */}
          <main style={{ flex: 1, minWidth: 0, padding: '20px 28px 40px', overflowY: 'auto' }}>

            {/* count + sort row */}
            {data && data.jobs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: MUTED, margin: 0 }}>
                  {data.total} {data.total === 1 ? 'job' : 'jobs'} found
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, margin: 0 }}>
                  ↓ Best match
                </p>
              </div>
            )}

            {/* loading */}
            {isLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
              </div>
            )}

            {/* error */}
            {isError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                padding: '14px 18px', color: '#991B1B', fontSize: 13,
              }}>
                <AlertCircle size={15} />
                Failed to load jobs. Please check your connection and try again.
              </div>
            )}

            {/* results */}
            {data && (
              <>
                {data.jobs.length === 0
                  ? <EmptyState hasFilters={hasFilters} />
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                      {data.jobs.map(job => (
                        <JobCard key={job.id} job={job} hasRoadmap={roadmapJobIds.has(job.id)} />
                      ))}
                    </div>
                  )
                }

                {data.total > limit && (
                  <div style={{ marginTop: 24 }}>
                    <Pagination
                      page={page + 1}
                      totalPages={Math.ceil(data.total / limit)}
                      onChange={p => setPage(p - 1)}
                    />
                  </div>
                )}
              </>
            )}
          </main>
        </div>
    </>
  )
}
