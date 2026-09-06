// Runs after `vite build`, before electron-builder packages the app.
// Obfuscates only the app's own bundled code (dist/assets/index-*.js) —
// not third-party chunks like exceljs (already minified, not proprietary,
// obfuscating it would only slow the build for no benefit) and not the
// service worker/workbox files (obfuscating those risks breaking them).
//
// This raises the bar against casual reverse engineering; it does not make
// the code unreadable to a determined, skilled attacker — see the
// discussion in the licensing plan for what actually protects this product.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JavaScriptObfuscator from 'javascript-obfuscator'

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets')

function main() {
  let files
  try {
    files = readdirSync(ASSETS_DIR)
  } catch {
    console.error('dist/assets not found — run `vite build` first.')
    process.exit(1)
  }

  const targets = files.filter((f) => f.startsWith('index-') && f.endsWith('.js'))
  if (targets.length === 0) {
    console.warn('No index-*.js bundle found to obfuscate.')
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
