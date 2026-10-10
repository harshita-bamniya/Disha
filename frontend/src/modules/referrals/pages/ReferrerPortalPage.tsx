import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { colors } from '@/design-system/tokens'
import Spinner from '@/shared/components/feedback/Spinner'
import ErrorState from '@/shared/components/feedback/ErrorState'
import { getApiError } from '@/api/client'
import { publicReferralsApi } from '@/api/referrals'
import MyReferralsPanel from '@/modules/employer/components/referrals/MyReferralsPanel'
import { useState } from 'react'

/** An invited employee's private page (/referrer/:token). No account: the long random token in the
 * emailed link is the credential, so the page asks search engines to stay away and never shows more
 * than a first name and initial for anyone they referred. */
export default function ReferrerPortalPage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const [sending, setSending] = useState(false)
  const key = ['referrer-portal', token]
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key, queryFn: () => publicReferralsApi.portal(token), retry: false,
  })

  return (
    <main style={{ minHeight: '100vh', background: colors.surface.bg, padding: '28px 20px' }}>
      <meta name="robots" content="noindex,nofollow" />
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: colors.brand.navy, marginBottom: 4 }}>BeginablAI</div>
        {data && (
          <>
            <h1 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: colors.text.ink }}>Hi {data.referrer_name.split(' ')[0]}, refer people to {data.company_name}</h1>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: colors.text.inkSoft }}>This page is private to you. Please don't share the address.</p>
          </>
        )}
        {isLoading ? <div style={{ padding: 60 }}><Spinner /></div>
          : error || !data ? (
            <ErrorState title="This page isn't available" description={getApiError(error, 'Ask your HR team for a new link.')} onRetry={() => refetch()} />
          ) : (
            <MyReferralsPanel data={data} nominating={sending} onNominate={async p => {
              setSending(true)
              try { qc.setQueryData(key, await publicReferralsApi.portalNominate(token, p)) } finally { setSending(false) }
            }} />
          )}
      </div>
    </main>
  )
}
