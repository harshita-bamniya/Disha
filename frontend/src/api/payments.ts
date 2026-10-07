import { apiClient } from './client'
import type { SubscriptionPlanEntry } from './company'

export interface CheckoutResponse {
  razorpay_key_id: string
  razorpay_subscription_id: string
  plan: SubscriptionPlanEntry
}

export interface VerifyPaymentPayload {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

export interface PaymentHistoryEntry {
  id: string
  plan_name: string | null
  amount: number
  currency: string
  status: string
  method: string | null
  invoice_number: string | null
  created_at: string
  captured_at: string | null
}

export interface AspirantSubscriptionResponse {
  plan: SubscriptionPlanEntry
  status: string
  current_period_start: string
  current_period_end: string
}

export interface FeatureUsageEntry {
  feature_key: 'counsellor_chat' | 'roadmap' | 'resume_builder' | 'mock_interview'
  used_count: number
  limit: number | null
}

export interface AspirantUsageResponse {
  is_premium: boolean
  features: FeatureUsageEntry[]
}

export const paymentsApi = {
  listPlans: (planType: 'employer' | 'aspirant') =>
    apiClient.get<SubscriptionPlanEntry[]>('/payments/plans', { params: { plan_type: planType } }).then(r => r.data),

  checkout: (planId: string) =>
    apiClient.post<CheckoutResponse>('/payments/checkout', { plan_id: planId }).then(r => r.data),

  verify: (payload: VerifyPaymentPayload) =>
    apiClient.post('/payments/verify', payload).then(r => r.data),

  cancel: () => apiClient.post('/payments/cancel').then(r => r.data),

  history: () => apiClient.get<PaymentHistoryEntry[]>('/payments/history').then(r => r.data),

  aspirantSubscription: () =>
    apiClient.get<AspirantSubscriptionResponse>('/payments/aspirant/subscription').then(r => r.data),

  aspirantUsage: () =>
    apiClient.get<AspirantUsageResponse>('/payments/aspirant/usage').then(r => r.data),
}
