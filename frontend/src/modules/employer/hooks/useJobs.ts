import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobsApi } from '@/api/jobs'
import type { JobPostingPayload, VerificationDocType } from '@/api/jobs'
import { companyApi, subscriptionApi } from '@/api/company'
import type { CompanyProfileUpdatePayload, EmployerProfileUpdatePayload, TeamInvitePayload } from '@/api/company'
import { analyticsApi } from '@/api/analytics'
import { getUpcomingInterviews } from '@/api/matching'

const DASHBOARD_KEY = ['employer', 'dashboard']
const KPIS_KEY = ['employer', 'dashboard', 'kpis']
const TREND_KEY = (days: number) => ['employer', 'dashboard', 'trend', days]
const VERIFICATION_KEY = ['employer', 'verification']
const COMPANY_KEY = ['employer', 'company']
const TEAM_KEY = ['employer', 'company', 'team']
const SUBSCRIPTION_KEY = ['employer', 'subscription']
const SUBSCRIPTION_USAGE_KEY = ['employer', 'subscription', 'usage']
const SUBSCRIPTION_PLANS_KEY = ['employer', 'subscription', 'plans']

export function useEmployerDashboard() {
  // is_approved (and the "verification required" banner it drives) can change
  // from an admin's session at any time — the 5-min global staleTime would
  // otherwise show a stale "still pending" banner for up to 5 minutes after
  // approval whenever the employer navigates back without a hard refresh.
  return useQuery({ queryKey: DASHBOARD_KEY, queryFn: jobsApi.getDashboard, staleTime: 0 })
}

const PERMISSIONS_KEY = ['employer', 'permissions']

export function useEmployerPermissions() {
  return useQuery({ queryKey: PERMISSIONS_KEY, queryFn: jobsApi.getMyPermissions, staleTime: 5 * 60 * 1000 })
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

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: JobPostingPayload) => jobsApi.createJob(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useUpdateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobPostingPayload }) => jobsApi.updateJob(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function usePublishJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.publishJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function usePauseJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.pauseJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useCloseJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.closeJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useReopenJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.reopenJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useArchiveJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.archiveJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useDuplicateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.duplicateJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  })
}

// ── KYC verification ──────────────────────────────────────────────────────────

export function useVerificationStatus() {
  // Same reasoning as useEmployerDashboard — admin review happens in a
  // separate session, so this must always refetch on mount, not sit on a
  // 5-minute-stale cached "pending" status.
  return useQuery({ queryKey: VERIFICATION_KEY, queryFn: jobsApi.getVerificationStatus, staleTime: 0 })
}

export function useUploadVerificationDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docType, file }: { docType: VerificationDocType; file: File }) =>
      jobsApi.uploadVerificationDocument(docType, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: VERIFICATION_KEY }),
  })
}

export function useSubmitVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => jobsApi.submitVerification(),
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
