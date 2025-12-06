const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanPdfFolder: () => ipcRenderer.invoke('scan-pdf-folder'),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath),
  getPdfsPath: () => ipcRenderer.invoke('get-pdfs-path'),
  onFullscreenChanged: (callback) => {
    ipcRenderer.on('electron-fullscreen-changed', (event, isFullscreen) => {
      callback(isFullscreen);
    });
  }
});

console.log('✅ Preload script loaded - electronAPI ready');

