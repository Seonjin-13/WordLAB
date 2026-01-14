import { getPinnedFiles, setPinnedFiles } from './storage.js';

// 전역 상태
let currentSelectedFile = '';
let allFiles = [];
let currentData = {};
let studentWordbookFilter = null; // 학생의 단어장 필터 (null이면 모든 단어장 표시)

export function setAllFiles(files) {
    allFiles = files;
}

export function getAllFiles() {
    return allFiles;
}

export function setCurrentData(data) {
    currentData = data;
}

export function getCurrentData() {
    return currentData;
}

export function setCurrentSelectedFile(filename) {
    currentSelectedFile = filename;
}

export function getCurrentSelectedFile() {
    return currentSelectedFile;
}

// 확장자 제거 헬퍼 함수
function removeExtension(filename) {
    return filename.replace(/\.(xlsx|csv)$/i, '');
}

export function renderFileSelect() {
    const pinned = getPinnedFiles();
    const searchInput = document.getElementById('fileSearchInput');
    const fileSelect = document.getElementById('fileSelect');
    
    // 현재 선택된 파일 유지
    if (!currentSelectedFile && fileSelect.value) {
        currentSelectedFile = fileSelect.value;
    }
    
    allFiles.sort((a, b) => {
        const aPin = pinned.includes(a);
        const bPin = pinned.includes(b);
        if (aPin && !bPin) return -1;
        if (!aPin && bPin) return 1;
        return a.localeCompare(b);
    });
    
    // 숨겨진 select 업데이트 (기존 코드 호환성)
    fileSelect.innerHTML = allFiles.map(f => {
        const isPinned = pinned.includes(f);
        const displayName = removeExtension(f);
        const text = isPinned ? `⭐ ${displayName}` : displayName;
        return `<option value="${f}">${text}</option>`;
    }).join('');
    
    if (currentSelectedFile && allFiles.includes(currentSelectedFile)) {
        fileSelect.value = currentSelectedFile;
        searchInput.value = removeExtension(currentSelectedFile);
    } else if (allFiles.length > 0) {
        currentSelectedFile = allFiles[0];
        fileSelect.value = currentSelectedFile;
        searchInput.value = removeExtension(currentSelectedFile);
    }
    
    toggleClearButton();
    updatePinButtonState(currentSelectedFile);
    filterFileList();
}

