import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { colors } from '@/design-system/tokens'

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode
  description?: string
  size?: 'sm' | 'md'
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, size = 'md', className, id, ...props }, ref) => {
    const trackW = size === 'sm' ? 28 : 36
    const trackH = size === 'sm' ? 16 : 20
    const thumbSize = trackH - 4
    const thumbOffset = props.checked ? trackW - thumbSize - 2 : 2
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        <div className="relative shrink-0">
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            aria-checked={props.checked}
            id={inputId}
            className="sr-only"
            {...props}
          />
          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              width: trackW,
              height: trackH,
              borderRadius: trackH,
              background: props.checked ? colors.brand.navy : '#CBD5E1',
              cursor: props.disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              opacity: props.disabled ? 0.5 : 1,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: thumbOffset,
                width: thumbSize,
                height: thumbSize,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
              }}
            />
          </label>
        </div>

        {(label || description) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label
                htmlFor={inputId}
                style={{
                  fontSize: 13,
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
      </div>
    )
  },
)

Switch.displayName = 'Switch'
export default Switch
