// Staff PINs are hashed (salted SHA-256) before they ever touch local
// storage or Supabase sync — never store or compare raw PIN digits.

export function generateSalt(): string {
  return crypto.randomUUID()
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** A 6-digit PIN-recovery code, hashed with the same hashPin/generateSalt
 * pair above. Wider keyspace than a 4-digit PIN, generated once and shown
 * to the admin a single time — never stored or logged in plaintext. */
export function generateRecoveryCode(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}
