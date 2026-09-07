import { forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode
  description?: string
  error?: string
  size?: 'sm' | 'md'
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, size = 'md', className, id, ...props }, ref) => {
    const boxSize = size === 'sm' ? 14 : 18
    const checkSize = size === 'sm' ? 9 : 11
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        <div className="relative shrink-0" style={{ width: boxSize, height: boxSize, marginTop: 2 }}>
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className="sr-only"
            {...props}
          />
          <label
            htmlFor={inputId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: boxSize,
              height: boxSize,
              borderRadius: size === 'sm' ? 3 : 4,
              border: props.checked
                ? `1.5px solid ${colors.brand.navy}`
                : error
                  ? `1.5px solid ${colors.state.danger}`
                  : `1.5px solid #CBD5E1`,
              background: props.checked ? colors.brand.navy : colors.surface.card,
              cursor: props.disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: props.disabled ? 0.5 : 1,
            }}
          >
            {props.checked && <Check size={checkSize} color="#fff" strokeWidth={3} />}
          </label>
        </div>

        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label
                htmlFor={inputId}
                style={{
                  fontSize: size === 'sm' ? 12 : 13,
                  fontWeight: 500,
                  color: props.disabled ? colors.text.muted : colors.text.ink,
                  cursor: props.disabled ? 'not-allowed' : 'pointer',
                  lineHeight: 1.4,
                }}
              >
                {label}
              </label>
            )}
            {description && (
              <span style={{ fontSize: 11, color: colors.text.muted, lineHeight: 1.4 }}>
                {description}
              </span>
            )}
          </div>
        )}

        {error && (
          <span style={{ fontSize: 11, color: colors.state.danger }}>{error}</span>
        )}
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
export default Checkbox
