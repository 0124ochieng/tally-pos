const { app, BrowserWindow, ipcMain, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const { machineIdSync } = require('node-machine-id')
const { autoUpdater } = require('electron-updater')

// Electron's default userData folder is named after productName, which is
// deliberately different for every customer build (see
// electron-builder.config.cjs). If that were left alone, a customer's
// local database would live in a folder named after their business —
// harmless on its own, but it means an update that ever changed how
// productName gets computed could make the app start looking in a
// different folder and find no data at all. Pinning this to a fixed name
// keeps every install's data path stable across every future update,
// forever, independent of branding. Must be set before app is ready.
//
// Dev mode gets its own separate folder on purpose: on a machine that
// also has a real packaged build installed (e.g. testing `electron .`
// against the same computer a customer build was installed on), the two
// would otherwise fight over the same IndexedDB lock file — the packaged
// app being open at all makes every dev-mode launch fail with a
// "database closed" error, and worse, a dev session could corrupt or
// overwrite real business data. Never point these at the same folder.
const isDev = !app.isPackaged
// Escape hatch for testing a packaged build without ever touching a real
// customer's data folder (e.g. reproducing a packaging-only bug). Unset by
// default, so it changes nothing about normal dev or production behavior.
if (process.env.REACH_POS_TEST_DATA_DIR) {
  app.setPath('userData', process.env.REACH_POS_TEST_DATA_DIR)
} else {
  app.setPath('userData', path.join(app.getPath('appData'), isDev ? 'ReachPOSData-Dev' : 'ReachPOSData'))
}
// Escape hatch for diagnosing a customer's already-installed build (e.g. a
// blank-screen bug that produces no visible error): launch the installed
// .exe with REACH_POS_DEBUG=1 set to get DevTools back. Customers won't
// stumble onto this — it's an env var, not a menu item or shortcut — but
// you can reproduce whatever they're seeing without needing a dev rebuild.
const debugEnabled = isDev || process.env.REACH_POS_DEBUG === '1'
const ACTIVATION_FILE = () => path.join(app.getPath('userData'), 'activation.json')
const DELETION_LOG_FILE = () => path.join(app.getPath('userData'), 'deletion-log.txt')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    // The packaged .exe already carries this icon (see electron-builder.config.cjs),
    // but Windows shows the exe's own default icon for the window/taskbar in dev
    // mode unless one is set here explicitly.
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: debugEnabled,
    },
  })

  if (isDev) {
    win.loadURL(process.env.ELECTRON_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  if (process.env.REACH_POS_DEBUG === '1') {
    win.webContents.openDevTools()
  }
}

ipcMain.handle('get-machine-id', () => {
  try {
    // Bind to more than just the registry MachineGuid alone — that single
    // value can be overwritten with a one-line registry edit, which would
    // otherwise let an activated install be cloned onto different hardware.
    // CPU model is read from the real processor, not stored anywhere a user
    // can edit, and (unlike hostname or RAM) essentially never changes on an
    // existing machine, so this doesn't add any new false-deactivation risk.
    const raw = machineIdSync(true)
    const cpuModel = os.cpus()[0]?.model ?? ''
    return crypto.createHash('sha256').update(`${raw}|${cpuModel}`).digest('hex')
  } catch {
    return null
  }
})

ipcMain.handle('get-activation', () => {
  try {
    const raw = fs.readFileSync(ACTIVATION_FILE())
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return JSON.parse(safeStorage.decryptString(raw))
      } catch {
        // Pre-encryption installs wrote plain JSON — read it once, it'll be
        // re-saved encrypted the next time activation data is written.
        return JSON.parse(raw.toString('utf-8'))
      }
    }
    return JSON.parse(raw.toString('utf-8'))
  } catch {
    return null
  }
})

ipcMain.handle('set-activation', (_event, data) => {
  const json = JSON.stringify(data)
  const payload = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf-8')
  fs.writeFileSync(ACTIVATION_FILE(), payload)
  return true
})

ipcMain.handle('clear-activation', () => {
  try {
    fs.unlinkSync(ACTIVATION_FILE())
  } catch {
    // already absent
  }
  return true
})

// Written outside the app's own database on purpose: this is the one
// record of a data wipe that has to survive the wipe itself, so whoever
// looks at this PC later can see who deleted what, and when.
ipcMain.handle('append-deletion-log', (_event, line) => {
  try {
    fs.appendFileSync(DELETION_LOG_FILE(), `${line}\n`)
    return true
  } catch {
    return false
  }
})

// Auto-update: only meaningful once electron-builder.config.cjs has a
// `publish` block (i.e. VITE_UPDATE_URL was set at build time) — otherwise
// electron-updater has no feed to check and every call below simply
// rejects quietly, which is exactly the desired no-op for a build that
// hasn't opted into this yet. Downloads happen silently in the background;
// the renderer is only told once the update is fully downloaded and ready,
// so installing it is a deliberate "restart now" action, never a surprise
// interruption mid-sale.
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false

autoUpdater.on('update-downloaded', () => {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update-ready')
})

function checkForUpdatesQuietly() {
  if (isDev) return
  autoUpdater.checkForUpdates().catch(() => {
    // No update feed configured, or no internet right now — both are
    // completely normal for this product and never worth bothering anyone
    // about. It'll just try again on the next scheduled check.
  })
}

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  checkForUpdatesQuietly()
  setInterval(checkForUpdatesQuietly, FOUR_HOURS_MS)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
