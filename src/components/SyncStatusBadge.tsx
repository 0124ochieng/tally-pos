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

function formatSyncedAt(ts: number | null) {
  if (!ts) return null
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function SyncStatusBadge() {
  const [state, setState] = useState<SyncState>('offline')
  const [pending, setPending] = useState(0)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [, forceTick] = useState(0)

  useEffect(() => subscribeSyncState((s, count, lastSyncedAt) => {
    setState(s)
    setPending(count)
    setSyncedAt(lastSyncedAt)
  }), [])

  // The "3 min ago" text goes stale as time passes even with no new sync
  // event — nudge a re-render periodically so it stays honest.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

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
  const syncedLabel = formatSyncedAt(syncedAt)

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs text-ink-secondary">
      <span className={`h-2 w-2 rounded-full ${dotClasses[state]}`} />
      {label}
      {state === 'online-idle' && pending === 0 && syncedLabel && (
        <span className="text-ink-muted">· {syncedLabel}</span>
      )}
      {pending > 0 && state !== 'syncing' && <span className="text-ink-muted">({pending} pending)</span>}
    </div>
  )
}
