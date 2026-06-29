import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Wifi, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, ArrowUpRight, IndianRupee, X } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobs, type JobListItem } from '@/api/matching'

const SECTORS = ['Policy', 'ESG', 'EdTech', 'NGO', 'Consulting', 'Public Affairs', 'Research']
const JOB_TYPES = ['remote', 'pan_india', 'hybrid', 'onsite']

const AVATAR_PALETTE = [
  ['#EEF2FF', '#4F46E5'], ['#ECFDF5', '#059669'], ['#FFF7ED', '#EA580C'],
  ['#FDF2F8', '#DB2777'], ['#F0F9FF', '#0284C7'], ['#FAF5FF', '#9333EA'],
]
function avatarColors(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function matchTier(score: number) {
  if (score >= 70) return { bg: '#ECFDF5', fg: '#059669', bar: '#10B981' }
  if (score >= 45) return { bg: '#EEF2FF', fg: '#4F46E5', bar: '#6366F1' }
  return { bg: '#F8FAFC', fg: '#64748B', bar: '#CBD5E1' }
}

function JobCard({ job }: { job: JobListItem }) {
  const [hov, setHov] = useState(false)
  const [bg, fg] = avatarColors(job.company_name)
  const tier = matchTier(job.match_score ?? 0)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 18, border: `1px solid ${hov ? '#DBEAFE' : '#EEF2F9'}`, overflow: 'hidden',
        boxShadow: hov ? '0 18px 40px rgba(37,99,235,0.15)' : '0 8px 22px rgba(15,23,42,0.06)',
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.34,1.1,0.64,1)',
        position: 'relative',
      }}
    >
      <div style={{ height: 3, background: tier.bar }} />
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700, color: fg,
          }}>
            {job.company_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <h3 style={{ fontWeight: 700, color: '#0F172A', fontSize: 15.5, margin: 0, lineHeight: 1.35 }}>{job.title}</h3>
              {job.match_score !== null && (
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0,
                  background: tier.bg, color: tier.fg, whiteSpace: 'nowrap',
                }}>
                  {job.match_score}% match
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0', fontWeight: 500 }}>{job.company_name}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {job.sector && (
            <span style={{ fontSize: 11, background: '#EEF2FF', color: '#4F46E5', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
              {job.sector}
            </span>
          )}
          {job.location && (
            <span style={{ fontSize: 11, background: '#F8FAFC', color: '#475569', padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
              <MapPin size={10} /> {job.location}
            </span>
          )}
          {job.job_type && (
            <span style={{ fontSize: 11, background: '#F8FAFC', color: '#475569', padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
              <Wifi size={10} /> {job.job_type.replace('_', ' ')}
            </span>
          )}
          {job.employment_type && (
            <span style={{ fontSize: 11, background: '#F8FAFC', color: '#475569', padding: '3px 9px', borderRadius: 20, fontWeight: 500 }}>
              {job.employment_type.replace('_', ' ')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #F8FAFC' }}>
          <div>
            {(job.salary_min || job.salary_max) ? (
              <p style={{ fontSize: 14, color: '#0F172A', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IndianRupee size={13} />{job.salary_min ?? '?'}–{job.salary_max ?? '?'} LPA
              </p>
            ) : (
              <p style={{ fontSize: 12.5, color: '#CBD5E1', margin: 0 }}>Salary not disclosed</p>
            )}
            {job.skill_overlap_pct !== null && (
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0' }}>
                You have {job.skill_overlap_pct}% of required skills
              </p>
            )}
          </div>
          <Link
            to={`/app/jobs/${job.id}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 13, fontWeight: 700, flexShrink: 0,
              color: '#2563EB', background: 'white', border: '1.5px solid #BFDBFE', borderRadius: 10,
              padding: '9px 16px', textDecoration: 'none', transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(37,99,235,0.08)',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#93C5FD'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 16px rgba(37,99,235,0.14)' }}
            onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#BFDBFE'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)' }}
          >
            View Details <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      background: 'white', borderRadius: 20, border: '1px solid #E2E8F0',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: 'rgba(37,99,235,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Briefcase size={24} color="#2563EB" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
        {hasFilters ? 'No jobs match these filters' : 'No jobs available yet'}
      </h3>
      {!hasFilters && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#F5F8FF', border: '1px solid #DBEAFE', borderRadius: 10,
          padding: '12px 16px', marginTop: 12, maxWidth: 420, textAlign: 'left',
        }}>
          <AlertCircle size={16} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
            Jobs are only shown after an employer account is approved by an admin.
            If you're testing, ask an admin to approve an employer in the admin panel.
          </p>
        </div>
      )}
      {hasFilters && (
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>
          Try clearing your filters to see all available positions.
        </p>
      )}
    </div>
  )
}

export default function JobsPage() {
  const [sector, setSector] = useState('')
  const [jobType, setJobType] = useState('')
  const [page, setPage] = useState(0)
  const limit = 12
  const hasFilters = !!(sector || jobType)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', sector, jobType, page],
    queryFn: () => getJobs({ sector: sector || undefined, job_type: jobType || undefined, limit, offset: page * limit }),
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'white' }}>
      <AppSidebar activePath="/app/jobs" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FAFBFD' }}>
        {/* Header */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #F1F5F9',
          padding: '0 28px', height: 64,
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Briefcase size={14} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A', margin: 0 }}>Job Opportunities</p>
            <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: 0 }}>Ranked by your BeginablAI profile match score</p>
          </div>
        </header>

      <main style={{ flex: 1, padding: '28px 36px 48px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>

        {/* Filters */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, alignItems: 'center',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#EEF2FF', borderRadius: 9, padding: '7px 11px',
          }}>
            <SlidersHorizontal size={13} color="#4F46E5" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>Filters</span>
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={sector}
              onChange={e => { setSector(e.target.value); setPage(0) }}
              style={{
                appearance: 'none', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 32px 8px 14px',
                fontSize: 13, fontWeight: 500, background: '#fff', color: sector ? '#0F172A' : '#6B7280',
                cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#A5B4FC' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
            >
              <option value="">All Sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} color="#9CA3AF" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={jobType}
              onChange={e => { setJobType(e.target.value); setPage(0) }}
              style={{
                appearance: 'none', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 32px 8px 14px',
                fontSize: 13, fontWeight: 500, background: '#fff', color: jobType ? '#0F172A' : '#6B7280',
                cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#A5B4FC' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
            >
              <option value="">All Types</option>
              {JOB_TYPES.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.replace('_', ' ')}</option>)}
            </select>
            <ChevronDown size={13} color="#9CA3AF" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setSector(''); setJobType(''); setPage(0) }}
              style={{
                fontSize: 12.5, fontWeight: 600, color: '#EF4444', background: 'none', border: 'none',
                padding: '8px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <X size={13} /> Clear filters
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div style={{
              width: 32, height: 32, border: '2px solid #2563EB',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '14px 18px', color: '#991B1B', fontSize: 14,
          }}>
            <AlertCircle size={16} />
            Failed to load jobs. Please check your connection and try again.
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {data.jobs.length > 0 && (
              <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>
                {data.total} {data.total === 1 ? 'job' : 'jobs'} found
              </p>
            )}

            {data.jobs.length === 0
              ? <EmptyState hasFilters={hasFilters} />
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
                  {data.jobs.map(job => <JobCard key={job.id} job={job} />)}
                </div>
              )
            }

            {data.total > limit && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 32 }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 14px', fontSize: 13, border: '1px solid #E2E8F0',
                    borderRadius: 9, background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer',
                    opacity: page === 0 ? 0.4 : 1, color: '#374151',
                  }}
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Page {page + 1} of {Math.ceil(data.total / limit)}
                </span>
                <button
                  disabled={(page + 1) * limit >= data.total}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 14px', fontSize: 13, border: '1px solid #E2E8F0',
                    borderRadius: 9, background: '#fff',
                    cursor: (page + 1) * limit >= data.total ? 'not-allowed' : 'pointer',
                    opacity: (page + 1) * limit >= data.total ? 0.4 : 1, color: '#374151',
                  }}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  )
}
