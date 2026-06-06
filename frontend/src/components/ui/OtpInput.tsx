import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  error?: string
  disabled?: boolean
}

export default function OtpInput({ value, onChange, length = 6, error, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const digits = value.padEnd(length, '').slice(0, length).split('')

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return

    const next = digits.map((d, i) => (i === index ? char.slice(-1) : d))
    onChange(next.join('').trimEnd())

    if (char && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 justify-center">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ''}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'w-11 h-14 text-center text-xl font-semibold rounded-xl border outline-none transition-all',
              'text-gray-900 bg-white',
              'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10',
              'disabled:bg-gray-50 disabled:cursor-not-allowed',
              error && 'border-danger focus:border-danger focus:ring-danger/10',
              digits[i] && 'border-primary bg-primary/5',
            )}
          />
        ))}
      </div>
      {error && <p className="text-xs text-danger text-center">{error}</p>}
    </div>
  )
}
