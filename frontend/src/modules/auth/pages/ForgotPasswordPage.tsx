import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Lock, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authApi } from '@/api/auth'
import { getApiError } from '@/api/client'

type Step = 'phone' | 'reset' | 'done'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const errors: Record<string, string> = {}
    if (!phone.trim()) errors.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '')))
      errors.phone = 'Enter a valid 10-digit Indian mobile number'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const res = await authApi.forgotPassword(phone)
      if (res.dev_otp) setDevOtp(res.dev_otp)
      setStep('reset')
    } catch (err: unknown) {
      setError(getApiError(err, 'Could not send OTP. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Reset Password ───────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const errors: Record<string, string> = {}
    if (!otp.trim() || !/^\d{6}$/.test(otp)) errors.otp = 'Enter the 6-digit OTP'
    if (!newPassword.trim()) errors.newPassword = 'New password is required'
    if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      await authApi.resetPassword({ phone, otp, new_password: newPassword })
      setStep('done')
    } catch (err: unknown) {
      setError(getApiError(err, 'Reset failed. Please check your OTP and try again.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <AuthLayout title="Password reset!" subtitle="You can now log in with your new password.">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', border: '2px solid rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={28} color="#059669" />
          </div>
          <p style={{ fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
            Your password has been updated successfully. All active sessions have been logged out for security.
          </p>
          <Button fullWidth size="lg" onClick={() => navigate('/auth/login')}>
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  // ── Step 1: Phone input ───────────────────────────────────────────────────────
  if (step === 'phone') {
    return (
      <AuthLayout title="Forgot password?" subtitle="Enter your registered phone number and we'll send an OTP.">
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <Input
            label="Phone number"
            type="tel"
            placeholder="9876543210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            error={fieldErrors.phone}
            prefix={<Phone className="w-4 h-4" />}
            maxLength={10}
            inputMode="numeric"
          />

          {error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Send OTP
          </Button>

          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            <ArrowLeft size={14} /> Back to Login
          </button>
        </form>
      </AuthLayout>
    )
  }

  // ── Step 2: OTP + new password ───────────────────────────────────────────────
  return (
    <AuthLayout title="Set new password" subtitle={`Enter the OTP sent to +91 ${phone}`}>
      <form onSubmit={handleReset} className="flex flex-col gap-4">

        {devOtp && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Dev OTP: <strong>{devOtp}</strong>
          </div>
        )}

        <Input
          label="OTP"
          type="text"
          placeholder="6-digit OTP"
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          error={fieldErrors.otp}
          prefix={<ShieldCheck className="w-4 h-4" />}
          maxLength={6}
          inputMode="numeric"
        />

        <Input
          label="New password"
          type="password"
          placeholder="Min 8 chars, uppercase, number, symbol"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          error={fieldErrors.newPassword}
          prefix={<Lock className="w-4 h-4" />}
        />

        <Input
          label="Confirm new password"
          type="password"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          prefix={<Lock className="w-4 h-4" />}
        />

        {error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Reset Password
        </Button>

        <button
          type="button"
          onClick={() => { setStep('phone'); setError(null); setFieldErrors({}) }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          <ArrowLeft size={14} /> Change phone number
        </button>
      </form>
    </AuthLayout>
  )
}
