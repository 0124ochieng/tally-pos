import type { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: string
  sublabel?: string
  tone?: 'gold' | 'cyan' | 'coral' | 'neutral'
  icon?: ReactNode
}

const toneClasses = {
  gold: 'bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  coral: 'bg-coral-100 text-coral-700 dark:bg-coral-900/40 dark:text-coral-300',
  neutral: 'bg-surface-alt text-ink-secondary',
}

export function StatTile({ label, value, sublabel, tone = 'neutral', icon }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-sm text-ink-secondary">{label}</p>
        {icon && <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-ink-muted">{sublabel}</p>}
    </div>
  )
}
