import { useMemo, useState } from 'react'
import { Banknote, Smartphone, CheckCircle2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { completeSale, type CartLine } from '../../lib/salesService'
import { confirmMpesaPayment } from '../../lib/paymentProviders/mpesaDemo'
import type { Sale } from '../../lib/db'
import { Receipt } from './Receipt'
import { useToast } from '../../components/ui/Toast'

interface PaymentModalProps {
  subtotal: number
  cashierId: string
  lines: CartLine[]
  onClose: () => void
  onComplete: () => void
}

type Step = 'method' | 'cash' | 'mpesa' | 'receipt'

const QUICK_NOTES = [50, 100, 200, 500, 1000]

export function PaymentModal({ subtotal, cashierId, lines, onClose, onComplete }: PaymentModalProps) {
  const { show } = useToast()
  const [step, setStep] = useState<Step>('method')
  const [discount, setDiscount] = useState(0)
  const [tendered, setTendered] = useState(0)
  const [mpesaRefInput, setMpesaRefInput] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sale, setSale] = useState<Sale | null>(null)

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount])
  const change = tendered - total

  async function finalizeCash() {
    try {
      const newSale = await completeSale({ cashierId, lines, discount, paymentMethod: 'cash', mpesaRef: null, amountTendered: tendered })
      setSale(newSale)
      setStep('receipt')
      show('Sale completed — cash')
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't complete the sale", 'error')
    }
  }

  async function finalizeMpesa() {
    if (!mpesaRefInput.trim()) return
    setConfirming(true)
    try {
      const { mpesaRef } = await confirmMpesaPayment(total, mpesaRefInput)
      const newSale = await completeSale({ cashierId, lines, discount, paymentMethod: 'mpesa', mpesaRef, amountTendered: null })
      setSale(newSale)
      setStep('receipt')
      show('Sale completed — M-Pesa')
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't complete the sale", 'error')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={step === 'receipt' ? 'Receipt' : 'Payment'} width={step === 'receipt' ? 'sm' : 'md'}>
      {step === 'method' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-secondary">Subtotal</span>
            <span className="text-sm font-medium text-ink">KES {subtotal.toLocaleString()}</span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-secondary">Discount (KES, optional)</label>
            <input
              type="number"
              min={0}
              max={subtotal}
              value={discount || ''}
              onChange={(e) => setDiscount(Math.min(subtotal, Math.max(0, Number(e.target.value))))}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30"
              placeholder="0"
            />
          </div>
          <div>
            <p className="text-sm text-ink-secondary">Total due</p>
            <p className="text-3xl font-bold text-ink">KES {total.toLocaleString()}</p>
          </div>

          <button
            onClick={() => { setTendered(total); setStep('cash') }}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-gold-300"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><Banknote size={20} /></span>
            <span>
              <span className="block text-sm font-semibold text-ink">Cash</span>
              <span className="block text-xs text-ink-muted">Type how much they paid, and we'll work out their change</span>
            </span>
          </button>

          <button
            onClick={() => setStep('mpesa')}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-cyan-300"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700"><Smartphone size={20} /></span>
            <span>
              <span className="block text-sm font-semibold text-ink">M-Pesa</span>
              <span className="block text-xs text-ink-muted">Confirm once the payment text comes in</span>
            </span>
          </button>
        </div>
      )}

      {step === 'cash' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-surface-alt px-4 py-3">
            <span className="text-sm text-ink-secondary">Total due</span>
            <span className="text-lg font-bold text-ink">KES {total.toLocaleString()}</span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-secondary">How Much They Paid</label>
            <input
              type="number"
              value={tendered || ''}
              onChange={(e) => setTendered(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && tendered >= total && finalizeCash()}
              className="h-14 w-full rounded-xl border border-border bg-surface px-4 text-2xl font-bold text-ink focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30"
              placeholder="0"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTendered(total)} className="rounded-lg bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-800">Exact</button>
            {QUICK_NOTES.map((n) => (
              <button key={n} onClick={() => setTendered((t) => t + n)} className="rounded-lg bg-surface-alt px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-border">
                +{n}
              </button>
            ))}
            <button onClick={() => setTendered(0)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-coral-500">Clear</button>
          </div>

          <div className={`rounded-xl px-4 py-3 text-center ${change >= 0 ? 'bg-gold-50 dark:bg-gold-900/20' : 'bg-coral-50 dark:bg-coral-900/20'}`}>
            <p className="text-xs text-ink-muted">{change >= 0 ? 'Change Due' : 'Amount Short'}</p>
            <p className={`text-2xl font-bold ${change >= 0 ? 'text-gold-700 dark:text-gold-400' : 'text-coral-600 dark:text-coral-400'}`}>
              KES {Math.abs(change).toLocaleString()}
            </p>
          </div>

          <Button className="w-full" size="lg" disabled={tendered < total} onClick={finalizeCash}>
            Confirm Cash Payment
          </Button>
        </div>
      )}

      {step === 'mpesa' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-surface-alt px-4 py-3">
            <span className="text-sm text-ink-secondary">Total due</span>
            <span className="text-lg font-bold text-ink">KES {total.toLocaleString()}</span>
          </div>
          <p className="text-sm text-ink-secondary">
            Once the M-Pesa text comes in on the till phone, type the confirmation code from it below.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-secondary">M-Pesa Confirmation Code</label>
            <input
              type="text"
              value={mpesaRefInput}
              onChange={(e) => setMpesaRefInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && mpesaRefInput.trim() && finalizeMpesa()}
              placeholder="e.g. QGH7X8Y9Z0"
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-lg font-semibold uppercase tracking-wide text-ink focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30"
              autoFocus
            />
          </div>
          <Button className="w-full" size="lg" disabled={confirming || !mpesaRefInput.trim()} onClick={finalizeMpesa}>
            <CheckCircle2 size={18} /> {confirming ? 'Confirming…' : 'Confirm Payment Received'}
          </Button>
        </div>
      )}

      {step === 'receipt' && sale && (
        <div>
          <Receipt sale={sale} />
          <div className="mt-4 flex gap-2 print:hidden">
            <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
              Print / Save PDF
            </Button>
            <Button className="flex-1" onClick={onComplete}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
