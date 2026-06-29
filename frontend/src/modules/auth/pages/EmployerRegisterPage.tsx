import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Phone, Lock, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useRegisterEmployer } from '../hooks/useAuth'
import { getApiError } from '@/api/client'
import { getRecaptchaToken } from '@/lib/recaptcha'

const PASSWORD_RULES = [
  { key: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'num', label: 'One number', test: (p: string) => /\d/.test(p) },
  { key: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

export default function EmployerRegisterPage() {
  const [form, setForm] = useState({ phone: '', password: '', company_name: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showPasswordHints, setShowPasswordHints] = useState(false)

  const registerEmployer = useRegisterEmployer()

  const passRules = PASSWORD_RULES.map((r) => ({ ...r, pass: r.test(form.password) }))
  const allRulesPass = passRules.every((r) => r.pass)
  const passedCount = passRules.filter((r) => r.pass).length
  const strengthColor =
    passedCount <= 1 ? 'bg-danger' :
    passedCount <= 3 ? 'bg-secondary' :
    'bg-primary'

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.phone.trim()) errors.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) errors.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!allRulesPass) errors.password = 'Password does not meet all requirements'
    if (!form.company_name.trim()) errors.company_name = 'Company name is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const recaptcha_token = await getRecaptchaToken('employer_register')
    registerEmployer.mutate({
      phone: form.phone,
      password: form.password,
      company_name: form.company_name,
      recaptcha_token,
    })
  }

  const serverError = registerEmployer.error ? getApiError(registerEmployer.error, 'Registration failed. Please try again.') : null

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-start px-4 py-12">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <span className="text-xl font-bold text-primary" style={{ fontFamily: 'Hind, sans-serif' }}>
          BeginablAI
        </span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft className="w-3.5 h-3.5" />Back to home
        </Link>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-accent" />
            </div>
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">For Employers</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>
            Create your company account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Just the basics for now — you'll add company details, branding, and verification after you log in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Company name"
            placeholder="Acme Corp Pvt Ltd"
            value={form.company_name}
            onChange={set('company_name')}
            error={fieldErrors.company_name}
            prefix={<Building2 className="w-4 h-4" />}
          />

          <Input
            label="Phone number"
            type="tel"
            placeholder="9876543210"
            value={form.phone}
            onChange={set('phone')}
            error={fieldErrors.phone}
            prefix={<Phone className="w-4 h-4" />}
            maxLength={10}
            inputMode="numeric"
          />

          <div className="flex flex-col gap-1">
            <Input
              label="Password"
              type="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={set('password')}
              error={fieldErrors.password}
              prefix={<Lock className="w-4 h-4" />}
              maxLength={128}
              onFocus={() => setShowPasswordHints(true)}
            />

            {(showPasswordHints || form.password.length > 0) && (
              <div className="mt-1 space-y-2">
                <div className="flex gap-1">
                  {passRules.map((r) => (
                    <div
                      key={r.key}
                      className={cn('h-1 flex-1 rounded-full transition-all duration-300', r.pass ? strengthColor : 'bg-gray-200')}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {passRules.map((r) => (
                    <li key={r.key} className={cn('text-xs flex items-center gap-1', r.pass ? 'text-primary' : 'text-gray-400')}>
                      <span>{r.pass ? '✓' : '○'}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={registerEmployer.isPending}
            disabled={!allRulesPass && form.password.length > 0}
            className="mt-1"
          >
            Create account
          </Button>

          <p className="text-center text-xs text-gray-500">
            Already registered?{' '}
            <Link to="/auth/login" className="text-primary font-medium hover:underline">
              Log in
            </Link>
            {' · '}
            <Link to="/auth/register" className="text-primary font-medium hover:underline">
              Aspirant registration
            </Link>
          </p>
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center max-w-xs">
        You can log in right after verifying your phone — complete your profile and verification
        afterward to start posting jobs.
      </p>
    </div>
  )
}
