import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { db, newId, type Category } from '../../lib/db'
import { enqueueSync } from '../../lib/sync/outbox'
import { logAudit, discardAudit } from '../../lib/auditLog'
import { diffFields } from '../../lib/diff'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useUndo } from '../../components/ui/UndoBar'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Input, Label, Select } from '../../components/ui/Input'
import { CATEGORY_ICON_OPTIONS, getCategoryIcon } from '../../lib/iconMap'

const FIELD_DEFS = [
  { key: 'name' as const, label: 'Name' },
  { key: 'icon' as const, label: 'Icon' },
]

export function CategoryManager() {
  const { user } = useAuth()
  const { show } = useToast()
  const { triggerUndo } = useUndo()
  const categoriesRaw = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categories = [...categoriesRaw].sort((a, b) => a.name.localeCompare(b.name))
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []

  const [editing, setEditing] = useState<Category | null | 'new'>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(CATEGORY_ICON_OPTIONS[0])
  const [confirming, setConfirming] = useState<Category | null>(null)

  function openNew() {
    setName('')
    setIcon(CATEGORY_ICON_OPTIONS[0])
    setEditing('new')
  }

  function openEdit(c: Category) {
    setName(c.name)
    setIcon(c.icon)
    setEditing(c)
  }

  async function handleSave() {
    if (!name.trim()) {
      show('Type in a category name', 'error')
      return
    }
    const now = Date.now()
    if (editing === 'new') {
      const category: Category = { id: newId(), name: name.trim(), icon, createdAt: now, updatedAt: now }
      await db.categories.add(category)
      await enqueueSync('categories', 'upsert', category)
      await logAudit(user!, 'created', 'category', category.id, category.name, `Created category "${category.name}"`, { snapshotAfter: category })
      show('Category added')
    } else if (editing) {
      const updated: Category = { ...editing, name: name.trim(), icon, updatedAt: now }
      const changes = diffFields(editing, updated, FIELD_DEFS)
      await db.categories.put(updated)
      await enqueueSync('categories', 'upsert', updated)
      if (changes.length > 0) {
        await logAudit(user!, 'updated', 'category', updated.id, updated.name, `Updated ${changes.map((c) => c.label).join(', ')} on "${editing.name}"`, { changes, snapshotBefore: editing, snapshotAfter: updated })
      }
      show('Category updated')
    }
    setEditing(null)
  }

  async function handleDelete(c: Category) {
    const productCount = products.filter((p) => p.categoryId === c.id && p.active).length
    if (productCount > 0) {
      show(`Move or remove the ${productCount} product(s) in "${c.name}" first`, 'error')
      return
    }
    setConfirming(c)
  }

  async function confirmDelete() {
    const c = confirming!
    setConfirming(null)
    await db.categories.delete(c.id)
    await enqueueSync('categories', 'delete', { id: c.id })
    const entry = await logAudit(user!, 'deleted', 'category', c.id, c.name, `Deleted category "${c.name}"`, { snapshotBefore: c })
    show('Category deleted')

    triggerUndo(`"${c.name}" removed`, async () => {
      await db.categories.put(c)
      await enqueueSync('categories', 'upsert', c)
      await discardAudit(entry.id)
      show('Category restored')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <Button size="sm" onClick={openNew}><Plus size={14} /> Add Category</Button>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.icon)
            const count = products.filter((p) => p.categoryId === c.id && p.active).length
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-700"><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">{count} items</p>
                </div>
                <button onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`} className="text-ink-muted hover:text-ink"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(c)} aria-label={`Remove ${c.name}`} className="text-ink-muted hover:text-coral-500"><Trash2 size={14} /></button>
              </div>
            )
          })}
          {categories.length === 0 && <p className="col-span-full py-4 text-center text-sm text-ink-muted">No categories yet.</p>}
        </div>
      </CardBody>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Add Category' : 'Edit Category'}
          width="sm"
          footer={<>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </>}
        >
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Icon</Label>
              <Select value={icon} onChange={(e) => setIcon(e.target.value)}>
                {CATEGORY_ICON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Remove Category"
        message={`Remove "${confirming?.name}"? You'll have a few seconds to undo it right after.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  )
}
