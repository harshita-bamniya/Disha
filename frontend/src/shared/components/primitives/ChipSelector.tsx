import { memo } from 'react'
import { colors, radius } from '@/design-system/tokens'

interface ChipSelectorProps {
  options: string[]
  selected: string | string[]
  onChange: (value: string | string[]) => void
  multi?: boolean
  disabled?: boolean
}

const ChipSelector = memo(function ChipSelector({
  options, selected, onChange, multi = false, disabled = false,
}: ChipSelectorProps) {
  const isSelected = (opt: string) =>
    multi ? (selected as string[]).includes(opt) : selected === opt

  function toggle(opt: string) {
    if (disabled) return
    if (multi) {
      const arr = selected as string[]
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt])
    } else {
      onChange(isSelected(opt) ? '' : opt)
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = isSelected(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            disabled={disabled}
            style={{
              padding: '6px 14px',
              borderRadius: radius.full,
              border: `1.5px solid ${active ? colors.brand.navy : colors.border.medium}`,
              background: active ? colors.brand.navy : colors.surface.card,
              color: active ? '#fff' : colors.text.inkSoft,
              fontSize: 13, fontWeight: active ? 700 : 500,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
})

export default ChipSelector
