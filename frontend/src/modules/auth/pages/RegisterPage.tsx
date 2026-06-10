import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Lock, Globe, Check, X } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useRegister } from '../hooks/useAuth'
import { getApiError } from '@/api/client'

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

export default function RegisterPage() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [language, setLanguage] = useState<'hi' | 'en'>('hi')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const register = useRegister()

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(password)).length

  const validate = () => {
    const errors: Record<string, string> = {}
    const cleaned = phone.replace(/\D/g, '')
    if (!cleaned || !/^[6-9]\d{9}$/.test(cleaned)) {
      errors.phone = 'Enter a valid 10-digit Indian mobile number'
    }
    const failedRules = PASSWORD_RULES.filter((r) => !r.test(password))
    if (failedRules.length > 0) {
      errors.password = 'Password does not meet all requirements'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    register.mutate({ phone, password, preferred_language: language })
  }

  const serverError = register.error ? getApiError(register.error) : null

  const strengthColor = [
    '',
    'bg-danger',
    'bg-orange-400',
    'bg-yellow-400',
    'bg-lime-400',
    'bg-primary',
  ][passwordStrength]

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your career relaunch journey today"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Language selector */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {(['hi', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                language === lang
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'हिन्दी' : 'English'}
            </button>
          ))}
        </div>

        {/* Phone */}
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

        {/* Password */}
        <div className="flex flex-col gap-1">
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setShowRules(true)
            }}
            error={fieldErrors.password}
            prefix={<Lock className="w-4 h-4" />}
            maxLength={128}
          />

          {/* Strength bar */}
          {password.length > 0 && (
            <div className="flex gap-1 mt-1">
              {PASSWORD_RULES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-300',
                    i < passwordStrength ? strengthColor : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
          )}

          {/* Rules checklist */}
          {showRules && password.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(password)
                return (
                  <li key={rule.label} className={cn(
                    'flex items-center gap-1.5 text-xs',
                    passed ? 'text-primary' : 'text-gray-400'
                  )}>
                    {passed
                      ? <Check className="w-3 h-3 shrink-0" />
                      : <X className="w-3 h-3 shrink-0" />
                    }
                    {rule.label}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={register.isPending}
          disabled={passwordStrength < PASSWORD_RULES.length}
          className="mt-1"
        >
          Create account
        </Button>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
