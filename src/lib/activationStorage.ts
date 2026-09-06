// Reads/writes the local activation record. Uses the Electron preload
// bridge when running inside the packaged desktop app; falls back to
// localStorage in a plain browser (local dev / `npm run dev`) so the same
// React code works in both places without branching everywhere.

export interface StoredActivation {
  certString: string
  signatureB64: string
}

declare global {
  interface Window {
    electronAPI?: {
      getMachineId: () => Promise<string | null>
      getActivation: () => Promise<StoredActivation | null>
      setActivation: (data: StoredActivation) => Promise<boolean>
      clearActivation: () => Promise<boolean>
    }
  }
}

const LOCAL_KEY = 'hymes-pos-activation'
const LOCAL_DEVICE_ID_KEY = 'hymes-pos-dev-device-id'

export function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI
}

export async function getMachineId(): Promise<string> {
  if (isElectron()) {
    const id = await window.electronAPI!.getMachineId()
    if (id) return id
  }
  // Browser dev fallback: a stable random id persisted in localStorage,
  // so repeated activation testing behaves consistently on one machine.
  let id = localStorage.getItem(LOCAL_DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(LOCAL_DEVICE_ID_KEY, id)
  }
  return id
}

export async function readActivation(): Promise<StoredActivation | null> {
  if (isElectron()) return window.electronAPI!.getActivation()
  const raw = localStorage.getItem(LOCAL_KEY)
  return raw ? JSON.parse(raw) : null
}

export async function writeActivation(data: StoredActivation): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.setActivation(data)
    return
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
}

export async function clearActivation(): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.clearActivation()
    return
  }
  localStorage.removeItem(LOCAL_KEY)
}
