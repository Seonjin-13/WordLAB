import { WORDS_PER_PAGE, ACADEMY_NAME_KEY, ACADEMY_LOGO_KEY, ACADEMY_POS_KEY, ACADEMY_SIZE_KEY, SHOW_MAIN_TITLE_KEY, MAIN_TITLE_KEY } from './constants.js';
import { getCurrentData, getCurrentSelectedFile } from './fileManager.js';
import { changeZoom } from './ui.js';
import { saveApplicationState, restoreApplicationState } from './stateManager.js'; // 위에서 수정한 모듈 import

let currentTestData = null;
let lastAutoTitle = "";

export function getCurrentTestData() { return currentTestData; }
export function setLastAutoTitle(title) { lastAutoTitle = title; }
export function getLastAutoTitle() { return lastAutoTitle; }

// 데이터 정규화 (엑셀 데이터 처리)
function normalizeRow(row) {
    if (!row || row.length < 2) return null;
    const firstCol = row[0];
    const isIndex = (typeof firstCol === 'number') || (!isNaN(parseInt(firstCol)) && String(firstCol).length < 5);
    if (isIndex) return { word: row[1], mean: row[2] };
    return { word: row[0], mean: row[1] };
}

// 시험지 생성 함수 (기존 로직 유지)
export function generateTest() {
    const checkboxes = document.querySelectorAll('#chapterList input:checked');
    if (!checkboxes.length) return alert("챕터를 선택해주세요.");

    const currentData = getCurrentData();
    let combinedData = [];
    let selectedSheetNames = [];

    checkboxes.forEach(sheet => {
        selectedSheetNames.push(sheet.value);
        const rows = currentData[sheet.value];
        if (rows) {
            rows.slice(1).forEach(row => {
                const n = normalizeRow(row);
                if (n && n.word && n.mean) combinedData.push(n);
            });
        }
    });

    if (!combinedData.length) return alert("데이터가 없습니다.");

    const inputCount = parseInt(document.getElementById('qCount').value) || 20;
    const actualCount = Math.min(combinedData.length, inputCount);
    const shuffleEnabled = document.getElementById('shuffleOption').checked;
    const selectedData = shuffleEnabled 
        ? combinedData.sort(() => 0.5 - Math.random()).slice(0, actualCount)
        : combinedData.slice(0, actualCount);
    
    const pages = [];
    for (let i = 0; i < selectedData.length; i += WORDS_PER_PAGE) {
        pages.push(selectedData.slice(i, i + WORDS_PER_PAGE));
    }

    const container = document.getElementById('previewArea');
    container.innerHTML = ""; 
    
    const dateVal = document.getElementById('inputDate').value;
    const nameVal = document.getElementById('inputName').value;
    const type = document.getElementById('typeSelect').value;
    let fileTitle = getCurrentSelectedFile() || document.getElementById('fileSelect').value;
    fileTitle = fileTitle.replace(/\.xlsx$|\.csv$/i, ''); 

    // 제목 로직
    const inputTitleField = document.getElementById('inputTitle');
    const customTitle = inputTitleField.value.trim();
    const chapterStr = selectedSheetNames.join(', ');
    const autoTitle = `${fileTitle} - [ ${chapterStr} ]`;
    lastAutoTitle = autoTitle; 

    if (!customTitle) {
        inputTitleField.value = autoTitle;
    }
    const finalSubtitle = inputTitleField.value;

    // 학원 로직/옵션 불러오기
    const academyName = localStorage.getItem(ACADEMY_NAME_KEY) || "";
    const academyLogo = localStorage.getItem(ACADEMY_LOGO_KEY) || "";
    const academyPos = localStorage.getItem(ACADEMY_POS_KEY) || "center";
    const academySize = localStorage.getItem(ACADEMY_SIZE_KEY) || "100";
    
    const sizePercent = parseInt(academySize) / 100;
    const textFontSize = 18 * sizePercent;
    const logoHeight = textFontSize * 1.2;
    const logoStyle = `height: ${logoHeight}px;`;
    const textStyle = `font-size: ${textFontSize}px;`;
    
    let brandHtml = "";
    if (academyLogo) {
        brandHtml = `<img src="${academyLogo}" class="brand-logo" style="${logoStyle}">`;
    } else if (academyName) {
        brandHtml = `<span class="brand-text" style="${textStyle}">${academyName}</span>`;
    }

    // 페이지 렌더링
    pages.forEach((pageData, pageIdx) => {
        let leftColumnHtml = "";
        let rightColumnHtml = "";
        let startNum = pageIdx * WORDS_PER_PAGE + 1;
        const wordsPerColumn = Math.ceil(WORDS_PER_PAGE / 2); 

        pageData.forEach((item, idx) => {
            const qNum = startNum + idx;
            const question = type === 'eng' ? item.word : item.mean;
            const answer = type === 'eng' ? item.mean : item.word;
            
            const qRowHtml = `
                <div class="q-row">
                    <span class="q-num">${qNum}.</span>
                    <span class="q-text">${question}</span>
                    <span class="q-line"></span>
                    <span class="a-text">${answer}</span>
                </div>
            `;
            if (idx < wordsPerColumn) leftColumnHtml += qRowHtml;
            else rightColumnHtml += qRowHtml;
        });

        const showMainTitle = localStorage.getItem(SHOW_MAIN_TITLE_KEY) !== 'false'; 
        const mainTitle = localStorage.getItem(MAIN_TITLE_KEY) || "VOCABULARY TEST";
        const brandHeaderHeight = Math.max(logoHeight + 5, 25);
        const brandHeaderMargin = Math.max(logoHeight * 0.1, 8); 
        const isFirstPage = pageIdx === 0;
        
        const pageHtml = `
            <div class="paper">
                <div class="brand-header" style="justify-content: ${academyPos}; min-height: ${brandHeaderHeight}px; margin-bottom: ${brandHeaderMargin}px;">
                    ${isFirstPage ? brandHtml : ''}
                </div>
                <div class="test-title-section">
                    ${isFirstPage && showMainTitle ? `<h1 class="test-title">${mainTitle}</h1>` : ''}
                    ${isFirstPage ? `<div class="test-subtitle">${finalSubtitle}</div>` : ''}
                </div>
                <div class="test-header-row">
                    ${isFirstPage ? `
                    <div class="test-info">
                        <div>Date : <b class="live-date">${dateVal}</b></div>
                        <div>Name : <b class="live-name">${nameVal}</b></div>
                    </div>
                    <div style="font-size: 14px; font-weight: bold;">Score : ______ / ${actualCount}</div>
                    ` : '<div></div><div></div>'}
                </div>
                <div class="questions-wrapper">
                    <div class="questions-column">${leftColumnHtml}</div>
                    <div class="questions-column">${rightColumnHtml}</div>
                </div>
                <div class="page-footer">${pageIdx + 1} / ${pages.length}</div>
            </div>
        `;
        container.innerHTML += pageHtml;
    });
    
    // 초기 줌 설정
    const defaultZoom = 0.6;
    changeZoom(defaultZoom);
    document.getElementById('zoomRange').value = defaultZoom;
    document.getElementById('btnToggleAnswer').classList.remove('active');
    container.classList.remove('show-answer');
    
    // 현재 데이터 저장 (자동 저장용)
    currentTestData = {
        testTitle: finalSubtitle,
        date: dateVal,
        studentName: nameVal,
        type: type,
        total: actualCount,
        selectedSheets: selectedSheetNames
    };
}

