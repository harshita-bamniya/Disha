import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Wifi, AlertCircle, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpRight } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobs, type JobListItem } from '@/api/matching'

const SECTORS = ['Policy', 'ESG', 'EdTech', 'NGO', 'Consulting', 'Public Affairs', 'Research']
const JOB_TYPES = ['remote', 'pan_india', 'hybrid', 'onsite']

function matchColor(_score: number): { bg: string; text: string } {
  return { bg: 'rgba(59,130,246,0.10)', text: '#1D4ED8' }
}

function JobCard({ job }: { job: JobListItem }) {
  const mc = job.match_score !== null ? matchColor(job.match_score) : null
  const [hov, setHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 18, border: '1.5px solid #E2E8F0', overflow: 'hidden',
        boxShadow: hov ? '0 16px 36px rgba(15,23,42,0.10)' : '0 2px 10px rgba(15,23,42,0.04)',
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s cubic-bezier(0.34,1.1,0.64,1)',
      }}
    >
      <div style={{ height: 3, background: 'linear-gradient(90deg, #3B82F6, #15130F)' }} />
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontWeight: 700, color: '#111827', fontSize: 15, margin: 0 }}>{job.title}</h3>
              {mc && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: mc.bg, color: mc.text,
                }}>
                  {job.match_score}% match
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0' }}>{job.company_name}</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {job.sector && (
                <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.08)', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                  {job.sector}
                </span>
              )}
              {job.location && (
                <span style={{ fontSize: 11, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={10} /> {job.location}
                </span>
              )}
              {job.job_type && (
                <span style={{ fontSize: 11, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Wifi size={10} /> {job.job_type.replace('_', ' ')}
                </span>
              )}
              {job.employment_type && (
                <span style={{ fontSize: 11, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 20 }}>
                  {job.employment_type.replace('_', ' ')}
                </span>
              )}
            </div>

            {(job.salary_min || job.salary_max) && (
              <p style={{ fontSize: 13, color: '#374151', marginTop: 8, fontWeight: 600 }}>
                ₹{job.salary_min ?? '?'}–{job.salary_max ?? '?'} LPA
              </p>
            )}
            {job.skill_overlap_pct !== null && (
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                You have {job.skill_overlap_pct}% of required skills
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link
            to={`/app/jobs/${job.id}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textAlign: 'center', fontSize: 13, fontWeight: 700,
              color: 'white', background: '#3B82F6', borderRadius: 10,
              padding: '9px 0', textDecoration: 'none', transition: 'background 0.15s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1D4ED8' }}
            onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#3B82F6' }}
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
        width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Briefcase size={24} color="#3B82F6" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
        {hasFilters ? 'No jobs match these filters' : 'No jobs available yet'}
      </h3>
      {!hasFilters && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#FAF7F1', border: '1px solid #F1EAE0', borderRadius: 10,
          padding: '12px 16px', marginTop: 12, maxWidth: 420, textAlign: 'left',
        }}>
          <AlertCircle size={16} color="#3B82F6" style={{ marginTop: 1, flexShrink: 0 }} />
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #EFF6FF 100%)' }}>
      <AppSidebar activePath="/app/jobs" />
      <main style={{ flex: 1, padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Hind, sans-serif', fontSize: 24, fontWeight: 900, color: '#1E3A5F', margin: 0, letterSpacing: '-0.4px' }}>Job Opportunities</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Ranked by your DISHA profile match score
          </p>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, alignItems: 'center',
          background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '12px 16px',
        }}>
          <SlidersHorizontal size={15} color="#3B82F6" />
          <select
            value={sector}
            onChange={e => { setSector(e.target.value); setPage(0) }}
            style={{
              border: '1px solid #E2E8F0', borderRadius: 9, padding: '7px 12px',
              fontSize: 13, background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">All Sectors</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={jobType}
            onChange={e => { setJobType(e.target.value); setPage(0) }}
            style={{
              border: '1px solid #E2E8F0', borderRadius: 9, padding: '7px 12px',
              fontSize: 13, background: '#fff', color: '#374151', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">All Types</option>
            {JOB_TYPES.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.replace('_', ' ')}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSector(''); setJobType(''); setPage(0) }}
              style={{
                fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E2E8F0',
                borderRadius: 9, padding: '7px 12px', cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div style={{
              width: 32, height: 32, border: '2px solid #3B82F6',
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
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
  )
}
