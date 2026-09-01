import { apiClient } from './client'
import type { CompanySize, User } from '@/types'

export interface RegisterPayload {
  phone: string
  password: string
  preferred_language?: string
}

export interface LoginPayload {
  phone: string
  password: string
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
  industry: string
  company_size: CompanySize
  contact_person: string
  city: string
  website?: string
  gst_number?: string
  designation?: string
  description?: string
}

export interface EmployerProfileResponse {
  id: string
  company_name: string
  industry: string
  company_size: CompanySize
  website?: string
  contact_person: string
  city: string
  is_approved: boolean
}

export interface EmployerRegisterResponse {
  message: string
  user: User
  employer_profile: EmployerProfileResponse
  dev_otp?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export const authApi = {
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

  forgotPassword: (phone: string) =>
    apiClient.post<MessageResponse>('/auth/forgot-password', { phone }).then((r) => r.data),

  resetPassword: (data: { phone: string; otp: string; new_password: string }) =>
    apiClient.post<MessageResponse>('/auth/reset-password', data).then((r) => r.data),

  registerEmployer: (data: EmployerRegisterPayload) =>
    apiClient.post<EmployerRegisterResponse>('/auth/register/employer', data).then((r) => r.data),

  verifyEmployerPhone: (data: VerifyPhonePayload) =>
    apiClient.post<MessageResponse>('/auth/verify-phone/employer', data).then((r) => r.data),
}
