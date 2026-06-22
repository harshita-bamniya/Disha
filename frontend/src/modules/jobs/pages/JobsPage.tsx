import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Wifi, AlertCircle, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpRight } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { getJobs, type JobListItem } from '@/api/matching'

const SECTORS = ['Policy', 'ESG', 'EdTech', 'NGO', 'Consulting', 'Public Affairs', 'Research']
const JOB_TYPES = ['remote', 'pan_india', 'hybrid', 'onsite']

function JobCard({ job }: { job: JobListItem }) {
  const [hov, setHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 16, border: `1px solid ${hov ? '#BFDBFE' : '#F1F5F9'}`, overflow: 'hidden',
        boxShadow: hov ? '0 12px 30px rgba(37,99,235,0.12)' : '0 2px 8px rgba(15,23,42,0.04)',
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.2s cubic-bezier(0.34,1.1,0.64,1)',
      }}
    >
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: 'linear-gradient(135deg, #15130F, #3B342B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#F1EAE0',
              boxShadow: '0 3px 10px rgba(21,19,15,0.3)',
            }}>
              {job.company_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontWeight: 700, color: '#111827', fontSize: 15, margin: 0 }}>{job.title}</h3>
              {job.match_score !== null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                  background: 'rgba(37,99,235,0.1)', color: '#1D4ED8',
                }}>
                  {job.match_score}% match
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0' }}>{job.company_name}</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {job.sector && (
                <span style={{ fontSize: 11, background: 'rgba(37,99,235,0.08)', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
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
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link
            to={`/app/jobs/${job.id}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              textAlign: 'center', fontSize: 13, fontWeight: 700,
              color: 'white', background: '#2563EB', borderRadius: 10,
              padding: '9px 0', textDecoration: 'none', transition: 'background 0.15s',
              boxShadow: '0 3px 10px rgba(37,99,235,0.25)',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1D4ED8' }}
            onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#2563EB' }}
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: 0 }}>Ranked by your DISHA profile match score</p>
          </div>
        </header>

      <main style={{ flex: 1, padding: '28px 36px', maxWidth: 960 }}>

        {/* Filters */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, alignItems: 'center',
          background: '#F5F8FF', border: '1px solid #DBEAFE', borderRadius: 14, padding: '12px 16px',
        }}>
          <SlidersHorizontal size={15} color="#2563EB" />
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
    </div>
  )
}
