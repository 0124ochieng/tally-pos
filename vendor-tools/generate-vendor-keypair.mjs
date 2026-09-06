// Run ONCE, by you (the vendor), never on a customer machine and never
// committed to a repo that customers or contractors can see.
//
//   node vendor-tools/generate-vendor-keypair.mjs
//
// Produces two things:
//   1. A private key (JWK) — paste this into your Supabase project's Edge
//      Function secrets as VENDOR_PRIVATE_KEY_JWK. It signs activation
//      certificates at activation time. Never put it in the app itself.
//   2. A public key (base64, raw 32 bytes) — paste this into
//      src/lib/license.ts as EMBEDDED_PUBLIC_KEY_B64. It ships inside the
//      app and only ever verifies signatures, never creates them.
//
// If you ever need to rotate keys, generate a new pair, update both
// places, and re-activate existing customers (old cached certs will stop
// verifying against the new public key, which is the point).

import { generateKeyPair } from 'node:crypto'
import { promisify } from 'node:util'

const generate = promisify(generateKeyPair)

function base64UrlToBase64(b64url) {
  return b64url.replace(/-/g, '+').replace(/_/g, '/')
}

async function main() {
  const { publicKey, privateKey } = await generate('ed25519')

  const publicJwk = publicKey.export({ format: 'jwk' })
  const privateJwk = privateKey.export({ format: 'jwk' })

  const publicKeyRawB64 = Buffer.from(base64UrlToBase64(publicJwk.x), 'base64').toString('base64')

  console.log('\n=== VENDOR PRIVATE KEY (JWK) — set as Supabase secret VENDOR_PRIVATE_KEY_JWK ===\n')
  console.log(JSON.stringify(privateJwk))
  console.log('\n=== EMBEDDED PUBLIC KEY (base64, raw 32 bytes) — paste into src/lib/license.ts ===\n')
  console.log(publicKeyRawB64)
  console.log('\nKeep the private key secret. Losing it means you can no longer issue')
  console.log('activations that existing installs will trust unless you also redistribute')
  console.log('a new build with a rotated public key.\n')
}

main()
