import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Sale } from '../../lib/db'
import { startOfDay, startOfMonth } from '../../lib/reportsService'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Input'
import { Receipt } from './Receipt'

type RangeFilter = 'today' | 'week' | 'month' | 'all'

function startOfWeek() {
  const d = new Date()
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1 // treat Monday as the first day of the week
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff).getTime()
}

/** Every sale, from every staff/admin account, in one place — with a
 * clear "Sold By" label on each. This is the admin-side counterpart to
 * "My Sales": a cashier only ever sees their own transactions there, but
 * an owner needs to see everyone's, and know exactly who rang up what. */
export function AllSalesPage() {
  const [viewing, setViewing] = useState<Sale | null>(null)
  const [range, setRange] = useState<RangeFilter>('today')
  const [cashierFilter, setCashierFilter] = useState('all')

  const salesRaw = useLiveQuery(() => db.sales.orderBy('createdAt').reverse().toArray(), []) ?? []
  const users = useLiveQuery(() => db.users.toArray(), []) ?? []
  const nameByCashierId = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])

  const rangeStart = range === 'today' ? startOfDay() : range === 'week' ? startOfWeek() : range === 'month' ? startOfMonth() : 0
  const sales = useMemo(() => salesRaw.filter((s) => s.createdAt >= rangeStart), [salesRaw, rangeStart])

  const cashiersInRange = useMemo(() => {
    const ids = new Set(sales.map((s) => s.cashierId))
    return [...ids].map((id) => ({ id, name: nameByCashierId.get(id) ?? 'Removed staff' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [sales, nameByCashierId])

  const filtered = cashierFilter === 'all' ? sales : sales.filter((s) => s.cashierId === cashierFilter)
  const completed = filtered.filter((s) => s.status === 'completed')
  const total = completed.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">Sales</h1>
        <p className="text-sm text-ink-secondary">{completed.length} sale{completed.length === 1 ? '' : 's'} · KES {total.toLocaleString()}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={range} onChange={(e) => setRange(e.target.value as RangeFilter)} className="max-w-[10rem]">
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </Select>
        <Select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)} className="max-w-[12rem]">
          <option value="all">Everyone</option>
          {cashiersInRange.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">Sold By</th>
                <th className="py-2">Items</th>
                <th className="py-2">Payment</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pl-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-ink-secondary">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="py-2 font-medium text-ink">{nameByCashierId.get(s.cashierId) ?? 'Removed staff'}</td>
                  <td className="py-2 text-ink-secondary">{s.items.length}</td>
                  <td className="py-2 capitalize text-ink-secondary">{s.paymentMethod}</td>
                  <td className="py-2 pr-4 text-right font-medium text-ink">KES {s.total.toLocaleString()}</td>
                  <td className="py-2 pl-4">
                    <Badge tone={s.status === 'voided' ? 'coral' : 'gold'}>{s.status === 'voided' ? 'Voided' : 'Completed'}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => setViewing(s)} className="text-xs font-medium text-gold-700 hover:underline">View Receipt</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-muted">
              No sales in this period — completed sales will show up here as soon as they are made.
            </p>
          )}
        </CardBody>
      </Card>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title="Receipt" width="sm">
          <Receipt sale={viewing} />
          <Button className="mt-4 w-full print:hidden" onClick={() => window.print()}>Print / Save PDF</Button>
        </Modal>
      )}
    </div>
  )
}
