// Deploy to your VENDOR Supabase project (not a customer's):
//   supabase functions deploy activate-license --project-ref <your-vendor-project-ref>
//   supabase secrets set VENDOR_PRIVATE_KEY_JWK='<paste from generate-vendor-keypair.mjs>' --project-ref <your-vendor-project-ref>
//
// This function holds the only copy of the vendor private key that ever
// leaves your machine — it runs server-side, so the key is never exposed to
// any customer install. It validates a license key + device fingerprint,
// enforces the per-license device limit, and signs an activation
// certificate the app can verify offline forever after (see src/lib/license.ts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PRIVATE_KEY_JWK = JSON.parse(Deno.env.get('VENDOR_PRIVATE_KEY_JWK')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// A legitimate device only ever needs to call this a handful of times
// (first activation, maybe a retry). This is generous enough to never
// bother a real customer while still closing off scripted hammering.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_ATTEMPTS = 10

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { licenseKey?: string; deviceId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const licenseKey = (body.licenseKey ?? '').trim().toUpperCase()
  const deviceId = (body.deviceId ?? '').trim()
  if (!licenseKey || !deviceId) return json({ error: 'License key and device ID are required' }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count: recentAttempts } = await supabase
    .from('activation_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('license_key', licenseKey)
    .gte('created_at', windowStart)

  if ((recentAttempts ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return json({ error: 'Too many activation attempts for this license key. Try again later or contact support.' }, 429)
  }
  await supabase.from('activation_attempts').insert({ license_key: licenseKey, device_id: deviceId })

  const { data: license, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', licenseKey)
    .maybeSingle()

  if (error || !license) return json({ error: 'License key not found' }, 404)
  if (license.revoked) return json({ error: 'This license has been revoked. Contact support.' }, 403)

  const activatedDevices: string[] = license.activated_device_ids ?? []
  const alreadyActivated = activatedDevices.includes(deviceId)

  if (!alreadyActivated) {
    if (activatedDevices.length >= license.device_limit) {
      return json({ error: `This license is already active on ${license.device_limit} device(s). Contact support to add more.` }, 403)
    }
    const { error: updateError } = await supabase
      .from('licenses')
      .update({ activated_device_ids: [...activatedDevices, deviceId] })
      .eq('id', license.id)
    if (updateError) return json({ error: 'Could not record activation. Try again.' }, 500)
  }

  const cert = {
    businessName: license.business_name,
    licenseId: license.id,
    deviceId,
    issuedAt: Date.now(),
    expiresAt: null as number | null,
    supabaseUrl: license.customer_supabase_url,
    supabaseAnonKey: license.customer_supabase_anon_key,
  }

  const certString = JSON.stringify(cert)
  const privateKey = await crypto.subtle.importKey('jwk', PRIVATE_KEY_JWK, { name: 'Ed25519' }, false, ['sign'])
  const signature = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(certString))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

  return json({ certString, signatureB64 })
})
