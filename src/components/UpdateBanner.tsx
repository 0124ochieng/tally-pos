import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

/** Only ever appears if electron-updater actually finished downloading an
 * update in the background (see electron/main.cjs) — most builds never
 * fire this at all, since it depends on VITE_UPDATE_URL being configured.
 * Installing is always the person's own choice, never automatic, so it
 * can't interrupt someone mid-sale. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!window.electronAPI?.onUpdateReady) return
    return window.electronAPI.onUpdateReady(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <div className="surface-glass elevation-3 fixed left-1/2 top-4 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold-300 px-4 py-2 text-sm dark:border-gold-500/40">
      <RefreshCw size={15} className="text-gold-600 dark:text-gold-400" />
      <span className="text-ink">A new version is ready.</span>
      <button
        onClick={() => window.electronAPI?.installUpdate()}
        className="rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-neutral-900 hover:bg-gold-500"
      >
        Restart to update
      </button>
    </div>
  )
}
