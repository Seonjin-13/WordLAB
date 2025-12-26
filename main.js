// 환경 변수 로드 (.env 파일)
require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const checkIconPath = path.join(__dirname, 'build', 'WordLAB_icon.ico');
console.log('--------------------------------------------------');
console.log('1. 아이콘 경로:', checkIconPath);
console.log('2. 파일 존재 여부:', fs.existsSync(checkIconPath) ? '✅ 있음 (성공)' : '❌ 없음 (실패)');
console.log('--------------------------------------------------');

const { exec } = require('child_process');
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
    
    // 첫 실행 시 바탕화면 바로가기 생성 (프로덕션 모드에서만)
    if (app.isPackaged) {
        createDesktopShortcuts();
    }
});

let mainWindow = null;

/**
 * 바탕화면에 바로가기 생성 (첫 실행 시에만)
 */
function createDesktopShortcuts() {
    try {
        const userDataPath = app.getPath('userData');
        const flagFile = path.join(userDataPath, 'shortcuts_created.flag');
        
        // 이미 생성되었는지 확인
        if (fs.existsSync(flagFile)) {
            return; // 이미 생성됨
        }
        
        const desktopPath = app.getPath('desktop');
        const exePath = process.execPath;
        const exeDir = path.dirname(exePath);
        const wordbooksDir = getWordbooksDirectory();
        
        // 1. exe 파일 바로가기 생성
        const exeShortcutPath = path.join(desktopPath, 'Word LAB.lnk');
        createShortcut(exePath, exeShortcutPath, 'Word LAB - 단어 시험지 생성 프로그램', exeDir);
        
        // 2. Wordbooks 폴더 바로가기 생성
        const wordbooksShortcutPath = path.join(desktopPath, 'Wordbooks.lnk');
        createShortcut(wordbooksDir, wordbooksShortcutPath, 'Word LAB - 단어장 폴더', wordbooksDir);
        
        // 플래그 파일 생성 (생성 완료 표시)
        fs.writeFileSync(flagFile, '1', 'utf8');
        
        console.log('[바로가기 생성] 바탕화면에 바로가기가 생성되었습니다.');
    } catch (error) {
        console.error('[바로가기 생성 오류]', error);
    }
}

/**
 * Windows 바로가기 생성 (PowerShell 사용)
 */
function createShortcut(targetPath, shortcutPath, description, workingDir) {
    // 경로의 백슬래시를 이스케이프하고 따옴표 처리
    const escapePath = (p) => p.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const escapeText = (t) => t.replace(/'/g, "''");
    
    // PowerShell 스크립트 생성
    const psScript = `$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${escapePath(shortcutPath)}'); $Shortcut.TargetPath = '${escapePath(targetPath)}'; $Shortcut.WorkingDirectory = '${escapePath(workingDir)}'; $Shortcut.Description = '${escapeText(description)}'; $Shortcut.IconLocation = '${escapePath(targetPath)}'; $Shortcut.Save()`;
    
    exec(`powershell -Command "${psScript}"`, (error) => {
        if (error) {
            console.error(`[바로가기 생성 실패] ${shortcutPath}:`, error);
        }
    });
}

function createWindow() {
    // 운영체제별 아이콘 경로 설정
    let iconPath;
    if (process.platform === 'win32') {
        // Windows: .ico 파일 사용
        iconPath = path.join(__dirname, 'build', 'WordLAB_icon.ico');
        // ICO 파일이 없으면 PNG 사용
        if (!fs.existsSync(iconPath)) {
            iconPath = path.join(__dirname, 'build', 'WordLAB_icon.png');
        }
    } else if (process.platform === 'darwin') {
        // macOS: .icns 파일 사용 (현재는 PNG로 대체)
        iconPath = path.join(__dirname, 'build', 'WordLAB_icon.png');
    } else {
        // Linux: PNG 파일 사용
        iconPath = path.join(__dirname, 'build', 'WordLAB_icon.png');
    }
    
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        title: 'Word LAB',
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile('index.html');
    
    // 개발자 도구 열기 (개발 모드에서만)
    if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
        mainWindow.webContents.openDevTools();
        
        // 개발 모드에서만 F12 키로 개발자 도구 토글
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12') {
                if (mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.closeDevTools();
                } else {
                    mainWindow.webContents.openDevTools();
                }
            }
        });
    }
    
    // 프로덕션 모드에서는 개발자 도구 완전 비활성화
    if (app.isPackaged) {
        // 개발자 도구가 열려있으면 닫기
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        }
        
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // F11, F12, Ctrl+Shift+I 등 개발자 도구 단축키 차단
            if (input.key === 'F11' || 
                input.key === 'F12' || 
                (input.control && input.shift && input.key === 'I') ||
                (input.control && input.shift && input.key === 'J') ||
                (input.control && input.shift && input.key === 'C')) {
                event.preventDefault();
            }
        });
        
        // 개발자 도구 열기 시도 차단
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });
    }
    
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
