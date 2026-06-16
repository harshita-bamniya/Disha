import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Wifi, AlertCircle, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobs, type JobListItem } from '@/api/matching'

const SECTORS = ['Policy', 'ESG', 'EdTech', 'NGO', 'Consulting', 'Public Affairs', 'Research']
const JOB_TYPES = ['remote', 'pan_india', 'hybrid', 'onsite']

function matchColor(score: number): { bg: string; text: string } {
  if (score >= 70) return { bg: '#DCFCE7', text: '#166534' }
  if (score >= 40) return { bg: '#FEF9C3', text: '#854D0E' }
  return { bg: '#FEE2E2', text: '#991B1B' }
}

function JobCard({ job }: { job: JobListItem }) {
  const mc = job.match_score !== null ? matchColor(job.match_score) : null

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
      padding: '18px 20px', transition: 'box-shadow 0.15s',
    }}
      onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseOut={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
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
              <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
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
            flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600,
            color: '#2D6A4F', border: '1px solid #2D6A4F', borderRadius: 9,
            padding: '8px 0', textDecoration: 'none', transition: 'background 0.15s',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F0FDF4' }}
          onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
        >
          View Details
        </Link>
      </div>
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Briefcase size={24} color="#94A3B8" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
        {hasFilters ? 'No jobs match these filters' : 'No jobs available yet'}
      </h3>
      {!hasFilters && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '12px 16px', marginTop: 12, maxWidth: 420, textAlign: 'left',
        }}>
          <AlertCircle size={16} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC' }}>
      <AppSidebar activePath="/app/jobs" />
      <main style={{ flex: 1, padding: '32px 28px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Job Opportunities</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Ranked by your DISHA profile match score
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, alignItems: 'center' }}>
          <SlidersHorizontal size={15} color="#94A3B8" />
          <select
            value={sector}
            onChange={e => { setSector(e.target.value); setPage(0) }}
            style={{
              border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px',
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
              border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px',
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
                borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
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
              width: 32, height: 32, border: '2px solid #2D6A4F',
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
                    borderRadius: 8, background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer',
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
                    borderRadius: 8, background: '#fff',
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
