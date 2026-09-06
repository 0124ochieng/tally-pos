import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type PaidVia } from '../../lib/db'
import { enqueueSync } from '../../lib/sync/outbox'
import { recordExpense } from '../../lib/expenseService'
import { INVENTORY_EXPENSE_CATEGORY_ID } from '../../lib/seedDb'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label, Select } from '../../components/ui/Input'
import { ProductFormModal } from './ProductFormModal'

const NEW_PRODUCT_VALUE = '__new__'

export function StockIntakePage() {
  const { user } = useAuth()
  const { show } = useToast()

  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const intakes = useLiveQuery(() => db.stockIntakes.orderBy('receivedAt').reverse().limit(15).toArray(), []) ?? []

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [costPrice, setCostPrice] = useState(0)
  const [paidVia, setPaidVia] = useState<PaidVia>('credit')
  const [note, setNote] = useState('')
  const [imeis, setImeis] = useState('')
  const [showAddProduct, setShowAddProduct] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const productsByCategory = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name))
    return sortedCategories.map((c) => ({
      category: c,
      products: products.filter((p) => p.active && p.categoryId === c.id).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.products.length > 0)
  }, [categories, products])

  function handleProductSelect(value: string) {
    if (value === NEW_PRODUCT_VALUE) {
      setShowAddProduct(true)
      return
    }
    setProductId(value)
    const p = productsById.get(value)
    if (p) setCostPrice(p.costPrice)
  }

  async function handleSubmit() {
    if (!selectedProduct || quantity <= 0) {
      show('Select a product and a valid quantity', 'error')
      return
    }
    if (selectedProduct.isSerialized) {
      const list = imeis.split('\n').map((s) => s.trim()).filter(Boolean)
      if (list.length !== quantity) {
        show(`Enter exactly ${quantity} IMEI number(s), one per line`, 'error')
        return
      }
    }

    const now = Date.now()
    const totalCost = quantity * costPrice
    const intake = { id: newId(), productId, quantity, costPrice, paidVia, receivedAt: now, receivedBy: user!.name, note }
    await db.stockIntakes.add(intake)
    await enqueueSync('stockIntakes', 'upsert', intake)

    const newStock = selectedProduct.stock + quantity
    const updated = { ...selectedProduct, stock: newStock, ...(costPrice > 0 ? { costPrice } : {}), updatedAt: now }
    await db.products.put(updated)
    await enqueueSync('products', 'upsert', updated)

    if (selectedProduct.isSerialized) {
      const list = imeis.split('\n').map((s) => s.trim()).filter(Boolean)
      for (const imei of list) {
        const serial = { id: newId(), productId, imei, status: 'in_stock' as const, soldInSaleId: null, createdAt: now }
        await db.serials.add(serial)
        await enqueueSync('serials', 'upsert', serial)
      }
    }

    if (totalCost > 0) {
      await recordExpense({
        categoryId: INVENTORY_EXPENSE_CATEGORY_ID,
        amount: totalCost,
        description: `Stock intake: ${quantity} x ${selectedProduct.name}${note ? ` (${note})` : ''}`,
        paidVia,
        source: 'stock_intake',
        relatedStockIntakeId: intake.id,
        recordedBy: user!.name,
      })
    }

    show('Stock intake recorded')
    setQuantity(1)
    setNote('')
    setImeis('')
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Record New Stock</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label>Product</Label>
            <Select value={productId} onChange={(e) => handleProductSelect(e.target.value)}>
              <option value="">Select product…</option>
              <option value={NEW_PRODUCT_VALUE}>+ Add New Product…</option>
              {productsByCategory.map((g) => (
                <optgroup key={g.category.id} label={g.category.name}>
                  {g.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div>
            <Label>Cost Price (KES, per unit)</Label>
            <Input type="number" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value))} />
          </div>
          <div>
            <Label>Paid Via</Label>
            <Select value={paidVia} onChange={(e) => setPaidVia(e.target.value as PaidVia)}>
              <option value="credit">Credit / Not Yet Paid</option>
              <option value="cash">Cash (deducts from drawer)</option>
              <option value="mpesa">M-Pesa (deducts from till)</option>
            </Select>
            {quantity > 0 && costPrice > 0 && (
              <p className="mt-1 text-xs text-ink-muted">
                Logs an expense of KES {(quantity * costPrice).toLocaleString()} under Inventory Purchases.
              </p>
            )}
          </div>
          {selectedProduct?.isSerialized && (
            <div>
              <Label>IMEI numbers (one per line, {quantity} required)</Label>
              <textarea
                value={imeis}
                onChange={(e) => setImeis(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30"
              />
            </div>
          )}
          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier invoice #..." />
          </div>
          <Button className="w-full" onClick={handleSubmit}>Add to Stock</Button>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Recent Intakes</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Cost/Unit</th>
                <th className="py-2">Paid Via</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {intakes.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 text-ink-muted">{new Date(i.receivedAt).toLocaleDateString()}</td>
                  <td className="py-2 text-ink">{productsById.get(i.productId)?.name ?? '—'}</td>
                  <td className="py-2 text-right text-ink-secondary">{i.quantity}</td>
                  <td className="py-2 text-right text-ink-secondary">KES {i.costPrice.toLocaleString()}</td>
                  <td className="py-2 capitalize text-ink-secondary">{i.paidVia ?? 'unspecified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {intakes.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No stock intakes recorded yet.</p>}
        </CardBody>
      </Card>

      {showAddProduct && (
        <ProductFormModal
          product={null}
          onClose={() => setShowAddProduct(false)}
          onSaved={(newProductId, newCostPrice) => {
            setProductId(newProductId)
            setCostPrice(newCostPrice)
          }}
        />
      )}
    </div>
  )
}
