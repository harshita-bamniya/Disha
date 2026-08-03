import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi, type TokenResponse } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'
import { EMPLOYER_ROLES, PLATFORM_ADMIN_ROLES } from '@/types'

/** Shared by useLogin/useGoogleLogin/useVerifyLogin2fa — same role-based
 * redirect everywhere a real token pair gets issued. */
function redirectByRole(user: User, navigate: ReturnType<typeof useNavigate>) {
  if (EMPLOYER_ROLES.includes(user.role)) navigate('/app/employer/dashboard')
  else if (PLATFORM_ADMIN_ROLES.includes(user.role)) navigate('/admin')
  else navigate('/app/dashboard')
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register })
}

export function useVerifyPhone() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.verifyPhone,
    onSuccess: (data) => {
      setAuth(data.user!, {
        access_token: data.access_token!,
        refresh_token: data.refresh_token!,
        token_type: data.token_type as 'bearer',
      })
      sessionStorage.removeItem('pending_phone')
      sessionStorage.removeItem('dev_otp')
      // New registrations always need step 1 — go directly to onboarding
      navigate('/app/onboarding/step/1')
    },
  })
}

export function useSendOtp() {
  return useMutation({ mutationFn: authApi.sendOtp })
}

export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ rememberMe, ...credentials }: Parameters<typeof authApi.login>[0] & { rememberMe?: boolean }) =>
      authApi.login(credentials).then((data) => ({ data, rememberMe })),
    onSuccess: ({ data, rememberMe }) => {
      if (data.requires_2fa) {
        // Password was correct, but a TOTP/backup code is still needed —
        // hand the challenge token to the code-entry page via route state
        // (never sessionStorage/localStorage — it's short-lived and sensitive).
        navigate('/auth/2fa-challenge', { state: { challengeToken: data.challenge_token, rememberMe } })
        return
      }
      setAuth(data.user!, {
        access_token: data.access_token!,
        refresh_token: data.refresh_token!,
        token_type: data.token_type as 'bearer',
      }, rememberMe)
      redirectByRole(data.user!, navigate)
    },
  })
}

export function useVerifyLogin2fa() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ rememberMe, ...body }: { challenge_token: string; code: string; rememberMe?: boolean }) =>
      authApi.verifyLogin2fa(body).then((data) => ({ data, rememberMe })),
    onSuccess: ({ data, rememberMe }: { data: TokenResponse; rememberMe?: boolean }) => {
      setAuth(data.user!, {
        access_token: data.access_token!,
        refresh_token: data.refresh_token!,
        token_type: data.token_type as 'bearer',
      }, rememberMe)
      redirectByRole(data.user!, navigate)
    },
  })
}

export function useRegisterEmployer() {
  return useMutation({ mutationFn: authApi.registerEmployer })
}

export function useVerifyEmployerPhone() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.verifyEmployerPhone,
    onSuccess: (data) => {
      // Account access is instant now — verifying the phone auto-logs in,
      // same as aspirants. Job posting itself stays gated separately on
      // profile completion + KYC verification.
      sessionStorage.removeItem('pending_phone')
      sessionStorage.removeItem('pending_employer')
      sessionStorage.removeItem('dev_otp')
      setAuth(data.user!, {
        access_token: data.access_token!,
        refresh_token: data.refresh_token!,
        token_type: data.token_type as 'bearer',
      })
      navigate('/app/employer/setup')
    },
  })
}

export function useGoogleLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.googleLogin,
    onSuccess: (data) => {
      setAuth(data.user!, {
        access_token: data.access_token!,
        refresh_token: data.refresh_token!,
        token_type: data.token_type as 'bearer',
      })
      redirectByRole(data.user!, navigate)
    },
  })
}

export function useLogout() {
  const { refreshToken, logout } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => {
      logout()
      navigate('/auth/login')
    },
  })
}
