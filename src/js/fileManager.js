import { getPinnedFiles, setPinnedFiles } from './storage.js';

// 전역 상태
let currentSelectedFile = '';
let allFiles = [];
let currentData = {};

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
    
    const filtered = allFiles.filter(f => 
        f.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="file-dropdown-item" style="color: #999; cursor: default;">검색 결과가 없습니다.</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    dropdown.innerHTML = filtered.map(f => {
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
    getAllFiles
};

// HTML onclick 속성 호환을 위한 전역 함수
window.selectFile = (filename) => window.fileManager?.selectFile(filename);
window.toggleClearButton = () => window.fileManager?.toggleClearButton();

