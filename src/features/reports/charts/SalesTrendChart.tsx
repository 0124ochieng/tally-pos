import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette } from './chartTheme'

interface Point { date: string; total: number }

export function SalesTrendChart({ data }: { data: Point[] }) {
  const { seriesGold, ink } = useChartPalette()
  const gradientId = `salesFill-${useId()}`
  const hasData = data.some((d) => d.total > 0)

  if (!hasData) {
    return (
      <div className="flex h-[240px] items-center justify-center text-center text-sm text-ink-muted">
        No sales yet — this chart fills in once sales start coming through.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={seriesGold} stopOpacity={0.25} />
            <stop offset="100%" stopColor={seriesGold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={ink.grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: ink.muted }} axisLine={{ stroke: ink.axis }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: ink.muted }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          formatter={(value) => [`KES ${Number(value).toLocaleString()}`, 'Sales']}
          contentStyle={{ borderRadius: 10, border: `1px solid ${ink.grid}`, background: ink.surface, color: ink.primary, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="total" stroke={seriesGold} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
