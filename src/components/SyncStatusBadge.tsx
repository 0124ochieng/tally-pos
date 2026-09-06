import { useEffect, useState } from 'react'
import { subscribeSyncState, type SyncState } from '../lib/sync/syncService'

const labels: Record<SyncState, string> = {
  offline: 'Offline',
  'online-idle': 'Synced',
  syncing: 'Syncing…',
  error: 'Sync error',
}

const dotClasses: Record<SyncState, string> = {
  offline: 'bg-ink-muted',
  'online-idle': 'bg-cyan-400',
  syncing: 'bg-gold-400 animate-pulse',
  error: 'bg-coral-400',
}

export function SyncStatusBadge() {
  const [state, setState] = useState<SyncState>('offline')
  const [pending, setPending] = useState(0)

  useEffect(() => subscribeSyncState((s, count) => {
    setState(s)
    setPending(count)
  }), [])

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs text-ink-secondary">
      <span className={`h-2 w-2 rounded-full ${dotClasses[state]}`} />
      {labels[state]}
      {pending > 0 && state !== 'syncing' && <span className="text-ink-muted">({pending} pending)</span>}
    </div>
  )
}
