import { apiClient } from './client'

export type ReferralStatus = 'invited' | 'applied' | 'in_process' | 'hired' | 'rejected' | 'withdrawn'
export type RewardStatus = 'pending' | 'eligible' | 'approved' | 'paid' | 'rejected' | 'cancelled'

export interface ReferralProgram {
  is_enabled: boolean
  default_bonus_amount: number
  currency: string
  hold_days: number
  terms: string | null
  updated_at: string | null
}

export interface ReferralProgramUpdate {
  is_enabled?: boolean
  default_bonus_amount?: number
  hold_days?: number
  terms?: string
}

export interface ReferralJob {
  job_id: string
  title: string
  location: string | null
  department: string | null
  is_open: boolean
  bonus_amount: number
  has_override: boolean
  referral_count: number
  hired_count: number
}

export interface Referrer {
  id: string
  name: string
  email: string
  status: 'active' | 'disabled'
  is_teammate: boolean
  referral_count: number
  hired_count: number
  earned_amount: number
  last_sent_at: string | null
  created_at: string | null
}

export interface BulkInviteResult {
  added: Referrer[]
  skipped: { email: string; reason: string }[]
}

export interface ReferralEvent {
  event: string
  from_value: string | null
  to_value: string | null
  note: string | null
  actor: string | null
  created_at: string
}

export interface Referral {
  id: string
  job_id: string
  job_title: string
  referrer_id: string
  referrer_name: string
  candidate_name: string | null
  candidate_email: string | null
  source: 'link' | 'nomination'
  status: ReferralStatus
  application_id: string | null
  note: string | null
  reward_status: RewardStatus | null
  reward_amount: number | null
  created_at: string
  events: ReferralEvent[]
}

export interface ReferralPage {
  items: Referral[]
  total: number
  page: number
  page_size: number
}

export interface ReferralFilters {
  status?: string
  job_id?: string
  referrer_id?: string
  q?: string
  page?: number
  page_size?: number
}

export interface Reward {
  id: string
  referral_id: string
  referrer_name: string
  candidate_name: string | null
  job_title: string
  amount: number
  currency: string
  status: RewardStatus
  hired_at: string
  eligible_on: string
  paid_at: string | null
  payment_reference: string | null
  note: string | null
}

export interface Overview {
  program_enabled: boolean
  referrers: number
  referrals: number
  by_status: Partial<Record<ReferralStatus, number>>
  hires: number
  conversion_rate: number
  rewards_by_status: Record<RewardStatus, { count: number; amount: number }>
  top_referrers: { referrer_id: string; name: string; referrals: number; hires: number; earned_amount: number }[]
  top_jobs: { job_id: string; title: string; referrals: number; hires: number }[]
}

export interface NominatePayload {
  job_id: string
  candidate_name: string
  candidate_email: string
  note?: string
}

export interface MyReferrals {
  company_name: string
  referrer_name: string
  program_enabled: boolean
  currency: string
  hold_days: number
  terms: string | null
  jobs: { job_id: string; title: string; location: string | null; bonus_amount: number; share_url: string }[]
  referrals: {
    id: string; candidate: string; job_title: string; status: ReferralStatus; source: 'link' | 'nomination'
    reward_status: RewardStatus | null; reward_amount: number | null; created_at: string
  }[]
  totals: { referred: number; hired: number; pending_amount: number; payable_amount: number; paid_amount: number }
}

export interface LinkInfo {
  valid: boolean
  job_title: string | null
  company_name: string | null
  location: string | null
  referrer_first_name: string | null
}

const base = '/employer/referrals'

