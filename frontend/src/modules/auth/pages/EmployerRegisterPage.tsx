import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Phone, Lock, ArrowLeft, Check, X, RotateCcw } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OtpInput from '@/components/ui/OtpInput'
import { useRegisterEmployer, useVerifyEmployerPhone, useSendOtp } from '../hooks/useAuth'
import { getApiError } from '@/api/client'
import { getRecaptchaToken } from '@/lib/recaptcha'

const N = {
  navy:    '#1A2744',
  ink:     '#1E3A5F',
  muted:   '#94A3B8',
  bg:      '#F4F5F7',
  white:   '#FFFFFF',
}

const PASSWORD_RULES = [
  { key: 'len',     label: 'At least 8 characters',   test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',     test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',     test: (p: string) => /[a-z]/.test(p) },
  { key: 'num',     label: 'One number',               test: (p: string) => /\d/.test(p) },
  { key: 'special', label: 'One special character',    test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

const PERKS = [
  { v: '2,400+', l: 'UPSC candidates' },
  { v: '87%',    l: 'Match accuracy' },
  { v: '48h',    l: 'Avg. time to hire' },
]

const RESEND_COOLDOWN = 30

export default function EmployerRegisterPage() {
  const [form, setForm] = useState({ phone: '', password: '', company_name: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showRules, setShowRules] = useState(false)

  // OTP state
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const otpRef = useRef<HTMLDivElement>(null)

  const registerEmployer = useRegisterEmployer()
  const verifyPhone = useVerifyEmployerPhone()
  const sendOtp = useSendOtp()

  const passRules    = PASSWORD_RULES.map(r => ({ ...r, pass: r.test(form.password) }))
  const allRulesPass = passRules.every(r => r.pass)
  const passedCount  = passRules.filter(r => r.pass).length
  const strengthColor =
    passedCount <= 1 ? '#EF4444' :
    passedCount <= 3 ? '#F97316' :
    passedCount === 4 ? '#EAB308' : N.navy

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }))
    if (fieldErrors[field]) setFieldErrors(p => ({ ...p, [field]: '' }))
  }

  // Scroll OTP into view when it appears
  useEffect(() => {
    if (otpSent && otpRef.current) {
      setTimeout(() => otpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }, [otpSent])

  // Resend countdown
  useEffect(() => {
    if (!otpSent || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [otpSent, countdown])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.company_name.trim()) errors.company_name = 'Company name is required'
    if (!form.phone.trim()) errors.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) errors.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!allRulesPass) errors.password = 'Password does not meet all requirements'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpSent) {
      if (otp.length < 6) return
      verifyPhone.mutate({ phone: form.phone, otp })
      return
    }
    if (!validate()) return
    const recaptcha_token = await getRecaptchaToken('employer_register')
    registerEmployer.mutate(
      { phone: form.phone, password: form.password, company_name: form.company_name, recaptcha_token },
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
    sendOtp.mutate({ phone: form.phone, purpose: 'register' }, {
      onSuccess: (data) => {
        if (data.dev_otp) setDevOtp(data.dev_otp)
        setOtp('')
        setCountdown(RESEND_COOLDOWN)
      },
    })
  }

  const serverError = registerEmployer.error
    ? getApiError(registerEmployer.error, 'Registration failed. Please try again.')
    : verifyPhone.error
    ? getApiError(verifyPhone.error, 'Verification failed. Please try again.')
    : null

  const maskedPhone = form.phone ? `${form.phone.slice(0, 2)}XXXXXX${form.phone.slice(-2)}` : ''

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: N.bg }}>

      {/* ── Left panel ── (no inline `display`: the "hidden lg:flex" class
          must control it, or it always shows and squeezes the form) */}
      <div style={{ width: '42%', background: N.navy, flexShrink: 0, flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', position: 'relative', overflow: 'hidden' }} className="hidden lg:flex">
        <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: '-140px', right: '-140px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', bottom: '5%', left: '-80px', pointerEvents: 'none' }} />
        <Link to="/" style={{ textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>BeginableAI</span>
        </Link>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.10)', border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: 100, padding: '5px 14px', marginBottom: 28 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.3px' }}>Hire UPSC-trained talent</span>
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 32, fontWeight: 800, color: N.white, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.4px' }}>
            Find candidates who think at a different level.
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, maxWidth: 320 }}>
            UPSC aspirants bring analytical depth, governance knowledge, and discipline that most professionals never develop.
          </p>
          <div style={{ display: 'flex', gap: 0, marginTop: 40, borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: 32 }}>
            {PERKS.map((s, i) => (
              <div key={s.l} style={{ flex: 1, paddingRight: i < 2 ? 24 : 0, borderRight: i < 2 ? '0.5px solid rgba(255,255,255,0.1)' : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color: N.white }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
          "UPSC aspirants bring discipline and analytical depth most professionals never develop."
        </p>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <Link to="/" className="lg:hidden" style={{ textDecoration: 'none', marginBottom: 28 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#1E3A5F', letterSpacing: '-0.4px' }}>BeginableAI</span>
        </Link>

        <div style={{ width: '100%', maxWidth: 440, background: N.white, borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(26,39,68,0.07)', padding: '36px 36px' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: N.muted, textDecoration: 'none', marginBottom: 24 }}
            onMouseOver={e => e.currentTarget.style.color = N.ink}
            onMouseOut={e => e.currentTarget.style.color = N.muted}
          >
            <ArrowLeft size={13} /> Back to home
          </Link>

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(26,39,68,0.06)', border: '0.5px solid rgba(26,39,68,0.1)', borderRadius: 100, padding: '4px 12px', marginBottom: 14 }}>
              <Building2 size={12} color={N.navy} />
              <span style={{ fontSize: 11, fontWeight: 700, color: N.navy, letterSpacing: '0.3px', textTransform: 'uppercase' }}>For Employers</span>
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 24, fontWeight: 800, color: N.ink, marginBottom: 6, letterSpacing: '-0.3px' }}>
              Create your company account
            </h1>
            <p style={{ fontSize: 14, color: N.muted, lineHeight: 1.6 }}>
              Just the basics for now — add branding and verification after you log in.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <Input
              label="Company name"
              placeholder="Acme Corp Pvt Ltd"
              value={form.company_name}
              onChange={set('company_name')}
              error={fieldErrors.company_name}
              prefix={<Building2 className="w-4 h-4" />}
              disabled={otpSent}
            />

            {/* Phone field + inline OTP below it */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Input
                label="Phone number"
                type="tel"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={set('phone')}
                error={fieldErrors.phone}
                prefix={<Phone className="w-4 h-4" />}
                maxLength={10}
                inputMode="numeric"
                disabled={otpSent}
              />

              {/* OTP slides in right below phone field */}
              {otpSent && (
                <div ref={otpRef} style={{
                  marginTop: 12, padding: '16px', borderRadius: 12,
                  background: 'rgba(26,39,68,0.03)', border: '1px solid rgba(26,39,68,0.08)',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <p style={{ fontSize: 12.5, color: N.muted, margin: 0 }}>
                    OTP sent to <strong style={{ color: N.ink }}>+91 {maskedPhone}</strong>
                  </p>

                  {devOtp && (
                    <div style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Dev OTP:</span>{' '}
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setOtp(devOtp)}>
                        {devOtp}
                      </span>
                      {' '}(click to fill)
                    </div>
                  )}

                  <OtpInput value={otp} onChange={setOtp} length={6} disabled={verifyPhone.isPending} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: N.muted }}>
                      <RotateCcw size={11} />
                      {countdown > 0 ? (
                        <span>Resend in {countdown}s</span>
                      ) : (
                        <button type="button" onClick={handleResend} disabled={sendOtp.isPending}
                          style={{ color: N.navy, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                          Resend OTP
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setDevOtp(null) }}
                      style={{ fontSize: 12, color: N.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Change number
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Input
                label="Password"
                type="password"
                placeholder="Create a strong password"
                value={form.password}
                onChange={e => { set('password')(e); setShowRules(true) }}
                error={fieldErrors.password}
                prefix={<Lock className="w-4 h-4" />}
                maxLength={128}
                onFocus={() => setShowRules(true)}
                disabled={otpSent}
              />
              {(showRules || form.password.length > 0) && (
                <>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {PASSWORD_RULES.map((_, i) => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i < passedCount ? strengthColor : '#E2E8F0', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                    {passRules.map(r => (
                      <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: r.pass ? N.navy : N.muted }}>
                        {r.pass ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                        {r.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {serverError && (
              <p style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 10, padding: '10px 14px' }}>
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              fullWidth size="lg"
              loading={registerEmployer.isPending || verifyPhone.isPending}
              disabled={otpSent ? otp.length < 6 : (!allRulesPass && form.password.length > 0)}
            >
              {otpSent ? 'Verify & Create Account' : 'Create account'}
            </Button>

            <p style={{ textAlign: 'center', fontSize: 13, color: N.muted }}>
              Already registered?{' '}
              <Link to="/auth/login" style={{ color: N.navy, fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
              <span style={{ margin: '0 8px', color: '#E2E8F0' }}>·</span>
              <Link to="/auth/register" style={{ color: N.navy, fontWeight: 600, textDecoration: 'none' }}>Aspirant sign up</Link>
            </p>
          </form>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: N.muted, textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
          Protected by reCAPTCHA · <a href="/privacy" style={{ color: N.muted, textDecoration: 'underline' }}>Privacy</a> · <a href="/terms" style={{ color: N.muted, textDecoration: 'underline' }}>Terms</a>
        </p>
      </div>
    </div>
  )
}
