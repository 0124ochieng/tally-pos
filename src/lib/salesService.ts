import { db, newId, type PaymentMethod, type Sale, type SaleItem } from './db'
import { enqueueSync } from './sync/outbox'
import { logAudit } from './auditLog'

export interface CartLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  imei: string | null
}

interface CompleteSaleInput {
  cashierId: string
  lines: CartLine[]
  discount: number
  paymentMethod: PaymentMethod
  mpesaRef: string | null
  amountTendered: number | null
}

export async function completeSale(input: CompleteSaleInput) {
  const now = Date.now()
  const saleId = newId()

  return db.transaction('rw', db.tables, async () => {
    // Re-validate against the authoritative committed stock/serial state
    // (not whatever the UI had cached) and snapshot each item's current
    // cost price — otherwise a stale cart can silently oversell, and a
    // later cost-price change would quietly rewrite this sale's margin.
    const items: SaleItem[] = []
    for (const line of input.lines) {
      const product = await db.products.get(line.productId)
      if (line.imei) {
        const serial = await db.serials.where('imei').equals(line.imei).first()
        if (!serial || serial.status !== 'in_stock') {
          throw new Error(`${line.name} (IMEI ${line.imei}) is no longer available.`)
        }
      } else {
        if (!product) throw new Error(`${line.name} could not be found.`)
        if (product.stock < line.qty) {
          throw new Error(`Not enough stock for ${line.name} — only ${product.stock} left.`)
        }
      }
      items.push({
        productId: line.productId,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        imei: line.imei,
        lineTotal: line.qty * line.unitPrice,
        costPriceAtSale: product?.costPrice ?? 0,
      })
    }

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
    const total = Math.max(0, subtotal - input.discount)
    const changeGiven = input.amountTendered != null ? Math.max(0, input.amountTendered - total) : null

    const sale: Sale = {
      id: saleId,
      cashierId: input.cashierId,
      items,
      subtotal,
      discount: input.discount,
      total,
      paymentMethod: input.paymentMethod,
      mpesaRef: input.mpesaRef,
      amountTendered: input.amountTendered,
      changeGiven,
      status: 'completed',
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
      createdAt: now,
    }

    await db.sales.add(sale)
    await enqueueSync('sales', 'upsert', sale)

    for (const line of input.lines) {
      const product = await db.products.get(line.productId)
      if (product) {
        const newStock = Math.max(0, product.stock - line.qty)
        await db.products.update(product.id, { stock: newStock })
        await enqueueSync('products', 'upsert', { ...product, stock: newStock })
      }

      if (line.imei) {
        const serial = await db.serials.where('imei').equals(line.imei).first()
        if (serial) {
          await db.serials.update(serial.id, { status: 'sold', soldInSaleId: saleId })
          await enqueueSync('serials', 'upsert', { ...serial, status: 'sold', soldInSaleId: saleId })
        }
      }
    }

    if (input.paymentMethod === 'cash') {
      const entry = { id: newId(), type: 'cash_sale' as const, amount: total, recordedBy: input.cashierId, note: `Sale ${saleId}`, createdAt: now }
      await db.cashDrawerEntries.add(entry)
      await enqueueSync('cashDrawerEntries', 'upsert', entry)
    } else {
      const entry = { id: newId(), type: 'sale' as const, amount: total, ref: input.mpesaRef ?? '', createdAt: now }
      await db.mpesaTillEntries.add(entry)
      await enqueueSync('mpesaTillEntries', 'upsert', entry)
    }

    return sale
  })
}

/** Reverses a completed sale: restores stock/serial availability, posts a
 * matching reversal to whichever till it was paid into, and marks it
 * voided. This is the only correction path for a mis-rung sale — there is
 * no delete, so the original transaction stays visible in History. */
export async function voidSale(sale: Sale, actor: { id: string; name: string }, reason: string) {
  if (sale.status !== 'completed') {
    throw new Error('Only a completed sale can be voided.')
  }
  const now = Date.now()

  await db.transaction('rw', db.tables, async () => {
    for (const item of sale.items) {
      if (item.imei) {
        const serial = await db.serials.where('imei').equals(item.imei).first()
        if (serial && serial.soldInSaleId === sale.id) {
          await db.serials.update(serial.id, { status: 'in_stock', soldInSaleId: null })
          await enqueueSync('serials', 'upsert', { ...serial, status: 'in_stock', soldInSaleId: null })
        }
      }
      // completeSale() decrements product.stock for every line, serialized
      // or not (see the loop there) — so the reversal has to restore it for
      // every line too. Only doing this for the non-serialized branch left
      // a voided serialized sale's stock count permanently short by the
      // voided quantity, even though the serial itself was already back
      // in the "in stock" list.
      const product = await db.products.get(item.productId)
      if (product) {
        const restoredStock = product.stock + item.qty
        await db.products.update(product.id, { stock: restoredStock })
        await enqueueSync('products', 'upsert', { ...product, stock: restoredStock })
      }
    }

    const note = `Void of sale ${sale.id}${reason ? ` — ${reason}` : ''}`
    if (sale.paymentMethod === 'cash') {
      const entry = { id: newId(), type: 'cash_out' as const, amount: sale.total, recordedBy: actor.name, note, createdAt: now }
      await db.cashDrawerEntries.add(entry)
      await enqueueSync('cashDrawerEntries', 'upsert', entry)
    } else {
      // Negative amount: mpesaTillBalance adds non-'expense' entries as-is,
      // so a negative reconciliation_adjustment nets out the voided sale.
      const entry = { id: newId(), type: 'reconciliation_adjustment' as const, amount: -sale.total, ref: sale.mpesaRef ?? '', createdAt: now }
      await db.mpesaTillEntries.add(entry)
      await enqueueSync('mpesaTillEntries', 'upsert', entry)
    }

    const updated: Sale = { ...sale, status: 'voided', voidedAt: now, voidedBy: actor.name, voidReason: reason || null }
    await db.sales.put(updated)
    await enqueueSync('sales', 'upsert', updated)
  })

  await logAudit(
    actor,
    'updated',
    'sale',
    sale.id,
    `Sale ${sale.id.slice(0, 8)}`,
    `Voided a KES ${sale.total.toLocaleString()} sale${reason ? ` — ${reason}` : ''}`,
  )
}
