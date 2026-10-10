import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, MapPin, UserCheck } from 'lucide-react'
import { colors } from '@/design-system/tokens'
import Button from '@/shared/components/primitives/Button'
import Spinner from '@/shared/components/feedback/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { publicReferralsApi, referralCode } from '@/api/referrals'

/** Where a referral share link lands (/r/:code/:jobId). Remembers who referred the visitor so the
 * application they submit later is credited, then sends them to the job (or to sign in first). */
export default function ReferralLandingPage() {
  const { code = '', jobId = '' } = useParams()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const role = useAuthStore(s => s.user?.role)
  const { data, isLoading } = useQuery({
    queryKey: ['referral-link', code, jobId],
    queryFn: () => publicReferralsApi.link(code, jobId),
    staleTime: 5 * 60_000,
    retry: false,
  })

  useEffect(() => {
    if (data?.valid) referralCode.remember(jobId, code)
  }, [data?.valid, code, jobId])

  // An invalid or expired link must not trap anyone: they can still open the job normally.
  if (isLoading) return <Shell><Spinner /></Shell>
  if (isAuthenticated && role === 'aspirant' && data?.valid) return <Navigate to={`/app/jobs/${jobId}`} replace />

  return (
    <Shell>
      {data?.valid ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.state.success, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            <UserCheck size={16} />{data.referrer_first_name} at {data.company_name} thinks you'd be a great fit
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: colors.text.ink }}>{data.job_title}</h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: colors.text.inkSoft, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Briefcase size={13} />{data.company_name}</span>
            {data.location && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><MapPin size={13} />{data.location}</span>}
          </p>
          {isAuthenticated ? (
            <Link to={`/app/jobs/${jobId}`}><Button>View the role and apply</Button></Link>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/auth/register"><Button>Create a free account</Button></Link>
              <Link to="/auth/login"><Button variant="outline">I already have an account</Button></Link>
            </div>
          )}
          <p style={{ margin: '16px 0 0', fontSize: 12, color: colors.text.muted }}>
            Sign in, then open this link again to see the role. Your referral is remembered for 30 days, so applying later still credits {data.referrer_first_name}.
          </p>
        </>
      ) : (
        <>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: colors.text.ink }}>This referral link is no longer active</h1>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: colors.text.inkSoft }}>
            The role may have closed, or the referral program is paused. You can still browse open jobs on BeginablAI.
          </p>
          <Link to={isAuthenticated ? '/app/jobs' : '/auth/login'}><Button variant="outline">{isAuthenticated ? 'Browse jobs' : 'Sign in'}</Button></Link>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: colors.surface.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: colors.brand.navy, marginBottom: 20 }}>BeginablAI</div>
      <div style={{ width: '100%', maxWidth: 460, background: colors.surface.card, border: `1px solid ${colors.border.default}`, borderRadius: 16, padding: 28, boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
        {children}
      </div>
    </main>
  )
}
