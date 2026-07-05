import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { authApi } from '@/api/auth'
import { getApiError } from '@/api/client'

export default function ChangePasswordCard() {
  const [current, setCurrent]       = useState('')
  const [next, setNext]             = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext]     = useState(false)
  const [success, setSuccess]       = useState(false)
  const [localError, setLocalError] = useState('')

  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSuccess(false), 4000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (next !== confirm) {
      setLocalError('New passwords do not match.')
      return
    }
    mutation.mutate({ current_password: current, new_password: next })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 9, fontSize: 14,
    border: '1.5px solid #E2E8F0', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: '#111827', background: 'white',
  }

  return (
    <div style={{
      background: 'white', border: '1px solid #E5E9F2', borderRadius: 16,
      padding: '24px 24px', marginTop: 20,
      boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: '#EEF2FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={16} color="#6366F1" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Change Password</p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Update your account password</p>
        </div>
      </div>

      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4',
          border: '1px solid #BBF7D0', borderRadius: 9, padding: '10px 14px', marginBottom: 16,
          color: '#15803D', fontSize: 13, fontWeight: 600,
        }}>
          <CheckCircle2 size={15} />
          Password changed successfully.
        </div>
      )}

      {(localError || mutation.isError) && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9,
          padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13,
        }}>
          {localError || getApiError(mutation.error)}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
            Current password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              style={inputStyle}
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}
            >
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
            New password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={e => setNext(e.target.value)}
              required
              style={inputStyle}
              placeholder="At least 8 chars, uppercase, number, symbol"
            />
            <button
              type="button"
              onClick={() => setShowNext(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}
            >
              {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={inputStyle}
            placeholder="Re-enter new password"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          style={{
            padding: '10px 20px', borderRadius: 9, border: 'none',
            background: mutation.isPending ? '#A5B4FC' : '#6366F1',
            color: 'white', fontSize: 13.5, fontWeight: 700,
            cursor: mutation.isPending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start', transition: 'background 0.2s',
          }}
        >
          {mutation.isPending ? 'Saving…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
