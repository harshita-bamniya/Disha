import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '@/api/jobs'
import type { JobPostingPayload } from '@/api/jobs'
import { companyApi, subscriptionApi, hiringTeamApi } from '@/api/company'
import type { CompanyProfileUpdatePayload, EmployerProfileUpdatePayload, TeamInvitePayload, DepartmentCreatePayload, DepartmentUpdatePayload, HiringTeamAddPayload } from '@/api/company'
import { analyticsApi } from '@/api/analytics'
import { getUpcomingInterviews, getPipelineStages, bulkUpsertPipelineStages, getPipelineTemplates, createPipelineTemplate, deletePipelineTemplate, applyTemplateToJob } from '@/api/matching'
import type { PipelineStageIn } from '@/api/matching'

const DASHBOARD_KEY = (departmentId?: string) => ['employer', 'dashboard', departmentId ?? '']
const KPIS_KEY = ['employer', 'dashboard', 'kpis']
const TREND_KEY = (days: number) => ['employer', 'dashboard', 'trend', days]
const VERIFICATION_KEY = ['employer', 'verification']
const COMPANY_KEY = ['employer', 'company']
const TEAM_KEY = ['employer', 'company', 'team']
const OFFICES_KEY = ['employer', 'company', 'offices']
const DEPARTMENTS_KEY = ['employer', 'company', 'departments']
const DEPARTMENT_JOBS_KEY = (id: string) => ['employer', 'company', 'departments', id, 'jobs']
const SUBSCRIPTION_KEY = ['employer', 'subscription']
const SUBSCRIPTION_USAGE_KEY = ['employer', 'subscription', 'usage']
const SUBSCRIPTION_PLANS_KEY = ['employer', 'subscription', 'plans']

export function useEmployerDashboard(departmentId?: string) {
  // is_approved (and the "verification required" banner it drives) can change
  // from an admin's session at any time — the 5-min global staleTime would
  // otherwise show a stale "still pending" banner for up to 5 minutes after
  // approval whenever the employer navigates back without a hard refresh.
  return useQuery({
    queryKey: DASHBOARD_KEY(departmentId),
    queryFn: () => jobsApi.getDashboard(departmentId),
    staleTime: 0,
  })
}

const PERMISSIONS_KEY = ['employer', 'permissions']

export function useEmployerPermissions() {
  // staleTime: 0 ensures sub-admins always get fresh permissions/department scope
  // on every page mount — prevents stale scoping after an employer changes their dept
  return useQuery({ queryKey: PERMISSIONS_KEY, queryFn: jobsApi.getMyPermissions, staleTime: 0 })
}

/** Returns true if the current company-side user has the given "resource:action"
 * permission. Returns false while loading — actions stay hidden, not shown-then-yanked. */
export function useHasPermission(permission: string): boolean {
  const { data } = useEmployerPermissions()
  return data?.permissions.includes(permission) ?? false
}

export function useDashboardKpis() {
  return useQuery({ queryKey: KPIS_KEY, queryFn: analyticsApi.getDashboardKpis })
}

export function useApplicationTrend(days = 30) {
  return useQuery({ queryKey: TREND_KEY(days), queryFn: () => analyticsApi.getApplicationTrend(days) })
}

const UPCOMING_INTERVIEWS_KEY = ['employer', 'interviews', 'upcoming']

export function useUpcomingInterviews(limit = 20) {
  return useQuery({
    queryKey: UPCOMING_INTERVIEWS_KEY,
    queryFn: () => getUpcomingInterviews(limit),
  })
}

export function useSuggestSkills() {
  return useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      jobsApi.suggestSkills(title, description),
  })
}

