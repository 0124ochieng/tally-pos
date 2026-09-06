import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Product } from '../../lib/db'
import { enqueueSync } from '../../lib/sync/outbox'
import { logAudit, discardAudit } from '../../lib/auditLog'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useUndo } from '../../components/ui/UndoBar'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CategoryManager } from './CategoryManager'
import { ProductFormModal } from './ProductFormModal'

export function InventoryPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const { triggerUndo } = useUndo()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('All')
  const [editing, setEditing] = useState<Product | null | 'new'>(null)
  const [confirming, setConfirming] = useState<Product | null>(null)

  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        if (!p.active) return false
        if (categoryId !== 'All' && p.categoryId !== categoryId) return false
        if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        const catCompare = (categoryById.get(a.categoryId) ?? '').localeCompare(categoryById.get(b.categoryId) ?? '')
        return catCompare !== 0 ? catCompare : a.name.localeCompare(b.name)
      })
  }, [products, categoryId, search, categoryById])

  async function confirmRemove() {
    const p = confirming!
    setConfirming(null)
    const updated = { ...p, active: false, updatedAt: Date.now() }
    await db.products.put(updated)
    await enqueueSync('products', 'upsert', updated)
    const entry = await logAudit(user!, 'deleted', 'product', p.id, p.name, `Removed product "${p.name}"`, { snapshotBefore: p })
    show('Product removed')

    triggerUndo(`"${p.name}" removed`, async () => {
      await db.products.put(p)
      await enqueueSync('products', 'upsert', p)
      await discardAudit(entry.id)
      show('Product restored')
    })
  }

  return (
    <div className="space-y-6">
      <CategoryManager />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">Products</h1>
        <Button data-tour="inventory-add" onClick={() => setEditing('new')}>Add Product</Button>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Search by name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="max-w-xs">
          <option value="All">All categories</option>
          {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Selling Price</th>
              <th className="px-4 py-3 text-right">Cost Price</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-surface-alt">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-muted">{p.brand}</p>
                </td>
                <td className="px-4 py-3 text-ink-secondary">{categoryById.get(p.categoryId) ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Badge tone={p.stock <= p.lowStockThreshold ? 'coral' : 'neutral'}>{p.stock}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-ink">KES {p.sellingPrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-ink-secondary">KES {p.costPrice.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">{p.sku}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)} className="text-xs font-medium text-gold-700 hover:underline">Edit</button>
                  <button onClick={() => setConfirming(p)} className="ml-3 text-xs font-medium text-coral-500 hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-ink-muted">No products match your filters.</p>}
      </div>

      {editing && (
        <ProductFormModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(newProductId) => {
            navigate('/stock-intake', { state: { preselectProductId: newProductId } })
          }}
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Remove Product"
        message={`Remove "${confirming?.name}"? You'll have a few seconds to undo it right after.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
