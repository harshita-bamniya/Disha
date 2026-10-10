import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { referralsApi, type ReferralFilters, type ReferralProgramUpdate } from '@/api/referrals'

const K = ['employer', 'referrals'] as const

export const useReferralProgram = () => useQuery({ queryKey: [...K, 'program'], queryFn: referralsApi.program })
export const useReferralOverview = (enabled = true) => useQuery({ queryKey: [...K, 'overview'], queryFn: referralsApi.overview, enabled })
export const useReferralJobs = (enabled = true) => useQuery({ queryKey: [...K, 'jobs'], queryFn: referralsApi.jobs, enabled })
export const useReferrers = (enabled = true) => useQuery({ queryKey: [...K, 'referrers'], queryFn: referralsApi.referrers, enabled })
export const useReferralList = (filters: ReferralFilters, enabled = true) =>
  useQuery({ queryKey: [...K, 'list', filters], queryFn: () => referralsApi.referrals(filters), enabled, placeholderData: p => p })
export const useReferralDetail = (id: string | null) =>
  useQuery({ queryKey: [...K, 'detail', id], queryFn: () => referralsApi.referral(id!), enabled: !!id })
export const useRewards = (status: string | undefined, enabled = true) =>
  useQuery({ queryKey: [...K, 'rewards', status ?? 'all'], queryFn: () => referralsApi.rewards(status), enabled })
export const useMyReferrals = () => useQuery({ queryKey: [...K, 'me'], queryFn: referralsApi.me })

function useInvalidating<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: K }) })
}

export const useUpdateProgram = () => useInvalidating((b: ReferralProgramUpdate) => referralsApi.updateProgram(b))
export const useUpdateReferralJob = () =>
  useInvalidating((v: { jobId: string; body: { is_open?: boolean; bonus_amount?: number; clear_bonus?: boolean } }) =>
    referralsApi.updateJob(v.jobId, v.body))
export const useInviteReferrers = () => useInvalidating((p: { name: string; email: string }[]) => referralsApi.invite(p))
export const useResendReferrer = () => useInvalidating((id: string) => referralsApi.resend(id))
export const useSetReferrerStatus = () =>
  useInvalidating((v: { id: string; status: 'active' | 'disabled' }) => referralsApi.setReferrerStatus(v.id, v.status))
export const useApproveReward = () => useInvalidating((id: string) => referralsApi.approve(id))
export const usePayReward = () => useInvalidating((v: { id: string; ref?: string }) => referralsApi.pay(v.id, v.ref))
export const useRejectReward = () =>
  useInvalidating((v: { id: string; reason: string; hireLeft: boolean }) => referralsApi.reject(v.id, v.reason, v.hireLeft))
export const useNominate = () => useInvalidating(referralsApi.nominate)
