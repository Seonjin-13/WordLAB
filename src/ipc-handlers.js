const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');
const { getDbDirectory, getWordbooksDirectory, getDatabase } = require('./db');
const { app } = require('electron');

const DB_NAME = 'students.db';

// 파일 관련 핸들러
function setupFileHandlers(ipcMain) {
    ipcMain.handle('get-files', async () => {
        const WORD_DIR = getWordbooksDirectory();
        return fs.readdirSync(WORD_DIR).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'));
    });

    ipcMain.handle('read-excel', async (event, filename) => {
        const WORD_DIR = getWordbooksDirectory();
        const filePath = path.join(WORD_DIR, filename);
        const workbook = XLSX.readFile(filePath);
        const result = {};
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            result[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        });
        return result;
    });
}

// DB 경로 관련 핸들러
function setupDbPathHandlers(ipcMain) {
    ipcMain.handle('get-db-path', async () => {
        return getDbDirectory();
    });

    ipcMain.handle('set-db-path', async (event, dbPath) => {
        const userDataPath = app.getPath('userData');
        const configFile = path.join(userDataPath, 'config.json');
        
        try {
            if (!fs.existsSync(dbPath)) {
                throw new Error('경로가 존재하지 않습니다.');
            }
            
            const config = { dbPath: dbPath };
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
            
            // DB 초기화 테스트
            const Database = require('better-sqlite3');
            const testDbPath = path.join(dbPath, DB_NAME);
            const testDb = new Database(testDbPath);
            testDb.close();
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

// 학년 자동 업데이트 함수
function autoUpdateGrades(db) {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentDay = now.getDate();
        
        // 3월 1일 이후인지 확인
        if (currentMonth < 3 || (currentMonth === 3 && currentDay < 1)) {
            return; // 3월 1일 이전이면 업데이트하지 않음
        }
        
        // 마지막 업데이트 연도 확인
        const lastUpdateYear = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('last_grade_update_year');
        
        if (lastUpdateYear && parseInt(lastUpdateYear.value) >= currentYear) {
            return; // 이미 올해 업데이트했으면 건너뜀
        }
        
        // 모든 학생의 학년 업데이트
        const students = db.prepare('SELECT id, grade FROM students WHERE grade IS NOT NULL AND grade <> ?').all('');
        const updateStmt = db.prepare('UPDATE students SET grade = ? WHERE id = ?');
        
        let updatedCount = 0;
        students.forEach(student => {
            const gradeNum = parseInt(student.grade);
            if (!isNaN(gradeNum) && gradeNum > 0) {
                // 학년을 1 증가 (최대 6학년까지만)
                const newGrade = Math.min(gradeNum + 1, 6);
                updateStmt.run(newGrade.toString(), student.id);
                updatedCount++;
            }
        });
        
        // 마지막 업데이트 연도 저장
        db.prepare(`
            INSERT INTO app_settings (key, value) 
            VALUES ('last_grade_update_year', ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
        `).run(currentYear.toString(), currentYear.toString());
        
    } catch (error) {
        // 오류가 발생해도 학생 목록은 반환하도록 함
    }
}

// 학생 관련 핸들러
function setupStudentHandlers(ipcMain) {
    ipcMain.handle('get-students', async () => {
        try {
            const db = getDatabase();
            
            // 학년 자동 업데이트 확인 및 실행
            autoUpdateGrades(db);
            
            const students = db.prepare('SELECT * FROM students ORDER BY name, wordbook').all();
            db.close();
            return students;
        } catch (error) {
            return [];
        }
    });

    ipcMain.handle('add-student', async (event, studentData) => {
        try {
            const db = getDatabase();
            const { name, class: className, school, grade, wordbook } = studentData;
            const result = db.prepare(`
                INSERT INTO students (name, class, school, grade, wordbook) 
                VALUES (?, ?, ?, ?, ?)
            `).run(name, className || null, school || null, grade || null, wordbook || null);
            db.close();
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
                return { success: false, error: '이미 존재하는 학생-단어장 조합입니다.' };
            }
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-student', async (event, id, studentData) => {
        try {
            const db = getDatabase();
            const { name, class: className, school, grade, wordbook } = studentData;
            db.prepare(`
                UPDATE students 
                SET name = ?, class = ?, school = ?, grade = ?, wordbook = ?
                WHERE id = ?
            `).run(name, className || null, school || null, grade || null, wordbook || null, id);
            db.close();
            return { success: true };
        } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
                return { success: false, error: '이미 존재하는 학생-단어장 조합입니다.' };
            }
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-student', async (event, id) => {
        try {
            const db = getDatabase();
            db.prepare('DELETE FROM students WHERE id = ?').run(id);
            db.close();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('search-students', async (event, searchTerm) => {
        try {
            const db = getDatabase();
            const students = db.prepare(`
                SELECT s.*, 
                       COALESCE(wts.last_test_date, '') as last_test_date,
                       COALESCE(wts.test_count, 0) as test_count
                FROM students s
                LEFT JOIN wordbook_test_stats wts ON s.id = wts.student_id AND s.wordbook = wts.wordbook
                WHERE s.name LIKE ?
                ORDER BY s.name, s.wordbook
            `).all(`%${searchTerm}%`);
            db.close();
            return students;
        } catch (error) {
            return [];
        }
    });
}

// 시험 기록 관련 핸들러
function setupTestRecordHandlers(ipcMain) {
    ipcMain.handle('save-test-record', async (event, studentId, wordbook, testTitle, date, score, total, testData) => {
        try {
            const db = getDatabase();
            
            // 시험 기록 저장
            const result = db.prepare(`
                INSERT INTO test_records (student_id, wordbook, test_title, date, score, total, test_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(studentId, wordbook, testTitle, date, score, total, JSON.stringify(testData));
            
            // 단어장별 통계 업데이트
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO wordbook_test_stats (student_id, wordbook, last_test_date, test_count)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(student_id, wordbook) DO UPDATE SET
                    last_test_date = ?,
                    test_count = test_count + 1,
                    updated_at = CURRENT_TIMESTAMP
            `).run(studentId, wordbook, now, now);
            
            // 챕터별 통계 업데이트
            if (testData && testData.selectedSheets && Array.isArray(testData.selectedSheets)) {
                const updateChapterStats = db.prepare(`
                    INSERT INTO chapter_test_stats (student_id, wordbook, chapter, last_test_date, test_count)
                    VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT(student_id, wordbook, chapter) DO UPDATE SET
                        last_test_date = ?,
                        test_count = test_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                `);
                
                testData.selectedSheets.forEach(chapter => {
                    updateChapterStats.run(studentId, wordbook, chapter, now, now);
                });
            }
            
            db.close();
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-test-records', async (event, studentId) => {
        try {
            const db = getDatabase();
            const records = db.prepare(`
                SELECT * FROM test_records 
                WHERE student_id = ? 
                ORDER BY date DESC, created_at DESC
            `).all(studentId);
            db.close();
            return records.map(record => ({
                ...record,
                test_data: record.test_data ? JSON.parse(record.test_data) : null
            }));
        } catch (error) {
            return [];
        }
    });

    ipcMain.handle('get-all-test-records', async () => {
        try {
            const db = getDatabase();
            const records = db.prepare(`
                SELECT tr.*, s.name as student_name 
                FROM test_records tr
                JOIN students s ON tr.student_id = s.id
                ORDER BY tr.date DESC, tr.created_at DESC
            `).all();
            db.close();
            return records.map(record => ({
                ...record,
                test_data: record.test_data ? JSON.parse(record.test_data) : null
            }));
        } catch (error) {
            return [];
        }
    });

    ipcMain.handle('get-student-wordbook-stats', async (event, studentId) => {
        try {
            const db = getDatabase();
            const stats = db.prepare(`
                SELECT s.wordbook, 
                       COALESCE(wts.last_test_date, '') as last_test_date,
                       COALESCE(wts.test_count, 0) as test_count
                FROM students s
                LEFT JOIN wordbook_test_stats wts ON s.id = wts.student_id AND s.wordbook = wts.wordbook
                WHERE s.id = ?
                ORDER BY s.wordbook
            `).all(studentId);
            db.close();
            return stats;
        } catch (error) {
            return [];
        }
    });

    // 학생의 챕터별 통계 가져오기
    ipcMain.handle('get-student-chapter-stats', async (event, studentId, wordbook) => {
        try {
            const db = getDatabase();
            const stats = db.prepare(`
                SELECT chapter,
                       COALESCE(last_test_date, '') as last_test_date,
                       COALESCE(test_count, 0) as test_count
                FROM chapter_test_stats
                WHERE student_id = ? AND wordbook = ?
                ORDER BY chapter
            `).all(studentId, wordbook);
            db.close();
            return stats;
        } catch (error) {
            return [];
        }
    });

    // 학생의 모든 단어장 가져오기 (등록된 단어장 + 시험 기록이 있는 단어장)
    ipcMain.handle('get-student-all-wordbooks', async (event, studentId) => {
        try {
            const db = getDatabase();
            // wordbook_test_stats에 기록이 있는 모든 단어장을 가져오고, students 테이블과 조인해서 등록 여부 확인
            const wordbooks = db.prepare(`
                SELECT DISTINCT
                    wts.wordbook,
                    wts.last_test_date,
                    wts.test_count,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM students s 
                        WHERE s.id = ? AND s.wordbook = wts.wordbook
                    ) THEN 1 ELSE 0 END as is_registered
                FROM wordbook_test_stats wts
                WHERE wts.student_id = ?
                UNION
                SELECT DISTINCT
                    s.wordbook,
                    COALESCE(wts.last_test_date, '') as last_test_date,
                    COALESCE(wts.test_count, 0) as test_count,
                    1 as is_registered
                FROM students s
                LEFT JOIN wordbook_test_stats wts ON s.id = wts.student_id AND s.wordbook = wts.wordbook
                WHERE s.id = ? AND s.wordbook IS NOT NULL AND s.wordbook != ''
                ORDER BY wordbook
            `).all(studentId, studentId, studentId);
            db.close();
            return wordbooks;
        } catch (error) {
            return [];
        }
    });
}

// 기기 ID 관련 핸들러
function setupDeviceHandlers(ipcMain) {
    // 기기 고유 ID 가져오기 (MAC 주소 기반)
    ipcMain.handle('get-device-id', () => {
        const networkInterfaces = os.networkInterfaces();
        let deviceId = '';
        
        // 첫 번째 활성화된 네트워크 인터페이스의 MAC 주소 사용
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    deviceId = iface.mac;
                    break;
                }
            }
            if (deviceId) break;
        }
        
        // MAC 주소가 없으면 호스트명 사용
        if (!deviceId) {
            deviceId = os.hostname();
        }
        
        return deviceId;
    });
}

// 인쇄 관련 핸들러
function setupPrintHandlers(ipcMain, mainWindow) {
    ipcMain.handle('print-pdf', async (event, options = {}) => {
        if (!mainWindow) return { success: false, error: '윈도우가 없습니다.' };
        
        try {
            // ⚠️ 수정: webContents.print()를 직접 사용 (인쇄 다이얼로그가 바로 열림)
            // PDF 생성 방식은 사용자 경험이 다르므로 기존 방식으로 복귀
            const printOptions = {
                silent: false, // 인쇄 다이얼로그 표시
                printBackground: true,
                color: true,
                margins: {
                    marginType: 'default'
                },
                ...options
            };
            
            // webContents.print()는 인쇄 다이얼로그를 열고 즉시 반환됨
            // DOM 초기화 문제는 복원 로직으로 해결
            mainWindow.webContents.print(printOptions);
            
            // 인쇄 다이얼로그가 열린 후 포커스를 다시 메인 윈도우로 돌려줌
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.focus();
                }
            }, 100);
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

// 환경 변수 핸들러
function setupEnvHandlers(ipcMain) {
    ipcMain.handle('get-env', async (event, key) => {
        // 보안을 위해 특정 환경 변수만 전달
        const allowedKeys = ['APP_LICENSE_PASSWORD'];
        if (allowedKeys.includes(key)) {
            return process.env[key] || null;
        }
        return null;
    });
}

// 모든 핸들러 설정
function setupAllHandlers(ipcMain, mainWindow) {
    setupFileHandlers(ipcMain);
    setupDbPathHandlers(ipcMain);
    setupStudentHandlers(ipcMain);
    setupTestRecordHandlers(ipcMain);
    setupPrintHandlers(ipcMain, mainWindow);
    setupDeviceHandlers(ipcMain);
    setupEnvHandlers(ipcMain);
}

module.exports = {
    setupAllHandlers
};

