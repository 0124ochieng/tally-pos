import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input, Label, Select, FieldError } from '../../components/ui/Input'
import { db, newId, type Product } from '../../lib/db'
import { enqueueSync } from '../../lib/sync/outbox'
import { logAudit } from '../../lib/auditLog'
import { diffFields, money, yesNo } from '../../lib/diff'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'

interface ProductFormModalProps {
  product: Product | null
  onClose: () => void
  onSaved?: (productId: string, costPrice: number) => void
}

// The blank-SKU fallback used to pick a random 4-digit suffix with no
// collision check — a 1-in-9000 chance per pair that grows fast with
// catalog size (birthday paradox), silently giving two different products
// the same SKU. Retrying against the existing SKU set closes that gap
// without changing the format anyone's already relying on.
function generateUniqueSku(existingSkus: string[]) {
  const taken = new Set(existingSkus.map((s) => s.toLowerCase()))
  let sku: string
  do {
    sku = `HG-${Math.floor(1000 + Math.random() * 9000)}`
  } while (taken.has(sku.toLowerCase()))
  return sku
}

function getFieldDefs(categoryById: Map<string, string>) {
  const formatCategory = (id: unknown) => categoryById.get(String(id)) ?? String(id)
  return [
    { key: 'name' as const, label: 'Name' },
    { key: 'brand' as const, label: 'Brand' },
    { key: 'description' as const, label: 'Description' },
    { key: 'categoryId' as const, label: 'Category', format: formatCategory },
    { key: 'sellingPrice' as const, label: 'Selling Price', format: money },
    { key: 'costPrice' as const, label: 'Cost Price', format: money },
    { key: 'unit' as const, label: 'Unit' },
    { key: 'stock' as const, label: 'Stock' },
    { key: 'lowStockThreshold' as const, label: 'Low Stock Warning Level' },
    { key: 'isSerialized' as const, label: 'Serialized', format: yesNo },
  ]
}

