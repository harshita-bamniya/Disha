import { cn } from '@/lib/utils'
import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  prefix?: React.ReactNode
  /** Shows a red asterisk after the label — purely visual, doesn't affect validation. */
  required?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, className, id, type, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const [showPassword, setShowPassword] = useState(false)

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-gray-700">
            {label}{required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3.5 text-gray-400 flex items-center pointer-events-none">
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            className={cn(
              'w-full h-12 rounded-xl border-[1.5px] bg-white/80 px-4 text-sm text-gray-900',
              'placeholder:text-gray-400 outline-none transition-all duration-200',
              'border-gray-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
              'focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]',
              'hover:border-gray-300',
              'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
              error && 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/10 focus:shadow-[0_0_0_4px_rgba(220,38,38,0.08)]',
              prefix && 'pl-11',
              isPassword && 'pr-11',
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
              className="absolute right-3.5 text-gray-400 hover:text-gray-600 flex items-center"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-[#DC2626] mt-0.5 flex items-center gap-1">⚠ {error}</p>}
        {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
