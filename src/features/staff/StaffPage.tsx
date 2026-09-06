import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Role, type User } from '../../lib/db'
import { hashPin, generateSalt } from '../../lib/pin'
import { enqueueSync } from '../../lib/sync/outbox'
import { useToast } from '../../components/ui/Toast'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Label, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'

export function StaffPage() {
  const { show } = useToast()
  const usersRaw = useLiveQuery(() => db.users.toArray(), []) ?? []
  const users = [...usersRaw].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1))

  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<Role>('staff')

  const [resetting, setResetting] = useState<User | null>(null)
  const [resetPin, setResetPin] = useState('')

  async function pinInUse(candidatePin: string, excludeUserId?: string) {
    const matches = await Promise.all(
      users.filter((u) => u.id !== excludeUserId).map((u) => hashPin(candidatePin, u.pinSalt).then((h) => h === u.pinHash)),
    )
    return matches.some(Boolean)
  }

  async function handleAdd() {
    if (!name.trim() || pin.length !== 4) {
      show('Enter a name and a 4-digit PIN', 'error')
      return
    }
    if (await pinInUse(pin)) {
      show('That PIN is already in use', 'error')
      return
    }
    const pinSalt = generateSalt()
    const pinHash = await hashPin(pin, pinSalt)
    const user = { id: newId(), name, pinHash, pinSalt, role, active: true }
    await db.users.add(user)
    await enqueueSync('users', 'upsert', user)
    show('Staff member added')
    setName('')
    setPin('')
  }

  async function toggleActive(id: string, active: boolean) {
    await db.users.update(id, { active: !active })
    const updated = await db.users.get(id)
    if (updated) await enqueueSync('users', 'upsert', updated)
  }

  async function handleResetPin() {
    if (!resetting || resetPin.length !== 4) {
      show('Enter a 4-digit PIN', 'error')
      return
    }
    if (await pinInUse(resetPin, resetting.id)) {
      show('That PIN is already in use', 'error')
      return
    }
    const pinSalt = generateSalt()
    const pinHash = await hashPin(resetPin, pinSalt)
    await db.users.update(resetting.id, { pinHash, pinSalt })
    const updated = await db.users.get(resetting.id)
    if (updated) await enqueueSync('users', 'upsert', updated)
    show(`PIN reset for ${resetting.name}`)
    setResetting(null)
    setResetPin('')
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Add Staff</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>PIN (4 digits)</Label>
            <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <Button className="w-full" onClick={handleAdd}>Add Staff Member</Button>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Staff</CardTitle></CardHeader>
        <CardBody>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 text-ink">{u.name}</td>
                  <td className="py-2 capitalize text-ink-secondary">{u.role}</td>
                  <td className="py-2"><Badge tone={u.active ? 'gold' : 'coral'}>{u.active ? 'Active' : 'Disabled'}</Badge></td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end">
                      <button
                        onClick={() => { setResetting(u); setResetPin('') }}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
                      >
                        Reset PIN
                      </button>
                      <button
                        onClick={() => toggleActive(u.id, u.active)}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-gold-700 hover:underline"
                      >
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {resetting && (
        <Modal open onClose={() => setResetting(null)} title={`Reset PIN — ${resetting.name}`} width="sm" footer={
          <>
            <Button variant="secondary" onClick={() => setResetting(null)}>Cancel</Button>
            <Button onClick={handleResetPin}>Set New PIN</Button>
          </>
        }>
          <Label>New PIN (4 digits)</Label>
          <Input
            value={resetPin}
            onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            autoFocus
          />
        </Modal>
      )}
    </div>
  )
}