export function useGenerateDescription() {
  return useMutation({
    mutationFn: ({ title, sector, keyPoints }: { title: string; sector: string; keyPoints: string }) =>
      jobsApi.generateDescription(title, sector, keyPoints),
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: JobPostingPayload) => jobsApi.createJob(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

const JOB_TEMPLATES_KEY = ['employer', 'job-templates']

export function useJobTemplates() {
  return useQuery({ queryKey: JOB_TEMPLATES_KEY, queryFn: jobsApi.listJobTemplates })
}

export function useCreateJobTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof jobsApi.createJobTemplate>[0]) => jobsApi.createJobTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOB_TEMPLATES_KEY }),
  })
}

export function useDeleteJobTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) => jobsApi.deleteJobTemplate(templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: JOB_TEMPLATES_KEY }),
  })
}

export function useBulkImportJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => jobsApi.bulkImportJobs(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function useUpdateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobPostingPayload }) => jobsApi.updateJob(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function usePublishJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.publishJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function usePauseJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.pauseJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function useCloseJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.closeJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function useReopenJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.reopenJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function useArchiveJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.archiveJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function useDuplicateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.duplicateJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] }),
  })
}

// ── KYC verification ──────────────────────────────────────────────────────────

export function useVerificationStatus() {
  // Same reasoning as useEmployerDashboard — admin review happens in a
  // separate session, so this must always refetch on mount, not sit on a
  // 5-minute-stale cached "pending" status.
  return useQuery({ queryKey: VERIFICATION_KEY, queryFn: jobsApi.getVerificationStatus, staleTime: 0 })
}

export function useRequestVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => jobsApi.requestVerification(),
    onSuccess: () => qc.invalidateQueries({ queryKey: VERIFICATION_KEY }),
  })
}

// ── Company profile + team management ─────────────────────────────────────────

export function useCompanyProfile() {
  // verification_status here is also admin-driven from a separate session.
  return useQuery({ queryKey: COMPANY_KEY, queryFn: companyApi.getProfile, staleTime: 0 })
}

export function useUpdateCompanyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CompanyProfileUpdatePayload) => companyApi.updateProfile(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEY }),
  })
}

export function useUpdateEmployerProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: EmployerProfileUpdatePayload) => companyApi.updateEmployerProfile(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEY }),
  })
}

export function useUploadCompanyLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => companyApi.uploadLogo(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEY }),
  })
}

export function useUploadCompanyBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => companyApi.uploadBanner(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_KEY }),
  })
}

export function useTeamMembers() {
  return useQuery({ queryKey: TEAM_KEY, queryFn: companyApi.listTeam })
}

const TEAM_ACTIVITY_KEY = ['employer', 'company', 'team', 'activity']

export function useTeamActivity() {
  return useQuery({ queryKey: TEAM_ACTIVITY_KEY, queryFn: () => companyApi.getTeamActivity(50) })
}

export function useInviteTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TeamInvitePayload) => companyApi.inviteTeamMember(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  })
}

export function useRemoveTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (employerProfileId: string) => companyApi.removeTeamMember(employerProfileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  })
}

export function useTransferOwnership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (newOwnerEmployerProfileId: string) => companyApi.transferOwnership(newOwnerEmployerProfileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  })
}

export function useOffices() {
  return useQuery({ queryKey: OFFICES_KEY, queryFn: companyApi.listOffices })
}

export function useCreateOffice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; city: string; state?: string; is_headquarters?: boolean }) => companyApi.createOffice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: OFFICES_KEY }),
  })
}

export function useDeleteOffice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (officeId: string) => companyApi.deleteOffice(officeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: OFFICES_KEY }),
  })
}

export function useDepartments() {
  return useQuery({ queryKey: DEPARTMENTS_KEY, queryFn: companyApi.listDepartments })
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: [...DEPARTMENTS_KEY, id],
    queryFn: () => companyApi.getDepartment(id),
    enabled: !!id,
  })
}

export function useDepartmentJobs(departmentId: string) {
  return useQuery({
    queryKey: DEPARTMENT_JOBS_KEY(departmentId),
    queryFn: () => companyApi.getDepartmentJobs(departmentId),
    enabled: !!departmentId,
  })
}

