const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

// PDF 폴더 경로 (프로젝트 외부)
function getPdfsPath() {
  // 프로젝트 폴더의 상위 디렉토리에 pdfs 폴더 생성
  // 예: C:\Projects\bethel-class-board -> C:\Projects\pdfs
  const projectDir = __dirname;
  const parentDir = path.dirname(projectDir);
  return path.join(parentDir, 'pdfs');
}

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
    const pdfsPath = getPdfsPath();
    
    if (!fs.existsSync(pdfsPath)) {
      fs.mkdirSync(pdfsPath, { recursive: true });
      return { success: true, data: {}, path: pdfsPath };
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
            // 전체 경로를 반환
            units[unitName] = path.join(gradePath, file);
          }
        }

        if (Object.keys(units).length > 0) {
          grades[gradeName] = units;
        }
      }
    }

    return { success: true, data: grades, path: pdfsPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// PDF 파일 읽기
ipcMain.handle('read-pdf-file', async (event, filePath) => {
  try {
    // filePath가 이미 전체 경로인 경우 그대로 사용
    // 상대 경로인 경우 프로젝트 외부 pdfs 폴더에서 찾기
    let fullPath;
    if (path.isAbsolute(filePath)) {
      fullPath = filePath;
    } else {
      // 상대 경로인 경우 (하위 호환성)
      fullPath = path.join(getPdfsPath(), filePath);
    }
    
    if (fs.existsSync(fullPath)) {
      return { success: true, path: fullPath };
    }
    return { success: false, error: '파일을 찾을 수 없습니다: ' + fullPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

