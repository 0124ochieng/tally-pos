import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Sale } from '../../lib/db'
import { useAuth } from '../../app/AuthContext'
import { startOfDay } from '../../lib/reportsService'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Receipt } from './Receipt'

export function MySalesPage() {
  const { user } = useAuth()
  const [viewing, setViewing] = useState<Sale | null>(null)

  const sales = useLiveQuery(
    () => db.sales.where('cashierId').equals(user!.id).sortBy('createdAt').then((rows) => rows.reverse()),
    [user?.id],
  ) ?? []

  const today = sales.filter((s) => s.createdAt >= startOfDay())
  const total = today.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">My Sales — Today</h1>
        <p className="text-sm text-ink-secondary">{today.length} sales · KES {total.toLocaleString()}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Today's Transactions</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">Items</th>
                <th className="py-2">Payment</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {today.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-ink-secondary">{new Date(s.createdAt).toLocaleTimeString()}</td>
                  <td className="py-2 text-ink-secondary">{s.items.length}</td>
                  <td className="py-2 capitalize text-ink-secondary">{s.paymentMethod}</td>
                  <td className="py-2 text-right font-medium text-ink">KES {s.total.toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => setViewing(s)} className="text-xs font-medium text-gold-700 hover:underline">View Receipt</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {today.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No sales yet today.</p>}
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
