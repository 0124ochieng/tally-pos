import { db } from '../db'
import { getSupabase, getIsCloudConfigured } from '../supabase'

export type SyncState = 'offline' | 'online-idle' | 'syncing' | 'error'

/** After this many failed attempts, stop retrying an entry automatically
 * every 15s (it's very unlikely a bad payload starts succeeding) and
 * surface it as a real error instead of a silently-stuck "pending" count. */
const MAX_AUTO_RETRIES = 8

type Listener = (state: SyncState, pendingCount: number, lastSyncedAt: number | null) => void

let listeners: Listener[] = []
let currentState: SyncState = navigator.onLine ? 'online-idle' : 'offline'
let currentPending = 0
let lastSyncedAt: number | null = null
let intervalHandle: ReturnType<typeof setInterval> | null = null

function notify(state: SyncState, pendingCount: number) {
  currentState = state
  currentPending = pendingCount
  // "Synced" only ever means "fully caught up right now" — timestamp it
  // whenever that's true, so the badge can say when, not just that it did.
  if (state === 'online-idle' && pendingCount === 0) lastSyncedAt = Date.now()
  listeners.forEach((l) => l(state, pendingCount, lastSyncedAt))
}

async function pendingCount() {
  const all = await db.outbox.toArray()
  return all.filter((e) => !e.synced).length
}

async function drainOutbox() {
  if (!navigator.onLine) {
    notify('offline', await pendingCount())
    return
  }
  const supabase = getSupabase()
  if (!getIsCloudConfigured() || !supabase) {
    // No cloud project configured yet — stay local-only, don't error.
    notify('online-idle', await pendingCount())
    return
  }

  const all = await db.outbox.toArray()
  const pending = all.filter((e) => !e.synced)
  if (pending.length === 0) {
    notify('online-idle', 0)
    return
  }

  // Entries that have already failed too many times are left alone this
  // round — no point hammering the network for a payload that isn't going
  // to start working — but they still count towards the total so the user
  // sees an honest number, not a silently-stuck "pending".
  const toAttempt = pending.filter((e) => (e.attempts ?? 0) < MAX_AUTO_RETRIES)

  notify('syncing', pending.length)

  for (const entry of toAttempt) {
    try {
      if (entry.op === 'upsert') {
        const { error } = await supabase.from(entry.table).upsert(entry.payload as object)
        if (error) throw error
      } else {
        const payload = entry.payload as { id: string }
        const { error } = await supabase.from(entry.table).delete().eq('id', payload.id)
        if (error) throw error
      }
      await db.outbox.update(entry.id, { synced: true })
    } catch (err) {
      // Leave unsynced; retry on next drain (up to the cap above). One
      // failure shouldn't block the rest of the batch.
      await db.outbox.update(entry.id, {
        attempts: (entry.attempts ?? 0) + 1,
        lastError: err instanceof Error ? err.message : String(err),
      })
      continue
    }
  }

  const remaining = (await db.outbox.toArray()).filter((e) => !e.synced)
  const synced = (await db.outbox.toArray()).filter((e) => e.synced)
  await db.outbox.bulkDelete(synced.map((e) => e.id))

  const stuck = remaining.filter((e) => (e.attempts ?? 0) >= MAX_AUTO_RETRIES)
  notify(stuck.length > 0 ? 'error' : 'online-idle', remaining.length)
}

const SYNCED_TABLES = [
  'users', 'categories', 'products', 'serials',
  'stockIntakes', 'sales', 'cashDrawerEntries', 'mpesaTillEntries',
  'expenseCategories', 'expenses', 'auditLog',
]

export type HydrationResult = 'has-data' | 'confirmed-empty' | 'unavailable'

/** Runs once at startup, before any local seeding, to answer: "is this
 * device's local database empty because it's a brand-new customer, or
 * because local data was lost (uninstall + data wipe, disk failure, a
 * replacement till PC) and their real history is sitting in the cloud?"
 *
 * Without this, a wiped local DB would silently reseed demo sample
 * products instead of recovering the shop's actual data — which is
 * sitting untouched in their own Supabase project the whole time, since
 * the realtime listener below only ever applies *future* changes, never
 * an initial bulk pull.
 *
 * Only ever touches the network when the local DB is already empty —
 * normal day-to-day restarts with existing local data never pay this
 * cost or depend on connectivity. And it fails closed: any doubt about
 * cloud reachability returns 'unavailable', never 'confirmed-empty', so a
 * network hiccup during a PC replacement can never be mistaken for
 * "genuinely new customer" and let demo data pollute real cloud records. */
export async function hydrateFromCloudIfAvailable(): Promise<HydrationResult> {
  if ((await db.products.count()) > 0) return 'has-data'

  const supabase = getSupabase()
  if (!getIsCloudConfigured() || !supabase) return 'confirmed-empty'

  try {
    const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true })
    if (error) return 'unavailable'
    if (!count) return 'confirmed-empty'

    for (const tableName of SYNCED_TABLES) {
      const { data, error: fetchError } = await supabase.from(tableName).select('*')
      if (fetchError) continue // best-effort per table — partial real data beats none
      if (data && data.length > 0) {
        await db.table(tableName).bulkPut(data)
      }
    }
    return 'has-data'
  } catch {
    return 'unavailable'
  }
}

function startRealtimePull() {
  const supabase = getSupabase()
  if (!getIsCloudConfigured() || !supabase) return

  for (const tableName of SYNCED_TABLES) {
    // Cloud sync is optional, best-effort infrastructure — a problem
    // subscribing to one table (or a client-library hiccup) should never
    // be able to crash the app for someone who's just trying to ring up a
    // sale. getIsCloudConfigured() already guards against a malformed
    // project URL (see lib/supabase.ts), but this stays defensive against
    // anything else that could go wrong here in the future too.
    try {
      supabase
        .channel(`public:${tableName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, async (payload) => {
          const table = db.table(tableName)
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string }
            if (oldRow?.id) await table.delete(oldRow.id)
            return
          }
          const incoming = payload.new as { id: string; updatedAt?: number }
          // Only tables with an updatedAt (products/categories/expenseCategories)
          // can be version-compared; for those, don't let an older write that
          // arrives late (e.g. a device reconnecting after being offline)
          // clobber a newer local edit made in the meantime.
          if (typeof incoming.updatedAt === 'number') {
            const local = (await table.get(incoming.id)) as { updatedAt?: number } | undefined
            if (local && typeof local.updatedAt === 'number' && local.updatedAt > incoming.updatedAt) return
          }
          await table.put(incoming)
        })
        .subscribe()
    } catch (err) {
      console.error(`Could not subscribe to realtime updates for "${tableName}" — continuing without it.`, err)
    }
  }
}

export function startSyncService() {
  if (intervalHandle) return
  // Most installs are local-only and never have a cloud project configured
  // (see docs/DISTRIBUTION.md) — nothing here would ever do anything for
  // them, so skip setting up listeners/intervals that would just wake up
  // every 15s forever to no-op.
  if (!getIsCloudConfigured()) return

  window.addEventListener('online', drainOutbox)
  window.addEventListener('offline', () => notify('offline', 0))

  intervalHandle = setInterval(drainOutbox, 15000)
  drainOutbox()
  startRealtimePull()
}

export function subscribeSyncState(listener: Listener) {
  listeners.push(listener)
  listener(currentState, currentPending, lastSyncedAt)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
