import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Search, Trash2, Minus, Plus, X } from 'lucide-react'
import { db, type Product } from '../../lib/db'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { getCategoryIcon } from '../../lib/iconMap'
import type { CartLine } from '../../lib/salesService'
import { loadCart, saveCart, clearCart } from '../../lib/cartPersistence'
import { PaymentModal } from './PaymentModal'
import { ImeiPickerModal } from './ImeiPickerModal'

const CATEGORY_TINTS = [
  'bg-gold-100 text-gold-700',
  'bg-cyan-100 text-cyan-700',
  'bg-coral-100 text-coral-700',
]

export function SellPage() {
  const { user } = useAuth()
  const { show } = useToast()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>(() => loadCart())
  const [payOpen, setPayOpen] = useState(false)
  const [imeiProduct, setImeiProduct] = useState<Product | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // Resume an interrupted sale (sign-out, inactivity timeout, Switch to
  // Admin) rather than silently discarding items already on the counter.
  useEffect(() => {
    if (cart.length > 0) {
      show(`Resumed previous sale — ${cart.length} item${cart.length === 1 ? '' : 's'} restored`, 'info')
    }
    // Only on mount: this greets a resumed session once, not on every cart edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveCart(cart)
  }, [cart])

  const categoriesRaw = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categories = [...categoriesRaw].sort((a, b) => a.name.localeCompare(b.name))
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const serials = useLiveQuery(() => db.serials.where('status').equals('in_stock').toArray(), []) ?? []

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>()
    activeProducts.forEach((p) => map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1))
    return map
  }, [activeProducts])

  const searching = search.trim().length > 0

  const visibleProducts = useMemo(() => {
    if (searching) {
      const q = search.toLowerCase()
      return activeProducts.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }
    if (categoryId) return activeProducts.filter((p) => p.categoryId === categoryId)
    return []
  }, [activeProducts, search, categoryId, searching])

  const selectedCategory = categories.find((c) => c.id === categoryId)

  function addToCart(product: Product, imei: string | null = null) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id && l.imei === imei)
      if (existing && !product.isSerialized) {
        return prev.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { productId: product.id, name: product.name, qty: 1, unitPrice: product.sellingPrice, imei }]
    })
  }

  function handleProductClick(product: Product) {
    if (product.stock <= 0) return
    if (product.isSerialized) {
      setImeiProduct(product)
      return
    }
    const inCart = cart.filter((l) => l.productId === product.id).reduce((s, l) => s + l.qty, 0)
    if (inCart >= product.stock) return
    addToCart(product)
  }

  function updateQty(index: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l, i) => {
          if (i !== index) return l
          const product = products.find((p) => p.id === l.productId)
          const available = product?.stock ?? 0
          return { ...l, qty: Math.min(available, Math.max(1, l.qty + delta)) }
        })
        .filter((l) => l.qty > 0),
    )
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  function handleClearCart() {
    setCart([])
    clearCart()
    setConfirmClear(false)
  }

  const subtotal = cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)

  return (
    <div className="flex h-full gap-6">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          {categoryId && !searching && (
            <button
              onClick={() => setCategoryId(null)}
              aria-label="Back to categories"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-secondary transition-colors hover:bg-surface-alt"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <Input
              placeholder="Search or scan a barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                // Barcode scanners type the SKU then send Enter — add the
                // single matching product straight to the cart, no click needed.
                if (visibleProducts.length === 1) {
                  handleProductClick(visibleProducts[0])
                  setSearch('')
                }
              }}
              className="pl-9"
              autoFocus
            />
          </div>
          {selectedCategory && !searching && (
            <p className="text-sm font-medium text-ink-secondary">{selectedCategory.name}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {!searching && !categoryId && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {categories.map((c, i) => {
                const Icon = getCategoryIcon(c.icon)
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-gold-300"
                  >
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]}`}>
                      <Icon size={20} />
                    </span>
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    <span className="text-xs text-ink-muted">{productCountByCategory.get(c.id) ?? 0} items</span>
                  </button>
                )
              })}
              {categories.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-ink-muted">
                  No categories yet — add one from Inventory.
                </p>
              )}
            </div>
          )}

          {(searching || categoryId) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((p) => {
                const inCartQty = cart.filter((l) => l.productId === p.id).reduce((s, l) => s + l.qty, 0)
                const soldOut = p.stock <= 0 || (!p.isSerialized && inCartQty >= p.stock)
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    disabled={soldOut}
                    className="flex flex-col items-start rounded-2xl border border-border bg-surface p-3 text-left transition-colors hover:border-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-xs text-ink-muted">{p.brand}</span>
                    <span className="mt-0.5 line-clamp-2 text-sm font-medium text-ink">{p.name}</span>
                    <span className="mt-2 text-sm font-bold text-ink">KES {p.sellingPrice.toLocaleString()}</span>
                    <Badge tone={p.stock <= p.lowStockThreshold ? 'coral' : 'neutral'} className="mt-2">
                      {p.stock} in stock
                    </Badge>
                  </button>
                )
              })}
              {visibleProducts.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-ink-muted">No products found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-full w-96 shrink-0 flex-col rounded-2xl border border-border bg-surface transition-colors">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Current Sale</h2>
            <p className="text-xs text-ink-muted">{cart.length} item{cart.length === 1 ? '' : 's'}</p>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-coral-100 hover:text-coral-600"
            >
              <X size={13} /> Clear cart
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 && <p className="mt-8 text-center text-sm text-ink-muted">Cart is empty</p>}
          {cart.map((line, i) => (
            <div key={i} className="mb-3 flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                {line.imei && <p className="text-xs text-ink-muted">IMEI: {line.imei}</p>}
                <p className="text-xs text-ink-muted">KES {line.unitPrice.toLocaleString()} each</p>
              </div>
              <div className="flex items-center gap-2">
                {!line.imei && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(i, -1)} aria-label={`Decrease quantity of ${line.name}`} className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-alt text-ink"><Minus size={14} /></button>
                    <span className="w-5 text-center text-sm text-ink">{line.qty}</span>
                    <button onClick={() => updateQty(i, 1)} aria-label={`Increase quantity of ${line.name}`} className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-alt text-ink"><Plus size={14} /></button>
                  </div>
                )}
                <button onClick={() => removeLine(i)} aria-label={`Remove ${line.name} from cart`} className="flex h-9 w-9 items-center justify-center text-coral-500 hover:text-coral-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-ink-secondary">Total</span>
            <span className="text-lg font-bold text-ink">KES {subtotal.toLocaleString()}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setPayOpen(true)}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gold-400 text-base font-bold text-neutral-900 shadow-sm shadow-gold-400/30 transition-colors hover:bg-gold-500 disabled:cursor-not-allowed disabled:bg-gold-200"
          >
            Charge KES {subtotal.toLocaleString()}
          </button>
        </div>
      </div>

      {imeiProduct && (
        <ImeiPickerModal
          product={imeiProduct}
          serials={serials.filter((s) => s.productId === imeiProduct.id && !cart.some((l) => l.imei === s.imei))}
          onClose={() => setImeiProduct(null)}
          onSelect={(imei) => {
            addToCart(imeiProduct, imei)
            setImeiProduct(null)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear the cart?"
        message="This removes every item from the cart. You can't undo this."
        confirmLabel="Clear cart"
        destructive
        onConfirm={handleClearCart}
        onCancel={() => setConfirmClear(false)}
      />

      {payOpen && (
        <PaymentModal
          subtotal={subtotal}
          cashierId={user!.id}
          lines={cart}
          onClose={() => setPayOpen(false)}
          onComplete={() => {
            setCart([])
            clearCart()
            setPayOpen(false)
          }}
        />
      )}
    </div>
  )
}
