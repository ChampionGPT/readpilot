// input: Electron renderer preload
// output: window.electronAPI for desktop-only settings
// pos: safe bridge between Next UI and Electron main process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  getDefaultDataPath: () => ipcRenderer.invoke('get-default-data-path'),
  setDataPath: (path) => ipcRenderer.invoke('set-data-path', path),
});
