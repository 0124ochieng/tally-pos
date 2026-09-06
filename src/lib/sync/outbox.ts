import { db, newId } from '../db'
import { emitDataChanged } from '../events'

/** Call after every local write that should eventually reach the cloud. */
export async function enqueueSync(table: string, op: 'upsert' | 'delete', payload: unknown) {
  await db.outbox.add({
    id: newId(),
    table,
    op,
    payload,
    createdAt: Date.now(),
    synced: false,
  })
  emitDataChanged()
}
