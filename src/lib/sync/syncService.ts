import { db } from '../db'
import { getSupabase, getIsCloudConfigured } from '../supabase'

export type SyncState = 'offline' | 'online-idle' | 'syncing' | 'error'

type Listener = (state: SyncState, pendingCount: number) => void

let listeners: Listener[] = []
let currentState: SyncState = navigator.onLine ? 'online-idle' : 'offline'
let intervalHandle: ReturnType<typeof setInterval> | null = null

function notify(state: SyncState, pendingCount: number) {
  currentState = state
  listeners.forEach((l) => l(state, pendingCount))
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

  notify('syncing', pending.length)

  for (const entry of pending) {
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
    } catch {
      // Leave unsynced; retry on next drain. One failure shouldn't block the rest.
      continue
    }
  }

  const stillPending = (await db.outbox.toArray()).filter((e) => !e.synced)
  const synced = (await db.outbox.toArray()).filter((e) => e.synced)
  await db.outbox.bulkDelete(synced.map((e) => e.id))
  notify('online-idle', stillPending.length)
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
  }
}

export function startSyncService() {
  if (intervalHandle) return

  window.addEventListener('online', drainOutbox)
  window.addEventListener('offline', () => notify('offline', 0))

  intervalHandle = setInterval(drainOutbox, 15000)
  drainOutbox()
  startRealtimePull()
}

export function subscribeSyncState(listener: Listener) {
  listeners.push(listener)
  listener(currentState, 0)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
