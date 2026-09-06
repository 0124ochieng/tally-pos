import { db, newId } from '../db'
import { emitDataChanged } from '../events'
import { getIsCloudConfigured } from '../supabase'

/** Call after every local write that should eventually reach the cloud.
 *
 * Most installs are local-only by design (see docs/DISTRIBUTION.md) and
 * never have a cloud project configured — for those, there's nothing to
 * eventually sync this to, so skip the outbox entirely. Without this
 * check, every single sale/product edit/stock intake would add a row to
 * `outbox` that nothing would ever drain or clean up, growing forever for
 * the lifetime of the install. */
export async function enqueueSync(table: string, op: 'upsert' | 'delete', payload: unknown) {
  if (getIsCloudConfigured()) {
    await db.outbox.add({
      id: newId(),
      table,
      op,
      payload,
      createdAt: Date.now(),
      synced: false,
    })
  }
  emitDataChanged()
}