export function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const { user } = useAuth()
  const { show } = useToast()
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categoryById = new Map(categories.map((c) => [c.id, c.name]))
  const isEdit = Boolean(product)

  const [form, setForm] = useState({
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    sku: product?.sku ?? '',
    sellingPrice: product?.sellingPrice ?? 0,
    costPrice: product?.costPrice ?? 0,
    unit: product?.unit ?? 'pc',
    isSerialized: product?.isSerialized ?? false,
    lowStockThreshold: product?.lowStockThreshold ?? 5,
    // Never directly editable here — see the field below and the create
    // branch of handleSave(). Stock only ever changes through Stock Intake,
    // so every unit received has a matching intake record and expense.
    stock: product?.stock ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Give the product a name'
    if (!form.categoryId) errors.categoryId = 'Pick a category'
    if (form.sellingPrice <= 0) errors.sellingPrice = 'Enter a selling price above 0'
    if (form.costPrice < 0) errors.costPrice = "Cost price can't be less than 0"
    if (form.lowStockThreshold < 0) errors.lowStockThreshold = "This can't be less than 0"
    if (!isEdit) {
      const trimmedSku = form.sku.trim().toLowerCase()
      if (trimmedSku && products.some((p) => p.sku.toLowerCase() === trimmedSku)) {
        errors.sku = 'Another product already uses that SKU'
      }
    }
    return errors
  }

  async function handleSave() {
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      show('Check the highlighted fields below', 'error')
      return
    }
    setFieldErrors({})
    setSaving(true)
    const now = Date.now()

    if (isEdit && product) {
      // Stock is intentionally excluded from this form on edit — it's
      // adjusted only via Stock Intake, which also logs cost/expense history.
      const updated: Product = { ...product, ...form, stock: product.stock, updatedAt: now }
      const changes = diffFields(product, updated, getFieldDefs(categoryById))
      await db.products.put(updated)
      await enqueueSync('products', 'upsert', updated)
      if (changes.length > 0) {
        await logAudit(
          user!, 'updated', 'product', updated.id, updated.name,
          `Updated ${changes.map((c) => c.label).join(', ')} on "${updated.name}"`,
          { changes, snapshotBefore: product, snapshotAfter: updated },
        )
      }
      show('Product updated')
    } else {
      const id = newId()
      const sku = form.sku.trim() || generateUniqueSku(products.map((p) => p.sku))
      const newProduct: Product = {
        id,
        name: form.name,
        brand: form.brand,
        description: form.description,
        categoryId: form.categoryId,
        sku,
        sellingPrice: form.sellingPrice,
        costPrice: form.costPrice,
        unit: form.unit,
        isSerialized: form.isSerialized,
        lowStockThreshold: form.lowStockThreshold,
        // Always starts at 0 — receive it through Stock Intake next, which
        // records the intake history and purchase expense at the same time.
        stock: 0,
        active: true,
        createdAt: now,
        updatedAt: now,
      }
      await db.products.add(newProduct)
      await enqueueSync('products', 'upsert', newProduct)
      await logAudit(user!, 'created', 'product', newProduct.id, newProduct.name, `Added product "${newProduct.name}"`, { snapshotAfter: newProduct })
      show('Product added')
      onSaved?.(newProduct.id, newProduct.costPrice)
    }
    setSaving(false)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'} width="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{isEdit ? 'Save Changes' : 'Add Product'}</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Product Name</Label>
          <Input
            value={form.name}
            invalid={!!fieldErrors.name}
            onChange={(e) => { setForm({ ...form, name: e.target.value }); clearFieldError('name') }}
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </div>
        <div>
          <Label>Brand</Label>
          <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        </div>
        <div>
          <Label>SKU {isEdit ? '' : '(auto if left blank)'}</Label>
          <Input
            value={form.sku}
            disabled={isEdit}
            invalid={!!fieldErrors.sku}
            onChange={(e) => { setForm({ ...form, sku: e.target.value }); clearFieldError('sku') }}
          />
          <FieldError>{fieldErrors.sku}</FieldError>
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <Select
            value={form.categoryId}
            invalid={!!fieldErrors.categoryId}
            onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); clearFieldError('categoryId') }}
          >
            <option value="">Select category…</option>
            {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <FieldError>{fieldErrors.categoryId}</FieldError>
        </div>
        <div>
          <Label>Unit</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div>
          <Label>Selling Price (KES)</Label>
          <Input
            type="number"
            value={form.sellingPrice || ''}
            placeholder="0"
            invalid={!!fieldErrors.sellingPrice}
            onChange={(e) => { setForm({ ...form, sellingPrice: Number(e.target.value) }); clearFieldError('sellingPrice') }}
          />
          <FieldError>{fieldErrors.sellingPrice}</FieldError>
        </div>
        <div>
          <Label>Cost Price (KES)</Label>
          <Input
            type="number"
            min={0}
            value={form.costPrice || ''}
            placeholder="0"
            invalid={!!fieldErrors.costPrice}
            onChange={(e) => { setForm({ ...form, costPrice: Number(e.target.value) }); clearFieldError('costPrice') }}
          />
          <FieldError>{fieldErrors.costPrice}</FieldError>
        </div>
        <div>
          <Label>Stock Quantity</Label>
          <Input type="number" value={form.stock} disabled />
          <p className="mt-1 text-xs text-ink-muted">
            {isEdit
              ? 'Adjust stock from the Stock Intake page.'
              : 'New products start at 0. Add stock next in Stock Intake — that way it always gets logged properly.'}
          </p>
        </div>
        <div>
          <Label>Low Stock Warning Level</Label>
          <Input
            type="number"
            min={0}
            value={form.lowStockThreshold}
            invalid={!!fieldErrors.lowStockThreshold}
            onChange={(e) => { setForm({ ...form, lowStockThreshold: Number(e.target.value) }); clearFieldError('lowStockThreshold') }}
          />
          <FieldError>{fieldErrors.lowStockThreshold}</FieldError>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            id="serialized"
            type="checkbox"
            checked={form.isSerialized}
            onChange={(e) => setForm({ ...form, isSerialized: e.target.checked })}
            className="h-4 w-4 rounded border-border text-gold-500"
          />
          <label htmlFor="serialized" className="text-sm text-ink-secondary">Track by IMEI / serial number (e.g. phones)</label>
        </div>
      </div>
    </Modal>
  )
}
