import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { activateWithKey } from '../lib/license'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { ThemeToggle } from '../components/ThemeToggle'
import { getBusinessName } from '../lib/settings'
import { Starfield } from '../components/Starfield'

export function ActivationGate({ onActivated }: { onActivated: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [activating, setActivating] = useState(false)

  async function handleActivate() {
    if (!key.trim()) return
    setActivating(true)
    setError('')
    const result = await activateWithKey(key.trim().toUpperCase())
    setActivating(false)
    if (result.ok) {
      onActivated()
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page transition-colors">
      <Starfield />
      <div className="absolute right-6 top-6 z-10"><ThemeToggle /></div>
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-sm transition-colors">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
            <ShieldCheck size={22} />
          </span>
          <h1 className="text-xl font-bold text-ink">Activate {getBusinessName()} POS</h1>
          <p className="mt-1 text-sm text-ink-secondary">Enter the license key you received to set up this computer.</p>
        </div>

        <Label>License Key</Label>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="REA-XXXXX-XXXXX-XXXXX"
          className="text-center font-mono tracking-wide"
          onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          autoFocus
        />

        {error && <p className="mt-3 text-sm text-coral-500">{error}</p>}

        <Button className="mt-4 w-full" size="lg" onClick={handleActivate} disabled={activating || !key.trim()}>
          {activating ? 'Activating…' : 'Activate'}
        </Button>

        <p className="mt-4 text-center text-xs text-ink-muted">
          This needs an internet connection once. After activation, the app works fully offline.
        </p>
      </div>
      <p className="absolute bottom-3 right-4 z-10 text-xs text-ink-muted">POS by REACH Digital Experts</p>
    </div>
  )
}
