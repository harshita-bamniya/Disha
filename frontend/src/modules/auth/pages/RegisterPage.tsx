import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Lock, Check, X, Mail, RotateCcw } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OtpInput from '@/components/ui/OtpInput'
import { cn } from '@/lib/utils'
import { GoogleLogin } from '@react-oauth/google'
import { useRegister, useVerifyPhone, useSendOtp, useGoogleLogin } from '../hooks/useAuth'
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

function isEmail(v: string) { return v.includes('@') }
const RESEND_COOLDOWN = 30

export default function RegisterPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const otpRef = useRef<HTMLDivElement>(null)

  const register = useRegister()
  const verifyPhone = useVerifyPhone()
  const sendOtp = useSendOtp()
  const googleLogin = useGoogleLogin()

  const usingEmail = isEmail(identifier)
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
    if (!identifier.trim()) {
      errors.identifier = 'Phone number or email is required'
    } else if (usingEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim()))
        errors.identifier = 'Enter a valid email address'
    } else {
      if (!/^[6-9]\d{9}$/.test(identifier.replace(/\D/g, '')))
        errors.identifier = 'Enter a valid 10-digit Indian mobile number'
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
      verifyPhone.mutate({ phone: identifier, otp })
      return
    }
    if (!validate()) return
    if (usingEmail) {
      const recaptcha_token = await getRecaptchaToken('register')
      register.mutate({ email: identifier.trim(), password, recaptcha_token })
      return
    }
    const recaptcha_token = await getRecaptchaToken('register')
    register.mutate(
      { phone: identifier, password, recaptcha_token },
      {
        onSuccess: (data) => {
          setOtpSent(true)
          setCountdown(RESEND_COOLDOWN)
          if (data.dev_otp) setDevOtp(data.dev_otp)
        },
      }
    )
  }

  const handleResend = () => {
    sendOtp.mutate({ phone: identifier, purpose: 'register' }, {
      onSuccess: (data) => {
        if (data.dev_otp) setDevOtp(data.dev_otp)
        setOtp('')
        setCountdown(RESEND_COOLDOWN)
      },
    })
  }

  const serverError = register.error
    ? getApiError(register.error)
    : verifyPhone.error
    ? getApiError(verifyPhone.error, 'Verification failed')
    : null

  const maskedPhone = identifier ? `${identifier.slice(0, 2)}XXXXXX${identifier.slice(-2)}` : ''

  const strengthColor = [
    '', 'bg-danger', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-primary',
  ][passwordStrength]

  return (
    <AuthLayout title="Create your account" subtitle="Start your career relaunch journey today" variant="register" panelSide="right">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Phone/Email + inline OTP */}
        <div className="flex flex-col gap-0">
          <Input
            label="Phone number or email"
            type={usingEmail ? 'email' : 'tel'}
            placeholder="Enter phone number or email"
            value={identifier}
            onChange={(e) => {
              const v = e.target.value
              if (!isEmail(v) && v.replace(/\D/g, '').length > 10) return
              setIdentifier(v)
              if (fieldErrors.identifier) setFieldErrors(p => ({ ...p, identifier: '' }))
            }}
            error={fieldErrors.identifier}
            prefix={usingEmail ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            maxLength={usingEmail ? 150 : 10}
            inputMode={usingEmail ? 'email' : 'numeric'}
            disabled={otpSent}
          />

          {otpSent && !usingEmail && (
            <div ref={otpRef} style={{
              marginTop: 10, padding: '14px 16px', borderRadius: 12,
              background: 'rgba(26,39,68,0.03)', border: '1px solid rgba(26,39,68,0.08)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <p style={{ fontSize: 12.5, color: '#475569', margin: 0 }}>
                OTP sent to <strong style={{ color: '#1E3A5F' }}>+91 {maskedPhone}</strong>
              </p>
              {devOtp && (
                <div className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                  <span className="font-semibold">Dev OTP:</span>{' '}
                  <span className="font-mono font-bold cursor-pointer underline" onClick={() => setOtp(devOtp)}>{devOtp}</span>
                  {' '}(click to fill)
                </div>
              )}
              <OtpInput value={otp} onChange={setOtp} length={6} disabled={verifyPhone.isPending} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94A3B8' }}>
                  <RotateCcw className="w-3 h-3" />
                  {countdown > 0 ? <span>Resend in {countdown}s</span> : (
                    <Button type="button" variant="ghost" size="sm" onClick={handleResend} disabled={sendOtp.isPending}
                      className="text-[#1A2744] font-semibold text-xs p-0 h-auto">
                      Resend OTP
                    </Button>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setOtpSent(false); setOtp(''); setDevOtp(null) }}
                  className="text-xs text-[#94A3B8] p-0 h-auto">
                  Change number
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
            onChange={(e) => { setPassword(e.target.value); setShowRules(true) }}
            error={fieldErrors.password}
            prefix={<Lock className="w-4 h-4" />}
            maxLength={128}
            disabled={otpSent}
          />
          {password.length > 0 && (
            <div className="flex gap-1 mt-1">
              {PASSWORD_RULES.map((_, i) => (
                <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300', i < passwordStrength ? strengthColor : 'bg-gray-200')} />
              ))}
            </div>
          )}
          {showRules && password.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(password)
                return (
                  <li key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: passed ? '#1A2744' : '#94A3B8' }}>
                    {passed ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                    {rule.label}
                  </li>
                )
              })}
            </ul>
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
          loading={register.isPending || verifyPhone.isPending}
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
