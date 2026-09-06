import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let configured = false

/**
 * Call once at app bootstrap (see app/LicenseGate.tsx), before any code
 * reads getSupabase()/getIsCloudConfigured(). With no args, falls back to
 * .env values (local dev / VITE_SKIP_ACTIVATION). With args, uses the
 * per-customer credentials returned by license activation — each
 * activated install syncs to its own business's Supabase project.
 */
export function initSupabase(url?: string, anonKey?: string) {
  const finalUrl = url ?? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  const finalKey = anonKey ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  configured = Boolean(finalUrl && finalKey)
  client = configured ? createClient(finalUrl!, finalKey!) : null
}

export function getSupabase() {
  return client
}

export function getIsCloudConfigured() {
  return configured
}
