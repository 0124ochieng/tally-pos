import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PlusCircle, Pencil, Trash2, PackagePlus, HandCoins, RotateCcw, Receipt as ReceiptIcon, Ban } from 'lucide-react'
import { db, type AuditLogEntry, type FieldChange, type Sale } from '../../lib/db'
import { restoreFromAudit } from '../../lib/auditLog'
import { voidSale } from '../../lib/salesService'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useDataChangedTick } from '../../lib/events'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'

type Filter = 'all' | 'category' | 'product' | 'stock' | 'expense' | 'sale'

interface FeedItem {
  id: string
  type: 'category' | 'product' | 'stock' | 'expense' | 'sale'
  icon: typeof PlusCircle
  tone: 'gold' | 'cyan' | 'coral'
  actorName: string
  summary: string
  changes?: FieldChange[]
  auditEntry?: AuditLogEntry
  sale?: Sale
  createdAt: number
}

export function HistoryPage() {
  useDataChangedTick()
  const { user } = useAuth()
  const { show } = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [restoring, setRestoring] = useState<AuditLogEntry | null>(null)
  const [voiding, setVoiding] = useState<Sale | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)

  const auditLog = useLiveQuery(() => db.auditLog.toArray(), []) ?? []
  const stockIntakes = useLiveQuery(() => db.stockIntakes.toArray(), []) ?? []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const expenseCategories = useLiveQuery(() => db.expenseCategories.toArray(), []) ?? []
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const expenseCategoryById = useMemo(() => new Map(expenseCategories.map((c) => [c.id, c.name])), [expenseCategories])

  const feed = useMemo<FeedItem[]>(() => {
    const auditItems: FeedItem[] = auditLog.map((a) => ({
      id: a.id,
      type: a.entityType === 'expenseCategory' ? 'expense' : a.entityType,
      icon: a.action === 'created' ? PlusCircle : a.action === 'deleted' ? Trash2 : Pencil,
      tone: a.action === 'created' ? 'gold' : a.action === 'deleted' ? 'coral' : 'cyan',
      actorName: a.actorName,
      summary: a.summary,
      changes: a.changes,
      auditEntry: a,
      createdAt: a.createdAt,
    }))
    const stockItems: FeedItem[] = stockIntakes.map((s) => ({
      id: s.id,
      type: 'stock',
      icon: PackagePlus,
      tone: 'gold',
      actorName: s.receivedBy,
      summary: `Received ${s.quantity} x ${productsById.get(s.productId)?.name ?? 'product'} @ KES ${s.costPrice.toLocaleString()} (${s.paidVia ?? 'unspecified'})`,
      createdAt: s.receivedAt,
    }))
    const expenseItems: FeedItem[] = expenses
      .filter((e) => e.source === 'manual')
      .map((e) => ({
        id: e.id,
        type: 'expense',
        icon: HandCoins,
        tone: 'coral',
        actorName: e.recordedBy,
        summary: `${expenseCategoryById.get(e.categoryId) ?? 'Expense'}: ${e.description} — KES ${e.amount.toLocaleString()} (${e.paidVia ?? 'unspecified'})`,
        createdAt: e.createdAt,
      }))
    const saleItems: FeedItem[] = sales.map((s) => ({
      id: s.id,
      type: 'sale',
      icon: s.status === 'voided' ? Ban : ReceiptIcon,
      tone: s.status === 'voided' ? 'coral' : 'gold',
      actorName: s.status === 'voided' ? (s.voidedBy ?? 'Admin') : 'Cashier',
      summary:
        s.status === 'voided'
          ? `Voided sale — KES ${s.total.toLocaleString()}${s.voidReason ? ` (${s.voidReason})` : ''}`
          : `Sale — ${s.items.length} item${s.items.length === 1 ? '' : 's'}, KES ${s.total.toLocaleString()} (${s.paymentMethod})`,
      sale: s,
      createdAt: s.status === 'voided' ? (s.voidedAt ?? s.createdAt) : s.createdAt,
    }))
    return [...auditItems, ...stockItems, ...expenseItems, ...saleItems].sort((a, b) => b.createdAt - a.createdAt)
  }, [auditLog, stockIntakes, expenses, sales, productsById, expenseCategoryById])

  const filtered = filter === 'all' ? feed : feed.filter((f) => f.type === filter)

  async function handleRestore() {
    if (!restoring) return
    await restoreFromAudit(restoring, user!)
    show('Restored successfully')
    setRestoring(null)
  }

  async function handleVoid() {
    if (!voiding || !user) return
    setVoidBusy(true)
    try {
      await voidSale(voiding, user, voidReason.trim())
      show('Sale voided')
      setVoiding(null)
      setVoidReason('')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not void sale', 'error')
    } finally {
      setVoidBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">History</h1>

      <div className="flex flex-wrap gap-2">
        {(['all', 'sale', 'category', 'product', 'stock', 'expense'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-gold-400 text-neutral-900' : 'bg-surface-alt text-ink-secondary hover:bg-border'
            }`}
          >
            {f === 'stock' ? 'Stock Intake' : f}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Activity Feed</CardTitle></CardHeader>
        <CardBody>
          <div className="space-y-1">
            {filtered.map((item) => {
              const canRestore = Boolean(
                item.auditEntry &&
                (item.auditEntry.action === 'deleted' || item.auditEntry.action === 'updated') &&
                item.auditEntry.snapshotBefore &&
                !item.auditEntry.restored,
              )
              const canVoid = Boolean(item.sale && item.sale.status === 'completed' && user?.role === 'admin')

              return (
                <div key={item.id} className="flex items-start gap-3 border-b border-border py-3 last:border-0">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    item.tone === 'gold' ? 'bg-gold-100 text-gold-700' : item.tone === 'cyan' ? 'bg-cyan-100 text-cyan-700' : 'bg-coral-100 text-coral-700'
                  }`}>
                    <item.icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{item.summary}</p>
                    {item.changes && item.changes.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 rounded-lg bg-surface-alt px-3 py-2 text-xs text-ink-secondary">
                        {item.changes.map((c) => (
                          <li key={c.field}>
                            <span className="font-medium text-ink">{c.label}:</span>{' '}
                            <span className="text-coral-600 dark:text-coral-400 line-through">{c.before}</span>{' '}
                            <span className="text-ink-muted">→</span>{' '}
                            <span className="text-gold-700 dark:text-gold-400">{c.after}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-xs text-ink-muted">
                      {item.actorName} · {new Date(item.createdAt).toLocaleString()}
                      {item.auditEntry?.restored && <span className="ml-2 text-cyan-600 dark:text-cyan-400">· Restored since</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral" className="capitalize">{item.type}</Badge>
                    {canRestore && (
                      <button
                        onClick={() => setRestoring(item.auditEntry!)}
                        className="flex items-center gap-1 rounded-lg bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                    )}
                    {canVoid && (
                      <button
                        onClick={() => { setVoiding(item.sale!); setVoidReason('') }}
                        className="flex items-center gap-1 rounded-lg bg-coral-100 px-2.5 py-1 text-xs font-semibold text-coral-800 hover:bg-coral-200 dark:bg-coral-900/30 dark:text-coral-300"
                      >
                        <Ban size={12} /> Void
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-ink-muted">No activity recorded yet.</p>}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={restoring !== null}
        title="Restore Version"
        message={`Restore "${restoring?.entityName}" to its state from ${restoring ? new Date(restoring.createdAt).toLocaleString() : ''}?`}
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setRestoring(null)}
      />

      {voiding && (
        <Modal open onClose={() => setVoiding(null)} title="Void Sale" width="sm" footer={
          <>
            <Button variant="secondary" onClick={() => setVoiding(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidBusy}>{voidBusy ? 'Voiding…' : 'Void Sale'}</Button>
          </>
        }>
          <p className="text-sm text-ink-secondary">
            This reverses the sale: restocks the {voiding.items.length} item{voiding.items.length === 1 ? '' : 's'} sold and removes
            KES {voiding.total.toLocaleString()} from the {voiding.paymentMethod === 'cash' ? 'cash drawer' : 'M-Pesa till'}. This cannot be undone.
          </p>
          <div className="mt-4">
            <Label>Reason (optional, recommended)</Label>
            <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Rung up wrong item" />
          </div>
        </Modal>
      )}
    </div>
  )
}
