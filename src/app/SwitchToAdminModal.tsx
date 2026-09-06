import { useState } from 'react'
import { db } from '../lib/db'
import { hashPin } from '../lib/pin'
import { useAuth } from './AuthContext'
import { Modal } from '../components/ui/Modal'
import { Input, Label } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function SwitchToAdminModal({ onClose }: { onClose: () => void }) {
  const { switchUser } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleConfirm() {
    setChecking(true)
    const admins = (await db.users.toArray()).filter((u) => u.active && u.role === 'admin')
    let matched: (typeof admins)[number] | undefined
    for (const candidate of admins) {
      const hash = await hashPin(pin, candidate.pinSalt)
      if (hash === candidate.pinHash) {
        matched = candidate
        break
      }
    }
    setChecking(false)
    if (!matched) {
      setError('Incorrect admin PIN')
      return
    }
    switchUser(matched)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Switch to Admin" width="sm" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={pin.length !== 4 || checking}>Switch</Button>
      </>
    }>
      <Label>Enter Admin PIN</Label>
      <Input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-coral-500">{error}</p>}
    </Modal>
  )
}
