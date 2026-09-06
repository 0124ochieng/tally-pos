const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getActivation: () => ipcRenderer.invoke('get-activation'),
  setActivation: (data) => ipcRenderer.invoke('set-activation', data),
  clearActivation: () => ipcRenderer.invoke('clear-activation'),
  appendDeletionLog: (line) => ipcRenderer.invoke('append-deletion-log', line),
})
