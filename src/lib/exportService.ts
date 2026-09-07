// exceljs is a large, rarely-used dependency (only touched by the "Export All
// Data" button) — imported dynamically inside exportFullReport() so it's
// fetched on demand instead of bloating every page load. `import type` here
// is compile-time only and adds nothing to the bundle.
import type ExcelJS from 'exceljs'
import { db, type Sale } from './db'
import { getBusinessName } from './settings'

export function exportFilePrefix() {
  return getBusinessName().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'POS'
}

// ---------- CSV ----------

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCSV(filename: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const lines = [
    columns.map((c) => csvEscape(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(',')),
  ]
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`)
}

export function downloadText(filename: string, content: string) {
  downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8;' }), filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- Excel (multi-sheet, formatted) ----------

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1607' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFF5C542' } }

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width?: number; format?: string }[],
  rows: Record<string, unknown>[],
) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }))
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
  })
  rows.forEach((r) => sheet.addRow(r))
  columns.forEach((c, i) => {
    if (c.format) sheet.getColumn(i + 1).numFmt = c.format
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return sheet
}

const KES = '#,##0'
const dateStr = (ms: number) => new Date(ms).toLocaleString()

export async function exportFullReport() {
  const [products, categories, sales, stockIntakes, expenses, expenseCategories, cashEntries, mpesaEntries] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.sales.toArray(),
    db.stockIntakes.toArray(),
    db.expenses.toArray(),
    db.expenseCategories.toArray(),
    db.cashDrawerEntries.toArray(),
    db.mpesaTillEntries.toArray(),
  ])

  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const expenseCategoryName = new Map(expenseCategories.map((c) => [c.id, c.name]))
  const productName = new Map(products.map((p) => [p.id, p.name]))

  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = `${getBusinessName()} POS`
  workbook.created = new Date()

  const sortedSales = [...sales].sort((a, b) => b.createdAt - a.createdAt)

  addSheet(workbook, 'Sales', [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Items', key: 'items', width: 10 },
    { header: 'Payment', key: 'payment', width: 12 },
    { header: 'Subtotal', key: 'subtotal', width: 14, format: KES },
    { header: 'Discount', key: 'discount', width: 12, format: KES },
    { header: 'Total', key: 'total', width: 14, format: KES },
    { header: 'M-Pesa Ref', key: 'ref', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
  ], sortedSales.map((s) => ({
    date: dateStr(s.createdAt),
    items: s.items.length,
    payment: s.paymentMethod,
    subtotal: s.subtotal,
    discount: s.discount,
    total: s.total,
    ref: s.mpesaRef ?? '',
    status: s.status,
  })))

  addSheet(workbook, 'Sale Items', [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Product', key: 'product', width: 30 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Unit Price', key: 'unitPrice', width: 14, format: KES },
    { header: 'Line Total', key: 'lineTotal', width: 14, format: KES },
    { header: 'IMEI', key: 'imei', width: 18 },
  ], sortedSales.flatMap((s: Sale) => s.items.map((i) => ({
    date: dateStr(s.createdAt),
    product: i.name,
    qty: i.qty,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
    imei: i.imei ?? '',
  }))))

  addSheet(workbook, 'Inventory', [
    { header: 'Product', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Brand', key: 'brand', width: 16 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Selling Price', key: 'sellingPrice', width: 14, format: KES },
    { header: 'Cost Price', key: 'costPrice', width: 14, format: KES },
    { header: 'Status', key: 'status', width: 10 },
  ], [...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({
    name: p.name,
    category: categoryName.get(p.categoryId) ?? '',
    brand: p.brand,
    sku: p.sku,
    stock: p.stock,
    sellingPrice: p.sellingPrice,
    costPrice: p.costPrice,
    status: p.active ? 'Active' : 'Removed',
  })))

  addSheet(workbook, 'Stock Intakes', [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Product', key: 'product', width: 30 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Cost/Unit', key: 'costPrice', width: 14, format: KES },
    { header: 'Total Cost', key: 'totalCost', width: 14, format: KES },
    { header: 'Paid Via', key: 'paidVia', width: 12 },
    { header: 'Received By', key: 'receivedBy', width: 16 },
    { header: 'Note', key: 'note', width: 24 },
  ], [...stockIntakes].sort((a, b) => b.receivedAt - a.receivedAt).map((s) => ({
    date: dateStr(s.receivedAt),
    product: productName.get(s.productId) ?? '',
    qty: s.quantity,
    costPrice: s.costPrice,
    totalCost: s.quantity * s.costPrice,
    paidVia: s.paidVia ?? 'unspecified',
    receivedBy: s.receivedBy,
    note: s.note,
  })))

  addSheet(workbook, 'Expenses', [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Amount', key: 'amount', width: 14, format: KES },
    { header: 'Paid Via', key: 'paidVia', width: 12 },
    { header: 'Source', key: 'source', width: 14 },
    { header: 'Recorded By', key: 'recordedBy', width: 16 },
  ], [...expenses].sort((a, b) => b.createdAt - a.createdAt).map((e) => ({
    date: dateStr(e.createdAt),
    description: e.description,
    category: expenseCategoryName.get(e.categoryId) ?? '',
    amount: e.amount,
    paidVia: e.paidVia,
    source: e.source === 'stock_intake' ? 'Stock Intake' : 'Manual',
    recordedBy: e.recordedBy,
  })))

  const ledger = [
    ...cashEntries.map((e) => ({ date: e.createdAt, account: 'Cash', type: e.type, amount: e.amount, note: e.note })),
    ...mpesaEntries.map((e) => ({ date: e.createdAt, account: 'M-Pesa', type: e.type, amount: e.amount, note: e.ref })),
  ].sort((a, b) => b.date - a.date)

  addSheet(workbook, 'Cash & M-Pesa Ledger', [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Account', key: 'account', width: 12 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Amount', key: 'amount', width: 14, format: KES },
    { header: 'Note', key: 'note', width: 26 },
  ], ledger.map((l) => ({ date: dateStr(l.date), account: l.account, type: l.type.replace('_', ' '), amount: l.amount, note: l.note })))

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${exportFilePrefix()}-Full-Report-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
