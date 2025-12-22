// 모든 모듈 import (전역 노출을 위해)
import './constants.js';
import './storage.js';
import './fileManager.js';
import './sheetManager.js';
import './studentManager.js';
import './settingsManager.js';
import './ui.js';
import './testGenerator.js';
import './stateManager.js';
import './authManager.js';
import './studentNameChecker.js';
import './studentAutocomplete.js';

import { setAllFiles, renderFileSelect, setCurrentSelectedFile } from './fileManager.js';
import { loadSheetList } from './sheetManager.js';
import { openSearchModal, closeSearchModal } from './studentManager.js';
import { loadSettingsToModal } from './settingsManager.js';

// 사이드바 리사이즈
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    resizer.classList.add('resizing');
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 400 && newWidth < 800) { 
        sidebar.style.width = `${newWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
    resizer.classList.remove('resizing');
});

// 줌 컨트롤
document.getElementById('zoomRange').addEventListener('input', (e) => {
    changeZoom(parseFloat(e.target.value));
});

// Ctrl + 마우스 스크롤로 크기 조절
const previewArea = document.getElementById('previewArea');
previewArea.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const zoomRange = document.getElementById('zoomRange');
        const currentZoom = parseFloat(zoomRange.value);
        const step = 0.1;
        const minZoom = parseFloat(zoomRange.min);
        const maxZoom = parseFloat(zoomRange.max);
        
        let newZoom = currentZoom;
        if (e.deltaY < 0) {
            // 스크롤 업 (확대)
            newZoom = Math.min(maxZoom, currentZoom + step);
        } else {
            // 스크롤 다운 (축소)
            newZoom = Math.max(minZoom, currentZoom - step);
        }
        
        zoomRange.value = newZoom;
        changeZoom(newZoom);
    }
}, { passive: false });

// Ctrl + 드래그로 시험지 이동
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let scrollStartX = 0;
let scrollStartY = 0;

previewArea.addEventListener('mousedown', (e) => {
    if (e.ctrlKey && e.button === 0) { // Ctrl + 왼쪽 마우스 버튼
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        scrollStartX = previewArea.scrollLeft;
        scrollStartY = previewArea.scrollTop;
        previewArea.style.cursor = 'grabbing';
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        previewArea.scrollLeft = scrollStartX - deltaX;
        previewArea.scrollTop = scrollStartY - deltaY;
        e.preventDefault();
    }
});

document.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        previewArea.style.cursor = '';
    }
});

// Ctrl 키를 누르고 있을 때 커서 변경
previewArea.addEventListener('mousemove', (e) => {
    if (e.ctrlKey && !isDragging) {
        previewArea.style.cursor = 'grab';
    } else if (!e.ctrlKey && !isDragging) {
        previewArea.style.cursor = '';
    }
});

// Alt+F 단축키 (전역)
document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key === 'f') {
        e.preventDefault();
        const modal = document.getElementById('searchModal');
        if (modal.style.display === 'flex') {
            closeSearchModal();
        } else {
            openSearchModal();
        }
    }
});

// 초기화
export async function init() {
    document.getElementById('inputDate').value = new Date().toISOString().split('T')[0];
    
    try {
        // API 호출 안전장치 추가
        const files = await window.api.getFiles();
        
        // files가 배열인지 확인 (오류 시 객체나 undefined가 올 수 있음)
        if (Array.isArray(files)) {
            setAllFiles(files);
            renderFileSelect(); 
            
            if (files.length > 0) {
                const currentSelectedFile = document.getElementById('fileSelect').value;
                if (currentSelectedFile) {
                    setCurrentSelectedFile(currentSelectedFile);
                    await loadSheetList(currentSelectedFile);
                }
            }
        } else {
            console.error('[Main] 파일 목록을 불러오지 못했습니다 (Not an array):', files);
            setAllFiles([]); // 빈 배열로 초기화하여 크래시 방지
            renderFileSelect();
        }
    } catch (error) {
        console.error('[Main] 초기화 중 치명적 오류 발생:', error);
        // 에러 발생 시에도 빈 목록으로 렌더링하여 화면이 멈추지 않게 함
        setAllFiles([]);
        renderFileSelect();
    }

    loadSettingsToModal();
}

// 입력 필드 포커스 문제 해결을 위한 이벤트 핸들러 (더 안전한 방식)
document.addEventListener('mousedown', (e) => {
    // 입력 필드나 선택 필드에 클릭했을 때만 포커스 설정
    if (e.target.matches('input:not([type="checkbox"]):not([type="radio"]), select, textarea')) {
        // 이벤트가 전파되도록 하되, 포커스는 보장
        requestAnimationFrame(() => {
            if (e.target && document.contains(e.target)) {
                e.target.focus();
            }
        });
    }
}, true);

// 인쇄 후 값이 초기화되지 않도록 보호 (기본 보호)
// ⚠️ 주의: 상태 저장은 testGenerator.js에서 localStorage에 저장하므로
// beforeprint 핸들러는 불필요 (제거됨)

// ⚠️ 주의: 복원은 localStorage를 통해 페이지 로드 시 자동으로 처리됨
// afterprint 핸들러는 testGenerator.js에서 처리

// 앱 시작 (기기별 비밀번호 확인 후)
async function startApp() {
    try {
        const authModule = await import('./authManager.js');
        
        // 기기 ID 초기화
        await authModule.getDeviceId();
        
        const isSet = await authModule.isPasswordSet();
        if (!isSet) {
            document.getElementById('passwordSetupModal').style.display = 'flex';
        } else {
            init();
        }
    } catch (e) {
        console.error("앱 시작 중 오류:", e);
        // 인증 모듈 로드 실패 시에도 일단 init 시도
        init();
    }
}

// 전역으로 노출
window.main = {
    init,
    startApp
};

// ⚠️ 중요: 페이지 리로드 후 복원 (인쇄 후 페이지가 리로드되는 경우 대비)
function restoreAfterPrint() {
    try {
        const printTimestamp = localStorage.getItem('_printTimestamp');
        if (!printTimestamp) return; // 저장된 상태가 없으면 복원하지 않음
        
        const timestamp = parseInt(printTimestamp);
        const now = Date.now();
        
        // 5초 이내에 인쇄했으면 복원 (너무 오래된 것은 무시)
        if (now - timestamp > 5000) {
            localStorage.removeItem('_printTimestamp');
            localStorage.removeItem('_printSavedState');
            localStorage.removeItem('_printSavedStateBackup');
            localStorage.removeItem('_printHiddenInputs');
            localStorage.removeItem('_printSavedChapters');
            localStorage.removeItem('_printIsAnswerKey');
            return;
        }
        
        // localStorage에서 상태 복원
        const savedStateStr = localStorage.getItem('_printSavedState');
        const hiddenInputsStr = localStorage.getItem('_printHiddenInputs');
        const savedChaptersStr = localStorage.getItem('_printSavedChapters');
        
        if (savedStateStr) {
            try {
                const savedState = JSON.parse(savedStateStr);
                
                // hidden input 값으로 직접 복원 (가장 확실한 방법)
                if (hiddenInputsStr) {
                    const hiddenInputs = JSON.parse(hiddenInputsStr);
                    
                    // DOM이 준비될 때까지 대기
                    const restoreFromStorage = () => {
                        const dateEl = document.getElementById('inputDate');
                        const nameEl = document.getElementById('inputName');
                        const titleEl = document.getElementById('inputTitle');
                        const qCountEl = document.getElementById('qCount');
                        const typeSelectEl = document.getElementById('typeSelect');
                        const shuffleEl = document.getElementById('shuffleOption');
                        const fileSelectEl = document.getElementById('fileSelect');
                        const fileSearchInputEl = document.getElementById('fileSearchInput');
                        
                        if (dateEl && hiddenInputs.date) {
                            dateEl.value = hiddenInputs.date;
                        }
                        if (nameEl && hiddenInputs.name) {
                            nameEl.value = hiddenInputs.name;
                        }
                        const studentIdEl = document.getElementById('inputStudentId');
                        if (studentIdEl && hiddenInputs.studentId) {
                            studentIdEl.value = hiddenInputs.studentId;
                        }
                        if (titleEl && hiddenInputs.title) {
                            titleEl.value = hiddenInputs.title;
                        }
                        if (qCountEl && hiddenInputs.qCount) {
                            qCountEl.value = hiddenInputs.qCount;
                        }
                        if (typeSelectEl && hiddenInputs.typeSelect) {
                            typeSelectEl.value = hiddenInputs.typeSelect;
                        }
                        if (shuffleEl !== null && hiddenInputs.shuffleOption !== undefined) {
                            shuffleEl.checked = hiddenInputs.shuffleOption;
                        }
                        if (fileSelectEl && hiddenInputs.fileSelect) {
                            fileSelectEl.value = hiddenInputs.fileSelect;
                            
                            // 파일이 변경되었으면 챕터 리스트 로드
                            if (window.sheetManager?.loadSheetList) {
                                window.sheetManager.loadSheetList(hiddenInputs.fileSelect).then(() => {
                                    // 챕터 복원 (즉시 실행하여 깜빡임 최소화)
                                    if (savedChaptersStr) {
                                        try {
                                            const savedChapters = JSON.parse(savedChaptersStr);
                                            // 즉시 복원 (지연 없음)
                                            Object.keys(savedChapters).forEach(chapterName => {
                                                const checkbox = document.querySelector(`#chapterList input[value="${chapterName.replace(/"/g, '\\"')}"]`);
                                                if (checkbox) {
                                                    checkbox.checked = savedChapters[chapterName];
                                                }
                                            });
                                            if (window.sheetManager?.updateStats) {
                                                window.sheetManager.updateStats();
                                            }
                                        } catch (e) {
                                            console.error('[Main] 챕터 복원 실패:', e);
                                        }
                                    }
                                }).catch(err => {
                                    console.error('[Main] 챕터 리스트 로드 실패:', err);
                                });
                            }
                        }
                        if (fileSearchInputEl && hiddenInputs.fileSearchInput) {
                            fileSearchInputEl.value = hiddenInputs.fileSearchInput;
                        }
                        
                        // stateManager를 통한 복원도 시도
                        if (window.stateManager?.restoreApplicationState) {
                            window.stateManager.restoreApplicationState(savedState);
                        }
                        
                        // 복원 후 localStorage 정리
                        localStorage.removeItem('_printTimestamp');
                        localStorage.removeItem('_printSavedState');
                        localStorage.removeItem('_printSavedStateBackup');
                        localStorage.removeItem('_printHiddenInputs');
                        localStorage.removeItem('_printSavedChapters');
                        localStorage.removeItem('_printIsAnswerKey');
                    };
                    
                    // DOM이 준비될 때까지 대기 (즉시 복원하여 깜빡임 최소화)
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            // 즉시 복원 (지연 없음)
                            restoreFromStorage();
                        });
                    } else {
                        // DOM이 이미 준비되었으면 즉시 복원 (지연 없음)
                        restoreFromStorage();
                    }
                } else {
                    // hidden input이 없으면 stateManager만 사용
                    if (window.stateManager?.restoreApplicationState) {
                        setTimeout(() => {
                            window.stateManager.restoreApplicationState(savedState);
                        }, 100);
                    }
                }
            } catch (e) {
                console.error('[Main] localStorage 상태 파싱 실패:', e);
            }
        }
    } catch (e) {
        console.error('[Main] 인쇄 후 복원 중 오류:', e);
    }
}

// 앱 시작
startApp();

// 페이지 로드 후 인쇄 복원 체크 (즉시 실행하여 깜빡임 최소화)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // 즉시 복원 (지연 없음)
        restoreAfterPrint();
    });
} else {
    // DOM이 이미 준비되었으면 즉시 복원 (지연 없음)
    restoreAfterPrint();
}
