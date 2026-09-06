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
const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'pos'

module.exports = {
  appId: `com.reachdigitalexperts.pos.${slug}`,
  productName: `${businessName} POS`,
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
}
