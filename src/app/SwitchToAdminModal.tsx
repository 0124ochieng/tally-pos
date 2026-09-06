import { useState } from 'react'
import { db } from '../lib/db'
import { hashPin } from '../lib/pin'
import { useAuth } from './AuthContext'
import { Modal } from '../components/ui/Modal'
import { PinEntry } from '../components/ui/PinEntry'
import { Button } from '../components/ui/Button'
import { getBusinessName } from '../lib/settings'

export function SwitchToAdminModal({ onClose }: { onClose: () => void }) {
  const { switchUser } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleComplete(fullPin: string) {
    setChecking(true)
    const admins = (await db.users.toArray()).filter((u) => u.active && u.role === 'admin')
    let matched: (typeof admins)[number] | undefined
    for (const candidate of admins) {
      const hash = await hashPin(fullPin, candidate.pinSalt)
      if (hash === candidate.pinHash) {
        matched = candidate
        break
      }
    }
    setChecking(false)
    if (!matched) {
      setError("That PIN doesn't match an admin account")
      setPin('')
      return
    }
    switchUser(matched)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Switch to Admin" width="sm" footer={
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
    }>
      <div className="mb-4 text-center">
        <p className="text-sm font-semibold text-ink">{getBusinessName()}</p>
        <p className="mt-0.5 text-sm text-ink-secondary">Enter an admin's PIN to continue</p>
      </div>
      <PinEntry
        value={pin}
        onChange={(next) => { setPin(next); setError('') }}
        onComplete={handleComplete}
        disabled={checking}
      />
      {error && <p className="mt-3 text-center text-sm text-coral-500">{error}</p>}
    </Modal>
  )
}
