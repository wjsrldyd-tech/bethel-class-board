const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanPdfFolder: () => ipcRenderer.invoke('scan-pdf-folder'),
  readPdfFile: (filePath) => ipcRenderer.invoke('read-pdf-file', filePath),
  getPdfsPath: () => ipcRenderer.invoke('get-pdfs-path'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveCanvasImage: (imageData, filename) => ipcRenderer.invoke('save-canvas-image', imageData, filename),
  getSavedImages: () => ipcRenderer.invoke('get-saved-images'),
  deleteSavedImage: (filename) => ipcRenderer.invoke('delete-saved-image', filename),
  getSavedImagePath: (filename) => ipcRenderer.invoke('get-saved-image-path', filename),
  readSavedImageBase64: (filename) => ipcRenderer.invoke('read-saved-image-base64', filename),
  onFullscreenChanged: (callback) => {
    ipcRenderer.on('electron-fullscreen-changed', (event, isFullscreen) => {
      callback(isFullscreen);
    });
  }
});

console.log('✅ Preload script loaded - electronAPI ready');

