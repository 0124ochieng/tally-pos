const KEYS = {
  receiptFooter: 'hymes-pos-receipt-footer',
  shopName: 'hymes-pos-shop-name',
  shopAddress: 'hymes-pos-shop-address',
  adminTimeoutSeconds: 'hymes-pos-admin-timeout-seconds',
  staffTimeoutSeconds: 'hymes-pos-staff-timeout-seconds',
} as const

// Per-customer default, set once per build in .env when a new install is
// restructured for a different business (see VITE_BUSINESS_NAME in
// .env.example). The shop owner can still rename it anytime in Settings —
// this is only the starting value on a fresh install.
const DEFAULT_BUSINESS_NAME = (import.meta.env.VITE_BUSINESS_NAME as string | undefined) || 'My Shop'

export const DEFAULT_INACTIVITY_TIMEOUT_SECONDS = 30
export const MIN_INACTIVITY_TIMEOUT_SECONDS = 5

export function getSetting(key: keyof typeof KEYS, fallback = '') {
  return localStorage.getItem(KEYS[key]) ?? fallback
}

export function setSetting(key: keyof typeof KEYS, value: string) {
  localStorage.setItem(KEYS[key], value)
}

export function getBusinessName() {
  return getSetting('shopName', DEFAULT_BUSINESS_NAME)
}

export function getInactivityTimeoutSeconds(role: 'admin' | 'staff') {
  const raw = getSetting(role === 'admin' ? 'adminTimeoutSeconds' : 'staffTimeoutSeconds')
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= MIN_INACTIVITY_TIMEOUT_SECONDS ? parsed : DEFAULT_INACTIVITY_TIMEOUT_SECONDS
}

export function setInactivityTimeoutSeconds(role: 'admin' | 'staff', seconds: number) {
  setSetting(role === 'admin' ? 'adminTimeoutSeconds' : 'staffTimeoutSeconds', String(seconds))
}