// 시험 기록 자동 저장
// ⚠️ 중요: 문제지 인쇄 시에만 호출되며, 학생이 이미 DB에 있을 때만 기록을 저장합니다.
// 새로운 학생을 자동으로 추가하지 않습니다.
// ⚠️ 추가: 저장 중에도 화면 상태를 유지하기 위해 저장 전후로 복원 상태 확인
export async function saveTestRecordAuto(savedState = null) {
    // ⚠️ 중요: 이 함수는 DOM을 전혀 건드리지 않고 저장만 수행
    // 복원은 호출하는 쪽에서 처리하도록 함
    
    if (!currentTestData || !currentTestData.studentName) {
        return;
    }
    if (!window.api) {
        return;
    }
    
    try {
        let students = await window.api.getStudents();
        let student = null;
        
        // ⚠️ 중요: 학생 ID가 있으면 ID로 찾기 (동명이인 문제 해결)
        const studentId = document.getElementById('inputStudentId')?.value;
        if (studentId) {
            student = students.find(s => s.id === parseInt(studentId));
        }
        
        // ID가 없거나 찾지 못한 경우 이름으로 찾기
        if (!student) {
            const studentsWithSameName = students.filter(s => s.name === currentTestData.studentName);
            
            if (studentsWithSameName.length === 0) {
                // 학생이 없으면 저장하지 않음
                return;
            } else if (studentsWithSameName.length === 1) {
                // 동명이인이 없으면 첫 번째 학생 사용
                student = studentsWithSameName[0];
            } else {
                // ⚠️ 동명이인이 있는 경우: 저장하지 않음 (사용자가 정확한 학생을 선택해야 함)
                console.warn(`[SaveTestRecord] 동명이인 발견: "${currentTestData.studentName}" (${studentsWithSameName.length}명). 학생 검색에서 정확한 학생을 선택해주세요.`);
                return;
            }
        }
        
        // 저장된 상태를 우선 사용 (값이 사라졌을 경우 대비)
        let selectedFile;
        if (savedState && savedState.savedInputs && savedState.savedInputs.fileSelect) {
            selectedFile = savedState.savedInputs.fileSelect;
        } else {
            selectedFile = getCurrentSelectedFile() || document.getElementById('fileSelect')?.value;
        }
        
        if (!selectedFile) {
            return;
        }
        
        const wordbook = selectedFile.replace(/\.(xlsx|csv)$/i, '');
        
        // 저장 실행 (DOM을 건드리지 않음)
        await window.api.saveTestRecord(
            student.id, wordbook, currentTestData.testTitle, currentTestData.date,
            null, currentTestData.total, currentTestData
        );
    } catch (error) {
        console.error("시험 기록 자동 저장 실패:", error);
        throw error; // 에러를 다시 던져서 호출하는 쪽에서 처리하도록 함
    }
}

