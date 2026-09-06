// Runs after `vite build`, before electron-builder packages the app.
// Obfuscates the app's own bundled code — not vendored third-party
// chunks (already minified, not proprietary, obfuscating them would
// only slow the build for no benefit) and not the service worker files.
//
// Some pages (Dashboard, Reports) are lazy-loaded into their own chunks
// (see src/App.tsx) instead of living inside index-*.js, so this can't
// just target one filename prefix — it obfuscates every chunk EXCEPT the
// ones known to be pure vendor code. A lazy chunk built purely from our
// own component code (e.g. DashboardPage-*.js) gets fully obfuscated;
// one that also happens to bundle a large vendor lib alongside our code
// (e.g. the chart components, which pull in recharts) still gets
// obfuscated too — the point is protecting the first-party logic mixed
// into it, even if that costs a bit more build time on the vendor's own
// machine (this never runs on a customer's PC).
//
// This raises the bar against casual reverse engineering; it does not make
// the code unreadable to a determined, skilled attacker — see the
// discussion in the licensing plan for what actually protects this product.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JavaScriptObfuscator from 'javascript-obfuscator'

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets')

// Chunk name prefixes known to be pure vendored/build-tool code, never
// our own source — skip these on purpose (see comment above).
const VENDOR_CHUNK_PREFIXES = ['exceljs', 'rolldown-runtime', 'workbox-']

function main() {
  let files
  try {
    files = readdirSync(ASSETS_DIR)
  } catch {
    console.error('dist/assets not found — run `vite build` first.')
    process.exit(1)
  }

  const targets = files.filter(
    (f) => f.endsWith('.js') && !VENDOR_CHUNK_PREFIXES.some((prefix) => f.startsWith(prefix)),
  )
  if (targets.length === 0) {
    console.warn('No app JS bundle found to obfuscate.')
    return
  }

  for (const file of targets) {
    const filePath = join(ASSETS_DIR, file)
    const source = readFileSync(filePath, 'utf-8')
    const result = JavaScriptObfuscator.obfuscate(source, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.2,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      selfDefending: true,
      disableConsoleOutput: false,
    })
    writeFileSync(filePath, result.getObfuscatedCode(), 'utf-8')
    console.log(`Obfuscated ${file}`)
  }
}

main()
