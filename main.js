const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

// 설정 파일 경로
function getConfigPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'config.json');
}

// 설정 파일 읽기
function loadConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error('설정 파일 읽기 오류:', error);
  }
  return {};
}

// 설정 파일 저장
function saveConfig(config) {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('설정 파일 저장 오류:', error);
    return false;
  }
}

// PDF 폴더 경로 가져오기
function getPdfsPath() {
  const config = loadConfig();
  if (config.pdfsPath && fs.existsSync(config.pdfsPath)) {
    return config.pdfsPath;
  }
  // 기본 경로: 프로젝트 폴더의 상위 디렉토리에 pdfs 폴더
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

  // 메뉴 설정
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '새로고침',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          }
        },
        {
          label: '확대',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            mainWindow.webContents.zoomLevel += 0.5;
          }
        },
        {
          label: '축소',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            mainWindow.webContents.zoomLevel -= 0.5;
          }
        },
        {
          label: '원래 크기',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            mainWindow.webContents.zoomLevel = 0;
          }
        },
        { type: 'separator' },
        {
          label: '전체 화면',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        },
        {
          label: '개발자 도구',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '설정',
      submenu: [
        {
          label: '교재 폴더 설정',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '교재 폴더 선택',
              properties: ['openDirectory'],
              defaultPath: getPdfsPath()
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const selectedPath = result.filePaths[0];
              const config = loadConfig();
              config.pdfsPath = selectedPath;
              
              if (saveConfig(config)) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: '설정 저장',
                  message: '교재 폴더가 설정되었습니다.',
                  detail: `경로: ${selectedPath}\n\n앱을 다시 시작하면 적용됩니다.`,
                  buttons: ['확인']
                });
              } else {
                dialog.showMessageBox(mainWindow, {
                  type: 'error',
                  title: '오류',
                  message: '설정 저장에 실패했습니다.',
                  buttons: ['확인']
                });
              }
            }
          }
        },
        {
          label: '교재 폴더 열기',
          click: () => {
            const pdfsPath = getPdfsPath();
            if (fs.existsSync(pdfsPath)) {
              require('electron').shell.openPath(pdfsPath);
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: '폴더 없음',
                message: '교재 폴더를 찾을 수 없습니다.',
                detail: `경로: ${pdfsPath}\n\n설정에서 교재 폴더를 다시 선택해주세요.`,
                buttons: ['확인']
              });
            }
          }
        }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '벧엘 전자칠판',
              message: '벧엘 전자칠판',
              detail: '버전 1.0.0\n\n전자칠판용 PDF 뷰어 및 필기 도구',
              buttons: ['확인']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Electron 전체화면 상태 변경 감지
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('electron-fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('electron-fullscreen-changed', false);
  });

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

// PDF 폴더 경로 가져오기
ipcMain.handle('get-pdfs-path', () => {
  return { success: true, path: getPdfsPath() };
});

