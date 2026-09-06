import { db, newId, type AuditAction, type AuditEntityType, type AuditLogEntry, type FieldChange } from './db'
import { enqueueSync } from './sync/outbox'

interface AuditExtra {
  changes?: FieldChange[]
  snapshotBefore?: unknown
  snapshotAfter?: unknown
}

export async function logAudit(
  actor: { id: string; name: string },
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  entityName: string,
  summary: string,
  extra: AuditExtra = {},
) {
  const entry: AuditLogEntry = {
    id: newId(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType,
    entityId,
    entityName,
    summary,
    changes: extra.changes,
    snapshotBefore: extra.snapshotBefore,
    snapshotAfter: extra.snapshotAfter,
    restored: false,
    createdAt: Date.now(),
  }
  await db.auditLog.add(entry)
  await enqueueSync('auditLog', 'upsert', entry)
  return entry
}

/** Silently deletes an audit entry — used only to cancel a just-logged action
 * within its undo grace window, so the transient "oops" never shows in History. */
export async function discardAudit(entryId: string) {
  await db.auditLog.delete(entryId)
  await enqueueSync('auditLog', 'delete', { id: entryId })
}

const TABLE_BY_ENTITY: Partial<Record<AuditEntityType, string>> = {
  product: 'products',
  category: 'categories',
  expenseCategory: 'expenseCategories',
}

/** Reverts a product/category to the state captured in an audit entry's
 * snapshotBefore — used both to restore a deleted item and to undo an edit.
 * No-ops for entity types (e.g. 'sale') that don't support this generic
 * restore path — those use their own dedicated reversal (see voidSale). */
export async function restoreFromAudit(entry: AuditLogEntry, actor: { id: string; name: string }) {
  if (!entry.snapshotBefore) return
  const tableName = TABLE_BY_ENTITY[entry.entityType]
  if (!tableName) return
  const table = db.table(tableName)
  await table.put(entry.snapshotBefore)
  await enqueueSync(tableName, 'upsert', entry.snapshotBefore)
  await db.auditLog.update(entry.id, { restored: true })
  await enqueueSync('auditLog', 'upsert', { ...entry, restored: true })
  await logAudit(
    actor,
    'updated',
    entry.entityType,
    entry.entityId,
    entry.entityName,
    `Restored "${entry.entityName}" to its state from ${new Date(entry.createdAt).toLocaleString()}`,
  )
}
