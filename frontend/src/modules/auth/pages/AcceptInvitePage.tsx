import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Lock, User as UserIcon, Building2, MailX } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordStrengthMeter from '@/shared/components/forms/PasswordStrengthMeter'
import { PASSWORD_RULES } from '@/shared/components/forms/passwordRules'
import { useAcceptInvite, useInviteInfo } from '../hooks/useAuth'
import { getApiError } from '@/api/client'

const ROLE_LABELS: Record<string, string> = {
  hr_manager: 'HR Manager', hiring_manager: 'Hiring Manager', recruiter: 'Recruiter', interviewer: 'Interviewer',
}

/** Where an emailed team invitation lands. Nothing exists yet: the invitee confirms who they are and
 * chooses their own password, and only then is the account created and signed in. */
export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { data: info, isLoading, error } = useInviteInfo(token)
  const accept = useAcceptInvite()

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [nameError, setNameError] = useState('')

  const passwordOk = !PASSWORD_RULES.some(r => !r.test(password))
  const ready = passwordOk && acceptedTerms && fullName.trim().length > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setNameError('Enter your name'); return }
    if (!ready || !token) return
    accept.mutate({ token, full_name: fullName.trim(), password })
  }

  const unusable = !token || !!error || (info && info.status !== 'pending')
  const problem = !token
    ? 'This invitation link is incomplete. Open the link from your invitation email.'
    : error
      ? getApiError(error, 'This invitation link is not valid.')
      : info?.status === 'expired'
        ? 'This invitation has expired. Ask your admin to send you a new one.'
        : info && info.status !== 'pending'
          ? 'This invitation can no longer be used.'
          : ''

  return (
    <AuthLayout title="Join your team" subtitle="Set up your BeginablAI account to get started" variant="default" panelSide="right">
      {isLoading ? (
        <p style={{ fontSize: 14, color: '#64748B' }}>Checking your invitation…</p>
      ) : unusable ? (
        <div className="flex flex-col gap-4">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <MailX className="w-5 h-5" style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 14, color: '#991B1B', margin: 0, lineHeight: 1.5 }}>{problem}</p>
          </div>
          <p className="text-center text-sm" style={{ color: '#475569' }}>
            Already have an account?{' '}
            <Link to="/auth/login" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      ) : info ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 12, background: '#F4F5F7', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1A2744', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 className="w-4 h-4" style={{ color: '#fff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E3A5F' }}>{info.company_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#475569' }}>
                {ROLE_LABELS[info.role_name] ?? info.role_name}
                {info.department_name ? ` · ${info.department_name}` : ''}
                {info.invited_by_name ? ` · invited by ${info.invited_by_name}` : ''}
              </p>
            </div>
          </div>

          <Input label="Email address" type="email" value={info.email} readOnly disabled />

          <Input
            label="Your full name"
            placeholder="e.g. Priya Sharma"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setNameError('') }}
            error={nameError}
            prefix={<UserIcon className="w-4 h-4" />}
            maxLength={150}
            autoFocus
          />

          <div className="flex flex-col gap-1">
            <Input
              label="Choose a password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefix={<Lock className="w-4 h-4" />}
              maxLength={128}
            />
            <PasswordStrengthMeter password={password} />
          </div>

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

          {accept.error && (
            <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">{getApiError(accept.error)}</p>
          )}

          <Button type="submit" fullWidth size="lg" loading={accept.isPending} disabled={!ready}>
            Create my account
          </Button>

          <p className="text-center text-sm" style={{ color: '#475569' }}>
            Already have an account?{' '}
            <Link to="/auth/login" style={{ color: '#1A2744', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </form>
      ) : null}
    </AuthLayout>
  )
}