export function toggleAnswers() {
    const container = document.getElementById('previewArea');
    const btn = document.getElementById('btnToggleAnswer');
    if (container.classList.contains('show-answer')) {
        container.classList.remove('show-answer');
        btn.classList.remove('active');
    } else {
        container.classList.add('show-answer');
        btn.classList.add('active');
    }
}

// 인쇄 중 플래그 (전역) - 중복 호출 방지
let globalIsPrinting = false;
let lastPrintTime = 0;

/**
 * [핵심] 인쇄 기능 수정
 * 인쇄 시작 전 상태를 변수에 저장해두고, 인쇄가 끝나면(afterprint) 즉시 복원합니다.
 */
export async function printTest(isAnswerKey) {
    // 중복 호출 방지: 인쇄 중이거나 최근에 인쇄했으면 무시
    const now = Date.now();
    if (globalIsPrinting || (now - lastPrintTime < 1000)) {
        return;
    }
    
    const container = document.getElementById('previewArea');
    if (!container || container.querySelectorAll('.paper').length === 0) {
        alert('먼저 시험지를 생성해주세요.');
        return;
    }
    
    // 인쇄 시작 플래그 설정
    globalIsPrinting = true;
    lastPrintTime = now;
    
    // 1. 인쇄 시작 직전, 현재 화면 상태 저장
    // ⚠️ 중요: 페이지가 리로드될 수 있으므로 localStorage에 저장
    const savedState = saveApplicationState();
    const savedStateBackup = saveApplicationState(); // 백업
    
    // localStorage에 저장 (페이지 리로드 후에도 복원 가능)
    try {
        localStorage.setItem('_printSavedState', JSON.stringify(savedState));
        localStorage.setItem('_printSavedStateBackup', JSON.stringify(savedStateBackup));
        localStorage.setItem('_printTimestamp', Date.now().toString());
        localStorage.setItem('_printIsAnswerKey', isAnswerKey ? 'true' : 'false');
    } catch (e) {
        console.error('[PrintTest] localStorage 저장 실패:', e);
    }
    
    // localStorage에 hidden input 값도 저장
    const hiddenInputs = {
        date: document.getElementById('inputDate')?.value || '',
        name: document.getElementById('inputName')?.value || '',
        studentId: document.getElementById('inputStudentId')?.value || '', // 학생 ID 저장
        title: document.getElementById('inputTitle')?.value || '',
        fileSelect: document.getElementById('fileSelect')?.value || '',
        fileSearchInput: document.getElementById('fileSearchInput')?.value || '',
        qCount: document.getElementById('qCount')?.value || '',
        typeSelect: document.getElementById('typeSelect')?.value || '',
        shuffleOption: document.getElementById('shuffleOption')?.checked || false
    };
    
    try {
        localStorage.setItem('_printHiddenInputs', JSON.stringify(hiddenInputs));
        localStorage.setItem('_printSavedChapters', JSON.stringify(savedState.savedChapters));
    } catch (e) {
        console.error('[PrintTest] localStorage hidden input 저장 실패:', e);
    }

    // 2. 답지/문제지 모드 설정
    if (isAnswerKey) {
        container.classList.add('show-answer');
    } else {
        container.classList.remove('show-answer');
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // 3. 인쇄 종료 후 핸들러 (페이지가 리로드되지 않는 경우를 대비한 간단한 복원)
    const afterPrintHandler = () => {
        globalIsPrinting = false; // 전역 인쇄 플래그 해제
        
        // 문제지 인쇄이고 학생 이름이 있을 때만 시험 기록 저장
        if (!isAnswerKey && currentTestData && currentTestData.studentName) {
            // localStorage에서 상태를 읽어서 복원 시도 (페이지가 리로드되지 않은 경우)
            const savedStateStr = localStorage.getItem('_printSavedState');
            if (savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    // 간단한 복원 (페이지가 리로드되지 않았으면)
                    if (window.stateManager?.restoreApplicationState) {
                        window.stateManager.restoreApplicationState(savedState);
                    }
                } catch (e) {
                    console.error('[PrintTest] 상태 복원 실패:', e);
                }
            }
            
            // 시험 기록 저장
            saveTestRecordAuto(savedState).catch(err => {
                console.error("자동 저장 실패:", err);
            });
        }
    };

    // 리스너 등록 (인쇄 실행 전에 등록)
    window.addEventListener('afterprint', afterPrintHandler, { once: true });

    // 4. 인쇄 실행
    try {
        if (window.api && window.api.printPDF) {
            // Electron 네이티브 프린터 API 사용
            window.api.printPDF({
                silent: false, // 인쇄 다이얼로그 표시
                printBackground: true,
                color: true,
                margins: {
                    marginType: 'default'
                }
            }).catch((error) => {
                console.error('[PrintTest] 인쇄 오류:', error);
                // 인쇄 실패 시 기존 방식으로 폴백
                window.print();
            });
        } else {
            // API가 없으면 window.print() 사용
            window.print();
        }
    } catch (error) {
        console.error('인쇄 실행 오류:', error);
        globalIsPrinting = false;
    }
}

window.testGenerator = {
    generateTest,
    toggleAnswers,
    printTest
};