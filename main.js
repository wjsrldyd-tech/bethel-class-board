const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    title: '벧엘 전자칠판'
  });

  mainWindow.loadFile('index.html');

  // 전체화면 지원
  mainWindow.setFullScreenable(true);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// PDF 폴더 스캔
ipcMain.handle('scan-pdf-folder', async () => {
  try {
    const pdfsPath = path.join(__dirname, 'pdfs');
    
    if (!fs.existsSync(pdfsPath)) {
      fs.mkdirSync(pdfsPath, { recursive: true });
      return { success: true, data: {} };
    }

    const grades = {};
    const gradeDirs = fs.readdirSync(pdfsPath, { withFileTypes: true });

    for (const gradeDir of gradeDirs) {
      if (gradeDir.isDirectory()) {
        const gradeName = gradeDir.name;
        const gradePath = path.join(pdfsPath, gradeName);
        const units = {};

        const files = fs.readdirSync(gradePath);
        for (const file of files) {
          if (file.endsWith('.pdf')) {
            const unitName = file.replace('.pdf', '');
            units[unitName] = path.join('pdfs', gradeName, file).replace(/\\/g, '/');
          }
        }

        if (Object.keys(units).length > 0) {
          grades[gradeName] = units;
        }
      }
    }

    return { success: true, data: grades };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// PDF 파일 읽기
ipcMain.handle('read-pdf-file', async (event, filePath) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      return { success: true, path: fullPath };
    }
    return { success: false, error: '파일을 찾을 수 없습니다.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

