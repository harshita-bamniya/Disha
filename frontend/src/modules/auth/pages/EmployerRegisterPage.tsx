import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Phone, Lock, User, Globe, MapPin } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useRegisterEmployer } from '../hooks/useAuth'
import { getApiError } from '@/api/client'
import type { CompanySize } from '@/types'

const INDUSTRIES = [
  'Banking & Finance', 'Consulting', 'Education', 'Government & PSU',
  'Healthcare', 'IT & Technology', 'Legal', 'Manufacturing',
  'Media & Communication', 'NGO & Social Sector', 'Real Estate',
  'Research & Analytics', 'Retail', 'Other',
]

const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1–10 employees' },
  { value: '11-50', label: '11–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '201-500', label: '201–500 employees' },
  { value: '501-1000', label: '501–1000 employees' },
  { value: '1000+', label: '1000+ employees' },
]

const PASSWORD_RULES = [
  { key: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'num', label: 'One number', test: (p: string) => /\d/.test(p) },
  { key: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

export default function EmployerRegisterPage() {
  const [form, setForm] = useState({
    phone: '',
    password: '',
    company_name: '',
    industry: '',
    company_size: '' as CompanySize | '',
    contact_person: '',
    designation: '',
    city: '',
    website: '',
    gst_number: '',
    description: '',
  })
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

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!form.phone.trim()) errors.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) errors.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!allRulesPass) errors.password = 'Password does not meet all requirements'
    if (!form.company_name.trim()) errors.company_name = 'Company name is required'
    if (!form.industry) errors.industry = 'Please select an industry'
    if (!form.company_size) errors.company_size = 'Please select company size'
    if (!form.contact_person.trim()) errors.contact_person = 'Contact person name is required'
    if (!form.city.trim()) errors.city = 'City is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    registerEmployer.mutate({
      phone: form.phone,
      password: form.password,
      company_name: form.company_name,
      industry: form.industry,
      company_size: form.company_size as CompanySize,
      contact_person: form.contact_person,
      city: form.city,
      designation: form.designation || undefined,
      website: form.website || undefined,
      gst_number: form.gst_number || undefined,
      description: form.description || undefined,
    })
  }

  const serverError = registerEmployer.error ? getApiError(registerEmployer.error, 'Registration failed. Please try again.') : null

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-start px-4 py-12">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-lg">D</span>
        </div>
        <span className="text-xl font-bold text-primary" style={{ fontFamily: 'Hind, sans-serif' }}>
          DISHA AI
        </span>
      </Link>

      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-accent" />
            </div>
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">For Employers</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Hind, sans-serif' }}>
            Register your company
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Access a verified pool of UPSC-background talent. Your account will be reviewed by our team before activation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Section: Company details */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Company details</p>
            <div className="flex flex-col gap-4">
              <Input
                label="Company name"
                placeholder="Acme Corp Pvt Ltd"
                value={form.company_name}
                onChange={set('company_name')}
                error={fieldErrors.company_name}
                prefix={<Building2 className="w-4 h-4" />}
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Industry</label>
                <select
                  value={form.industry}
                  onChange={set('industry')}
                  className={cn(
                    'w-full h-11 rounded-xl border bg-white px-4 text-sm text-gray-900',
                    'outline-none transition-all duration-150',
                    'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10',
                    fieldErrors.industry && 'border-danger focus:border-danger focus:ring-danger/10',
                  )}
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
                {fieldErrors.industry && <p className="text-xs text-danger mt-0.5">{fieldErrors.industry}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Company size</label>
                <div className="grid grid-cols-3 gap-2">
                  {COMPANY_SIZES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setForm((p) => ({ ...p, company_size: value })); setFieldErrors((p) => ({ ...p, company_size: '' })) }}
                      className={cn(
                        'h-10 rounded-xl border text-xs font-medium transition-all duration-150',
                        form.company_size === value
                          ? 'bg-accent text-white border-accent'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-accent/50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {fieldErrors.company_size && <p className="text-xs text-danger mt-0.5">{fieldErrors.company_size}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Website (optional)"
                  placeholder="https://acme.com"
                  value={form.website}
                  onChange={set('website')}
                  prefix={<Globe className="w-4 h-4" />}
                  type="url"
                />
                <Input
                  label="GST number (optional)"
                  placeholder="22AAAAA0000A1Z5"
                  value={form.gst_number}
                  onChange={set('gst_number')}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">About company (optional)</label>
                <textarea
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Brief description of your company and what kind of talent you're looking for..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Contact details */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact person</p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Full name"
                  placeholder="Rajiv Sharma"
                  value={form.contact_person}
                  onChange={set('contact_person')}
                  error={fieldErrors.contact_person}
                  prefix={<User className="w-4 h-4" />}
                />
                <Input
                  label="Designation (optional)"
                  placeholder="HR Manager"
                  value={form.designation}
                  onChange={set('designation')}
                />
              </div>
              <Input
                label="City"
                placeholder="New Delhi"
                value={form.city}
                onChange={set('city')}
                error={fieldErrors.city}
                prefix={<MapPin className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Section: Login credentials */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Login credentials</p>
            <div className="flex flex-col gap-4">
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
                      {passRules.map((r, i) => (
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
            </div>
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
            Register company
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
        Employer accounts are reviewed within 24–48 hours. We'll notify you via SMS once approved.
      </p>
    </div>
  )
}
