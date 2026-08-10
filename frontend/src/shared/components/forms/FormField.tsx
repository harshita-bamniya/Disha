import type { ReactNode } from 'react'
import { colors } from '@/design-system/tokens'

interface FormFieldProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  id?: string
}

export default function FormField({ label, error, hint, required, children, id }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: colors.text.muted }}
        >
          {label}
          {required && <span style={{ color: colors.state.danger, marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <p style={{ fontSize: 11, color: colors.state.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ fontSize: 11, color: colors.text.muted }}>{hint}</p>
      )}
    </div>
  )
}
