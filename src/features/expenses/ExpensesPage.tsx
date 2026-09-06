import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PaidVia } from '../../lib/db'
import { recordExpense } from '../../lib/expenseService'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useDataChangedTick } from '../../lib/events'
import { startOfDay, startOfMonth, startOfYear, sumExpenses } from '../../lib/reportsService'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { StatTile } from '../../components/ui/StatTile'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input, Label, Select } from '../../components/ui/Input'
import { ExpenseCategoryManager } from './ExpenseCategoryManager'

const PAID_VIA_LABEL: Record<PaidVia, string> = { cash: 'Cash', mpesa: 'M-Pesa', credit: 'Credit' }

export function ExpensesPage() {
  useDataChangedTick()
  const { user } = useAuth()
  const { show } = useToast()

  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.expenseCategories.toArray(), []) ?? []
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [paidVia, setPaidVia] = useState<PaidVia>('cash')

  const sorted = useMemo(() => [...expenses].sort((a, b) => b.createdAt - a.createdAt), [expenses])
  const today = sorted.filter((e) => e.createdAt >= startOfDay())
  const month = sorted.filter((e) => e.createdAt >= startOfMonth())
  const year = sorted.filter((e) => e.createdAt >= startOfYear())

  async function handleSubmit() {
    if (!categoryId || amount <= 0 || !description.trim()) {
      show('Pick a category, and fill in the amount and description', 'error')
      return
    }
    await recordExpense({
      categoryId,
      amount,
      description: description.trim(),
      paidVia,
      source: 'manual',
      relatedStockIntakeId: null,
      recordedBy: user!.name,
    })
    show('Expense recorded')
    setAmount(0)
    setDescription('')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Expenses</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Today" value={`KES ${sumExpenses(today).toLocaleString()}`} tone="coral" />
        <StatTile label="This Month" value={`KES ${sumExpenses(month).toLocaleString()}`} tone="coral" />
        <StatTile label="This Year" value={`KES ${sumExpenses(year).toLocaleString()}`} tone="coral" />
        <StatTile label="Total Entries" value={String(expenses.length)} />
      </div>

      <ExpenseCategoryManager />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Record Expense</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category…</option>
                {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount || ''} placeholder="0" onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lunch for staff" />
            </div>
            <div>
              <Label>How Was It Paid?</Label>
              <Select value={paidVia} onChange={(e) => setPaidVia(e.target.value as PaidVia)}>
                <option value="cash">Cash (comes out of the drawer)</option>
                <option value="mpesa">M-Pesa (comes out of the till)</option>
                <option value="credit">On Credit (Not Paid Yet)</option>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSubmit}>Record Expense</Button>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Expenses</CardTitle></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">How Paid</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.slice(0, 50).map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-ink-muted">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="py-2 text-ink">
                      {e.description}
                      {e.source === 'stock_intake' && <Badge tone="gold" className="ml-2">Stock Intake</Badge>}
                    </td>
                    <td className="py-2 text-ink-secondary">{categoryById.get(e.categoryId) ?? '—'}</td>
                    <td className="py-2 text-ink-secondary">{PAID_VIA_LABEL[e.paidVia]}</td>
                    <td className="py-2 text-right font-medium text-ink">KES {e.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No expenses yet.</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
