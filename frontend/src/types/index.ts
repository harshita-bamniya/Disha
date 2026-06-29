export type Language = 'en' | 'hi'
export type UserRole =
  | 'aspirant' | 'admin' | 'super_admin' | 'employer'
  | 'moderator' | 'verification_officer' | 'finance_manager' | 'support_executive'
  | 'employer_owner' | 'hr_manager' | 'recruiter' | 'interviewer'

export const PLATFORM_ADMIN_ROLES: UserRole[] = [
  'admin', 'super_admin', 'moderator', 'verification_officer', 'finance_manager', 'support_executive',
]
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+'

export interface User {
  id: string
  phone: string
  email?: string
  role: UserRole
  preferred_language: Language
  phone_verified: boolean
  email_verified: boolean
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
}

export interface ApiError {
  detail: string
  code?: string
}

// ── Onboarding types ──────────────────────────────────────────────────────────
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'
export type Qualification = 'graduate' | 'post_graduate' | 'doctorate' | 'diploma' | 'other'
export type UpscExam = 'cse' | 'capf' | 'cds' | 'ies' | 'cms' | 'state_pcs' | 'other'
export type UpscStage = 'none' | 'prelims' | 'mains' | 'interview'

// Step 7 — Psychological Assessment
export type BurnoutLevel = 'fresh' | 'somewhat_tired' | 'exhausted' | 'burnt_out'
export type ConfidenceLevel = 'very_confident' | 'reasonably_confident' | 'somewhat_unsure' | 'very_anxious'
export type FinancialPressure = 'no_rush' | 'some_pressure' | 'significant_pressure' | 'urgent'
export type RiskTolerance = 'low' | 'medium' | 'high'
export type MotivationType = 'intrinsic' | 'extrinsic' | 'mixed'
export type IdentityAttachment = 'low' | 'medium' | 'high'
export type SupportSystem = 'strong' | 'moderate' | 'weak'

export interface OnboardingStatus {
  current_step: number
  is_completed: boolean
}

export interface StepSavedResponse {
  message: string
  current_step: number
  is_completed: boolean
  disha_insight?: string | null
}
