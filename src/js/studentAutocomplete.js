// 학생 이름 자동완성 모듈
let autocompleteTimeout = null;
let allStudentsCache = [];

// 학생 목록 캐시 업데이트
export async function updateStudentsCache() {
    if (!window.api) return;
    try {
        allStudentsCache = await window.api.getStudents();
    } catch (error) {
        console.error('학생 목록 로드 실패:', error);
        allStudentsCache = [];
    }
}

// 학생 검색 자동완성
export async function searchStudentsAutocomplete() {
    const nameInput = document.getElementById('inputName');
    const dropdown = document.getElementById('studentAutocompleteDropdown');
    const studentIdInput = document.getElementById('inputStudentId');
    
    if (!nameInput || !dropdown) return;
    
    const searchTerm = nameInput.value.trim();
    
    // 입력 중일 때는 약간의 지연 후 검색 (성능 최적화)
    if (autocompleteTimeout) {
        clearTimeout(autocompleteTimeout);
    }
    
    autocompleteTimeout = setTimeout(async () => {
        // 학생 목록이 없으면 업데이트
        if (allStudentsCache.length === 0) {
            await updateStudentsCache();
        }
        
        if (!searchTerm) {
            hideStudentDropdown();
            return;
        }
        
        // 이름으로 검색 (대소문자 구분 없음)
        const filtered = allStudentsCache.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (filtered.length === 0) {
            hideStudentDropdown();
            return;
        }
        
        // 동명이인이 있는지 확인
        const exactMatches = filtered.filter(s => s.name === searchTerm);
        
        // 정확히 일치하는 학생이 하나면 자동으로 선택
        if (exactMatches.length === 1) {
            const student = exactMatches[0];
            studentIdInput.value = student.id.toString();
            // 이름이 정확히 일치하면 드롭다운 숨김
            if (student.name === searchTerm) {
                hideStudentDropdown();
                return;
            }
        } else if (exactMatches.length > 1) {
            // 동명이인이 있으면 ID 초기화
            studentIdInput.value = '';
        }
        
        // 드롭다운 표시
        displayStudentDropdown(filtered);
    }, 300); // 300ms 지연
}

// 학생 드롭다운 표시
function displayStudentDropdown(students) {
    const dropdown = document.getElementById('studentAutocompleteDropdown');
    if (!dropdown) return;
    
    // 최대 5명만 표시
    const displayStudents = students.slice(0, 5);
    
    dropdown.innerHTML = displayStudents.map(student => {
        const school = student.school || '';
        const grade = student.grade || '';
        const className = student.class || '';
        
        let infoParts = [];
        if (school) infoParts.push(school);
        if (grade) infoParts.push(`${grade}학년`);
        if (className) infoParts.push(`${className}반`);
        
        const infoText = infoParts.length > 0 ? infoParts.join(' | ') : '정보 없음';
        
        return `
            <div class="student-autocomplete-item" onclick="selectStudentFromAutocomplete(${student.id}, '${student.name.replace(/'/g, "\\'")}')">
                <span class="student-autocomplete-name">${student.name}</span>
                <span class="student-autocomplete-info">${infoText}</span>
            </div>
        `;
    }).join('');
    
    // 더 많은 결과가 있으면 표시
    if (students.length > 5) {
        dropdown.innerHTML += `
            <div style="padding: 8px 12px; text-align: center; color: #868e96; font-size: 12px; border-top: 1px solid #f1f3f5;">
                외 ${students.length - 5}명 더... (학생 검색 모달에서 전체 검색)
            </div>
        `;
    }
    
    dropdown.style.display = 'block';
}

// 학생 선택
export async function selectStudentFromAutocomplete(studentId, studentName) {
    const nameInput = document.getElementById('inputName');
    const studentIdInput = document.getElementById('inputStudentId');
    
    if (nameInput) {
        nameInput.value = studentName;
    }
    if (studentIdInput) {
        studentIdInput.value = studentId.toString();
    }
    
    hideStudentDropdown();
    
    // 학생의 단어장 자동 선택
    await selectStudentWordbook(studentId);
    
    // 실시간 정보 업데이트
    if (window.updateRealTimeInfo) {
        window.updateRealTimeInfo();
    }
}

