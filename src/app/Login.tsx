import { useState } from 'react'
import { Delete } from 'lucide-react'
import { useAuth } from './AuthContext'
import { Button } from '../components/ui/Button'
import { ThemeToggle } from '../components/ThemeToggle'
import { LiveClock } from '../components/LiveClock'
import { getBusinessName } from '../lib/settings'
import { Starfield } from '../components/Starfield'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

export function Login() {
  const { login } = useAuth()
  const businessName = getBusinessName()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleKey(key: string) {
    if (submitting) return
    if (key === 'back') {
      setPin((p) => p.slice(0, -1))
      setError('')
      return
    }
    if (key === '' || pin.length >= 4) return
    const next = pin + key
    setPin(next)
    setError('')
    if (next.length === 4) {
      setSubmitting(true)
      const result = await login(next)
      setSubmitting(false)
      if (!result.ok) {
        setError(result.error ?? "That didn't work. Try again.")
        setPin('')
      }
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

        <div className="mb-5 flex justify-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full border transition-colors ${i < pin.length ? 'border-gold-400 bg-gold-400' : 'border-border'}`}
            />
          ))}
        </div>

        {error && <p className="mb-3 text-center text-sm text-coral-500">{error}</p>}

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === '' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                onClick={() => handleKey(key)}
                aria-label={key === 'back' ? 'Delete last digit' : `Digit ${key}`}
                className="flex h-14 items-center justify-center rounded-2xl bg-surface-alt text-lg font-semibold text-ink transition-colors hover:bg-gold-100 active:bg-gold-200"
              >
                {key === 'back' ? <Delete size={20} /> : key}
              </button>
            ),
          )}
        </div>

        <Button
          variant="ghost"
          className="mt-4 w-full"
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
