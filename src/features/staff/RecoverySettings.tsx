import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldQuestion, RefreshCw } from 'lucide-react'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../lib/db'
import { generateRecoveryCode } from '../../lib/pin'
import { setRecoveryCode, hasRecoveryCode } from '../../lib/recovery'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'

/** Lets the signed-in admin set up (or replace) their own "forgot PIN"
 * recovery code — see Login.tsx for where it's redeemed. Scoped to the
 * current admin's own account only: recovery is per-account, same as PIN
 * login has no separate "which user" step, so each admin who wants this
 * protection sets up their own code here. */
export function RecoverySettings() {
  const { user: currentUser } = useAuth()
  const { show } = useToast()
  const liveUser = useLiveQuery(
    () => (currentUser ? db.users.get(currentUser.id) : undefined),
    [currentUser?.id],
  )
  const configured = hasRecoveryCode(liveUser)

  const [modalOpen, setModalOpen] = useState(false)
  const [code, setCode] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)

  function openModal() {
    setCode(generateRecoveryCode())
    setAcknowledged(false)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!currentUser || !acknowledged) return
    setSaving(true)
    await setRecoveryCode(currentUser.id, code)
    setSaving(false)
    setModalOpen(false)
    show('Recovery code saved')
  }

  if (!currentUser) return null

  return (
    <Card>
      <CardHeader><CardTitle>PIN Recovery</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            If you ever forget your PIN, this code is the only way back into your own account without
            reinstalling. It's tied to your account ({currentUser.name}) — each admin who wants this
            protection sets up their own.
          </p>
          <Badge tone={configured ? 'gold' : 'coral'} className="shrink-0">
            {configured ? 'Set up' : 'Not set up'}
          </Badge>
        </div>
        <Button variant={configured ? 'secondary' : 'primary'} onClick={openModal}>
          {configured ? <RefreshCw size={14} /> : <ShieldQuestion size={14} />}
          {configured ? 'Regenerate Recovery Code' : 'Set Up Recovery Code'}
        </Button>
      </CardBody>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Your PIN Recovery Code"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!acknowledged || saving}>Save</Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-secondary">
          Write this down or save it somewhere safe — you'll need it on the login screen if you ever
          forget your PIN.
          {configured && ' Saving replaces your old code, which stops working immediately.'}
        </p>
        <p className="mb-4 rounded-xl border border-border bg-surface-alt py-4 text-center font-mono text-2xl font-bold tracking-[0.3em] text-ink">
          {code}
        </p>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-border text-gold-500"
          />
          I've saved this code
        </label>
      </Modal>
    </Card>
  )
}
