import { useEffect } from 'react'
import { create } from 'zustand'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { colors } from '@/design-system/tokens'

type ToastVariant = 'success' | 'warning' | 'danger' | 'info'

interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration?: number
}

interface ToastStore {
  toasts: ToastItem[]
  add: (toast: Omit<ToastItem, 'id'>) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Convenience helpers — call these anywhere without needing a component
export const toast = {
  success: (message: string, duration = 4000) => useToastStore.getState().add({ variant: 'success', message, duration }),
  warning: (message: string, duration = 4000) => useToastStore.getState().add({ variant: 'warning', message, duration }),
  danger:  (message: string, duration = 5000) => useToastStore.getState().add({ variant: 'danger',  message, duration }),
  info:    (message: string, duration = 4000) => useToastStore.getState().add({ variant: 'info',    message, duration }),
}

const cfg: Record<ToastVariant, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  success: { bg: colors.state.successBg, border: '#BBF7D0', text: '#14532D', icon: <CheckCircle2 size={16} color={colors.state.success} /> },
  warning: { bg: colors.state.warningBg, border: '#FDE68A', text: '#92400E', icon: <AlertTriangle  size={16} color={colors.state.warning} /> },
  danger:  { bg: colors.state.dangerBg,  border: '#FECACA', text: '#991B1B', icon: <XCircle        size={16} color={colors.state.danger}  /> },
  info:    { bg: colors.state.infoBg,    border: '#BFDBFE', text: '#1E40AF', icon: <Info            size={16} color={colors.state.info}    /> },
}

function ToastCard({ toast: t }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove)
  const c = cfg[t.variant]

  useEffect(() => {
    const timer = setTimeout(() => remove(t.id), t.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [t.id, t.duration, remove])

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        minWidth: 280,
        maxWidth: 420,
        animation: 'toast-in 0.2s ease',
      }}
    >
      <span style={{ flexShrink: 0 }}>{c.icon}</span>
      <p style={{ flex: 1, fontSize: 13, color: c.text, margin: 0, lineHeight: 1.5 }}>{t.message}</p>
      <button
        onClick={() => remove(t.id)}
        aria-label="Dismiss"
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: c.text, opacity: 0.5, padding: 2, display: 'flex' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastCard toast={t} />
          </div>
        ))}
      </div>
    </>
  )
}
