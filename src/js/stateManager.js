// 상태 저장 및 복원 관리 모듈
import { toggleClearButton } from './fileManager.js';

/**
 * 1. 현재 모든 입력값과 상태를 저장 (말씀하신 8가지 항목)
 */
export function saveApplicationState() {
    const container = document.getElementById('previewArea');
    
    // [항목 8] 생성된 시험지 (HTML 통째로 저장)
    const savedTestHTML = container ? container.innerHTML : '';
    const wasShowing = container ? container.classList.contains('show-answer') : false;
    
    // [항목 1~7] 입력값들 저장
    const savedInputs = {
        date: document.getElementById('inputDate')?.value || '',          // [항목 2] 날짜
        name: document.getElementById('inputName')?.value || '',          // [항목 3] 학생 이름
        studentId: document.getElementById('inputStudentId')?.value || '', // 학생 ID (동명이인 구분용)
        title: document.getElementById('inputTitle')?.value || '',        // [항목 1] 시험지 제목
        fileSelect: document.getElementById('fileSelect')?.value || '',   // [항목 4] 단어장 (파일)
        fileSearchInput: document.getElementById('fileSearchInput')?.value || '',
        qCount: document.getElementById('qCount')?.value || '',           // [항목 7] 문항 수
        typeSelect: document.getElementById('typeSelect')?.value || '',   // [항목 6] 옵션 유형 (영어/한글)
        shuffleOption: document.getElementById('shuffleOption')?.checked || false // [항목 6] 셔플 옵션
    };
    
    // [항목 5] 챕터 선택 상태 저장
    const chapterCheckboxes = document.querySelectorAll('#chapterList input[type="checkbox"]');
    const savedChapters = {};
    chapterCheckboxes.forEach(checkbox => {
        savedChapters[checkbox.value] = checkbox.checked;
    });
    
    return {
        savedTestHTML,
        savedInputs,
        savedChapters,
        wasShowing
    };
}

// 복원 중 플래그
let isRestoring = false;
let lastRestoreTime = 0;

/**
 * 2. 저장된 상태를 화면에 복구
 */
export function restoreApplicationState(state) {
    if (!state) return;
    
    // [중요] 인쇄 직후 빠르게 복원하기 위해 대기 시간을 1000ms -> 100ms로 단축
    const now = Date.now();
    if (isRestoring && (now - lastRestoreTime) < 100) {
        return;
    }
    
    isRestoring = true;
    lastRestoreTime = now;
    
    // 1. 시험지 HTML 복원 (가장 먼저 복구하여 화면 깜빡임 방지)
    const container = document.getElementById('previewArea');
    if (state.savedTestHTML && container) {
        container.innerHTML = state.savedTestHTML;
        // 답지 보기 상태였으면 그대로 유지
        if (state.wasShowing) container.classList.add('show-answer');
        else container.classList.remove('show-answer');
    }
    
    // 2. 기본 입력값 복원
    const inputs = state.savedInputs;
    setVal('inputDate', inputs.date);
    setVal('inputName', inputs.name);
    setVal('inputStudentId', inputs.studentId); // 학생 ID 복원
    setVal('inputTitle', inputs.title);
    setVal('qCount', inputs.qCount);
    setVal('typeSelect', inputs.typeSelect);
    
    const shuffleEl = document.getElementById('shuffleOption');
    if (shuffleEl) shuffleEl.checked = inputs.shuffleOption;
    
    // 3. 파일 및 챕터 복원 (비동기 처리 필요)
    const fileSelectEl = document.getElementById('fileSelect');
    const fileSearchInputEl = document.getElementById('fileSearchInput');
    
    if (inputs.fileSelect && fileSelectEl) {
        // 파일이 변경되었거나, 화면이 리셋된 경우
        const currentFile = fileSelectEl.value;
        
        // 검색창 값 복원
        if (fileSearchInputEl) {
            fileSearchInputEl.value = inputs.fileSearchInput || '';
            if (window.fileManager?.toggleClearButton) window.fileManager.toggleClearButton();
        }

        // ⚠️ 중요: 파일이 실제로 변경되었을 때만 loadSheetList() 호출
        // 파일이 같으면 loadSheetList()를 호출하지 않아서 챕터 목록이 다시 렌더링되지 않음
        if (currentFile !== inputs.fileSelect) {
            // 파일 선택값 강제 주입
            fileSelectEl.value = inputs.fileSelect;
            if (window.fileManager?.setCurrentSelectedFile) {
                window.fileManager.setCurrentSelectedFile(inputs.fileSelect);
            }

            // 챕터 목록 다시 로드 후 체크박스 복원
            // (파일을 선택해야 챕터 목록이 뜨므로 순서가 중요함)
            if (window.sheetManager?.loadSheetList) {
                window.sheetManager.loadSheetList(inputs.fileSelect).then(() => {
                    restoreChapters(state.savedChapters);
                }).catch(() => {
                    // 로드 실패해도 시도는 해봄
                    restoreChapters(state.savedChapters);
                });
            }
        } else {
            // 파일이 같으면 챕터 목록을 다시 로드하지 않고 바로 챕터만 복원
            // 이렇게 하면 챕터 목록이 다시 렌더링되지 않아서 값이 사라지지 않음
            restoreChapters(state.savedChapters);
        }
    } else {
        // 파일 선택이 없는 경우 챕터만이라도 복원 시도
        restoreChapters(state.savedChapters);
    }
    
    // 4. 실시간 정보 업데이트 (제목, 날짜 등 화면 반영)
    if (window.ui?.updateRealTimeInfo) {
        setTimeout(() => window.ui.updateRealTimeInfo(), 50);
    }
    
    // 복원 종료 플래그 해제
    setTimeout(() => { isRestoring = false; }, 300);
}

// 헬퍼 함수: ID로 값 설정
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
}

// 헬퍼 함수: 챕터 체크박스 복원
function restoreChapters(savedChapters) {
    if (!savedChapters) return;
    
    // 약간의 지연을 주어 DOM이 생성된 후 체크
    setTimeout(() => {
        let restoredCount = 0;
        Object.keys(savedChapters).forEach(chapterName => {
            // 특수문자 처리를 위해 속성 선택자 사용
            const checkbox = document.querySelector(`#chapterList input[value="${chapterName.replace(/"/g, '\\"')}"]`);
            if (checkbox) {
                checkbox.checked = savedChapters[chapterName];
                restoredCount++;
            }
        });
        
        // 통계(선택된 단어 수) 업데이트
        if (window.sheetManager?.updateStats && restoredCount > 0) {
            window.sheetManager.updateStats();
        }
    }, 100);
}

window.stateManager = {
    saveApplicationState,
    restoreApplicationState
};