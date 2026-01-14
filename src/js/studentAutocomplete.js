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
        // 캐시가 비어있을 때만 업데이트 (성능 개선)
        if (allStudentsCache.length === 0) {
            await updateStudentsCache();
        }
        
        if (!searchTerm) {
            hideStudentDropdown();
            // 학생 이름이 비어있으면 ID도 초기화 및 단어장 필터 해제
            if (studentIdInput) {
                studentIdInput.value = '';
            }
            // 단어장 필터 해제
            if (window.fileManager?.clearStudentWordbookFilter) {
                window.fileManager.clearStudentWordbookFilter();
            }
            return;
        }
        
        // 이름으로 검색 (대소문자 구분 없음)
        const filtered = allStudentsCache.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (filtered.length === 0) {
            hideStudentDropdown();
            // 검색 결과가 없으면 단어장 필터 해제
            if (window.fileManager?.clearStudentWordbookFilter) {
                window.fileManager.clearStudentWordbookFilter();
            }
            return;
        }
        
        // 동명이인이 있는지 확인 (중복 제거된 학생 목록 기준)
        const studentMap = {};
        filtered.forEach(student => {
            const key = `${student.name}_${student.class || ''}_${student.school || ''}_${student.grade || ''}`;
            if (!studentMap[key]) {
                studentMap[key] = {
                    ...student,
                    ids: [student.id],
                    wordbooks: student.wordbook ? [student.wordbook] : []
                };
            } else {
                if (!studentMap[key].ids.includes(student.id)) {
                    studentMap[key].ids.push(student.id);
                }
                if (student.wordbook && !studentMap[key].wordbooks.includes(student.wordbook)) {
                    studentMap[key].wordbooks.push(student.wordbook);
                }
            }
        });
        
        const uniqueFiltered = Object.values(studentMap);
        const exactMatches = uniqueFiltered.filter(s => s.name === searchTerm);
        
        // 정확히 일치하는 학생이 하나면 자동으로 선택
        if (exactMatches.length === 1) {
            const student = exactMatches[0];
            const representativeId = student.ids[0];
            studentIdInput.value = representativeId.toString();
            // 이름이 정확히 일치하면 드롭다운 숨기고 단어장 필터 적용
            if (student.name === searchTerm) {
                hideStudentDropdown();
                // 캐시된 데이터로 단어장 필터 적용 (DB 재조회 없이)
                await setStudentWordbookFilter(student.ids);
                return;
            }
        } else if (exactMatches.length > 1) {
            // 동명이인이 있으면 ID 초기화 및 필터 해제
            studentIdInput.value = '';
            if (window.fileManager?.clearStudentWordbookFilter) {
                window.fileManager.clearStudentWordbookFilter();
            }
        } else {
            // 일치하는 학생이 없으면 단어장 필터 해제
            if (window.fileManager?.clearStudentWordbookFilter) {
                window.fileManager.clearStudentWordbookFilter();
            }
        }
        
        // 드롭다운 표시 (중복 제거된 목록 사용)
        displayStudentDropdown(uniqueFiltered);
    }, 150); // 300ms → 150ms로 단축
}

// 학생 이름이 변경될 때 단어장 필터 해제
export function onStudentNameChanged() {
    const nameInput = document.getElementById('inputName');
    const studentIdInput = document.getElementById('inputStudentId');
    
    // 학생 이름이 비어있거나 ID가 없으면 단어장 필터 해제
    if (!nameInput || !nameInput.value.trim() || !studentIdInput || !studentIdInput.value) {
        if (window.fileManager?.clearStudentWordbookFilter) {
            window.fileManager.clearStudentWordbookFilter();
        }
    }
}

