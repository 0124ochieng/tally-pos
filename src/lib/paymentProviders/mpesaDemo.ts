// Manual M-Pesa confirmation — stands in for the Safaricom Daraja API,
// which isn't available yet. The cashier reads the real confirmation code
// off the SMS that lands on the till phone and types it into the app here;
// this function normalizes it the same shape a real API response would
// have. Swap this for a real Daraja call later (same signature, same
// return shape) — nothing else in the app needs to change.
//
// This used to fabricate a random reference instead of asking for the real
// one — every M-Pesa receipt carried a code that matched nothing in the
// shop's actual M-Pesa statement, which is a real problem for reconciling
// or handling a customer dispute. Recording the cashier-entered code fixes
// that without needing the real Daraja integration yet.

export async function confirmMpesaPayment(_amount: number, mpesaRef: string): Promise<{ mpesaRef: string }> {
  return { mpesaRef: mpesaRef.trim().toUpperCase() }
}
