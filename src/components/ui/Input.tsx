import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type LabelHTMLAttributes } from 'react'

export const Label = ({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`mb-1 block text-sm font-medium text-ink-secondary ${className}`} {...props} />
)

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30 ${className}`}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...props }, ref) => (
    <select
      ref={ref}
      className={`h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30 ${className}`}
      {...props}
    />
  ),
)
Select.displayName = 'Select'
