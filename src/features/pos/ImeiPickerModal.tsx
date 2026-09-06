import { Modal } from '../../components/ui/Modal'
import type { Product, Serial } from '../../lib/db'

interface ImeiPickerModalProps {
  product: Product
  serials: Serial[]
  onClose: () => void
  onSelect: (imei: string) => void
}

export function ImeiPickerModal({ product, serials, onClose, onSelect }: ImeiPickerModalProps) {
  return (
    <Modal open onClose={onClose} title={`Select unit — ${product.name}`}>
      {serials.length === 0 && <p className="text-sm text-ink-muted">No units with recorded IMEI in stock.</p>}
      <div className="space-y-2">
        {serials.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.imei)}
            className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:border-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/10"
          >
            <span className="font-mono text-ink-secondary">{s.imei}</span>
            <span className="text-gold-600">Select</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
