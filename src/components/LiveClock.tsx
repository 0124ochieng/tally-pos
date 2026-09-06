import { useEffect, useState } from 'react'

export function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2 print:hidden">
      <div className="surface-glass elevation-1 rounded-full border border-border px-3.5 py-1 text-xs text-ink-muted">
        {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        <span className="mx-1.5 text-border">·</span>
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  )
}
