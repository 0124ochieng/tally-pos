import { useState } from 'react'
import { useAuth } from './AuthContext'
import { Button } from '../components/ui/Button'
import { PinEntry } from '../components/ui/PinEntry'
import { ThemeToggle } from '../components/ThemeToggle'
import { LiveClock } from '../components/LiveClock'
import { getBusinessName } from '../lib/settings'
import { Starfield } from '../components/Starfield'

export function Login() {
  const { login } = useAuth()
  const businessName = getBusinessName()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleComplete(fullPin: string) {
    setSubmitting(true)
    const result = await login(fullPin)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? "That didn't work. Try again.")
      setPin('')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page transition-colors">
      <Starfield />
      <div className="absolute right-6 top-6 z-10"><ThemeToggle /></div>
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-sm transition-colors">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-ink">{businessName}</h1>
          <p className="mt-1 text-sm text-ink-secondary">Enter your PIN to sign in</p>
        </div>

        {error && <p className="mb-3 text-center text-sm text-coral-500">{error}</p>}

        <PinEntry
          value={pin}
          onChange={(next) => { setPin(next); setError('') }}
          onComplete={handleComplete}
          disabled={submitting}
        />

        <Button
          variant="ghost"
          className="mt-2 w-full"
          onClick={() => {
            setPin('')
            setError('')
          }}
        >
          Clear
        </Button>
      </div>
      <p className="absolute bottom-3 right-4 z-10 text-xs text-ink-muted print:hidden">POS by REACH Digital Experts</p>
      <LiveClock />
    </div>
  )
}
