// Run this once per sale, on your own machine — never on a customer's.
//
//   VENDOR_SUPABASE_URL=... VENDOR_SUPABASE_SERVICE_KEY=... \
//     node vendor-tools/keygen.mjs \
//       --business "Hymes Gadgets" \
//       --customer-url "https://xxxx.supabase.co" \
//       --customer-anon-key "eyJ..." \
//       --devices 2
//
// Writes one row to your vendor project's `licenses` table and prints the
// key to hand to the customer. VENDOR_SUPABASE_SERVICE_KEY is your vendor
// project's service-role key — keep it out of source control, pass it as
// an environment variable each time (or via a local untracked .env you
// source in your shell).

import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L ambiguity

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i === -1 ? undefined : args[i + 1]
  }
  return {
    business: get('--business'),
    customerUrl: get('--customer-url'),
    customerAnonKey: get('--customer-anon-key'),
    devices: Number(get('--devices') ?? '2'),
  }
}

function generateLicenseKey() {
  const group = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return `REA-${group()}-${group()}-${group()}`
}

async function main() {
  const { business, customerUrl, customerAnonKey, devices } = parseArgs()
  if (!business || !customerUrl || !customerAnonKey) {
    console.error('Usage: node vendor-tools/keygen.mjs --business "Name" --customer-url "..." --customer-anon-key "..." [--devices 2]')
    process.exit(1)
  }

  const vendorUrl = process.env.VENDOR_SUPABASE_URL
  const vendorServiceKey = process.env.VENDOR_SUPABASE_SERVICE_KEY
  if (!vendorUrl || !vendorServiceKey) {
    console.error('Set VENDOR_SUPABASE_URL and VENDOR_SUPABASE_SERVICE_KEY environment variables first.')
    process.exit(1)
  }

  const supabase = createClient(vendorUrl, vendorServiceKey)
  const licenseKey = generateLicenseKey()

  const { error } = await supabase.from('licenses').insert({
    license_key: licenseKey,
    business_name: business,
    customer_supabase_url: customerUrl,
    customer_supabase_anon_key: customerAnonKey,
    device_limit: devices,
    activated_device_ids: [],
    revoked: false,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to write license:', error.message)
    process.exit(1)
  }

  console.log(`\nLicense created for "${business}"`)
  console.log(`Devices allowed: ${devices}`)
  console.log(`\nLicense key (give this to the customer):\n\n  ${licenseKey}\n`)
}

main()
