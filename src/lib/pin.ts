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
