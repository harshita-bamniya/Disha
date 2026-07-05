import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found in the link.')
      return
    }
    apiClient.get<{ message: string }>(`/auth/verify-email?token=${token}`)
      .then(r => {
        setStatus('success')
        setMessage(r.data.message)
      })
      .catch(err => {
        setStatus('error')
        setMessage(err?.response?.data?.detail ?? 'Verification failed. The link may have expired.')
      })
  }, [token])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAFBFD', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '40px 36px', maxWidth: 440, width: '100%',
        boxShadow: '0 8px 32px rgba(15,23,42,0.08)', border: '1px solid #E5E9F2', textAlign: 'center',
      }}>
        {status === 'loading' && (
          <>
            <Loader2 size={40} color="#6366F1" style={{ animation: 'spin 0.8s linear infinite', marginBottom: 20 }} />
            <p style={{ fontSize: 15, color: '#374151', fontWeight: 600 }}>Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={48} color="#10B981" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Email Verified!</h2>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>{message}</p>
            <button
              onClick={() => navigate('/app/dashboard')}
              style={{
                padding: '11px 28px', borderRadius: 10, border: 'none',
                background: '#6366F1', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >Go to Dashboard</button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} color="#EF4444" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Verification Failed</h2>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>{message}</p>
            <button
              onClick={() => navigate('/app/dashboard')}
              style={{
                padding: '11px 28px', borderRadius: 10, border: 'none',
                background: '#F3F4F6', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >Back to Dashboard</button>
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
