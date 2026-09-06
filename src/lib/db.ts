import Dexie, { type EntityTable } from 'dexie'
import { hashPin, generateSalt } from './pin'

export type Role = 'admin' | 'staff'
export type PaymentMethod = 'cash' | 'mpesa'
export type SaleStatus = 'completed' | 'voided'
export type SerialStatus = 'in_stock' | 'sold'
export type DrawerEntryType = 'opening_float' | 'cash_sale' | 'cash_in' | 'cash_out' | 'closing_count'
export type MpesaEntryType = 'sale' | 'expense' | 'reconciliation_adjustment'
export type AuditAction = 'created' | 'updated' | 'deleted'
export type AuditEntityType = 'category' | 'product' | 'expenseCategory' | 'sale'
export type PaidVia = 'cash' | 'mpesa' | 'credit'
export type ExpenseSource = 'manual' | 'stock_intake'

export interface User {
  id: string
  name: string
  pinHash: string
  pinSalt: string
  role: Role
  active: boolean
}

export interface Category {
  id: string
  name: string
  icon: string // lucide icon name
  createdAt: number
  updatedAt: number
}

export interface Product {
  id: string
  name: string
  brand: string
  description: string
  categoryId: string
  sku: string
  sellingPrice: number
  costPrice: number
  unit: string
  isSerialized: boolean
  lowStockThreshold: number
  stock: number
  active: boolean
  createdAt: number
  updatedAt: number
}

export interface Serial {
  id: string
  productId: string
  imei: string
  status: SerialStatus
  soldInSaleId: string | null
  createdAt: number
}

export interface StockIntake {
  id: string
  productId: string
  quantity: number
  costPrice: number
  paidVia: PaidVia
  receivedAt: number
  receivedBy: string
  note: string
}

export interface SaleItem {
  productId: string
  name: string
  qty: number
  unitPrice: number
  imei: string | null
  lineTotal: number
  /** Product cost price at the moment of sale — used for historical profit
   * reporting so a later cost-price change can't rewrite past margins.
   * Optional only because sales recorded before this field existed lack it. */
  costPriceAtSale?: number
}

export interface Sale {
  id: string
  cashierId: string
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  mpesaRef: string | null
  amountTendered: number | null
  changeGiven: number | null
  status: SaleStatus
  voidedAt: number | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: number
}

export interface CashDrawerEntry {
  id: string
  type: DrawerEntryType
  amount: number
  recordedBy: string
  note: string
  createdAt: number
}

export interface MpesaTillEntry {
  id: string
  type: MpesaEntryType
  amount: number
  ref: string
  createdAt: number
}

export interface ExpenseCategory {
  id: string
  name: string
  icon: string
  protected: boolean // true for the built-in "Inventory Purchases" category
  createdAt: number
  updatedAt: number
}

export interface Expense {
  id: string
  categoryId: string
  amount: number
  description: string
  paidVia: PaidVia
  source: ExpenseSource
  relatedStockIntakeId: string | null
  recordedBy: string
  createdAt: number
}

export interface FieldChange {
  field: string
  label: string
  before: string
  after: string
}

export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  entityName: string
  summary: string
  changes?: FieldChange[]
  snapshotBefore?: unknown
  snapshotAfter?: unknown
  restored?: boolean
  createdAt: number
}

export interface OutboxEntry {
  id: string
  table: string
  op: 'upsert' | 'delete'
  payload: unknown
  createdAt: number
  synced: boolean
}

class HymesDB extends Dexie {
  users!: EntityTable<User, 'id'>
  categories!: EntityTable<Category, 'id'>
  products!: EntityTable<Product, 'id'>
  serials!: EntityTable<Serial, 'id'>
  stockIntakes!: EntityTable<StockIntake, 'id'>
  sales!: EntityTable<Sale, 'id'>
  cashDrawerEntries!: EntityTable<CashDrawerEntry, 'id'>
  mpesaTillEntries!: EntityTable<MpesaTillEntry, 'id'>
  expenseCategories!: EntityTable<ExpenseCategory, 'id'>
  expenses!: EntityTable<Expense, 'id'>
  auditLog!: EntityTable<AuditLogEntry, 'id'>
  outbox!: EntityTable<OutboxEntry, 'id'>

  constructor() {
    super('hymes-gadgets-pos-v2')
    this.version(1).stores({
      users: 'id, role',
      categories: 'id, name',
      products: 'id, categoryId, sku, name',
      serials: 'id, productId, imei, status',
      stockIntakes: 'id, productId, receivedAt',
      sales: 'id, cashierId, status, createdAt',
      cashDrawerEntries: 'id, type, createdAt',
      mpesaTillEntries: 'id, type, createdAt',
      auditLog: 'id, entityType, entityId, createdAt',
      outbox: 'id, createdAt',
    })
    this.version(2).stores({
      users: 'id, role',
      categories: 'id, name',
      products: 'id, categoryId, sku, name',
      serials: 'id, productId, imei, status',
      stockIntakes: 'id, productId, receivedAt',
      sales: 'id, cashierId, status, createdAt',
      cashDrawerEntries: 'id, type, createdAt',
      mpesaTillEntries: 'id, type, createdAt',
      expenseCategories: 'id, name',
      expenses: 'id, categoryId, source, createdAt',
      auditLog: 'id, entityType, entityId, createdAt',
      outbox: 'id, createdAt',
    })
    // v3: hash any plaintext staff PINs left over from earlier installs.
    // Runs transparently — no one has to re-enter their PIN.
    this.version(3).stores({
      users: 'id, role',
      categories: 'id, name',
      products: 'id, categoryId, sku, name',
      serials: 'id, productId, imei, status',
      stockIntakes: 'id, productId, receivedAt',
      sales: 'id, cashierId, status, createdAt',
      cashDrawerEntries: 'id, type, createdAt',
      mpesaTillEntries: 'id, type, createdAt',
      expenseCategories: 'id, name',
      expenses: 'id, categoryId, source, createdAt',
      auditLog: 'id, entityType, entityId, createdAt',
      outbox: 'id, createdAt',
    }).upgrade(async (tx) => {
      const users = (await tx.table('users').toArray()) as Array<User & { pin?: string }>
      for (const u of users) {
        if (typeof u.pin === 'string') {
          const pinSalt = generateSalt()
          const pinHash = await hashPin(u.pin, pinSalt)
          await tx.table('users').put({ id: u.id, name: u.name, role: u.role, active: u.active, pinHash, pinSalt })
        }
      }
    })
  }
}

export const db = new HymesDB()

export const newId = () => crypto.randomUUID()
