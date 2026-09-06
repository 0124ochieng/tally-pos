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
 * installs that already had products before expense tracking was added. */
export async function seedExpenseCategoriesIfEmpty() {
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
}

export async function seedDatabaseIfEmpty() {
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

  await db.transaction('rw', db.tables, async () => {
    await db.users.bulkAdd(users)
    await db.categories.bulkAdd(categories)
    await db.products.bulkAdd(products)
    await db.cashDrawerEntries.add({ id: newId(), type: 'opening_float', amount: 5000, recordedBy: 'system', note: 'Initial float', createdAt: now })
  })
}
