import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Banknote, Smartphone } from 'lucide-react'
import { db } from '../../lib/db'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useDataChangedTick } from '../../lib/events'
import {
  startOfDay,
  startOfMonth,
  sumSales,
  sumExpenses,
  cashDrawerBalance,
  mpesaTillBalance,
  getProfitForSales,
  topProducts,
  salesByDay,
  salesByCategory,
} from '../../lib/reportsService'
import { SalesTrendChart } from './charts/SalesTrendChart'
import { CategoryBreakdownChart } from './charts/CategoryBreakdownChart'

/** Bumps on window focus/visibility change so cross-tab writes (e.g. a sale
 * made on a different tab/device) are reflected here even in the unlikely
 * case the live query didn't already pick it up. */
function useRefreshTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', bump)
    return () => {
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', bump)
    }
  }, [])
  return tick
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'gold' | 'coral' | 'default' }) {
  const toneClass = tone === 'gold' ? 'text-gold-700 dark:text-gold-400' : tone === 'coral' ? 'text-coral-600 dark:text-coral-400' : 'text-ink'
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
    </div>
  )
}

export function DashboardPage() {
  useRefreshTick()
  useDataChangedTick()

  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? []
  const cashEntries = useLiveQuery(() => db.cashDrawerEntries.toArray(), []) ?? []
  const mpesaEntries = useLiveQuery(() => db.mpesaTillEntries.toArray(), []) ?? []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) ?? []

  const todaySales = useMemo(() => sales.filter((s) => s.createdAt >= startOfDay()), [sales])
  const monthSales = useMemo(() => sales.filter((s) => s.createdAt >= startOfMonth()), [sales])
  const monthExpenses = useMemo(() => expenses.filter((e) => e.createdAt >= startOfMonth()), [expenses])

  const [profit, setProfit] = useState({ revenue: 0, cost: 0, profit: 0 })
  useEffect(() => {
    getProfitForSales(monthSales).then(setProfit)
  }, [monthSales])

  const netProfit = profit.profit - sumExpenses(monthExpenses)
  const cashBalance = cashDrawerBalance(cashEntries)
  const mpesaBalance = mpesaTillBalance(mpesaEntries)

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const productCategoryMap = useMemo(() => new Map(products.map((p) => [p.id, categoryNameById.get(p.categoryId) ?? 'Other'])), [products, categoryNameById])

  const trend = useMemo(() => salesByDay(sales, 14), [sales])
  const breakdown = useMemo(() => salesByCategory(monthSales, productCategoryMap), [monthSales, productCategoryMap])
  const top = useMemo(() => topProducts(monthSales, 5), [monthSales])

  const lowStock = useMemo(
    () => products.filter((p) => p.active && p.stock <= p.lowStockThreshold).sort((a, b) => a.stock - b.stock).slice(0, 6),
    [products],
  )

  const todayTotal = sumSales(todaySales)
  const todayAvg = todaySales.length ? Math.round(todayTotal / todaySales.length) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Dashboard</h1>

      {/* HERO — the one number an owner checks first each day */}
      <div data-tour="dashboard-hero" className="rounded-2xl border-2 border-gold-300 bg-surface p-6 transition-colors dark:border-gold-500/40">
        <p className="text-sm font-medium text-ink-secondary">Today's Sales</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-ink">KES {todayTotal.toLocaleString()}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-secondary">
          <span>{todaySales.length} transaction{todaySales.length === 1 ? '' : 's'}</span>
          <span>Avg KES {todayAvg.toLocaleString()} / sale</span>
        </div>
      </div>

      {/* Money + Attention — grouped by "what does the owner act on right now" */}
      <div data-tour="dashboard-money" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Money Right Now</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"><Banknote size={16} /></span>
              <Stat label="Cash in Drawer" value={`KES ${cashBalance.toLocaleString()}`} />
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"><Smartphone size={16} /></span>
              <Stat label="M-Pesa Till" value={`KES ${mpesaBalance.toLocaleString()}`} />
            </div>
          </CardBody>
        </Card>

        <Card className={lowStock.length > 0 ? 'border-coral-300 dark:border-coral-500/40' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              {lowStock.length > 0 && <AlertTriangle size={14} className="text-coral-500" />} Needs Attention
            </CardTitle>
            <Badge tone={lowStock.length > 0 ? 'coral' : 'neutral'}>{lowStock.length} low stock</Badge>
          </CardHeader>
          <CardBody>
            {lowStock.length === 0 && <p className="text-sm text-ink-muted">All stock levels healthy — nothing needs attention.</p>}
            <ul className="space-y-2">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink" title={p.name}>{p.name}</span>
                  <Badge tone="coral" className="shrink-0">{p.stock} left</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* This Month — one grouped strip instead of four competing tiles */}
      <Card>
        <CardHeader><CardTitle>This Month</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Sales" value={`KES ${sumSales(monthSales).toLocaleString()}`} />
          <Stat label="Gross Profit" value={`KES ${profit.profit.toLocaleString()}`} />
          <Stat label="Expenses" value={`KES ${sumExpenses(monthExpenses).toLocaleString()}`} tone="coral" />
          <Stat label="Net Profit" value={`KES ${netProfit.toLocaleString()}`} tone={netProfit >= 0 ? 'gold' : 'coral'} />
        </CardBody>
      </Card>

      {/* Analysis — for reviewing trends, not urgent at-a-glance decisions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Sales — last 14 days</CardTitle></CardHeader>
          <CardBody><SalesTrendChart data={trend} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sales by Category (Month)</CardTitle></CardHeader>
          <CardBody><CategoryBreakdownChart data={breakdown} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top Products (Month)</CardTitle></CardHeader>
        <CardBody>
          {top.length === 0 && <p className="text-sm text-ink-muted">No sales yet this month.</p>}
          <ul className="space-y-3">
            {top.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink" title={p.name}>{p.name}</span>
                <span className="shrink-0 whitespace-nowrap text-ink-muted">{p.qty} sold · KES {p.revenue.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