// 학생 드롭다운 표시 (이미 중복 제거된 목록을 받음)
function displayStudentDropdown(uniqueStudents) {
    const dropdown = document.getElementById('studentAutocompleteDropdown');
    if (!dropdown) return;
    
    // 최대 5명만 표시
    const displayStudents = uniqueStudents.slice(0, 5);
    
    dropdown.innerHTML = displayStudents.map(student => {
        const school = student.school || '';
        const grade = student.grade || '';
        const className = student.class || '';
        
        let infoParts = [];
        if (school) infoParts.push(school);
        if (grade) infoParts.push(`${grade}학년`);
        if (className) infoParts.push(`${className}반`);
        
        const infoText = infoParts.length > 0 ? infoParts.join(' | ') : '정보 없음';
        
        // 대표 ID (첫 번째 ID 사용)
        const representativeId = student.ids ? student.ids[0] : student.id;
        const wordbookCount = student.wordbooks ? student.wordbooks.length : (student.wordbook ? 1 : 0);
        const wordbookInfo = wordbookCount > 0 ? ` (단어장 ${wordbookCount}개)` : '';
        const studentIds = student.ids || [student.id];
        
        return `
            <div class="student-autocomplete-item" onclick="selectStudentFromAutocomplete(${representativeId}, '${student.name.replace(/'/g, "\\'")}', ${JSON.stringify(studentIds)})">
                <span class="student-autocomplete-name">${student.name}</span>
                <span class="student-autocomplete-info">${infoText}${wordbookInfo}</span>
            </div>
        `;
    }).join('');
    
    // 더 많은 결과가 있으면 표시
    if (uniqueStudents.length > 5) {
        dropdown.innerHTML += `
            <div style="padding: 8px 12px; text-align: center; color: #868e96; font-size: 12px; border-top: 1px solid #f1f3f5;">
                외 ${uniqueStudents.length - 5}명 더... (학생 검색 모달에서 전체 검색)
            </div>
        `;
    }
    
    dropdown.style.display = 'block';
}

// 학생 선택
export async function selectStudentFromAutocomplete(studentId, studentName, studentIds = null) {
    const nameInput = document.getElementById('inputName');
    const studentIdInput = document.getElementById('inputStudentId');
    
    if (nameInput) {
        nameInput.value = studentName;
    }
    if (studentIdInput) {
        studentIdInput.value = studentId.toString();
    }
    
    hideStudentDropdown();
    
    // 학생의 모든 단어장 목록 가져오기 (캐시 우선 사용)
    let idsToUse = studentIds && Array.isArray(studentIds) ? studentIds : [studentId];
    
    // 같은 학생 이름의 모든 레코드 ID 찾기 (캐시에서)
    if (allStudentsCache.length > 0) {
        const representativeRecord = allStudentsCache.find(s => s.id === studentId);
        if (representativeRecord) {
            const sameStudentRecords = allStudentsCache.filter(s => 
                s.name === representativeRecord.name &&
                (s.class || '') === (representativeRecord.class || '') &&
                (s.school || '') === (representativeRecord.school || '') &&
                (s.grade || '') === (representativeRecord.grade || '')
            );
            idsToUse = sameStudentRecords.map(s => s.id);
        }
    }
    
    await setStudentWordbookFilter(idsToUse);
    
    // 실시간 정보 업데이트
    if (window.updateRealTimeInfo) {
        window.updateRealTimeInfo();
    }
}

