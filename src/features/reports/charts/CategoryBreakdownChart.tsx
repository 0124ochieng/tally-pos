import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChartPalette } from './chartTheme'

interface Slice { name: string; value: number }

// Categorical palette validates at 8 slots; beyond that, fold the smallest
// remainder into "Other" rather than reusing/cycling hues (dataviz rule).
function foldToEight(data: Slice[]): Slice[] {
  if (data.length <= 8) return data
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, 7)
  const rest = sorted.slice(7).reduce((sum, d) => sum + d.value, 0)
  return [...top, { name: 'Other', value: rest }]
}

export function CategoryBreakdownChart({ data }: { data: Slice[] }) {
  const { categorical, ink } = useChartPalette()
  const folded = useMemo(() => foldToEight(data), [data])
  const total = folded.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <Pie data={folded} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke={ink.surface} strokeWidth={2} isAnimationActive={false}>
          {folded.map((_, i) => (
            <Cell key={i} fill={categorical[i % categorical.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => {
            const num = Number(value)
            return [`KES ${num.toLocaleString()} (${total ? Math.round((num / total) * 100) : 0}%)`, '']
          }}
          contentStyle={{ borderRadius: 10, border: `1px solid ${ink.grid}`, background: ink.surface, color: ink.primary, fontSize: 12 }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => <span style={{ color: ink.secondary, fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
