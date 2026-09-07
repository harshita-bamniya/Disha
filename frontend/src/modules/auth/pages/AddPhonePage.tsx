import { useState } from 'react'
import { Phone } from 'lucide-react'
import AuthLayout from '@/layouts/AuthLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAddPhone } from '../hooks/useAuth'
import { getApiError } from '@/api/client'

export default function AddPhonePage() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const addPhone = useAddPhone()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''))) {
      setError('Enter a valid 10-digit Indian mobile number')
      return
    }
    setError('')
    addPhone.mutate({ phone })
  }

  const serverError = addPhone.error ? getApiError(addPhone.error) : null

  return (
    <AuthLayout title="Add your phone number" subtitle="One last step before you get started" variant="register" panelSide="right">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => {
            const v = e.target.value
            if (v.replace(/\D/g, '').length > 10) return
            setPhone(v)
            if (error) setError('')
          }}
          error={error}
          prefix={<Phone className="w-4 h-4" />}
          maxLength={10}
          inputMode="numeric"
        />

        <p className="text-xs" style={{ color: '#94A3B8' }}>
          We use this to reach you about applications and interviews — you won't need to verify it right now.
        </p>

        {serverError && (
          <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">{serverError}</p>
        )}

        <Button
          type="submit" fullWidth size="lg"
          loading={addPhone.isPending}
          disabled={phone.replace(/\D/g, '').length !== 10}
          className="mt-1"
        >
          Continue
        </Button>
      </form>
    </AuthLayout>
  )
}
