import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const variants = {
  primary: [
    'text-white font-semibold active:scale-[0.98]',
    'bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]',
    'shadow-[0_4px_14px_rgba(59,130,246,0.3)]',
    'hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] hover:-translate-y-px',
    'disabled:from-[#3B82F6] disabled:to-[#3B82F6]',
    'transition-all duration-200',
  ].join(' '),
  secondary: [
    'text-white font-semibold active:scale-[0.98]',
    'bg-gradient-to-br from-[#93C5FD] to-[#3B82F6]',
    'shadow-[0_4px_14px_rgba(147,197,253,0.3)]',
    'hover:shadow-[0_6px_20px_rgba(147,197,253,0.4)] hover:-translate-y-px',
    'transition-all duration-200',
  ].join(' '),
  outline: [
    'border-[1.5px] border-[#3B82F6] text-[#3B82F6] font-semibold',
    'hover:bg-[#3B82F6] hover:text-white active:scale-[0.98]',
    'transition-all duration-200',
  ].join(' '),
  ghost: 'text-gray-600 hover:bg-gray-100 active:scale-[0.98] transition-all duration-150',
  danger: [
    'text-white font-semibold bg-[#DC2626]',
    'hover:bg-[#B91C1C] active:scale-[0.98]',
    'shadow-[0_4px_12px_rgba(220,38,38,0.25)]',
    'transition-all duration-200',
  ].join(' '),
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
        sizes[size],
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