// 학생의 단어장 자동 선택
async function selectStudentWordbook(studentId) {
    if (!window.api) return;
    
    try {
        // 학생의 모든 단어장 가져오기
        const wordbooks = await window.api.getStudentAllWordbooks(studentId);
        
        if (!Array.isArray(wordbooks) || wordbooks.length === 0) {
            // 단어장이 없으면 아무것도 하지 않음
            return;
        }
        
        // 단어장이 하나면 자동 선택
        // 여러 개면 가장 최근에 시험 본 단어장 선택 (last_test_date 기준)
        let selectedWordbook = null;
        
        if (wordbooks.length === 1) {
            selectedWordbook = wordbooks[0].wordbook;
        } else {
            // 가장 최근 시험일 기준으로 정렬
            const sorted = wordbooks
                .filter(wb => wb.wordbook) // wordbook이 있는 것만
                .sort((a, b) => {
                    const dateA = a.last_test_date ? new Date(a.last_test_date) : new Date(0);
                    const dateB = b.last_test_date ? new Date(b.last_test_date) : new Date(0);
                    return dateB - dateA; // 최신순
                });
            
            if (sorted.length > 0) {
                selectedWordbook = sorted[0].wordbook;
            }
        }
        
        if (!selectedWordbook) return;
        
        // 단어장 파일 찾기
        const allFiles = window.fileManager?.getAllFiles ? window.fileManager.getAllFiles() : [];
        const wordbookFile = allFiles.find(f => {
            const fileName = f.replace(/\.(xlsx|csv)$/i, '');
            return fileName === selectedWordbook;
        });
        
        if (wordbookFile) {
            // 파일 선택
            if (window.fileManager?.setCurrentSelectedFile) {
                window.fileManager.setCurrentSelectedFile(wordbookFile);
            }
            
            const fileSelectEl = document.getElementById('fileSelect');
            const fileSearchInputEl = document.getElementById('fileSearchInput');
            
            if (fileSelectEl) {
                fileSelectEl.value = wordbookFile;
            }
            if (fileSearchInputEl) {
                fileSearchInputEl.value = selectedWordbook;
            }
            
            // 파일 검색 버튼 상태 업데이트
            if (window.fileManager?.toggleClearButton) {
                window.fileManager.toggleClearButton();
            }
            
            // 챕터 리스트 로드
            if (window.sheetManager?.loadSheetList) {
                await window.sheetManager.loadSheetList(wordbookFile);
            }
            
            // 즐겨찾기 버튼 상태 업데이트
            if (window.fileManager?.updatePinButtonState) {
                window.fileManager.updatePinButtonState(wordbookFile);
            }
        }
    } catch (error) {
        console.error('학생 단어장 자동 선택 실패:', error);
    }
}

// 드롭다운 숨기기
export function hideStudentDropdown() {
    const dropdown = document.getElementById('studentAutocompleteDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

// 전역으로 노출
window.searchStudentsAutocomplete = searchStudentsAutocomplete;
window.selectStudentFromAutocomplete = selectStudentFromAutocomplete;
window.hideStudentDropdown = hideStudentDropdown;
window.updateStudentsCache = updateStudentsCache; // 캐시 업데이트 함수도 전역 노출

// 초기화 시 학생 목록 로드
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        updateStudentsCache();
    });
} else {
    updateStudentsCache();
}

// 학생이 추가/수정/삭제되면 캐시 업데이트
document.addEventListener('click', (e) => {
    // 학생 관리 모달에서 저장/삭제 버튼 클릭 시 캐시 업데이트
    if (e.target.matches('#saveStudentBtn, #deleteStudentBtn')) {
        setTimeout(() => {
            updateStudentsCache();
        }, 500);
    }
});

