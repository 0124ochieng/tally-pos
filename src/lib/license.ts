import { getMachineId, readActivation, writeActivation, type StoredActivation } from './activationStorage'

// Replace after running `node vendor-tools/generate-vendor-keypair.mjs`.
// This is a PUBLIC key — safe to ship in the app. It can only verify
// signatures, never create them.
const EMBEDDED_PUBLIC_KEY_B64 = 'V/Ic+CkT8/u4tz2VqH8taP6Kl7piZfA3sQV7WG2oNOc='

// Point this at your deployed vendor Supabase project's Edge Function once
// it exists (see vendor-supabase/activate-license).
const ACTIVATION_ENDPOINT = import.meta.env.VITE_ACTIVATION_ENDPOINT as string | undefined

export interface ActivationCert {
  businessName: string
  licenseId: string
  deviceId: string
  issuedAt: number
  expiresAt: number | null
  // Optional: this product is local-first by default (all data lives on
  // the till's own computer). These are only present for an install that
  // has separately opted into the cloud-backup add-on for that business —
  // most installs will never have them.
  supabaseUrl?: string
  supabaseAnonKey?: string
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importPublicKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(EMBEDDED_PUBLIC_KEY_B64), { name: 'Ed25519' }, false, ['verify'])
}

/** Verifies signature + device binding; does NOT parse/trust the cert until this passes. */
async function verifyStored(stored: StoredActivation, currentDeviceId: string): Promise<ActivationCert | null> {
  try {
    const key = await importPublicKey()
    const data = new TextEncoder().encode(stored.certString)
    const sig = base64ToBytes(stored.signatureB64)
    const validSignature = await crypto.subtle.verify('Ed25519', key, sig, data)
    if (!validSignature) return null

    const cert = JSON.parse(stored.certString) as ActivationCert
    if (cert.deviceId !== currentDeviceId) return null
    if (cert.expiresAt && cert.expiresAt < Date.now()) return null
    return cert
  } catch {
    return null
  }
}

export type LicenseState =
  | { status: 'checking' }
  | { status: 'unactivated' }
  | { status: 'activated'; cert: ActivationCert }

export async function checkLicense(): Promise<LicenseState> {
  const deviceId = await getMachineId()
  const stored = await readActivation()
  if (!stored) return { status: 'unactivated' }

  const cert = await verifyStored(stored, deviceId)
  return cert ? { status: 'activated', cert } : { status: 'unactivated' }
}

export async function activateWithKey(licenseKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ACTIVATION_ENDPOINT) {
    return { ok: false, error: "Setup isn't ready yet. Contact support for help." }
  }
  const deviceId = await getMachineId()

  let response: Response
  try {
    response = await fetch(ACTIVATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, deviceId }),
    })
  } catch {
    return { ok: false, error: "Couldn't connect to the internet. Check your connection and try again." }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    return { ok: false, error: body.error ?? "That didn't work. Check your license key and try again." }
  }

  const { certString, signatureB64 } = await response.json()
  const stored: StoredActivation = { certString, signatureB64 }

  const verified = await verifyStored(stored, deviceId)
  if (!verified) {
    return { ok: false, error: 'Something went wrong on our end. Contact support for help.' }
  }

  await writeActivation(stored)
  return { ok: true }
}
