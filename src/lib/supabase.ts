import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let configured = false

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Call once at app bootstrap (see app/LicenseGate.tsx), before any code
 * reads getSupabase()/getIsCloudConfigured(). With no args, falls back to
 * .env values (local dev / VITE_SKIP_ACTIVATION). With args, uses the
 * per-customer credentials returned by license activation — each
 * activated install syncs to its own business's Supabase project.
 *
 * A malformed or placeholder URL here (e.g. a leftover value on an older
 * license record, or a slot the vendor left blank) must never crash the
 * whole app — @supabase/supabase-js's own `new URL(...)` calls throw
 * synchronously, and that throw can otherwise surface deep inside a
 * realtime subscription well after the login screen, taking the whole POS
 * down for a cashier mid-shift. Validate first and fail safe to "not
 * configured" instead.
 */
export function initSupabase(url?: string, anonKey?: string) {
  const finalUrl = url ?? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  const finalKey = anonKey ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

  if (finalUrl && finalKey && isValidHttpUrl(finalUrl)) {
    try {
      client = createClient(finalUrl, finalKey)
      configured = true
      return
    } catch (err) {
      console.error('Could not set up cloud sync — continuing in local-only mode.', err)
    }
  } else if (finalUrl || finalKey) {
    console.error(
      'Cloud sync credentials are present but invalid (bad URL or missing key) — continuing in local-only mode.',
    )
  }

  client = null
  configured = false
}

export function getSupabase() {
  return client
}

export function getIsCloudConfigured() {
  return configured
}
