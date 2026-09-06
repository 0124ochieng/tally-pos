import { db, type Sale, type CashDrawerEntry, type MpesaTillEntry, type Expense } from './db'

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}
export function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1).getTime()
}

export function sumSales(sales: Sale[]) {
  return sales.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.total, 0)
}

export function cashDrawerBalance(entries: CashDrawerEntry[]) {
  return entries.reduce((sum, e) => {
    if (e.type === 'opening_float' || e.type === 'cash_sale' || e.type === 'cash_in') return sum + e.amount
    if (e.type === 'cash_out') return sum - e.amount
    return sum // closing_count is informational, not part of the running total
  }, 0)
}

export function mpesaTillBalance(entries: MpesaTillEntry[]) {
  return entries.reduce((sum, e) => (e.type === 'expense' ? sum - e.amount : sum + e.amount), 0)
}

export function sumExpenses(expenses: Expense[]) {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

export async function getProfitForSales(sales: Sale[]) {
  // Prefer each item's cost price as it was at the moment of sale, so a
  // later restock/cost change never rewrites a past period's profit.
  // Only sales recorded before that field existed fall back to today's
  // product cost price (best available approximation for old data).
  const legacyProductIds = new Set(
    sales.flatMap((s) => s.items.filter((i) => i.costPriceAtSale === undefined).map((i) => i.productId)),
  )
  const legacyProducts = await db.products.bulkGet(Array.from(legacyProductIds))
  const legacyCostByProduct = new Map(legacyProducts.filter(Boolean).map((p) => [p!.id, p!.costPrice]))

  let revenue = 0
  let cost = 0
  for (const sale of sales) {
    if (sale.status !== 'completed') continue
    for (const item of sale.items) {
      revenue += item.lineTotal
      cost += (item.costPriceAtSale ?? legacyCostByProduct.get(item.productId) ?? 0) * item.qty
    }
  }
  return { revenue, cost, profit: revenue - cost }
}

export function topProducts(sales: Sale[], limit = 5) {
  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  sales
    .filter((s) => s.status === 'completed')
    .forEach((s) =>
      s.items.forEach((i) => {
        const existing = map.get(i.productId) ?? { name: i.name, qty: 0, revenue: 0 }
        existing.qty += i.qty
        existing.revenue += i.lineTotal
        map.set(i.productId, existing)
      }),
    )
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function salesByDay(sales: Sale[], days = 14) {
  const buckets = new Map<string, number>()
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    buckets.set(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), 0)
  }
  sales
    .filter((s) => s.status === 'completed')
    .forEach((s) => {
      const key = new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + s.total)
    })
  return Array.from(buckets.entries()).map(([date, total]) => ({ date, total }))
}

export function expensesByCategory(expenses: Expense[], categoryNameById: Map<string, string>) {
  const map = new Map<string, number>()
  expenses.forEach((e) => {
    const name = categoryNameById.get(e.categoryId) ?? 'Other'
    map.set(name, (map.get(name) ?? 0) + e.amount)
  })
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}

export function salesByCategory(sales: Sale[], productCategoryMap: Map<string, string>) {
  const map = new Map<string, number>()
  sales
    .filter((s) => s.status === 'completed')
    .forEach((s) =>
      s.items.forEach((i) => {
        const cat = productCategoryMap.get(i.productId) ?? 'Other'
        map.set(cat, (map.get(cat) ?? 0) + i.lineTotal)
      }),
    )
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}
