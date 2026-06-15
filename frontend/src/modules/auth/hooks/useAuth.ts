import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data, variables) => {
      sessionStorage.setItem('pending_phone', variables.phone)
      if (data.dev_otp) {
        sessionStorage.setItem('dev_otp', data.dev_otp)
      }
      navigate('/auth/verify')
    },
  })
}

export function useVerifyPhone() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.verifyPhone,
    onSuccess: (data) => {
      // Backend returns token pair after verification — auto-login, go straight to dashboard
      setAuth(data.user, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type as 'bearer',
      })
      sessionStorage.removeItem('pending_phone')
      sessionStorage.removeItem('dev_otp')
      navigate('/app/dashboard')
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
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type as 'bearer',
      })
      // Route based on role
      if (data.user.role === 'employer') {
        navigate('/app/employer/dashboard')
      } else if (data.user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/app/dashboard')
      }
    },
  })
}

export function useRegisterEmployer() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.registerEmployer,
    onSuccess: (data, variables) => {
      sessionStorage.setItem('pending_phone', variables.phone)
      sessionStorage.setItem('pending_employer', '1')
      if (data.dev_otp) {
        sessionStorage.setItem('dev_otp', data.dev_otp)
      }
      navigate('/auth/verify-employer')
    },
  })
}

export function useVerifyEmployerPhone() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.verifyEmployerPhone,
    onSuccess: () => {
      sessionStorage.removeItem('pending_phone')
      sessionStorage.removeItem('pending_employer')
      sessionStorage.removeItem('dev_otp')
      navigate('/auth/employer-pending')
    },
  })
}

export function useGoogleLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.googleLogin,
    onSuccess: (data) => {
      setAuth(data.user, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type as 'bearer',
      })
      if (data.user.role === 'employer') {
        navigate('/app/employer/dashboard')
      } else if (data.user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/app/dashboard')
      }
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