export function useDepartmentOverview(departmentId: string) {
  return useQuery({
    queryKey: [...DEPARTMENTS_KEY, departmentId, 'overview'],
    queryFn: () => companyApi.getDepartmentOverview(departmentId),
    enabled: !!departmentId,
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DepartmentCreatePayload) => companyApi.createDepartment(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  })
}

export function useUpdateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DepartmentUpdatePayload }) =>
      companyApi.updateDepartment(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (departmentId: string) => companyApi.deleteDepartment(departmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  })
}

export function useAssignMemberDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employerProfileId, departmentId }: { employerProfileId: string; departmentId: string | null }) =>
      companyApi.assignMemberDepartment(employerProfileId, departmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEPARTMENTS_KEY })
      qc.invalidateQueries({ queryKey: TEAM_KEY })
      // Invalidate permissions so the affected sub-admin sees updated scope on next mount
      qc.invalidateQueries({ queryKey: PERMISSIONS_KEY })
      // Invalidate dashboard so the employer's job list re-scopes immediately
      qc.invalidateQueries({ queryKey: ['employer', 'dashboard'] })
    },
  })
}

// ── Hiring Team ───────────────────────────────────────────────────────────────

const HIRING_TEAM_KEY = (jobId: string) => ['employer', 'jobs', jobId, 'hiring-team']

export function useHiringTeam(jobId: string | undefined) {
  return useQuery({
    queryKey: HIRING_TEAM_KEY(jobId ?? ''),
    queryFn: () => hiringTeamApi.list(jobId!),
    enabled: !!jobId,
  })
}

export function useAddHiringTeamMember(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: HiringTeamAddPayload) => hiringTeamApi.add(jobId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: HIRING_TEAM_KEY(jobId) }),
  })
}

export function useRemoveHiringTeamMember(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => hiringTeamApi.remove(jobId, memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: HIRING_TEAM_KEY(jobId) }),
  })
}

// ── Subscriptions ──────────────────────────────────────────────────────────────

export function useSubscription() {
  return useQuery({ queryKey: SUBSCRIPTION_KEY, queryFn: subscriptionApi.getSubscription })
}

export function useSubscriptionUsage() {
  return useQuery({ queryKey: SUBSCRIPTION_USAGE_KEY, queryFn: subscriptionApi.getUsage })
}

export function useSubscriptionPlans() {
  return useQuery({ queryKey: SUBSCRIPTION_PLANS_KEY, queryFn: subscriptionApi.listPlans })
}

export function useUpgradeSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => subscriptionApi.upgrade(planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBSCRIPTION_KEY })
      qc.invalidateQueries({ queryKey: SUBSCRIPTION_USAGE_KEY })
    },
  })
}


// ── Phase F: Pipeline Stage hooks ─────────────────────────────────────────────

const PIPELINE_STAGES_KEY = (jobId: string) => ['employer', 'pipeline-stages', jobId]
const PIPELINE_TEMPLATES_KEY = ['employer', 'pipeline-templates']

export function usePipelineStages(jobId: string) {
  return useQuery({
    queryKey: PIPELINE_STAGES_KEY(jobId),
    queryFn: () => getPipelineStages(jobId),
    enabled: !!jobId,
  })
}

export function useBulkUpsertPipelineStages(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stages: PipelineStageIn[]) => bulkUpsertPipelineStages(jobId, stages),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_STAGES_KEY(jobId) }),
  })
}

export function usePipelineTemplates() {
  return useQuery({ queryKey: PIPELINE_TEMPLATES_KEY, queryFn: getPipelineTemplates })
}

export function useCreatePipelineTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, stages }: { name: string; stages: PipelineStageIn[] }) =>
      createPipelineTemplate(name, stages),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_TEMPLATES_KEY }),
  })
}

export function useDeletePipelineTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePipelineTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_TEMPLATES_KEY }),
  })
}

export function useApplyTemplateToJob(jobId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) => applyTemplateToJob(jobId, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_STAGES_KEY(jobId) }),
  })
}
