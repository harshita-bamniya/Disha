import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Phone, Lock, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLogin } from '../hooks/useAuth'
import { getApiError } from '@/api/client'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const login = useLogin()
  const location = useLocation()
  const justVerified = (location.state as { verified?: boolean } | null)?.verified === true

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!phone.trim()) errors.phone = 'Phone number is required'
    if (!password.trim()) errors.password = 'Password is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    login.mutate({ phone, password })
  }

  const serverError = login.error ? getApiError(login.error, 'Incorrect phone number or password') : null

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your career journey"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {justVerified && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Phone verified successfully! You can now log in.
          </div>
        )}

        <Input
          label="Phone number"
          type="tel"
          placeholder="9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fieldErrors.phone}
          prefix={<Phone className="w-4 h-4" />}
          maxLength={10}
          inputMode="numeric"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          prefix={<Lock className="w-4 h-4" />}
        />

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

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-primary font-medium hover:underline">
              Create account
            </Link>
          </span>
          <Link to="/auth/forgot-password" className="text-primary font-medium hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
