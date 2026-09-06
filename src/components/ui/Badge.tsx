import type { HTMLAttributes } from 'react'

type Tone = 'gold' | 'cyan' | 'coral' | 'neutral'

const toneClasses: Record<Tone, string> = {
  gold: 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  coral: 'bg-coral-100 text-coral-800 dark:bg-coral-900/40 dark:text-coral-300',
  neutral: 'bg-surface-alt text-ink-secondary',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
      {...props}
    />
  )
}
