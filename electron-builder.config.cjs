// electron-builder config as a JS file (not JSON) specifically so the
// product name can read VITE_BUSINESS_NAME from .env — this is the one
// place you edit, once per customer, when restructuring this build for a
// different business (see .env.example).
const fs = require('node:fs')
const path = require('node:path')

function readEnvVar(name, fallback) {
  try {
    const content = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8')
    const match = content.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return match ? match[1].trim() : fallback
  } catch {
    return fallback
  }
}

const businessName = readEnvVar('VITE_BUSINESS_NAME', 'My Shop')
const updateUrl = readEnvVar('VITE_UPDATE_URL', '')

module.exports = {
  // Deliberately NOT derived from the business name, unlike productName
  // below. This id is what Windows and electron-updater use to recognize
  // "this install and that update are the same app" — if it changed per
  // customer, one shared update feed could never work, and worse, Electron
  // derives the userData folder from the app identity, so a mismatched id
  // on update could make a customer's existing local database look like it
  // vanished. Keep this constant forever; only productName (cosmetic,
  // shown in the Start Menu / taskbar / installer) is branded per sale.
  appId: 'com.reachdigitalexperts.pos',
  productName: `${businessName} - Tally`,
  copyright: 'Copyright © REACH Digital Experts',
  directories: { output: 'release' },
  files: ['dist/**/*', 'electron/**/*', 'package.json'],
  win: {
    target: 'nsis',
    // No .ico shipped yet — electron-builder falls back to its own default
    // icon. Add build/icon.ico (256x256) and uncomment the line below
    // before shipping a real customer build.
    // icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
  },
  // Only wired up when VITE_UPDATE_URL is set in .env (see .env.example) —
  // a build without it simply never checks for updates, so this stays a
  // no-op until you actually stand up a static file host for releases.
  // A "generic" provider is just a folder of files (latest.yml + the
  // installer) served over HTTPS — no vendor lock-in to any one host.
  ...(updateUrl ? { publish: [{ provider: 'generic', url: updateUrl }] } : {}),
}
