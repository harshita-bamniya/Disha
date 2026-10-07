import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react'
import PageHeader from '@/shared/layouts/PageHeader'
import Spinner from '@/shared/components/feedback/Spinner'
import EmptyState from '@/shared/components/feedback/EmptyState'
import Button from '@/shared/components/primitives/Button'
import { toast } from '@/shared/components/feedback/Toast'
import { colors, spacing } from '@/design-system/tokens'
import { getApiError } from '@/api/client'
import { getJobDetail, getMyApplications } from '@/api/matching'
import { resumeMatchApi, type ScanOut } from '@/api/resumeMatch'
import { useActivePrepJob } from '@/hooks/useActivePrepJob'
import ResumePicker, { type ResumeChoice } from '../components/match/ResumePicker'
import ScoreCard from '../components/match/ScoreCard'
import SubScoreBars from '../components/match/SubScoreBars'
import FixesList from '../components/match/FixesList'
import RequirementChecklist from '../components/match/RequirementChecklist'
import AtsPanel from '../components/match/AtsPanel'
import QualityCard from '../components/match/QualityCard'
import ScanHistory from '../components/match/ScanHistory'
import SuggestionDrawer from '../components/match/SuggestionDrawer'

export default function ResumeMatchPage() {
  const { jobId, scanId } = useParams<{ jobId: string; scanId?: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { startPrep, isStartingPrep } = useActivePrepJob()
  const [improving, setImproving] = useState<string | null>(null)

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => getJobDetail(jobId!), enabled: !!jobId })
  const { data: myApps } = useQuery({ queryKey: ['my-applications'], queryFn: getMyApplications })
  const applied = !!myApps?.some(a => a.job_id === jobId)

  const history = useQuery({
    queryKey: ['resume-match', 'history', jobId],
    queryFn: () => resumeMatchApi.listForJob(jobId!),
    enabled: !!jobId,
  })
  const scanQuery = useQuery({
    queryKey: ['resume-match', 'scan', scanId],
    queryFn: () => resumeMatchApi.get(scanId!),
    enabled: !!scanId,
  })

  const consent = useQuery({ queryKey: ['resume-match', 'consent'], queryFn: resumeMatchApi.consent })
  const giveConsent = useMutation({
    mutationFn: resumeMatchApi.giveConsent,
    onSuccess: s => queryClient.setQueryData(['resume-match', 'consent'], s),
    onError: e => toast.danger(getApiError(e, 'Could not save your choice. Please try again.')),
  })
  const deleteData = useMutation({
    mutationFn: resumeMatchApi.deleteMyData,
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: ['resume-match'] })
      toast.info(`Deleted ${r.deleted_scans} saved resume check${r.deleted_scans === 1 ? '' : 's'} and withdrew your consent.`)
      navigate(`/app/jobs/${jobId}/resume-match`)
    },
    onError: e => toast.danger(getApiError(e, 'Could not delete your resume checks. Please try again.')),
  })

  const scanMutation = useMutation({
    mutationFn: (choice: ResumeChoice): Promise<ScanOut> => {
      if (choice.kind === 'upload') return resumeMatchApi.scanUpload(jobId!, choice.file)
      return resumeMatchApi.scanSaved(
        choice.kind === 'builder'
          ? { job_id: jobId!, resume_id: choice.id }
          : { job_id: jobId!, resume_file_id: choice.id },
      )
    },
    onSuccess: scan => {
      queryClient.setQueryData(['resume-match', 'scan', scan.id], scan)
      queryClient.invalidateQueries({ queryKey: ['resume-match', 'history', jobId] })
      queryClient.invalidateQueries({ queryKey: ['resume-match-quota'] })
      if (scan.cached) toast.info('Nothing has changed since your last check, so this is the same result.')
      navigate(`/app/jobs/${jobId}/resume-match/${scan.id}`)
    },
    onError: e => toast.danger(getApiError(e, 'Could not check your resume right now. Please try again.')),
  })

  const initial: ResumeChoice | null = search.get('file')
    ? { kind: 'file', id: search.get('file')! }
    : search.get('resume') ? { kind: 'builder', id: search.get('resume')! } : null

  function handleRoadmap(_requirement: string, inRoadmap: boolean) {
    if (!jobId) return
    if (inRoadmap) { navigate('/app/roadmap'); return }
    startPrep(jobId, { onSuccess: () => navigate('/app/roadmap') })
  }

  const scan = scanQuery.data
  const showReport = !!scanId
  const backTo = `/app/jobs/${jobId}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: colors.surface.bg }}>
      <PageHeader
        title="Resume match"
        subtitle={job ? `${job.title} · ${job.company_name}` : undefined}
        icon={<FileSearch size={16} color={colors.text.inkSoft} />}
        back={(
          <button
            onClick={() => navigate(backTo)}
            aria-label="Back to job"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <ArrowLeft size={18} color={colors.text.inkSoft} />
          </button>
        )}
        actions={showReport && scan ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => navigate(`/app/jobs/${jobId}/resume-match`)}>
              <RefreshCw size={13} style={{ marginRight: 6 }} /> Check an updated resume
            </Button>
            {!applied && (
              <Button size="sm" onClick={() => navigate(`/app/jobs/${jobId}/apply`)}>
                Apply <ArrowUpRight size={13} style={{ marginLeft: 4 }} />
              </Button>
            )}
          </div>
        ) : undefined}
      />

      <main style={{ padding: `${spacing[6]}px ${spacing.layout}px`, maxWidth: 980, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {!showReport && consent.data && !consent.data.consented && (
          <section aria-label="Resume analysis consent" style={{ background: '#fff', border: `1px solid ${colors.border.default}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color={colors.brand.navy} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Before we check your resume</h2>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: colors.text.ink }}>{consent.data.text}</p>
            <div>
              <Button onClick={() => giveConsent.mutate()} disabled={giveConsent.isPending}>I agree, continue</Button>
            </div>
          </section>
        )}

        {!showReport && consent.isError && (
          <p role="alert" style={{ fontSize: 13, color: colors.state.danger }}>Could not load the consent details. Refresh to try again.</p>
        )}

        {!showReport && consent.data?.consented && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ResumePicker
              key={initial ? `${initial.kind}` : 'none'}
              initial={initial}
              busy={scanMutation.isPending}
              onSubmit={c => scanMutation.mutate(c)}
            />
            <ScanHistory
              scans={history.data ?? []}
              onOpen={id => navigate(`/app/jobs/${jobId}/resume-match/${id}`)}
            />
            <p style={{ margin: 0, fontSize: 12, color: colors.text.muted }}>
              Your checks are kept for {consent.data.retention_days} days.{' '}
              <button
                onClick={() => { if (window.confirm('Delete all your saved resume checks and withdraw your consent?')) deleteData.mutate() }}
                disabled={deleteData.isPending}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: colors.brand.navy, textDecoration: 'underline', fontSize: 12 }}
              >
                Delete all my resume checks
              </button>
            </p>
          </div>
        )}

        {showReport && scanQuery.isLoading && <Spinner />}

        {showReport && scanQuery.isError && (
          <EmptyState
            icon={<FileSearch size={24} color={colors.text.muted} />}
            title="We couldn't find that check"
            description="It may have been deleted. Run a new check to see your results."
            action={<Button onClick={() => navigate(`/app/jobs/${jobId}/resume-match`)}>Check a resume</Button>}
          />
        )}

        {showReport && scan && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: colors.text.muted }}>
              Checked <strong>{scan.resume_label || 'your resume'}</strong>
              {' on '}{new Date(scan.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {scan.cached ? ' · unchanged since last check' : ''}
            </p>

            <ScoreCard scan={scan} />

            {scan.changes.length > 0 && (
              <div style={{
                padding: '12px 16px', borderRadius: 12, background: colors.state.successBg,
                border: `1px solid ${colors.state.success}33`, fontSize: 13, color: colors.text.ink, lineHeight: 1.6,
              }}>
                <strong>What changed since your last check</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                  {scan.changes.map(c => (
                    <li key={c.requirement}>
                      {c.requirement}: {Math.round(c.before * 100)}% → {Math.round(c.after * 100)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FixesList
              fixes={scan.report.fixes}
              roadmap={scan.roadmap}
              onImprove={setImproving}
              onRoadmap={handleRoadmap}
              roadmapBusy={isStartingPrep}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
              <SubScoreBars subScores={scan.report.sub_scores} />
              <AtsPanel checks={scan.report.ats_checks} />
            </div>

            {scan.report.quality && <QualityCard quality={scan.report.quality} />}

            <RequirementChecklist results={scan.report.requirements} onImprove={setImproving} />

            <ScanHistory
              scans={history.data ?? []}
              currentId={scan.id}
              onOpen={id => navigate(`/app/jobs/${jobId}/resume-match/${id}`)}
            />
          </div>
        )}
      </main>

      {scan && (
        <SuggestionDrawer
          open={!!improving}
          scanId={scan.id}
          requirement={improving}
          onClose={() => setImproving(null)}
        />
      )}
    </div>
  )
}
