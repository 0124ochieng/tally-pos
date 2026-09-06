// The two "danger zone" data-wipe operations, kept in one place so their
// exact scope (what's deleted vs. kept) is easy to audit and can't drift
// out of sync between the UI and what actually runs.
//
// Both operations write a line to a plain-text log file outside the
// database they just wiped (see electron/main.cjs's append-deletion-log
// handler) — that way the record of "who deleted what, when" survives the
// deletion itself.

import { db } from './db'
import { clearCart } from './cartPersistence'
import { emitDataChanged } from './events'

/** Exported for reuse anywhere else a destructive, hard-to-undo action
 * (e.g. permanently deleting a staff account) deserves the same
 * outside-the-database paper trail as a full data wipe. */
export async function logDeletion(line: string) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  if (typeof window !== 'undefined' && window.electronAPI) {
    await window.electronAPI.appendDeletionLog(stamped)
  } else {
    // Browser dev fallback — there's no local filesystem to write to.
    console.warn('[deletion-log]', stamped)
  }
}

export interface DataResetSummary {
  sales: number
  cashDrawerEntries: number
  mpesaTillEntries: number
  expenses: number
  expenseCategories: number
  stockIntakes: number
  auditLog: number
  /** Sold-serial records removed (the physical units they represent were
   * already sold to real customers — see resetSalesAndActivityData). */
  soldSerialsRemoved: number
}

/** Wipes sales/money/activity history. Deliberately spares products,
 * categories, current stock counts, staff accounts, and shop settings —
 * rebuilding a product catalogue from scratch is hours of work an owner
 * shouldn't have to redo just to start a new financial period. */
export async function resetSalesAndActivityData(actorName: string): Promise<DataResetSummary> {
  const [sales, cashDrawerEntries, mpesaTillEntries, expenses, stockIntakes, auditLog, expenseCategoriesToDelete, soldSerialsRemoved] =
    await Promise.all([
      db.sales.count(),
      db.cashDrawerEntries.count(),
      db.mpesaTillEntries.count(),
      db.expenses.count(),
      db.stockIntakes.count(),
      db.auditLog.count(),
      db.expenseCategories.filter((c) => !c.protected).count(),
      db.serials.where('status').equals('sold').count(),
    ])

  await db.transaction(
    'rw',
    [db.sales, db.cashDrawerEntries, db.mpesaTillEntries, db.expenses, db.expenseCategories, db.stockIntakes, db.auditLog, db.outbox, db.serials],
    async () => {
      await db.sales.clear()
      await db.cashDrawerEntries.clear()
      await db.mpesaTillEntries.clear()
      await db.expenses.clear()
      await db.expenseCategories.filter((c) => !c.protected).delete()
      await db.stockIntakes.clear()
      await db.auditLog.clear()
      await db.outbox.clear()
      // A "sold" serial was physically handed to a real customer — deleting
      // the sales history doesn't undo that. Resetting it back to
      // "in_stock" here would let it be sold a second time even though the
      // shop doesn't have it anymore. Remove the record instead: it keeps
      // product.stock (untouched by this reset) matching the count of
      // serials that are *actually* still on the shelf.
      await db.serials.where('status').equals('sold').delete()
    },
  )

  clearCart()
  emitDataChanged()
  await logDeletion(`RESET SALES & ACTIVITY DATA by "${actorName}" — inventory (products/categories/stock) was kept.`)

  return {
    sales,
    cashDrawerEntries,
    mpesaTillEntries,
    expenses,
    expenseCategories: expenseCategoriesToDelete,
    stockIntakes,
    auditLog,
    soldSerialsRemoved,
  }
}

export interface InventoryDeleteSummary {
  products: number
  categories: number
  serials: number
}

/** Wipes the entire product catalogue. Separate from the reset above, and
 * meant to be reached for far less often — rebuilding a catalogue from
 * nothing is the single most time-consuming thing an owner can be asked
 * to redo, so this needs its own explicit, harder-to-reach confirmation. */
export async function deleteAllInventory(actorName: string): Promise<InventoryDeleteSummary> {
  const [products, categories, serials] = await Promise.all([
    db.products.count(),
    db.categories.count(),
    db.serials.count(),
  ])

  await db.transaction('rw', [db.products, db.categories, db.serials], async () => {
    await db.products.clear()
    await db.categories.clear()
    await db.serials.clear()
  })

  emitDataChanged()
  await logDeletion(`DELETED ALL INVENTORY by "${actorName}" — ${products} product(s), ${categories} categorie(s).`)

  return { products, categories, serials }
}
