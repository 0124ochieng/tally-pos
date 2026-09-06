import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileSpreadsheet } from 'lucide-react'
import { db } from '../../lib/db'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { StatTile } from '../../components/ui/StatTile'
import { useToast } from '../../components/ui/Toast'
import {
  startOfDay,
  startOfMonth,
  startOfYear,
  sumSales,
  sumExpenses,
  getProfitForSales,
  salesByDay,
} from '../../lib/reportsService'
import { downloadCSV, exportFullReport, exportFilePrefix } from '../../lib/exportService'
import { useDataChangedTick } from '../../lib/events'
import { SalesTrendChart } from './charts/SalesTrendChart'

type Period = 'day' | 'month' | 'year'

export function ReportsPage() {
  useDataChangedTick()
  const { show } = useToast()
  const [period, setPeriod] = useState<Period>('month')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [exporting, setExporting] = useState(false)

  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const periodStart = period === 'day' ? startOfDay() : period === 'month' ? startOfMonth() : startOfYear()

  const scoped = useMemo(() => {
    let rows = sales.filter((s) => s.createdAt >= periodStart && s.status === 'completed')
    if (categoryFilter !== 'All') {
      rows = rows
        .map((s) => ({ ...s, items: s.items.filter((i) => productsById.get(i.productId)?.categoryId === categoryFilter) }))
        .filter((s) => s.items.length > 0)
        .map((s) => ({ ...s, total: s.items.reduce((sum, i) => sum + i.lineTotal, 0) }))
    }
    return rows
  }, [sales, periodStart, categoryFilter, productsById])

  const [profit, setProfit] = useState({ revenue: 0, cost: 0, profit: 0 })
  useEffect(() => { getProfitForSales(scoped).then(setProfit) }, [scoped])

  const scopedExpenses = useMemo(() => expenses.filter((e) => e.createdAt >= periodStart), [expenses, periodStart])
  const netProfit = profit.profit - sumExpenses(scopedExpenses)

  const trend = useMemo(() => salesByDay(scoped, period === 'day' ? 1 : period === 'month' ? 30 : 12), [scoped, period])

  const cashTotal = scoped.filter((s) => s.paymentMethod === 'cash').reduce((s, sale) => s + sale.total, 0)
  const mpesaTotal = scoped.filter((s) => s.paymentMethod === 'mpesa').reduce((s, sale) => s + sale.total, 0)

  function handleExportView() {
    downloadCSV(
      `${exportFilePrefix()}-Transactions-${period}`,
      [
        { key: 'date', label: 'Date' },
        { key: 'items', label: 'Items' },
        { key: 'payment', label: 'Payment' },
        { key: 'total', label: 'Total (KES)' },
      ],
      scoped.map((s) => ({
        date: new Date(s.createdAt).toLocaleString(),
        items: s.items.length,
        payment: s.paymentMethod,
        total: s.total,
      })),
    )
    show('Transactions exported as CSV')
  }

  async function handleExportAll() {
    setExporting(true)
    await exportFullReport()
    setExporting(false)
    show('Full report exported — check your downloads')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">Reports</h1>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-32">
            <option value="day">Today</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </Select>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-56">
            <option value="All">All Categories</option>
            {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button variant="secondary" size="md" onClick={handleExportView}>
            <Download size={15} /> Export View (CSV)
          </Button>
          <Button size="md" onClick={handleExportAll} disabled={exporting}>
            <FileSpreadsheet size={15} /> {exporting ? 'Preparing…' : 'Export All Data (Excel)'}
          </Button>
        </div>
      </div>

      {/* The two numbers a shopkeeper actually opens this page for —
          everything else is supporting detail, so these two get to be big. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-gold-300 bg-surface p-6 transition-colors dark:border-gold-500/40">
          <p className="text-sm font-medium text-ink-secondary">Revenue</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-ink">KES {sumSales(scoped).toLocaleString()}</p>
          <p className="mt-1 text-xs text-ink-muted">Everything collected from sales this period</p>
        </div>
        <div className={`rounded-2xl border-2 bg-surface p-6 transition-colors ${netProfit >= 0 ? 'border-gold-300 dark:border-gold-500/40' : 'border-coral-300 dark:border-coral-500/40'}`}>
          <p className="text-sm font-medium text-ink-secondary">Net Profit</p>
          <p className={`mt-1 text-3xl font-extrabold tracking-tight ${netProfit >= 0 ? 'text-ink' : 'text-coral-600 dark:text-coral-400'}`}>KES {netProfit.toLocaleString()}</p>
          <p className="mt-1 text-xs text-ink-muted">What's left after cost of goods and expenses</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Sales</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile label="Cash Sales" value={`KES ${cashTotal.toLocaleString()}`} tone="cyan" sublabel="Part of revenue" />
          <StatTile label="M-Pesa Sales" value={`KES ${mpesaTotal.toLocaleString()}`} tone="cyan" sublabel="Part of revenue" />
          <StatTile label="Transactions" value={String(scoped.length)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Costs &amp; Profit</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile label="Cost of Goods" value={`KES ${profit.cost.toLocaleString()}`} sublabel="What you paid for what sold" />
          <StatTile
            label="Gross Profit"
            value={`KES ${profit.profit.toLocaleString()}`}
            tone="gold"
            sublabel={profit.revenue ? `${Math.round((profit.profit / profit.revenue) * 100)}% margin — before expenses` : 'Revenue minus cost of goods'}
          />
          <StatTile label="Expenses" value={`KES ${sumExpenses(scopedExpenses).toLocaleString()}`} tone="coral" sublabel="Rent, wages, and other costs" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Sales Trend</CardTitle></CardHeader>
        <CardBody><SalesTrendChart data={trend} /></CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Items</th>
                <th className="py-2">Payment</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scoped.slice(0, 50).map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-ink-secondary">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="py-2 text-ink-secondary">{s.items.length}</td>
                  <td className="py-2 capitalize text-ink-secondary">{s.paymentMethod}</td>
                  <td className="py-2 text-right font-medium text-ink">KES {s.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scoped.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-muted">
              No sales in this period — completed sales will show up here as soon as they are made.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
