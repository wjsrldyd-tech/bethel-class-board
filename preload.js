const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanPdfFolder: () => ipcRenderer.invoke('scan-pdf-folder'),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath)
});

console.log('✅ Preload script loaded - electronAPI ready');

