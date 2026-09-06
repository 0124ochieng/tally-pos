// Runs after `vite build`, before electron-builder packages the app.
// Obfuscates the app's own bundled code — not vendored third-party
// chunks (already minified, not proprietary, obfuscating them would
// only slow the build for no benefit) and not the service worker files.
// Everything currently builds into a single index-*.js (no route-based
// code splitting — see the App.tsx history for why), so in practice
// there's just one file to obfuscate, but this still filters by prefix
// in case that ever changes.
//
// controlFlowFlattening and deadCodeInjection are deliberately OFF: they
// previously produced a real runtime bug (a Map lookup coming back
// `undefined` — "Cannot read properties of undefined (reading 'has')")
// that only showed up in the packaged, obfuscated build and only on the
// admin Dashboard/Reports code paths, never in dev mode. stringArray +
// hexadecimal identifiers still meaningfully raise the bar against casual
// reverse engineering without touching control flow, which is the safer
// trade-off here. This does not make the code unreadable to a determined,
// skilled attacker — see the discussion in the licensing plan for what
// actually protects this product.

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
      controlFlowFlattening: false,
      deadCodeInjection: false,
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
