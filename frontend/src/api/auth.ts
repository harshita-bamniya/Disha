import { apiClient } from './client'
import type { AuthTokens, CompanySize, User } from '@/types'

export interface RegisterPayload {
  phone: string
  password: string
  preferred_language?: string
  recaptcha_token?: string
}

export interface LoginPayload {
  phone: string
  password: string
  recaptcha_token?: string
}

export interface VerifyPhonePayload {
  phone: string
  otp: string
}

export interface SendOtpPayload {
  phone: string
  purpose?: string
}

export interface MessageResponse {
  message: string
  dev_otp?: string
}

export interface EmployerRegisterPayload {
  phone: string
  password: string
  company_name: string
  // Everything below is collected later via the post-login setup wizard —
  // registration itself only needs phone + password + company_name.
  industry?: string
  company_size?: CompanySize
  contact_person?: string
  city?: string
  website?: string
  gst_number?: string
  designation?: string
  description?: string
  recaptcha_token?: string
}

export interface EmployerProfileResponse {
  id: string
  company_name: string
  industry?: string | null
  company_size?: CompanySize | null
  website?: string | null
  contact_person?: string | null
  city?: string | null
  is_approved: boolean
}

export interface EmployerRegisterResponse {
  message: string
  user: User
  employer_profile: EmployerProfileResponse
  dev_otp?: string
}

export interface TokenResponse {
  // access_token/refresh_token/user are only absent when requires_2fa is true —
  // the password step succeeded but a TOTP/backup code is still needed.
  access_token?: string
  refresh_token?: string
  token_type: string
  user?: User
  requires_2fa?: boolean
  challenge_token?: string
}

export interface GoogleLoginPayload {
  credential: string
}

export interface TwoFactorStatus {
  is_enabled: boolean
}

export interface TwoFactorSetupResponse {
  secret: string
  qr_code_data_uri: string
}

export interface TwoFactorEnableResponse {
  message: string
  backup_codes: string[]
}

export const authApi = {
  googleLogin: (data: GoogleLoginPayload) =>
    apiClient.post<TokenResponse>('/auth/google', data).then((r) => r.data),

  register: (data: RegisterPayload) =>
    apiClient.post<MessageResponse>('/auth/register', data).then((r) => r.data),

  verifyPhone: (data: VerifyPhonePayload) =>
    apiClient.post<TokenResponse>('/auth/verify-phone', data).then((r) => r.data),

  sendOtp: (data: SendOtpPayload) =>
    apiClient.post<MessageResponse>('/auth/send-otp', data).then((r) => r.data),

  login: (data: LoginPayload) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),

  logout: (refresh_token: string) =>
    apiClient.post<MessageResponse>('/auth/logout', { refresh_token }).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  forgotPassword: (phone: string, recaptcha_token?: string) =>
    apiClient.post<MessageResponse>('/auth/forgot-password', { phone, recaptcha_token }).then((r) => r.data),

  resetPassword: (data: { phone: string; otp: string; new_password: string }) =>
    apiClient.post<MessageResponse>('/auth/reset-password', data).then((r) => r.data),

  registerEmployer: (data: EmployerRegisterPayload) =>
    apiClient.post<EmployerRegisterResponse>('/auth/register/employer', data).then((r) => r.data),

  verifyEmployerPhone: (data: VerifyPhonePayload) =>
    apiClient.post<TokenResponse>('/auth/verify-phone/employer', data).then((r) => r.data),

  verifyLogin2fa: (data: { challenge_token: string; code: string }) =>
    apiClient.post<TokenResponse>('/auth/2fa/verify-login', data).then((r) => r.data),

  get2faStatus: () =>
    apiClient.get<TwoFactorStatus>('/auth/2fa/status').then((r) => r.data),

  setup2fa: () =>
    apiClient.post<TwoFactorSetupResponse>('/auth/2fa/setup').then((r) => r.data),

  enable2fa: (code: string) =>
    apiClient.post<TwoFactorEnableResponse>('/auth/2fa/enable', { code }).then((r) => r.data),

  disable2fa: (password: string) =>
    apiClient.post<MessageResponse>('/auth/2fa/disable', { password }).then((r) => r.data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post<MessageResponse>('/auth/change-password', data).then((r) => r.data),

  sendEmailVerification: () =>
    apiClient.post<MessageResponse>('/auth/send-email-verification').then((r) => r.data),
}
