import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useJoyride } from 'react-joyride'
import { HelpCircle } from 'lucide-react'
import { getTourForPath } from '../lib/tours'
import { hasSeenOnboarding, markOnboardingSeen } from '../lib/settings'
import { useToast } from './ui/Toast'

/** The interactive, on-page walkthrough — steps point at the actual button
 * or panel they're describing, not a static box in the middle of the
 * screen. Runs itself once automatically the first time someone visits a
 * page that has a tour, and can always be replayed from the floating "?"
 * button bottom-right. */
export function TourGuide() {
  const location = useLocation()
  const { show } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const steps = getTourForPath(location.pathname) ?? []

  const { controls, Tour } = useJoyride({
    steps,
    continuous: true,
    scrollToFirstStep: true,
    options: {
      skipBeacon: true,
      showProgress: true,
      buttons: ['back', 'skip', 'primary'],
      primaryColor: '#f5c542',
      backgroundColor: 'var(--surface)',
      textColor: 'var(--ink)',
      arrowColor: 'var(--surface)',
      overlayColor: 'rgba(15, 15, 20, 0.55)',
      zIndex: 10000,
    },
  })

  function startTour() {
    markOnboardingSeen(location.pathname)
    controls.start()
  }

  const autoStarted = useRef<string | null>(null)
  useEffect(() => {
    if (steps.length === 0) return
    if (hasSeenOnboarding(location.pathname)) return
    if (autoStarted.current === location.pathname) return
    autoStarted.current = location.pathname
    // Let the page's own content (categories, products, stats — most of it
    // loaded from the local database) settle in before pointing at it.
    const t = setTimeout(startTour, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, steps.length])

  function handleHelpClick() {
    setMenuOpen(false)
    if (steps.length === 0) {
      show("There's no guided tour for this page yet.", 'info')
      return
    }
    startTour()
  }

  return (
    <>
      {Tour}
      <div className="fixed bottom-6 right-6 z-[95]">
        {menuOpen && (
          <div className="surface-glass elevation-3 mb-3 w-56 rounded-2xl border border-border p-2">
            <button
              onClick={handleHelpClick}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-surface-alt"
            >
              Show me around this page
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Help"
          className="surface-glass elevation-3 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-gold-300 text-gold-600 transition-transform hover:scale-105 dark:border-gold-500/40 dark:text-gold-400"
        >
          <HelpCircle size={22} />
        </button>
      </div>
    </>
  )
}
