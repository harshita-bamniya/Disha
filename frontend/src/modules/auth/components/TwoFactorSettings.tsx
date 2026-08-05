import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldOff, Copy, Check, AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import { authApi } from '@/api/auth'
import { getApiError } from '@/api/client'

const STATUS_KEY = ['auth', '2fa-status']

export default function TwoFactorSettings() {
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEY, queryFn: authApi.get2faStatus })

  const [stage, setStage] = useState<'idle' | 'setup' | 'backup-codes'>('idle')
  const [setupData, setSetupData] = useState<{ secret: string; qr_code_data_uri: string } | null>(null)
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisableForm, setShowDisableForm] = useState(false)

  const startSetup = useMutation({
    mutationFn: authApi.setup2fa,
    onSuccess: (data) => { setSetupData(data); setStage('setup') },
  })

  const enable = useMutation({
    mutationFn: () => authApi.enable2fa(code),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes)
      setStage('backup-codes')
      qc.invalidateQueries({ queryKey: STATUS_KEY })
    },
  })

  const disable = useMutation({
    mutationFn: () => authApi.disable2fa(disablePassword),
    onSuccess: () => {
      setShowDisableForm(false)
      setDisablePassword('')
      qc.invalidateQueries({ queryKey: STATUS_KEY })
    },
  })

  const finishSetup = () => {
    setStage('idle')
    setSetupData(null)
    setCode('')
    setBackupCodes([])
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg flex flex-col gap-3">
      <Skeleton width={160} height={20} />
      <Skeleton width="80%" height={14} />
      <Skeleton width={120} height={36} rounded={10} />
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${status?.is_enabled ? 'bg-primary/10' : 'bg-gray-100'}`}>
          {status?.is_enabled ? <ShieldCheck className="w-4.5 h-4.5 text-primary" /> : <ShieldOff className="w-4.5 h-4.5 text-gray-400" />}
        </div>
        <div>
          <p className="font-semibold text-gray-900">Two-factor authentication</p>
          <p className="text-sm text-gray-500">{status?.is_enabled ? 'Enabled' : 'Not enabled'}</p>
        </div>
      </div>

      {stage === 'idle' && !status?.is_enabled && (
        <>
          <p className="text-sm text-gray-500 mt-4 mb-4">
            Add an extra layer of security — after entering your password, you'll also need a code from
            an authenticator app (Google Authenticator, Authy, 1Password, etc.) to log in.
          </p>
          <Button onClick={() => startSetup.mutate()} loading={startSetup.isPending}>
            Enable two-factor authentication
          </Button>
        </>
      )}

      {stage === 'idle' && status?.is_enabled && (
        <div className="mt-4">
          {!showDisableForm ? (
            <Button variant="danger" onClick={() => setShowDisableForm(true)}>
              Disable two-factor authentication
            </Button>
          ) : (
            <div className="flex flex-col gap-3 bg-danger/5 border border-danger/20 rounded-xl p-4">
              <p className="text-sm text-gray-700">Confirm your password to disable 2FA.</p>
              <Input
                type="password"
                placeholder="Your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
              {disable.error && (
                <p className="text-xs text-danger">{getApiError(disable.error, 'Incorrect password.')}</p>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowDisableForm(false)}>Cancel</Button>
                <Button variant="danger" loading={disable.isPending} onClick={() => disable.mutate()}>
                  Confirm disable
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'setup' && setupData && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Scan this QR code with your authenticator app, then enter the 6-digit code it generates.
          </p>
          <img src={setupData.qr_code_data_uri} alt="2FA QR code" className="w-44 h-44 mx-auto border border-gray-100 rounded-xl" />
          <p className="text-xs text-gray-400 text-center">
            Can't scan? Enter this code manually: <code className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">{setupData.secret}</code>
          </p>
          <Input
            label="6-digit code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            autoFocus
          />
          {enable.error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
              {getApiError(enable.error, 'Invalid code. Please try again.')}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={finishSetup}>Cancel</Button>
            <Button loading={enable.isPending} disabled={code.length !== 6} onClick={() => enable.mutate()}>
              Verify and enable
            </Button>
          </div>
        </div>
      )}

      {stage === 'backup-codes' && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Save these backup codes somewhere safe — each one can be used once to log in if you lose
              access to your authenticator app. They won't be shown again.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-4 font-mono text-sm text-gray-700">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <Button variant="outline" onClick={copyBackupCodes}>
            {copied ? <><Check className="w-4 h-4 mr-1.5" />Copied</> : <><Copy className="w-4 h-4 mr-1.5" />Copy codes</>}
          </Button>
          <Button onClick={finishSetup}>Done</Button>
        </div>
      )}
    </div>
  )
}
