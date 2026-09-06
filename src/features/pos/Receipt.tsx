import type { Sale } from '../../lib/db'
import { getSetting, getBusinessName } from '../../lib/settings'

export function Receipt({ sale }: { sale: Sale }) {
  const date = new Date(sale.createdAt)
  const shopName = getBusinessName()
  const shopAddress = getSetting('shopAddress')
  const footer = getSetting('receiptFooter', 'Thank you for shopping with us!')

  // Pinned to a literal white "paper" background regardless of app theme —
  // both because a thermal/A4 printer always prints black-on-white, and so
  // the on-screen preview stays legible even in dark mode.
  return (
    <div id="print-receipt" className="mx-auto w-full max-w-[280px] rounded-lg bg-white p-4 font-mono text-xs text-neutral-800 shadow-sm">
      <div className="text-center">
        <p className="text-sm font-bold">{shopName}</p>
        {shopAddress && <p>{shopAddress}</p>}
        <p>{date.toLocaleString()}</p>
      </div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      {sale.items.map((item, i) => (
        <div key={i} className="mb-1 flex justify-between gap-2">
          <span className="flex-1">
            {item.name}
            {item.imei && <span className="block text-[10px] text-neutral-500">IMEI {item.imei}</span>}
            <span className="block text-[10px] text-neutral-500">{item.qty} x KES {item.unitPrice.toLocaleString()}</span>
          </span>
          <span>{item.lineTotal.toLocaleString()}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <div className="flex justify-between"><span>Subtotal</span><span>KES {sale.subtotal.toLocaleString()}</span></div>
      {sale.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-KES {sale.discount.toLocaleString()}</span></div>}
      <div className="flex justify-between text-sm font-bold"><span>Total</span><span>KES {sale.total.toLocaleString()}</span></div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <p>Payment: {sale.paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'}</p>
      {sale.paymentMethod === 'cash' && sale.amountTendered != null && (
        <>
          <div className="flex justify-between"><span>Tendered</span><span>KES {sale.amountTendered.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Change</span><span>KES {(sale.changeGiven ?? 0).toLocaleString()}</span></div>
        </>
      )}
      {sale.mpesaRef && <p>Ref: {sale.mpesaRef}</p>}
      <p className="mt-3 text-center">{footer}</p>
    </div>
  )
}
