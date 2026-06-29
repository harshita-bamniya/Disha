import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useVerifyLogin2fa } from '../hooks/useAuth'
import { getApiError } from '@/api/client'

export default function TwoFactorChallengePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { challengeToken?: string; rememberMe?: boolean } | null

  const [code, setCode] = useState('')
  const verify = useVerifyLogin2fa()

  // No challenge token — this page was reached directly (e.g. URL pasted/refreshed),
  // not via a real login attempt. Send back to login instead of erroring.
  if (!state?.challengeToken) {
    navigate('/auth/login', { replace: true })
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verify.mutate({ challenge_token: state.challengeToken!, code, rememberMe: state.rememberMe })
  }

  const serverError = verify.error ? getApiError(verify.error, 'Invalid code. Please try again.') : null

  return (
    <AuthLayout
      title="Two-factor verification"
      subtitle="Enter the 6-digit code from your authenticator app, or one of your backup codes."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Authentication code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          prefix={<ShieldCheck className="w-4 h-4" />}
          maxLength={9}
          autoFocus
        />

        {serverError && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" loading={verify.isPending} disabled={code.length < 6}>
          Verify and continue
        </Button>

        <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 justify-center">
          <ArrowLeft className="w-3.5 h-3.5" />Back to login
        </Link>
      </form>
    </AuthLayout>
  )
}
