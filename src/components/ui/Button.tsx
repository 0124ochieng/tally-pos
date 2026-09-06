import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-gold-400 text-neutral-900 hover:bg-gold-500 focus-visible:outline-gold-500 disabled:bg-gold-200 shadow-sm shadow-gold-400/20',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-surface-alt focus-visible:outline-gold-500',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-alt focus-visible:outline-gold-500',
  destructive: 'bg-coral-400 text-white hover:bg-coral-500 focus-visible:outline-coral-500 disabled:bg-coral-200',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
}
