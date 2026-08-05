import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const variants = {
  primary: [
    'text-white font-semibold active:scale-[0.98]',
    'bg-[#1A2744]',
    'shadow-[0_4px_14px_rgba(26,39,68,0.25)]',
    'hover:bg-[#243359] hover:shadow-[0_6px_20px_rgba(26,39,68,0.35)] hover:-translate-y-px',
    'disabled:bg-[#1A2744]',
    'transition-all duration-200',
  ].join(' '),
  secondary: [
    'text-white font-semibold active:scale-[0.98]',
    'bg-[#243359]',
    'shadow-[0_4px_14px_rgba(26,39,68,0.2)]',
    'hover:bg-[#1A2744] hover:shadow-[0_6px_20px_rgba(26,39,68,0.3)] hover:-translate-y-px',
    'transition-all duration-200',
  ].join(' '),
  outline: [
    'border-[1.5px] border-[#1A2744] text-[#1A2744] font-semibold',
    'hover:bg-[#1A2744] hover:text-white active:scale-[0.98]',
    'transition-all duration-200',
  ].join(' '),
  ghost: 'text-gray-600 hover:bg-gray-100 active:scale-[0.98] transition-all duration-150',
  danger: [
    'text-white font-semibold bg-[#DC2626]',
    'hover:bg-[#B91C1C] active:scale-[0.98]',
    'shadow-[0_4px_12px_rgba(220,38,38,0.25)]',
    'transition-all duration-200',
  ].join(' '),
  // Text-only link button — e.g. "Skip for now" beside a primary CTA.
  // Bypasses `sizes[size]` (see below) so it keeps its own compact padding
  // instead of a fixed button height.
  link: 'text-sm font-medium text-gray-500 hover:text-primary transition-colors px-2 py-2 whitespace-nowrap',
}

const sizes = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:translate-y-0',
        variants[variant],
        variant !== 'link' && sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
