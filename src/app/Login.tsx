import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Button } from '../components/ui/Button'
import { PinEntry } from '../components/ui/PinEntry'
import { ThemeToggle } from '../components/ThemeToggle'
import { LiveClock } from '../components/LiveClock'
import { getBusinessName } from '../lib/settings'
import { Starfield } from '../components/Starfield'
import { useToast } from '../components/ui/Toast'
import { findUserByRecoveryCode, resetPinWithRecovery } from '../lib/recovery'
import type { User } from '../lib/db'

type Mode = 'pin' | 'recovery' | 'new-pin'

export function Login() {
  const { login } = useAuth()
  const { show } = useToast()
  const businessName = getBusinessName()

  const [mode, setMode] = useState<Mode>('pin')
  const [pin, setPin] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [recoveredUser, setRecoveredUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function backToPin() {
    setMode('pin')
    setPin('')
    setRecoveryCode('')
    setNewPin('')
    setRecoveredUser(null)
    setError('')
  }

  async function handleComplete(fullPin: string) {
    setSubmitting(true)
    const result = await login(fullPin)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? "That didn't work. Try again.")
      setPin('')
    }
  }

  async function handleRecoveryCodeComplete(code: string) {
    setSubmitting(true)
    const user = await findUserByRecoveryCode(code)
    setSubmitting(false)
    if (user) {
      setRecoveredUser(user)
      setMode('new-pin')
      setRecoveryCode('')
      setError('')
    } else {
      setError("That code isn't recognized")
      setRecoveryCode('')
    }
  }

  async function handleNewPinComplete(fullPin: string) {
    if (!recoveredUser) return
    setSubmitting(true)
    const result = await resetPinWithRecovery(recoveredUser.id, fullPin)
    setSubmitting(false)
    if (result.ok) {
      show('PIN reset — sign in with your new PIN')
      backToPin()
    } else {
      setError(result.error ?? "That didn't work. Try again.")
      setNewPin('')
    }
  }

  const heading = mode === 'pin' ? 'Enter your PIN to sign in'
    : mode === 'recovery' ? 'Enter your recovery code'
    : `Choose a new PIN for ${recoveredUser?.name ?? 'your account'}`

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page transition-colors">
      <Starfield />
      <div className="absolute right-6 top-6 z-10"><ThemeToggle /></div>
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-sm transition-colors">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-ink">{businessName}</h1>
          <p className="mt-1 text-sm text-ink-secondary">{heading}</p>
        </div>

        {error && <p className="mb-3 text-center text-sm text-coral-500">{error}</p>}

        {mode === 'pin' && (
          <>
            <PinEntry
              value={pin}
              onChange={(next) => { setPin(next); setError('') }}
              onComplete={handleComplete}
              disabled={submitting}
            />
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => { setPin(''); setError('') }}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => { setMode('recovery'); setError('') }}
            >
              Forgot PIN?
            </Button>
          </>
        )}

        {mode === 'recovery' && (
          <>
            <PinEntry
              value={recoveryCode}
              onChange={(next) => { setRecoveryCode(next); setError('') }}
              onComplete={handleRecoveryCodeComplete}
              disabled={submitting}
              length={6}
            />
            <Button variant="ghost" className="mt-2 w-full" onClick={backToPin}>
              Back to PIN
            </Button>
          </>
        )}

        {mode === 'new-pin' && (
          <>
            <PinEntry
              value={newPin}
              onChange={(next) => { setNewPin(next); setError('') }}
              onComplete={handleNewPinComplete}
              disabled={submitting}
            />
            <Button variant="ghost" className="mt-2 w-full" onClick={backToPin}>
              Cancel
            </Button>
          </>
        )}
      </div>
      <p className="absolute bottom-3 right-4 z-10 text-xs text-ink-muted print:hidden">Built by REACH</p>
      <LiveClock />
    </div>
  )
}
