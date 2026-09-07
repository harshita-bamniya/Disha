import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Mail, RotateCcw } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OtpInput from '@/components/ui/OtpInput'
import { cn } from '@/lib/utils'
import { GoogleLogin } from '@react-oauth/google'
import { useRegister, useVerifyEmailOtp, useResendEmailOtp, useGoogleLogin } from '../hooks/useAuth'
import { getApiError } from '@/api/client'
import { getRecaptchaToken } from '@/lib/recaptcha'

interface PasswordRule {
  label: string
  test: (v: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { label: 'One number (0-9)', test: (v) => /\d/.test(v) },
  { label: 'One special character (!@#$...)', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
]

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']

const RESEND_COOLDOWN = 30

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const otpRef = useRef<HTMLDivElement>(null)

  const register = useRegister()
  const verifyEmailOtp = useVerifyEmailOtp()
  const resendEmailOtp = useResendEmailOtp()
  const googleLogin = useGoogleLogin()

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(password)).length

  useEffect(() => {
    if (otpSent && otpRef.current)
      setTimeout(() => otpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }, [otpSent])

  useEffect(() => {
    if (!otpSent || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [otpSent, countdown])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!email.trim()) {
      errors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address'
    }
    if (PASSWORD_RULES.some(r => !r.test(password))) errors.password = 'Password does not meet all requirements'
    if (!acceptedTerms) errors.terms = 'You must accept the Terms & Conditions to create an account'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpSent) {
      if (otp.length < 6) return
      verifyEmailOtp.mutate({ email: email.trim(), otp })
      return
    }
    if (!validate()) return
    const recaptcha_token = await getRecaptchaToken('register')
    register.mutate(
      { email: email.trim(), password, recaptcha_token },
      {
        onSuccess: () => {
          setOtpSent(true)
          setCountdown(RESEND_COOLDOWN)
        },
      }
    )
  }

  const handleResend = () => {
    resendEmailOtp.mutate({ email: email.trim() }, {
      onSuccess: () => {
        setOtp('')
        setCountdown(RESEND_COOLDOWN)
      },
    })
  }

  const serverError = register.error
    ? getApiError(register.error)
    : verifyEmailOtp.error
    ? getApiError(verifyEmailOtp.error, 'Verification failed')
    : null

  const maskedEmail = email.includes('@')
    ? email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
    : email

  const strengthColor = [
    '', 'bg-danger', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-primary',
  ][passwordStrength]

  return (
    <AuthLayout title="Create your account" subtitle="Start your career relaunch journey today" variant="register" panelSide="right">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Email + inline OTP */}
        <div className="flex flex-col gap-0">
          <Input
            label="Email address"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' }))
            }}
            error={fieldErrors.email}
            prefix={<Mail className="w-4 h-4" />}
            maxLength={150}
            inputMode="email"
            disabled={otpSent}
          />

          {otpSent && (
            <div ref={otpRef} style={{
              marginTop: 10, padding: '14px 16px', borderRadius: 12,
              background: 'rgba(26,39,68,0.03)', border: '1px solid rgba(26,39,68,0.08)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <p style={{ fontSize: 12.5, color: '#475569', margin: 0 }}>
                A verification code was sent to <strong style={{ color: '#1E3A5F' }}>{maskedEmail}</strong>
              </p>
              <OtpInput value={otp} onChange={setOtp} length={6} disabled={verifyEmailOtp.isPending} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94A3B8' }}>
                  <RotateCcw className="w-3 h-3" />
                  {countdown > 0 ? <span>Resend in {countdown}s</span> : (
                    <Button type="button" variant="ghost" size="sm" onClick={handleResend} disabled={resendEmailOtp.isPending}
                      className="text-[#1A2744] font-semibold text-xs p-0 h-auto">
                      Resend code
                    </Button>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setOtpSent(false); setOtp('') }}
                  className="text-xs text-[#94A3B8] p-0 h-auto">
                  Edit details
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1">
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            prefix={<Lock className="w-4 h-4" />}
            maxLength={128}
            disabled={otpSent}
          />
          {password.length > 0 && (
            <>
              <div className="flex gap-1 mt-1">
                {PASSWORD_RULES.map((_, i) => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300', i < passwordStrength ? strengthColor : 'bg-gray-200')} />
                ))}
              </div>
              <p className="text-xs mt-1" style={{ color: passwordStrength === PASSWORD_RULES.length ? '#16A34A' : '#94A3B8' }}>
                {STRENGTH_LABELS[passwordStrength]}
              </p>
            </>
          )}
        </div>

        {/* T&C */}
        {!otpSent && (
          <div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: '#1A2744', flexShrink: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                I agree to BeginablAI's{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'underline' }}>Terms &amp; Conditions</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'underline' }}>Privacy Policy</a>
              </span>
            </label>
            {fieldErrors.terms && <p className="text-xs text-danger mt-1">{fieldErrors.terms}</p>}
          </div>
        )}

        {serverError && (
          <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">{serverError}</p>
        )}

        <Button
          type="submit" fullWidth size="lg"
          loading={register.isPending || verifyEmailOtp.isPending}
          disabled={otpSent ? otp.length < 6 : (passwordStrength < PASSWORD_RULES.length || !acceptedTerms)}
          className="mt-1"
        >
          {otpSent ? 'Verify & Create Account' : 'Create account'}
        </Button>

        <p className="text-center text-sm" style={{ color: '#475569' }}>
          Already have an account?{' '}
          <Link to="/auth/login" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
        </p>

        {!otpSent && (
          <>
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
                onSuccess={(response) => { if (response.credential) googleLogin.mutate({ credential: response.credential }) }}
                onError={() => {}}
                width="320" text="signup_with" shape="rectangular" theme="outline"
              />
            </div>
          </>
        )}
      </form>
    </AuthLayout>
  )
}
