import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Download, ShieldAlert } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input, Label } from './Input'
import { useAuth } from '../../app/AuthContext'
import { hashPin } from '../../lib/pin'
import { exportFullReport } from '../../lib/exportService'
import { getBusinessName } from '../../lib/settings'

type Step = 'intro' | 'backup' | 'confirm-name' | 'confirm-pin' | 'working' | 'done'

interface DangerWizardProps {
  open: boolean
  onClose: () => void
  title: string
  /** Plain-language list of what this action removes. */
  deletes: string[]
  /** Plain-language list of what this action leaves untouched. */
  keeps: string[]
  /** Extra warning shown above the checklist — use for the more serious action. */
  extraWarning?: ReactNode
  confirmButtonLabel: string
  /** Runs the actual deletion. Return a short list of result lines to show on the done screen. */
  onExecute: () => Promise<string[]>
}

/** A deliberately slow, multi-step path to an irreversible action: show
 * exactly what happens, force a backup, make the person type their own
 * name, then re-enter their PIN. Nothing here is a formality — each step
 * exists because skipping it is how someone loses data they needed. */
export function DangerWizard({ open, onClose, title, deletes, keeps, extraWarning, confirmButtonLabel, onExecute }: DangerWizardProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('intro')
  const [backedUp, setBackedUp] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [resultLines, setResultLines] = useState<string[]>([])

  function reset() {
    setStep('intro')
    setBackedUp(false)
    setBackingUp(false)
    setNameInput('')
    setPin('')
    setPinError('')
    setResultLines([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleDownloadBackup() {
    setBackingUp(true)
    try {
      await exportFullReport()
      setBackedUp(true)
    } finally {
      setBackingUp(false)
    }
  }

  async function handlePinSubmit() {
    if (!user) return
    const hash = await hashPin(pin, user.pinSalt)
    if (hash !== user.pinHash) {
      setPinError("That PIN doesn't match your account. Try again.")
      return
    }
    setPinError('')
    setStep('working')
    try {
      const lines = await onExecute()
      setResultLines(lines)
      setStep('done')
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Something went wrong. Nothing was deleted.')
      setStep('confirm-pin')
    }
  }

  const shopName = getBusinessName()
  const nameMatches = nameInput.trim().toLowerCase() === shopName.trim().toLowerCase()

  return (
    <Modal open={open} onClose={step === 'working' ? () => {} : handleClose} title={title} width="md">
      {step === 'intro' && (
        <div className="space-y-4">
          {extraWarning}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-coral-600 dark:text-coral-400">
              <AlertTriangle size={15} /> This gets deleted for good:
            </p>
            <ul className="space-y-1 pl-1 text-sm text-ink-secondary">
              {deletes.map((d) => (
                <li key={d} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-400" /> {d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Check size={15} /> This stays exactly as it is:
            </p>
            <ul className="space-y-1 pl-1 text-sm text-ink-secondary">
              {keeps.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" /> {k}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="destructive" onClick={() => setStep('backup')}>Continue</Button>
          </div>
        </div>
      )}

      {step === 'backup' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Before anything is deleted, save a copy of everything to a file on this computer. If you ever
            need to look something up later, this file is the only place it will still exist.
          </p>
          <Button variant="secondary" onClick={handleDownloadBackup} disabled={backingUp} className="w-full">
            <Download size={15} /> {backingUp ? 'Preparing your backup file…' : 'Download a backup first'}
          </Button>
          {backedUp && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-gold-700 dark:text-gold-400">
              <Check size={15} /> Backup downloaded. Keep it somewhere safe.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="destructive" disabled={!backedUp} onClick={() => setStep('confirm-name')}>Continue</Button>
          </div>
        </div>
      )}

      {step === 'confirm-name' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            To make sure this is really what you want, type the shop name exactly as shown to continue.
          </p>
          <p className="rounded-xl border border-border bg-surface-alt px-3 py-2 text-center text-sm font-semibold text-ink">
            {shopName}
          </p>
          <div>
            <Label>Type the shop name</Label>
            <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="destructive" disabled={!nameMatches} onClick={() => setStep('confirm-pin')}>Continue</Button>
          </div>
        </div>
      )}

      {(step === 'confirm-pin' || step === 'working') && (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Last step — enter your PIN to confirm. This will start deleting right away.
          </p>
          <div>
            <Label>Your PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              disabled={step === 'working'}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            />
            {pinError && <p className="mt-1.5 text-xs text-coral-500">{pinError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose} disabled={step === 'working'}>Cancel</Button>
            <Button variant="destructive" onClick={handlePinSubmit} disabled={!pin || step === 'working'}>
              {step === 'working' ? 'Deleting…' : confirmButtonLabel}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gold-700 dark:text-gold-400">
            <ShieldAlert size={15} /> Done.
          </p>
          <ul className="space-y-1 pl-1 text-sm text-ink-secondary">
            {resultLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
