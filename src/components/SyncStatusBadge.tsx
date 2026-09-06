import { useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { subscribeSyncState, type SyncState } from '../lib/sync/syncService'
import { getIsCloudConfigured } from '../lib/supabase'

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

  // This product is local-first by default: most installs never have a
  // cloud project configured at all, so "Offline"/"Synced" would be a
  // confusing thing to show for what's working exactly as designed. Say
  // what's actually true instead.
  if (!getIsCloudConfigured()) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs text-ink-secondary">
        <HardDrive size={12} className="text-ink-muted" />
        Saved on this computer
      </div>
    )
  }

  // "Synced" only ever means what it says — zero pending. Anything else
  // shows its real state instead of a contradictory "Synced (N pending)".
  const label = state === 'online-idle' && pending > 0 ? 'Syncing…' : labels[state]

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs text-ink-secondary">
      <span className={`h-2 w-2 rounded-full ${dotClasses[state]}`} />
      {label}
      {pending > 0 && state !== 'syncing' && <span className="text-ink-muted">({pending} pending)</span>}
    </div>
  )
}