export const referralsApi = {
  program: () => apiClient.get<ReferralProgram>(`${base}/program`).then(r => r.data),
  updateProgram: (body: ReferralProgramUpdate) => apiClient.put<ReferralProgram>(`${base}/program`, body).then(r => r.data),
  overview: () => apiClient.get<Overview>(`${base}/overview`).then(r => r.data),

  jobs: () => apiClient.get<ReferralJob[]>(`${base}/jobs`).then(r => r.data),
  updateJob: (jobId: string, body: { is_open?: boolean; bonus_amount?: number; clear_bonus?: boolean }) =>
    apiClient.put<ReferralJob>(`${base}/jobs/${jobId}`, body).then(r => r.data),

  referrers: () => apiClient.get<Referrer[]>(`${base}/referrers`).then(r => r.data),
  invite: (people: { name: string; email: string }[]) =>
    apiClient.post<BulkInviteResult>(`${base}/referrers/bulk`, { people }).then(r => r.data),
  resend: (id: string) => apiClient.post<Referrer>(`${base}/referrers/${id}/resend`).then(r => r.data),
  setReferrerStatus: (id: string, status: 'active' | 'disabled') =>
    apiClient.patch<Referrer>(`${base}/referrers/${id}`, { status }).then(r => r.data),

  referrals: (filters: ReferralFilters) =>
    apiClient.get<ReferralPage>(`${base}/referrals`, { params: filters }).then(r => r.data),
  referral: (id: string) => apiClient.get<Referral>(`${base}/referrals/${id}`).then(r => r.data),

  rewards: (status?: string) =>
    apiClient.get<Reward[]>(`${base}/rewards`, { params: status ? { status } : undefined }).then(r => r.data),
  exportRewards: () => apiClient.get<Blob>(`${base}/rewards/export`, { responseType: 'blob' }).then(r => r.data),
  approve: (id: string) => apiClient.post<Reward>(`${base}/rewards/${id}/approve`).then(r => r.data),
  pay: (id: string, payment_reference?: string) =>
    apiClient.post<Reward>(`${base}/rewards/${id}/pay`, { payment_reference }).then(r => r.data),
  reject: (id: string, reason: string, hire_left: boolean) =>
    apiClient.post<Reward>(`${base}/rewards/${id}/reject`, { reason, hire_left }).then(r => r.data),

  me: () => apiClient.get<MyReferrals>(`${base}/me`).then(r => r.data),
  nominate: (body: NominatePayload) => apiClient.post<MyReferrals>(`${base}/me/nominate`, body).then(r => r.data),
}

// Public (no sign-in): the share-link landing page and an invited employee's private page.
export const publicReferralsApi = {
  link: (code: string, jobId: string) =>
    apiClient.get<LinkInfo>(`/public/referrals/link/${encodeURIComponent(code)}/${encodeURIComponent(jobId)}`).then(r => r.data),
  portal: (token: string) => apiClient.get<MyReferrals>(`/public/referrals/portal/${encodeURIComponent(token)}`).then(r => r.data),
  portalNominate: (token: string, body: NominatePayload) =>
    apiClient.post<MyReferrals>(`/public/referrals/portal/${encodeURIComponent(token)}/nominate`, body).then(r => r.data),
}

// ── Carrying a referral code from the share link through sign-in to the application ─────────────

const STORE_KEY = 'beginablai.referral'
const TTL_MS = 30 * 24 * 3600 * 1000

type Stored = Record<string, { code: string; at: number }>

function read(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Stored
  } catch {
    return {}
  }
}

export const referralCode = {
  remember(jobId: string, code: string) {
    try {
      const all = read()
      all[jobId] = { code, at: Date.now() }
      localStorage.setItem(STORE_KEY, JSON.stringify(all))
    } catch { /* storage blocked: the link still works if they apply straight away */ }
  },
  get(jobId: string): string | null {
    const hit = read()[jobId]
    return hit && Date.now() - hit.at < TTL_MS ? hit.code : null
  },
  forget(jobId: string) {
    try {
      const all = read()
      delete all[jobId]
      localStorage.setItem(STORE_KEY, JSON.stringify(all))
    } catch { /* nothing to clean up */ }
  },
}
