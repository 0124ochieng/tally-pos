import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import { db, newId, type ExpenseCategory } from '../../lib/db'
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

export function ExpenseCategoryManager() {
  const { user } = useAuth()
  const { show } = useToast()
  const { triggerUndo } = useUndo()
  const categoriesRaw = useLiveQuery(() => db.expenseCategories.toArray(), []) ?? []
  const categories = [...categoriesRaw].sort((a, b) => a.name.localeCompare(b.name))
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []

  const [editing, setEditing] = useState<ExpenseCategory | null | 'new'>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(CATEGORY_ICON_OPTIONS[0])
  const [confirming, setConfirming] = useState<ExpenseCategory | null>(null)

  function openNew() {
    setName('')
    setIcon(CATEGORY_ICON_OPTIONS[0])
    setEditing('new')
  }

  function openEdit(c: ExpenseCategory) {
    setName(c.name)
    setIcon(c.icon)
    setEditing(c)
  }

  async function handleSave() {
    if (!name.trim()) {
      show('Category name is required', 'error')
      return
    }
    const now = Date.now()
    if (editing === 'new') {
      const category: ExpenseCategory = { id: newId(), name: name.trim(), icon, protected: false, createdAt: now, updatedAt: now }
      await db.expenseCategories.add(category)
      await enqueueSync('expenseCategories', 'upsert', category)
      await logAudit(user!, 'created', 'expenseCategory', category.id, category.name, `Created expense category "${category.name}"`, { snapshotAfter: category })
      show('Expense category added')
    } else if (editing) {
      const updated: ExpenseCategory = { ...editing, name: name.trim(), icon, updatedAt: now }
      const changes = diffFields(editing, updated, [
        { key: 'name', label: 'Name' },
        { key: 'icon', label: 'Icon' },
      ])
      await db.expenseCategories.put(updated)
      await enqueueSync('expenseCategories', 'upsert', updated)
      if (changes.length) {
        await logAudit(user!, 'updated', 'expenseCategory', updated.id, updated.name, `Updated expense category "${editing.name}"`, { changes, snapshotBefore: editing, snapshotAfter: updated })
      }
      show('Expense category updated')
    }
    setEditing(null)
  }

  function handleDelete(c: ExpenseCategory) {
    if (c.protected) {
      show(`"${c.name}" is a built-in category and can't be deleted`, 'error')
      return
    }
    const count = expenses.filter((e) => e.categoryId === c.id).length
    if (count > 0) {
      show(`${count} expense(s) use "${c.name}" — reassign or remove them first`, 'error')
      return
    }
    setConfirming(c)
  }

  async function confirmDelete() {
    const c = confirming!
    setConfirming(null)
    await db.expenseCategories.delete(c.id)
    await enqueueSync('expenseCategories', 'delete', { id: c.id })
    const entry = await logAudit(user!, 'deleted', 'expenseCategory', c.id, c.name, `Deleted expense category "${c.name}"`, { snapshotBefore: c })
    show('Expense category deleted')

    triggerUndo(`"${c.name}" removed`, async () => {
      await db.expenseCategories.put(c)
      await enqueueSync('expenseCategories', 'upsert', c)
      await discardAudit(entry.id)
      show('Expense category restored')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Categories</CardTitle>
        <Button size="sm" onClick={openNew}><Plus size={14} /> Add Category</Button>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.icon)
            const count = expenses.filter((e) => e.categoryId === c.id).length
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700"><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">{count} entries</p>
                </div>
                {c.protected ? (
                  <span className="text-ink-muted" title="Built-in category" aria-label="Built-in category"><Lock size={14} /></span>
                ) : (
                  <>
                    <button onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`} className="text-ink-muted hover:text-ink"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(c)} aria-label={`Remove ${c.name}`} className="text-ink-muted hover:text-coral-500"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            )
          })}
          {categories.length === 0 && <p className="col-span-full py-4 text-center text-sm text-ink-muted">No expense categories yet.</p>}
        </div>
      </CardBody>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Add Expense Category' : 'Edit Expense Category'}
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
        title="Remove Expense Category"
        message={`Remove "${confirming?.name}"? You can undo this for a few seconds after removing.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  )
}
