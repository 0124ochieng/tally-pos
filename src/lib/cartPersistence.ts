import type { CartLine } from './salesService'

// Persists the in-progress sale so a sign-out (manual, inactivity timeout,
// or Switch to Admin) doesn't lose items sitting on the counter. Tied to the
// till itself, not the signed-in user — the physical cart doesn't change
// just because a different PIN is entered.
const KEY = 'hymes-pos-active-cart'

export function saveCart(cart: CartLine[]) {
  if (cart.length === 0) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(KEY, JSON.stringify(cart))
}

export function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearCart() {
  localStorage.removeItem(KEY)
}