export function filterFileList() {
    const searchInput = document.getElementById('fileSearchInput');
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const dropdown = document.getElementById('fileDropdown');
    const pinned = getPinnedFiles();
    
    if (!dropdown) return;
    
    if (allFiles.length === 0) {
        dropdown.innerHTML = '<div class="file-dropdown-item" style="color: #999; cursor: default;">단어장이 없습니다.</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    // 먼저 학생 단어장 필터 적용 (있는 경우)
    let filtered = allFiles;
    if (studentWordbookFilter && studentWordbookFilter.length > 0) {
        filtered = allFiles.filter(f => {
            const fileName = removeExtension(f);
            return studentWordbookFilter.includes(fileName);
        });
    }
    
    // 검색어 필터 적용
    if (searchTerm) {
        filtered = filtered.filter(f => 
            f.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        const message = studentWordbookFilter && studentWordbookFilter.length > 0 
            ? '등록된 단어장이 없습니다.' 
            : '검색 결과가 없습니다.';
        dropdown.innerHTML = `<div class="file-dropdown-item" style="color: #999; cursor: default;">${message}</div>`;
        dropdown.style.display = 'block';
        return;
    }
    
    // 학생 단어장 필터가 적용된 경우 힌트 표시
    const filterHint = studentWordbookFilter && studentWordbookFilter.length > 0 
        ? `<div style="padding: 8px 12px; font-size: 11px; color: #868e96; border-bottom: 1px solid #f1f3f5; background: #f8f9fa;">
             📚 학생 등록 단어장 목록
           </div>`
        : '';
    
    dropdown.innerHTML = filterHint + filtered.map(f => {
        const isPinned = pinned.includes(f);
        const isSelected = f === currentSelectedFile;
        const displayName = removeExtension(f);
        return `
            <div class="file-dropdown-item ${isSelected ? 'selected' : ''}" 
                 onclick="window.fileManager.selectFile('${f.replace(/'/g, "\\'")}')">
                ${isPinned ? '<span class="pin-icon">⭐</span>' : '<span style="width: 20px;"></span>'}
                <span>${displayName}</span>
            </div>
        `;
    }).join('');
    
    dropdown.style.display = 'block';
}

export function showFileDropdown() {
    const dropdown = document.getElementById('fileDropdown');
    const toggleBtn = document.getElementById('fileDropdownToggle');
    if (dropdown) {
        if (dropdown.innerHTML === '' || dropdown.innerHTML.trim() === '') {
            filterFileList();
        } else {
            dropdown.style.display = 'block';
        }
        if (toggleBtn) {
            const svg = toggleBtn.querySelector('svg path');
            if (svg) svg.setAttribute('d', 'M2 6L5 3L8 6');
        }
    }
}

export function toggleFileDropdown() {
    const dropdown = document.getElementById('fileDropdown');
    const toggleBtn = document.getElementById('fileDropdownToggle');
    const searchInput = document.getElementById('fileSearchInput');
    
    const isHidden = dropdown.style.display === 'none' || !dropdown.style.display || dropdown.style.display === '';
    
    if (isHidden) {
        // 드롭다운을 열 때: 비어있으면 필터링 후 표시
        if (dropdown.innerHTML === '' || dropdown.innerHTML.trim() === '') {
            filterFileList();
        } else {
            dropdown.style.display = 'block';
        }
        if (toggleBtn) {
            const svg = toggleBtn.querySelector('svg path');
            if (svg) svg.setAttribute('d', 'M2 6L5 3L8 6');
        }
        if (searchInput) {
            searchInput.focus();
        }
    } else {
        // 드롭다운을 닫을 때
        dropdown.style.display = 'none';
        if (toggleBtn) {
            const svg = toggleBtn.querySelector('svg path');
            if (svg) svg.setAttribute('d', 'M2 4L5 7L8 4');
        }
    }
}

export function selectFile(filename) {
    currentSelectedFile = filename;
    document.getElementById('fileSearchInput').value = removeExtension(filename);
    document.getElementById('fileSelect').value = filename;
    const dropdown = document.getElementById('fileDropdown');
    const toggleBtn = document.getElementById('fileDropdownToggle');
    dropdown.style.display = 'none';
    if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg path');
        if (svg) svg.setAttribute('d', 'M2 4L5 7L8 4');
    }
    toggleClearButton();
    updatePinButtonState(filename);
    if (window.sheetManager) {
        window.sheetManager.loadSheetList(filename);
    }
}

export function clearFileSearch() {
    const searchInput = document.getElementById('fileSearchInput');
    searchInput.value = '';
    searchInput.focus();
    toggleClearButton();
    // X 버튼 클릭 시 학생 단어장 필터도 해제
    studentWordbookFilter = null;
    filterFileList();
}

export function toggleClearButton() {
    const searchInput = document.getElementById('fileSearchInput');
    const clearButton = document.getElementById('fileSearchClear');
    if (searchInput && clearButton) {
        if (searchInput.value.trim().length > 0) {
            clearButton.style.display = 'flex';
        } else {
            clearButton.style.display = 'none';
        }
    }
}

export function togglePin() {
    const filename = currentSelectedFile || document.getElementById('fileSelect').value;
    if (!filename) return;
    let pinned = getPinnedFiles();
    if (pinned.includes(filename)) pinned = pinned.filter(f => f !== filename);
    else pinned.push(filename);
    setPinnedFiles(pinned);
    renderFileSelect();
}

export function updatePinButtonState(filename) {
    const btn = document.getElementById('btnPin');
    const pinned = getPinnedFiles();
    if (pinned.includes(filename)) { 
        btn.classList.add('pinned'); 
        btn.innerHTML = '⭐'; 
    } else { 
        btn.classList.remove('pinned'); 
        btn.innerHTML = '☆'; 
    }
}

// 드롭다운 외부 클릭 시 닫기
document.addEventListener('click', function(e) {
    const fileSearchInput = document.getElementById('fileSearchInput');
    const fileDropdown = document.getElementById('fileDropdown');
    const toggleBtn = document.getElementById('fileDropdownToggle');
    if (fileSearchInput && fileDropdown && toggleBtn &&
        !fileSearchInput.contains(e.target) && 
        !fileDropdown.contains(e.target) && 
        !toggleBtn.contains(e.target)) {
        fileDropdown.style.display = 'none';
        const svg = toggleBtn.querySelector('svg path');
        if (svg) svg.setAttribute('d', 'M2 4L5 7L8 4');
    }
});

// 학생 단어장 필터 설정
export function setStudentWordbookFilter(wordbooks) {
    studentWordbookFilter = wordbooks && Array.isArray(wordbooks) && wordbooks.length > 0 
        ? wordbooks.map(wb => typeof wb === 'string' ? wb : wb.wordbook).filter(Boolean)
        : null;
    
    // 학생 단어장 필터가 설정되면 검색 입력란 초기화 (필터가 제대로 보이도록)
    if (studentWordbookFilter && studentWordbookFilter.length > 0) {
        const searchInput = document.getElementById('fileSearchInput');
        if (searchInput && searchInput.value.trim() !== '') {
            searchInput.value = '';
            toggleClearButton();
        }
    }
    
    // 필터 적용 후 드롭다운 새로고침
    filterFileList();
}

// 학생 단어장 필터 해제
export function clearStudentWordbookFilter() {
    studentWordbookFilter = null;
    filterFileList();
}

// 전역으로 노출 (HTML에서 onclick 사용)
window.fileManager = {
    selectFile,
    clearFileSearch,
    togglePin,
    filterFileList,
    showFileDropdown,
    toggleFileDropdown,
    setCurrentSelectedFile,
    getCurrentSelectedFile,
    getAllFiles,
    setStudentWordbookFilter,
    clearStudentWordbookFilter
};

// HTML onclick 속성 호환을 위한 전역 함수
window.selectFile = (filename) => window.fileManager?.selectFile(filename);
window.toggleClearButton = () => window.fileManager?.toggleClearButton();

