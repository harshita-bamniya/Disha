import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, RotateCcw } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import OtpInput from '@/components/ui/OtpInput'
import { useVerifyPhone, useSendOtp } from '../hooks/useAuth'
import { getApiError } from '@/api/client'

const RESEND_COOLDOWN = 30

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)

  const navigate = useNavigate()
  const phone = sessionStorage.getItem('pending_phone') ?? ''
  const devOtp = sessionStorage.getItem('dev_otp')

  const verifyPhone = useVerifyPhone()
  const sendOtp = useSendOtp()

  // Redirect if no pending phone
  useEffect(() => {
    if (!phone) navigate('/auth/register')
  }, [phone, navigate])

  // Resend countdown
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6) return
    verifyPhone.mutate({ phone, otp })
  }

  const handleResend = () => {
    sendOtp.mutate({ phone, purpose: 'register' }, {
      onSuccess: (data) => {
        if (data.dev_otp) sessionStorage.setItem('dev_otp', data.dev_otp)
        setOtp('')
        setCountdown(RESEND_COOLDOWN)
      },
    })
  }

  const serverError = verifyPhone.error ? getApiError(verifyPhone.error, 'Verification failed') : null

  const maskedPhone = phone ? `${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}` : '**********'

  return (
    <AuthLayout
      title="Verify your phone"
      subtitle={`Enter the 6-digit OTP sent to +91 ${maskedPhone}`}
    >
      <form onSubmit={handleVerify} className="flex flex-col gap-6">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>

        {/* Dev OTP hint */}
        {devOtp && (
          <div className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <span className="font-semibold">Dev mode OTP:</span>{' '}
            <span
              className="font-mono font-bold cursor-pointer underline"
              onClick={() => setOtp(devOtp)}
            >
              {devOtp}
            </span>
            {' '}(click to fill)
          </div>
        )}

        <OtpInput
          value={otp}
          onChange={setOtp}
          length={6}
          error={serverError ?? undefined}
          disabled={verifyPhone.isPending}
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={verifyPhone.isPending}
          disabled={otp.length < 6}
        >
          Verify OTP
        </Button>

        <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
          <RotateCcw className="w-3.5 h-3.5" />
          {countdown > 0 ? (
            <span>Resend OTP in {countdown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={sendOtp.isPending}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              Resend OTP
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
