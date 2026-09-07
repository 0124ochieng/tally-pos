import { useEffect, useState, type ReactNode } from 'react'
import { checkLicense } from '../lib/license'
import { initSupabase } from '../lib/supabase'
import { seedDatabaseIfEmpty, seedExpenseCategoriesIfEmpty } from '../lib/seedDb'
import { startSyncService, hydrateFromCloudIfAvailable } from '../lib/sync/syncService'
import { ActivationGate } from './ActivationGate'
import { SplashScreen } from '../components/SplashScreen'

const SKIP_ACTIVATION = import.meta.env.VITE_SKIP_ACTIVATION === 'true'

// Long enough to read as a deliberate, polished entrance rather than a
// flicker (even on a machine so fast the real bootstrap below finishes
// almost instantly); short enough that nobody's ever kept waiting on it —
// standard splash-screen territory (~2s all in, including the fade-out).
const MIN_SPLASH_MS = 1900
const SPLASH_EXIT_MS = 420

type Phase = 'checking' | 'unactivated' | 'ready' | { status: 'error'; message: string }

/** Owns the app's startup sequence: check license -> configure Supabase with
 * the right credentials for this install -> seed/sync -> render the app.
 * Supabase must be initialized before anything else touches it, which is
 * why this replaces the old top-level bootstrap in main.tsx.
 *
 * This runs inside a useEffect, so a thrown error here is an unhandled
 * promise rejection, not a render error — React's error boundaries do NOT
 * catch it. Without the try/catch below, any failure in this sequence
 * leaves `phase` stuck at 'checking' forever, rendering a blank screen with
 * no error surfaced anywhere (not even to an ErrorBoundary). */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking')

  // Splash timing is deliberately independent of `phase` below — it must
  // stay up at least MIN_SPLASH_MS even if bootstrap resolves instantly,
  // and must stay up past MIN_SPLASH_MS if bootstrap is still running.
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const splashExiting = phase !== 'checking' && minSplashElapsed

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!splashExiting) return
    const t = setTimeout(() => setShowSplash(false), SPLASH_EXIT_MS)
    return () => clearTimeout(t)
  }, [splashExiting])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        if (SKIP_ACTIVATION) {
          initSupabase()
        } else {
          const result = await checkLicense()
          if (result.status !== 'activated') {
            if (!cancelled) setPhase('unactivated')
            return
          }
          // Cloud sync is optional, best-effort infrastructure (most
          // installs are local-only — see docs/DISTRIBUTION.md). A bad or
          // stale credential on one specific license record must never be
          // able to stop the till from opening at all, so nothing from
          // here on is allowed to throw past this block — initSupabase()
          // itself already fails safe to "not configured" on a bad URL,
          // this is a second, independent backstop in case anything else
          // in the cloud-sync setup below goes wrong in a way that
          // wasn't anticipated.
          try {
            initSupabase(result.cert.supabaseUrl, result.cert.supabaseAnonKey)
          } catch (err) {
            console.error('Cloud sync setup failed — continuing in local-only mode.', err)
          }
        }

        let hydration: Awaited<ReturnType<typeof hydrateFromCloudIfAvailable>> = 'confirmed-empty'
        try {
          hydration = await hydrateFromCloudIfAvailable()
        } catch (err) {
          console.error('Could not check cloud data before starting up — continuing locally.', err)
          hydration = 'unavailable'
        }
        if (hydration === 'unavailable') {
          throw new Error(
            "Couldn't check your data before starting up. Connect to the internet and restart — " +
              "this only happens once, when there's no local data yet, so nothing gets wiped by mistake.",
          )
        }
        if (hydration === 'confirmed-empty') {
          await seedDatabaseIfEmpty()
        }
        await seedExpenseCategoriesIfEmpty()
        try {
          startSyncService()
        } catch (err) {
          console.error('Could not start cloud sync — continuing in local-only mode.', err)
        }
        if (!cancelled) setPhase('ready')
      } catch (err) {
        console.error('Startup failed', err)
        if (!cancelled) setPhase({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  // Rendered underneath the splash overlay (not gated on it) so that once
  // the splash starts fading out, it's revealing a screen that's already
  // there — a crossfade, not a cut to blank. While phase is still
  // 'checking' none of these match anything, so only the splash shows.
  let content: ReactNode = null
  if (phase === 'unactivated') {
    // Reload rather than re-checking in place: it's the simplest way to
    // guarantee Supabase and the sync service initialize fresh with the
    // newly activated credentials.
    content = <ActivationGate onActivated={() => window.location.reload()} />
  } else if (typeof phase === 'object') {
    content = (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-100">
        <h1 className="text-lg font-bold">Couldn't start the app</h1>
        <p className="max-w-md text-sm text-neutral-400">
          Something went wrong while starting up. Restarting usually fixes it — if it keeps happening, share
          the message below with support.
        </p>
        <pre className="max-w-lg overflow-x-auto rounded-lg bg-neutral-900 px-4 py-3 text-left text-xs text-coral-400">
          {phase.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-bold text-neutral-900 hover:bg-gold-500"
        >
          Restart
        </button>
      </div>
    )
  } else if (phase === 'ready') {
    content = children
  }

  return (
    <>
      {content}
      {showSplash && <SplashScreen exiting={splashExiting} />}
    </>
  )
}
