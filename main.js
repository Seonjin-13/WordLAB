// 환경 변수 로드 (.env 파일)
require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupAllHandlers } = require('./src/ipc-handlers');
const { getWordbooksDirectory } = require('./src/db');

// 개발 모드에서만 자동 리로드 (소스 코드 파일만 감시)
// ⚠️ 중요: DB 파일 변경 시 리로드 방지를 위해 소스 코드 파일만 감시
if (process.env.NODE_ENV !== 'production') {
    try {
        // 소스 코드 파일만 감시 (HTML, JS, CSS)
        require('electron-reload')([
            path.join(__dirname, 'index.html'),
            path.join(__dirname, 'src', '**', '*.js'),
            path.join(__dirname, 'src', '**', '*.css'),
            path.join(__dirname, 'main.js'),
            path.join(__dirname, 'preload.js')
        ], {
            electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit',
            // chokidar 옵션: DB 파일과 데이터 폴더 완전히 무시
            ignored: [
                '**/Database/**',
                '**/Wordbooks/**',
                '**/*.db',
                '**/*.db-shm',
                '**/*.db-wal',
                '**/node_modules/**',
                '**/dist/**',
                '**/package-lock.json'
            ]
        });
    } catch (error) {
        // electron-reload가 없거나 오류가 발생해도 앱은 정상 작동
        console.log('electron-reload 초기화 실패 (무시됨):', error.message);
    }
}

// Wordbooks 디렉토리 생성 (DB 디렉토리 내부)
app.whenReady().then(() => {
    getWordbooksDirectory(); // Wordbooks 폴더 생성
});

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        title: 'Word LAB',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile('index.html');
    
    // 개발자 도구 열기 (F12 또는 Ctrl+Shift+I로도 열 수 있음)
    // 개발 중에는 자동으로 열리도록, 프로덕션에서는 제거
    if (process.env.NODE_ENV !== 'production') {
        mainWindow.webContents.openDevTools();
    }
    
    // F12 키로 개발자 도구 토글
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
            if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
            } else {
                mainWindow.webContents.openDevTools();
            }
        }
    });
    
    // IPC 핸들러 설정
    setupAllHandlers(ipcMain, mainWindow);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
