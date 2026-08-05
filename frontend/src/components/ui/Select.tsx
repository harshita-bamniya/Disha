import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode
  error?: string
  required?: boolean
}

// Boxed select style already established ad hoc across onboarding forms
// (rounded-xl border, focus ring) — packaged here as-is, not restyled to
// match Input's underline theme, so adopting it doesn't change any page's
// current appearance.
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, className, id, children, ...props }, ref) => {
    const selectId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
            {label}{required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full h-11 rounded-xl border bg-white px-4 text-sm text-gray-900 outline-none transition-all',
            'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10',
            error && 'border-danger',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
