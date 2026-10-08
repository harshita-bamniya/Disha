import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock, CheckCircle2, Mail } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLogin, useGoogleLogin } from '../hooks/useAuth'
import { getApiError } from '@/api/client'
import { getRecaptchaToken } from '@/lib/recaptcha'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const login = useLogin()
  const googleLogin = useGoogleLogin()
  const location = useLocation()
  const justVerified = (location.state as any)?.verified === true

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!identifier.trim()) errors.identifier = 'Email address is required'
    if (!password.trim()) errors.password = 'Password is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const recaptcha_token = await getRecaptchaToken('login')
    login.mutate({ identifier, password, rememberMe, recaptcha_token })
  }

  const serverError = login.error ? getApiError(login.error, 'Incorrect email or password') : null

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your career journey"
      variant="login"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {justVerified && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Verified successfully! You can now log in.
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          placeholder="Enter email address"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldErrors.identifier}
          prefix={<Mail className="w-4 h-4" />}
          maxLength={150}
          inputMode="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          prefix={<Lock className="w-4 h-4" />}
          maxLength={128}
        />

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none -mt-1" style={{ color: '#475569' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 focus:ring-0"
            style={{ accentColor: '#1A2744' }}
          />
          Remember me on this device
        </label>

        {serverError && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={login.isPending}
          className="mt-1"
        >
          Log in
        </Button>

        <div className="flex items-center justify-between text-sm" style={{ color: '#475569' }}>
          <span>
            Don't have an account?{' '}
            <Link to="/auth/register" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'none' }}>
              Create account
            </Link>
          </span>
          <Link to="/auth/forgot-password" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>

        <div className="relative flex items-center my-1">
          <div className="flex-grow" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }} />
          <span className="mx-3 text-xs shrink-0" style={{ color: '#94A3B8' }}>or continue with</span>
          <div className="flex-grow" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }} />
        </div>

        {googleLogin.error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {getApiError(googleLogin.error, 'Google sign-in failed. Please try again.')}
          </p>
        )}

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(response) => {
              if (response.credential) {
                googleLogin.mutate({ credential: response.credential })
              }
            }}
            onError={() => {}}
            width="320"
            text="signin_with"
            shape="rectangular"
            theme="outline"
          />
        </div>
      </form>
    </AuthLayout>
  )
}
