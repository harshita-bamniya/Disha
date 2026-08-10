import { memo } from 'react'
import { colors } from '@/design-system/tokens'

interface RadioOption {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
}

interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  layout?: 'vertical' | 'horizontal'
}

const RadioGroup = memo(function RadioGroup({
  name,
  options,
  value,
  onChange,
  label,
  error,
  layout = 'vertical',
}: RadioGroupProps) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      {label && (
        <legend style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: colors.text.muted,
          marginBottom: 10,
        }}>
          {label}
        </legend>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: layout === 'horizontal' ? 'row' : 'column',
          gap: layout === 'horizontal' ? 20 : 10,
          flexWrap: 'wrap',
        }}
      >
        {options.map(opt => {
          const isChecked = value === opt.value
          const inputId = `${name}-${opt.value}`

          return (
            <div key={opt.value} className="flex items-start gap-2.5">
              <div className="relative shrink-0" style={{ width: 18, height: 18, marginTop: 2 }}>
                <input
                  type="radio"
                  id={inputId}
                  name={name}
                  value={opt.value}
                  checked={isChecked}
                  disabled={opt.disabled}
                  onChange={() => onChange?.(opt.value)}
                  className="sr-only"
                />
                <label
                  htmlFor={inputId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: isChecked
                      ? `1.5px solid ${colors.brand.navy}`
                      : `1.5px solid #CBD5E1`,
                    background: colors.surface.card,
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: opt.disabled ? 0.5 : 1,
                  }}
                >
                  {isChecked && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: colors.brand.navy,
                    }} />
                  )}
                </label>
              </div>

              <div className="flex flex-col gap-0.5">
                <label
                  htmlFor={inputId}
                  style={{
                    fontSize: 13, fontWeight: 500,
                    color: opt.disabled ? colors.text.muted : colors.text.ink,
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    lineHeight: 1.4,
                  }}
                >
                  {opt.label}
                </label>
                {opt.description && (
                  <span style={{ fontSize: 11, color: colors.text.muted, lineHeight: 1.4 }}>
                    {opt.description}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <span style={{ fontSize: 11, color: colors.state.danger, display: 'block', marginTop: 6 }}>
          {error}
        </span>
      )}
    </fieldset>
  )
})

export default RadioGroup
