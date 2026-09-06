import { db, newId, type Category, type ExpenseCategory, type Product, type User } from './db'
import { seedCategories, seedProducts } from '../data/seedProducts'
import { hashPin, generateSalt } from './pin'

// Fixed id so stock intake can always find the built-in expense category,
// even after re-seeding, without a fragile name-based lookup.
export const INVENTORY_EXPENSE_CATEGORY_ID = 'expense-cat-inventory'

const DEFAULT_EXPENSE_CATEGORIES: { id: string; name: string; icon: string; protected: boolean }[] = [
  { id: INVENTORY_EXPENSE_CATEGORY_ID, name: 'Inventory Purchases', icon: 'PackagePlus', protected: true },
  { id: newId(), name: 'Staff Welfare', icon: 'HandCoins', protected: false },
  { id: newId(), name: 'Utilities', icon: 'Lightbulb', protected: false },
  { id: newId(), name: 'Rent & Rates', icon: 'Package', protected: false },
  { id: newId(), name: 'Transport', icon: 'ShoppingBag', protected: false },
  { id: newId(), name: 'Miscellaneous', icon: 'Gift', protected: false },
]

/** Runs independently of the main seed so it also backfills existing
 * installs that already had products before expense tracking was added.
 *
 * The empty-check and the insert run inside one transaction on purpose:
 * React's StrictMode (and, in principle, any other double-mount of
 * LicenseGate's bootstrap effect) can call this twice back-to-back. With
 * the check and the write as separate un-transacted steps, two calls can
 * both see "empty" before either one finishes writing, and both then try
 * to insert the same fixed IDs — Dexie throws a ConstraintError on every
 * row and the app never gets past the loading screen. Wrapping both steps
 * in a single `db.transaction(...)` lets IndexedDB's own per-store
 * transaction queue serialize concurrent calls, so the second one's count
 * check correctly sees the first one's already-committed rows and skips. */
export async function seedExpenseCategoriesIfEmpty() {
  await db.transaction('rw', db.expenseCategories, async () => {
    const count = await db.expenseCategories.count()
    if (count > 0) return
    const now = Date.now()
    const expenseCategories: ExpenseCategory[] = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      protected: c.protected,
      createdAt: now,
      updatedAt: now,
    }))
    await db.expenseCategories.bulkAdd(expenseCategories)
  })
}

// Same reasoning as seedExpenseCategoriesIfEmpty() above: the emptiness
// check has to run inside the same transaction as the writes, or two
// near-simultaneous calls (StrictMode's double-effect-invoke in dev, most
// commonly) can both see "empty" and both try to insert — the second
// bulkAdd then fails outright on duplicate ids.
export async function seedDatabaseIfEmpty() {
  await db.transaction('rw', db.tables, async () => {
    const productCount = await db.products.count()
    if (productCount > 0) return

    const now = Date.now()

    const adminSalt = generateSalt()
    const staffSalt = generateSalt()
    const users: User[] = [
      { id: newId(), name: 'Admin', pinHash: await hashPin('0000', adminSalt), pinSalt: adminSalt, role: 'admin', active: true },
      { id: newId(), name: 'Staff', pinHash: await hashPin('1111', staffSalt), pinSalt: staffSalt, role: 'staff', active: true },
    ]

    const categoryIdByKey = new Map<string, string>()
    const categories: Category[] = seedCategories.map((c) => {
      const id = newId()
      categoryIdByKey.set(c.key, id)
      return { id, name: c.name, icon: c.icon, createdAt: now, updatedAt: now }
    })

    const products: Product[] = seedProducts.map((sp, index) => ({
      id: newId(),
      name: sp.name,
      brand: sp.brand,
      description: sp.description,
      categoryId: categoryIdByKey.get(sp.categoryKey)!,
      sku: `HG-${String(index + 1).padStart(4, '0')}`,
      sellingPrice: sp.sellingPrice,
      costPrice: sp.costPrice,
      unit: sp.unit,
      isSerialized: sp.isSerialized,
      lowStockThreshold: sp.lowStockThreshold,
      stock: sp.stock,
      active: true,
      createdAt: now,
      updatedAt: now,
    }))

    await db.users.bulkAdd(users)
    await db.categories.bulkAdd(categories)
    await db.products.bulkAdd(products)
    await db.cashDrawerEntries.add({ id: newId(), type: 'opening_float', amount: 5000, recordedBy: 'system', note: 'Initial float', createdAt: now })
  })
}
