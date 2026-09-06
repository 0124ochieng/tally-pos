import { useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { getInactivityTimeoutSeconds } from '../lib/settings'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

/** Signs the current user out after N seconds of no mouse/keyboard/touch
 * activity — separately configurable for admin vs staff in Settings. */
export function useInactivityLogout() {
  const { user, logout } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      const seconds = getInactivityTimeoutSeconds(user!.role)
      timerRef.current = setTimeout(() => logout(), seconds * 1000)
    }

    reset()
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset))
    }
  }, [user, logout])
}