// 학생 단어장 필터 설정
async function setStudentWordbookFilter(studentIds) {
    if (!window.api || !Array.isArray(studentIds) || studentIds.length === 0) {
        // 필터 해제
        if (window.fileManager?.clearStudentWordbookFilter) {
            window.fileManager.clearStudentWordbookFilter();
        }
        return;
    }
    
    try {
        // students 테이블에서 직접 모든 레코드의 단어장을 가져오기
        const allWordbooks = new Set();
        
        // 캐시에서 해당 학생 레코드들의 단어장 직접 조회 (빠른 처리)
        if (allStudentsCache.length > 0) {
            const selectedRecords = allStudentsCache.filter(s => studentIds.includes(s.id));
            console.log('선택된 학생 레코드:', selectedRecords);
            
            selectedRecords.forEach(student => {
                if (student.wordbook && student.wordbook.trim() !== '') {
                    allWordbooks.add(student.wordbook);
                }
            });
        }
        
        // 추가로 getStudentAllWordbooks도 호출 (시험 기록이 있는 단어장 포함)
        // 하지만 병렬로 처리하여 속도 향상
        const wordbookPromises = studentIds.map(async (studentId) => {
            try {
                const wordbooks = await window.api.getStudentAllWordbooks(studentId);
                if (Array.isArray(wordbooks)) {
                    wordbooks.forEach(wb => {
                        // 등록된 단어장만 추가
                        if (wb.wordbook && wb.is_registered === 1) {
                            allWordbooks.add(wb.wordbook);
                        }
                    });
                }
            } catch (err) {
                console.warn(`getStudentAllWordbooks(${studentId}) 실패:`, err);
            }
        });
        
        // 모든 API 호출을 병렬로 처리
        await Promise.all(wordbookPromises);
        
        const uniqueWordbooks = Array.from(allWordbooks);
        
        console.log('학생 단어장 필터:', {
            studentIds,
            foundWordbooks: uniqueWordbooks,
            count: uniqueWordbooks.length,
            fromCache: allStudentsCache.filter(s => studentIds.includes(s.id)).map(s => ({ id: s.id, wordbook: s.wordbook }))
        });
        
        if (uniqueWordbooks.length === 0) {
            // 단어장이 없으면 필터 해제
            if (window.fileManager?.clearStudentWordbookFilter) {
                window.fileManager.clearStudentWordbookFilter();
            }
            return;
        }
        
        // 단어장 필터 적용 (기존 드롭다운 사용)
        if (window.fileManager?.setStudentWordbookFilter) {
            window.fileManager.setStudentWordbookFilter(uniqueWordbooks);
        }
        
        // 단어장이 하나면 자동 선택
        if (uniqueWordbooks.length === 1) {
            await selectWordbookFromStudent(uniqueWordbooks[0]);
        } else {
            // 여러 개면 드롭다운 표시
            if (window.fileManager?.showFileDropdown) {
                window.fileManager.showFileDropdown();
            }
        }
    } catch (error) {
        console.error('학생 단어장 필터 설정 실패:', error);
        if (window.fileManager?.clearStudentWordbookFilter) {
            window.fileManager.clearStudentWordbookFilter();
        }
    }
}

// 학생의 단어장 선택 (fileManager의 selectFile 사용)
export async function selectWordbookFromStudent(wordbookName) {
    if (!wordbookName) return;
    
    // 단어장 파일 찾기
    const allFiles = window.fileManager?.getAllFiles ? window.fileManager.getAllFiles() : [];
    const wordbookFile = allFiles.find(f => {
        const fileName = f.replace(/\.(xlsx|csv)$/i, '');
        return fileName === wordbookName;
    });
    
    if (wordbookFile) {
        // fileManager의 selectFile 사용
        if (window.fileManager?.selectFile) {
            window.fileManager.selectFile(wordbookFile);
        }
    } else {
        alert(`단어장 파일 "${wordbookName}"을 찾을 수 없습니다.`);
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
window.studentAutocomplete = {
    searchStudentsAutocomplete,
    selectStudentFromAutocomplete,
    hideStudentDropdown,
    updateStudentsCache,
    selectWordbookFromStudent,
    onStudentNameChanged,
    forceUpdateCache
};
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

// 학생이 추가/수정/삭제되면 캐시 업데이트 (더 빠른 반응)
document.addEventListener('click', (e) => {
    // 학생 관리 모달에서 저장/삭제 버튼 클릭 시 캐시 업데이트
    if (e.target.matches('#saveStudentBtn, #deleteStudentBtn')) {
        setTimeout(() => {
            updateStudentsCache();
        }, 100); // 500ms → 100ms로 단축
    }
});

// 학생 추가/수정/삭제 후 즉시 캐시 업데이트를 위한 함수
export function forceUpdateCache() {
    return updateStudentsCache();
}

