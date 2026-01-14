const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

const DB_NAME = 'students.db';

// DB 디렉토리 가져오기 (공유 폴더 설정 유지 + 안전한 DB 위치)
function getDbDirectory() {
    const userDataPath = app.getPath('userData');
    const configFile = path.join(userDataPath, 'config.json');
    
    // 공유 폴더 설정 확인 (설정은 유지하지만 DB는 안전한 위치 사용)
    if (fs.existsSync(configFile)) {
        try {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            if (config.dbPath) {
                // 네트워크 경로 접근 시 타임아웃 방지
                try {
                    if (fs.existsSync(config.dbPath)) {
                        const stats = fs.statSync(config.dbPath);
                        if (stats.isDirectory()) {
                            // 공유 폴더 접근 가능: 공유 폴더 사용
                            return config.dbPath;
                        }
                    }
                } catch (networkError) {
                    // 네트워크 경로 접근 실패 시 기본 경로 사용
                    console.warn('네트워크 경로 접근 실패, 기본 경로 사용:', networkError.message);
                }
            }
        } catch (e) {
            // 설정 파일 읽기 실패
        }
    }
    
    // 기본 위치: 사용자 데이터 폴더 (업데이트 시에도 안전)
    const dbDir = path.join(userDataPath, 'Database');
    
    // Database 폴더 생성
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // 기존 DB 파일들을 여러 위치에서 찾아서 마이그레이션
    migrateExistingDatabases(dbDir);
    
    return dbDir;
}

// 기존 DB 파일들을 찾아서 마이그레이션 (안전 모드)
function migrateExistingDatabases(targetDir) {
    const targetDbPath = path.join(targetDir, DB_NAME);
    
    // ⚠️ 중요: 이미 타겟 위치에 DB가 있으면 절대 건드리지 않음
    if (fs.existsSync(targetDbPath)) {
        return; // 기존 DB 보호
    }
    
    // 가능한 DB 위치들 (우선순위 순)
    const possibleLocations = [
        // 1. 이전 포터블 버전 위치 (exe와 같은 폴더)
        app.isPackaged ? path.join(path.dirname(process.execPath), 'Database', DB_NAME) : null,
        // 2. 개발 모드 위치
        path.join(__dirname, '..', 'Database', DB_NAME),
        // 3. 이전 AppData 위치 (직접 파일)
        path.join(app.getPath('userData'), DB_NAME),
        // 4. 프로젝트 루트 Database 폴더
        app.isPackaged ? null : path.join(process.cwd(), 'Database', DB_NAME),
        // 5. 현재 작업 디렉토리의 Database 폴더 (포터블 버전)
        path.join(process.cwd(), 'Database', DB_NAME),
        // 6. exe 파일 상위 디렉토리의 Database 폴더
        app.isPackaged ? path.join(path.dirname(process.execPath), '..', 'Database', DB_NAME) : null,
        // 7. 다양한 상대 경로들
        app.isPackaged ? path.join(path.dirname(process.execPath), '..', '..', 'Database', DB_NAME) : null
    ].filter(Boolean);
    
    // 첫 번째로 발견되는 DB 파일만 복사 (기존 DB가 없을 때만)
    for (const dbPath of possibleLocations) {
        if (fs.existsSync(dbPath)) {
            try {
                // 다시 한 번 확인: 복사 직전에 타겟 파일이 없는지 재확인
                if (!fs.existsSync(targetDbPath)) {
                    fs.copyFileSync(dbPath, targetDbPath);
                    console.log(`DB 복구 완료: ${dbPath} → ${targetDbPath}`);
                    
                    // 단어장 폴더도 함께 복구 (기존 폴더가 없을 때만)
                    const sourceWordbooksDir = path.join(path.dirname(dbPath), 'Wordbooks');
                    const targetWordbooksDir = path.join(targetDir, 'Wordbooks');
                    
                    if (fs.existsSync(sourceWordbooksDir) && !fs.existsSync(targetWordbooksDir)) {
                        fs.mkdirSync(targetWordbooksDir, { recursive: true });
                        const files = fs.readdirSync(sourceWordbooksDir);
                        const wordbookFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'));
                        
                        wordbookFiles.forEach(file => {
                            const sourcePath = path.join(sourceWordbooksDir, file);
                            const targetPath = path.join(targetWordbooksDir, file);
                            if (!fs.existsSync(targetPath)) {
                                fs.copyFileSync(sourcePath, targetPath);
                            }
                        });
                        console.log(`단어장 복구 완료: ${wordbookFiles.length}개 파일`);
                    }
                }
                break;
            } catch (error) {
                console.warn(`DB 복구 실패 (${dbPath}):`, error.message);
            }
        }
    }
}

