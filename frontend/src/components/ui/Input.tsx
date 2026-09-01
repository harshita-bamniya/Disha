import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  hint?: string
  prefix?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-gray-700">
            {label}
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
            className={cn(
              'w-full h-12 rounded-xl border-[1.5px] bg-white/80 px-4 text-sm text-gray-900',
              'placeholder:text-gray-400 outline-none transition-all duration-200',
              'border-gray-200 focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/8',
              'focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]',
              'hover:border-gray-300',
              'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
              error && 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/10 focus:shadow-[0_0_0_4px_rgba(220,38,38,0.08)]',
              prefix && 'pl-11',
              className,
            )}
            {...props}
          />
        </div>

        {error && <p className="text-xs text-[#DC2626] mt-0.5 flex items-center gap-1">⚠ {error}</p>}
        {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
