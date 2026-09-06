// Demo M-Pesa confirmation — stands in for the Safaricom Daraja API, which
// isn't available yet. In real use the cashier reads the M-Pesa confirmation
// SMS on the till phone and taps "Confirm Payment Received"; this generates
// a reference the same way a real API response would, so the receipt still
// carries a transaction ref. Swap this for a real Daraja call later (same
// signature) — nothing else in the app needs to change.

function generateMpesaRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = ''
  for (let i = 0; i < 10; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}

export async function confirmMpesaPayment(_amount: number): Promise<{ mpesaRef: string }> {
  return { mpesaRef: generateMpesaRef() }
}
