// Runs before electron:build. Refuses to produce a customer installer if
// the license is still unconfigured — this is what stands between "runs
// the build" and "accidentally ships an unlocked, unpaid copy".
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function fail(message) {
  console.error(`\n✖ Release check failed: ${message}\n`)
  process.exit(1)
}

const licenseSrc = fs.readFileSync(path.join(root, 'src/lib/license.ts'), 'utf-8')
if (licenseSrc.includes('REPLACE_WITH_GENERATED_PUBLIC_KEY')) {
  fail(
    'src/lib/license.ts still has the placeholder EMBEDDED_PUBLIC_KEY_B64. ' +
      'Run `node vendor-tools/generate-vendor-keypair.mjs` and paste the printed public key in before building a customer release.',
  )
}

const envPath = path.join(root, '.env')
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

if (/^VITE_SKIP_ACTIVATION\s*=\s*true\s*$/m.test(env)) {
  fail('.env has VITE_SKIP_ACTIVATION=true. Remove this line before building a customer release — it ships a copy that skips license activation entirely.')
}

const endpointMatch = env.match(/^VITE_ACTIVATION_ENDPOINT\s*=\s*(.*)$/m)
if (!endpointMatch || !endpointMatch[1].trim()) {
  fail('.env has no VITE_ACTIVATION_ENDPOINT set. A customer build needs this pointed at your deployed vendor activate-license function.')
}

console.log('✔ Release config check passed — license is configured for a real customer build.')
