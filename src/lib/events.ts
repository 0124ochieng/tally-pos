import { useEffect, useState } from 'react'

// A deterministic "something changed" signal, fired by every write that goes
// through enqueueSync (i.e. every mutation in the app). Dexie's useLiveQuery
// should already re-run reactively on its own — including across tabs via
// its built-in BroadcastChannel support — but dashboards/reports combine
// several queries with derived useMemo/useEffect state, so this gives pages
// a single, unambiguous tick to key their derived computations off. It also
// runs its own BroadcastChannel relay so a sale made on one tab/device
// (e.g. the till) reliably refreshes a dashboard open on another, independent
// of any Dexie internals.

type Listener = () => void
const listeners = new Set<Listener>()

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hymes-pos-data-changed') : null
channel?.addEventListener('message', () => listeners.forEach((l) => l()))

export function emitDataChanged() {
  listeners.forEach((l) => l())
  channel?.postMessage('changed')
}

export function useDataChangedTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return tick
}
