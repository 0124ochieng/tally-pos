import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Undo2 } from 'lucide-react'

interface UndoState {
  id: string
  label: string
  onUndo: () => void | Promise<void>
  durationMs: number
}

interface UndoContextValue {
  triggerUndo: (label: string, onUndo: () => void | Promise<void>, durationMs?: number) => void
}

const UndoContext = createContext<UndoContextValue | null>(null)
const DEFAULT_DURATION = 8000

export function UndoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<UndoState | null>(null)
  const [progress, setProgress] = useState(1)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const triggerUndo = useCallback((label: string, onUndo: () => void | Promise<void>, durationMs = DEFAULT_DURATION) => {
    clearTimers()
    const id = crypto.randomUUID()
    const startedAt = Date.now()
    setActive({ id, label, onUndo, durationMs })
    setProgress(1)

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setProgress(Math.max(0, 1 - elapsed / durationMs))
    }, 100)

    timeoutRef.current = setTimeout(() => {
      clearTimers()
      setActive((current) => (current?.id === id ? null : current))
    }, durationMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => clearTimers, [])

  async function handleUndo() {
    if (!active) return
    clearTimers()
    const { onUndo } = active
    setActive(null)
    await onUndo()
  }

  return (
    <UndoContext.Provider value={{ triggerUndo }}>
      {children}
      {active && (
        <div
          role="status"
          aria-live="assertive"
          className="elevation-2 fixed bottom-16 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{active.label}</p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-alt">
              <div className="h-full rounded-full bg-gold-400" style={{ width: `${progress * 100}%`, transition: 'width 100ms linear' }} />
            </div>
          </div>
          <button
            onClick={handleUndo}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-800 hover:bg-gold-200"
          >
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}
    </UndoContext.Provider>
  )
}

export function useUndo() {
  const ctx = useContext(UndoContext)
  if (!ctx) throw new Error('useUndo must be used within UndoProvider')
  return ctx
}