// DB 경로 가져오기
function getDbPath() {
    return path.join(getDbDirectory(), DB_NAME);
}

// Wordbooks 디렉토리 가져오기 (DB 디렉토리 내부)
function getWordbooksDirectory() {
    const dbDir = getDbDirectory();
    const wordbooksDir = path.join(dbDir, 'Wordbooks');
    
    // Wordbooks 폴더 생성
    if (!fs.existsSync(wordbooksDir)) {
        fs.mkdirSync(wordbooksDir, { recursive: true });
    }
    
    // 기존 프로젝트 루트의 Wordbooks 폴더에서 파일 마이그레이션 (한 번만 실행)
    // 빌드된 앱에서는 app.asar를 건너뛰기 위해 app.getAppPath() 사용
    const appPath = app.getAppPath();
    const oldWordbooksDir = path.join(appPath, 'Wordbooks');
    if (fs.existsSync(oldWordbooksDir) && oldWordbooksDir !== wordbooksDir) {
        try {
            const files = fs.readdirSync(oldWordbooksDir);
            const wordbookFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'));
            
            if (wordbookFiles.length > 0) {
                // 새 위치에 파일이 없으면 기존 파일 복사
                wordbookFiles.forEach(file => {
                    const oldPath = path.join(oldWordbooksDir, file);
                    const newPath = path.join(wordbooksDir, file);
                    
                    if (!fs.existsSync(newPath)) {
                        fs.copyFileSync(oldPath, newPath);
                        // 로그 제거 (사용자에게 불필요한 정보)
                    }
                });
            }
        } catch (error) {
            // 단어장 파일 마이그레이션 실패
        }
    }
    
    return wordbooksDir;
}

// DB 초기화
function initDatabase() {
    const dbPath = getDbPath();
    const db = new Database(dbPath);
    
    // students 테이블 (확장된 스키마)
    db.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            class TEXT,
            school TEXT,
            grade TEXT,
            wordbook TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, wordbook)
        )
    `);
    
    // 기존 테이블 마이그레이션 (컬럼 추가)
    try {
        db.exec(`ALTER TABLE students ADD COLUMN class TEXT`);
    } catch (e) {
        // 컬럼이 이미 존재하면 무시
    }
    try {
        db.exec(`ALTER TABLE students ADD COLUMN school TEXT`);
    } catch (e) {}
    try {
        db.exec(`ALTER TABLE students ADD COLUMN grade TEXT`);
    } catch (e) {}
    try {
        db.exec(`ALTER TABLE students ADD COLUMN wordbook TEXT`);
    } catch (e) {}
    
    // test_records 테이블
    db.exec(`
        CREATE TABLE IF NOT EXISTS test_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            wordbook TEXT NOT NULL,
            test_title TEXT NOT NULL,
            date TEXT NOT NULL,
            score INTEGER,
            total INTEGER NOT NULL,
            test_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    `);
    
    // wordbook_test_stats 테이블 (단어장별 시험 통계)
    db.exec(`
        CREATE TABLE IF NOT EXISTS wordbook_test_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            wordbook TEXT NOT NULL,
            last_test_date DATETIME,
            test_count INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            UNIQUE(student_id, wordbook)
        )
    `);
    
    // chapter_test_stats 테이블 (챕터별 시험 통계)
    db.exec(`
        CREATE TABLE IF NOT EXISTS chapter_test_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            wordbook TEXT NOT NULL,
            chapter TEXT NOT NULL,
            last_test_date DATETIME,
            test_count INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            UNIQUE(student_id, wordbook, chapter)
        )
    `);
    
    // app_settings 테이블 (앱 설정 저장)
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 인덱스 생성
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_test_records_student_id ON test_records(student_id);
        CREATE INDEX IF NOT EXISTS idx_test_records_date ON test_records(date);
        CREATE INDEX IF NOT EXISTS idx_test_records_wordbook ON test_records(wordbook);
        CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
        CREATE INDEX IF NOT EXISTS idx_students_wordbook ON students(wordbook);
        CREATE INDEX IF NOT EXISTS idx_wordbook_stats_student ON wordbook_test_stats(student_id);
        CREATE INDEX IF NOT EXISTS idx_chapter_stats_student ON chapter_test_stats(student_id);
        CREATE INDEX IF NOT EXISTS idx_chapter_stats_wordbook ON chapter_test_stats(wordbook);
    `);
    
    return db;
}

// DB 연결 가져오기 (매번 새로 연결하여 네트워크 공유 폴더 변경 시 반영)
function getDatabase() {
    try {
        return initDatabase();
    } catch (error) {
        // DB 연결 오류
        throw error;
    }
}

module.exports = {
    getDbDirectory,
    getDbPath,
    getWordbooksDirectory,
    getDatabase
};

