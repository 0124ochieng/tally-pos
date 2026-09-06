const { app, BrowserWindow, ipcMain, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const { machineIdSync } = require('node-machine-id')

const isDev = !app.isPackaged
// Escape hatch for diagnosing a customer's already-installed build (e.g. a
// blank-screen bug that produces no visible error): launch the installed
// .exe with REACH_POS_DEBUG=1 set to get DevTools back. Customers won't
// stumble onto this — it's an env var, not a menu item or shortcut — but
// you can reproduce whatever they're seeing without needing a dev rebuild.
const debugEnabled = isDev || process.env.REACH_POS_DEBUG === '1'
const ACTIVATION_FILE = () => path.join(app.getPath('userData'), 'activation.json')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
