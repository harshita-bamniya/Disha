import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authApi } from '@/api/auth'
import { getApiError } from '@/api/client'

const STATUS_KEY = ['auth', '2fa-status']

interface Props {
  /** true when rendered inside another section that already provides the
   * card chrome (border/shadow/header) — mirrors ChangePasswordCard's own
   * `embedded` prop — so this doesn't nest a card inside a card. */
  embedded?: boolean
}

// Setting up new two-factor authentication is turned off as a feature for
// now — no entry point to enable it. This only renders anything for an
// account that already has it enabled from before, so they still have a way
// to turn it back off instead of being stuck with it permanently.
export default function TwoFactorSettings({ embedded = false }: Props) {
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEY, queryFn: authApi.get2faStatus })

  const [disablePassword, setDisablePassword] = useState('')
  const [showDisableForm, setShowDisableForm] = useState(false)

  const disable = useMutation({
    mutationFn: () => authApi.disable2fa(disablePassword),
    onSuccess: () => {
      setShowDisableForm(false)
      setDisablePassword('')
      qc.invalidateQueries({ queryKey: STATUS_KEY })
    },
  })

  if (isLoading || !status?.is_enabled) return null

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Two-factor authentication</p>
            <p className="text-sm text-gray-500">Enabled</p>
          </div>
        </div>
      )}

      <div className={embedded ? '' : 'mt-4'}>
        {embedded && <p className="text-sm text-gray-500 mb-3">Two-factor authentication is enabled.</p>}
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
    </>
  )

  if (embedded) return content

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
      {content}
    </div>
  )
}
