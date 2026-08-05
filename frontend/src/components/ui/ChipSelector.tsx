// Extracted from ProfilePage (audit Phase 5: "ChipSelector in ProfilePage
// only -> shared/components/primitives/ChipSelector.tsx"). Same markup.
export function ChipSelector({
  options, selected, onChange, multi = false,
}: {
  options: string[]
  selected: string | string[]
  onChange: (val: any) => void
  multi?: boolean
}) {
  const isSelected = (opt: string) =>
    multi ? (selected as string[]).includes(opt) : selected === opt

  const toggle = (opt: string) => {
    if (!multi) { onChange(opt); return }
    const arr = selected as string[]
    onChange(arr.includes(opt) ? arr.filter(s => s !== opt) : [...arr, opt])
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
            background: isSelected(opt) ? '#2563EB' : 'white',
            color: isSelected(opt) ? '#fff' : '#374151',
            border: isSelected(opt)
              ? 'none'
              : '1.5px solid rgba(59,130,246,0.15)',
            boxShadow: isSelected(opt)
              ? '0 3px 10px rgba(59,130,246,0.3)'
              : '0 1px 3px rgba(0,0,0,0.04)',
            transform: isSelected(opt) ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          {isSelected(opt) ? '✓ ' : ''}{opt}
        </button>
      ))}
    </div>
  )
}
