import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, id, ...props }, ref) => {
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const [focused, setFocused] = useState(false)

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: focused ? colors.brand.navy : colors.text.muted,
              transition: 'color 0.15s',
            }}
          >
            {label}
            {required && <span style={{ color: colors.state.danger, marginLeft: 2 }}>*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          onFocus={e => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={e => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          style={{
            border: error
              ? `1px solid ${colors.state.danger}`
              : focused
                ? `1px solid ${colors.brand.navy}`
                : `1px solid #E2E8F0`,
            borderRadius: 10,
            background: colors.surface.card,
            padding: '10px 12px',
            fontSize: 14,
            color: colors.text.ink,
            outline: 'none',
            resize: 'vertical',
            minHeight: 96,
            width: '100%',
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
          className={cn(className)}
          {...props}
        />

        {error && (
          <span style={{ fontSize: 11, color: colors.state.danger }}>{error}</span>
        )}
        {hint && !error && (
          <span style={{ fontSize: 11, color: colors.text.muted }}>{hint}</span>
        )}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
export default Textarea
