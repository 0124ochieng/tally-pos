import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type DrawerEntryType } from '../../lib/db'
import { enqueueSync } from '../../lib/sync/outbox'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { cashDrawerBalance, mpesaTillBalance } from '../../lib/reportsService'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { StatTile } from '../../components/ui/StatTile'
import { Button } from '../../components/ui/Button'
import { Input, Label, Select } from '../../components/ui/Input'

export function DrawerPage() {
  const { user } = useAuth()
  const { show } = useToast()

  const cashEntries = useLiveQuery(() => db.cashDrawerEntries.toArray().then((rows) => rows.sort((a, b) => b.createdAt - a.createdAt)), []) ?? []
  const mpesaEntries = useLiveQuery(() => db.mpesaTillEntries.toArray(), []) ?? []

  const [type, setType] = useState<DrawerEntryType>('cash_in')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')

  async function handleSubmit() {
    if (amount <= 0) {
      show('Enter an amount above 0', 'error')
      return
    }
    const entry = { id: newId(), type, amount, recordedBy: user!.name, note, createdAt: Date.now() }
    await db.cashDrawerEntries.add(entry)
    await enqueueSync('cashDrawerEntries', 'upsert', entry)
    show('Entry recorded')
    setAmount(0)
    setNote('')
  }

  const cashBalance = cashDrawerBalance(cashEntries)
  const mpesaBalance = mpesaTillBalance(mpesaEntries)

  const lastClosingCount = [...cashEntries].filter((e) => e.type === 'closing_count').sort((a, b) => b.createdAt - a.createdAt)[0]
  const expectedAtClosing = lastClosingCount
    ? cashDrawerBalance(cashEntries.filter((e) => e.createdAt <= lastClosingCount.createdAt))
    : null
  const variance = lastClosingCount && expectedAtClosing != null ? lastClosingCount.amount - expectedAtClosing : null

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Drawer</h1>

      <div className="grid grid-cols-2 gap-4">
        <StatTile label="Cash in Drawer" value={`KES ${cashBalance.toLocaleString()}`} tone="gold" />
        <StatTile label="M-Pesa Till Balance" value={`KES ${mpesaBalance.toLocaleString()}`} tone="cyan" />
      </div>

      {lastClosingCount && variance != null && (
        <Card>
          <CardHeader><CardTitle>Last Till Count</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-ink-muted">Expected</p>
                <p className="text-lg font-bold text-ink">KES {expectedAtClosing!.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Counted</p>
                <p className="text-lg font-bold text-ink">KES {lastClosingCount.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">{variance === 0 ? 'Matched' : variance > 0 ? 'Extra Cash' : 'Missing Cash'}</p>
                <p className={`text-lg font-bold ${variance === 0 ? 'text-ink' : variance > 0 ? 'text-gold-700 dark:text-gold-400' : 'text-coral-600 dark:text-coral-400'}`}>
                  KES {Math.abs(variance).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-ink-muted">
              As of {new Date(lastClosingCount.createdAt).toLocaleString()}, recorded by {lastClosingCount.recordedBy}
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Add a Cash Entry</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as DrawerEntryType)}>
                <option value="cash_in">Cash In (e.g. float top-up)</option>
                <option value="cash_out">Cash Out (e.g. expense, withdrawal)</option>
                <option value="closing_count">Closing Count (end of shift)</option>
              </Select>
            </div>
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount || ''} placeholder="0" onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for this entry" />
            </div>
            <Button className="w-full" onClick={handleSubmit}>Record Entry</Button>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Cash Activity</CardTitle></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2">Time</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">By</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cashEntries.slice(0, 20).map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-ink-secondary">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="py-2 capitalize text-ink-secondary">{e.type.replace('_', ' ')}</td>
                    <td className="py-2 text-ink-secondary">{e.recordedBy}</td>
                    <td className="py-2 text-right text-ink">KES {e.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cashEntries.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">No cash activity yet.</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
