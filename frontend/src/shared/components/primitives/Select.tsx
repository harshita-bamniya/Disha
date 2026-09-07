import { forwardRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  /** 'underline' matches Input.tsx aesthetic; 'box' for filter panels */
  variant?: 'underline' | 'box'
  size?: 'sm' | 'md' | 'lg'
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      required,
      variant = 'underline',
      size = 'md',
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const [focused, setFocused] = useState(false)

    const heights = { sm: 34, md: 44, lg: 52 }
    const h = heights[size]

    const boxStyle: React.CSSProperties =
      variant === 'box'
        ? {
            border: error
              ? `1px solid ${colors.state.danger}`
              : focused
                ? `1px solid ${colors.brand.navy}`
                : `1px solid ${colors.border.medium}`,
            borderRadius: 10,
            background: colors.surface.card,
            padding: '0 32px 0 12px',
            transition: 'border-color 0.15s',
          }
        : {
            borderBottom: error
              ? `1.5px solid ${colors.state.danger}`
              : focused
                ? `1.5px solid ${colors.brand.navy}`
                : `1.5px solid #E2E8F0`,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderRadius: 0,
            background: 'transparent',
            padding: '0 28px 0 0',
            transition: 'border-color 0.15s',
          }

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

        <div className="relative flex items-center">
          <select
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
              height: h,
              width: '100%',
              appearance: 'none',
              WebkitAppearance: 'none',
              outline: 'none',
              fontSize: 14,
              color: props.value === '' || props.value === undefined ? colors.text.muted : colors.text.ink,
              cursor: 'pointer',
              ...boxStyle,
            }}
            className={cn('w-full', className)}
            {...props}
          >
            {placeholder !== undefined && (
              <option value="">{placeholder}</option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2"
            style={{ color: focused ? colors.brand.navy : colors.text.muted }}
          />
        </div>

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

Select.displayName = 'Select'
export default Select
