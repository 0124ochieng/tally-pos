const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getActivation: () => ipcRenderer.invoke('get-activation'),
  setActivation: (data) => ipcRenderer.invoke('set-activation', data),
  clearActivation: () => ipcRenderer.invoke('clear-activation'),
  appendDeletionLog: (line) => ipcRenderer.invoke('append-deletion-log', line),
  onUpdateReady: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('update-ready', listener)
    return () => ipcRenderer.removeListener('update-ready', listener)
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
})
