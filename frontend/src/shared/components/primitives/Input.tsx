import { cn } from '@/lib/utils'
import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string
  hint?: string
  prefix?: React.ReactNode
  required?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, className, id, type, required, ...props }, ref) => {
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const isPassword = type === 'password'
    const [showPassword, setShowPassword] = useState(false)
    const [focused, setFocused] = useState(false)

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: focused ? '#1A2744' : '#94A3B8',
              transition: 'color 0.15s',
            }}
          >
            {label}{required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {prefix && (
            <div
              className="absolute left-0 flex items-center pointer-events-none"
              style={{ color: focused ? '#1A2744' : '#94A3B8', transition: 'color 0.15s' }}
            >
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
            style={{
              borderBottom: error
                ? '1.5px solid #DC2626'
                : focused
                  ? '1.5px solid #1A2744'
                  : '1.5px solid #E2E8F0',
              transition: 'border-color 0.15s',
            }}
            className={cn(
              'w-full h-11 bg-transparent outline-none text-sm',
              'text-[#1E3A5F] placeholder:text-[#CBD5E1]',
              'border-0 border-b rounded-none px-0',
              prefix && 'pl-7',
              isPassword && 'pr-8',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-0 flex items-center transition-colors"
              style={{ color: focused ? '#1A2744' : '#94A3B8' }}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 11, color: '#DC2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            ⚠ {error}
          </p>
        )}
        {hint && !error && (
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
