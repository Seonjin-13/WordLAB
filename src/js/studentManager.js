import { getAllFiles, setCurrentSelectedFile, updatePinButtonState, toggleClearButton } from './fileManager.js';
import { loadSheetList } from './sheetManager.js';
import { updateRealTimeInfo } from './ui.js';

let selectedStudentId = null;
let selectedStudentData = null;
let allStudentsList = []; // 전체 학생 목록 (검색용)
let editingStudentId = null; // 수정 중인 학생 ID

export function getSelectedStudentData() {
    return selectedStudentData;
}

export function setSelectedStudentData(data) {
    selectedStudentData = data;
}

export function openSearchModal() {
    const modal = document.getElementById('searchModal');
    const searchInput = document.getElementById('searchInput');
    
    // 입력 필드 초기화
    searchInput.value = '';
    
    // 모달 표시
    modal.style.display = 'flex';
    
    // 포커스를 약간 지연시켜 모달이 완전히 표시된 후에 포커스
    setTimeout(() => {
        searchInput.focus();
        searchInput.select();
    }, 150);
}

export function closeSearchModal() {
    const modal = document.getElementById('searchModal');
    modal.style.display = 'none';
    document.getElementById('searchResults').innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">검색어를 입력하고 조회 버튼을 클릭하세요.</div>';
    document.getElementById('selectedStudentInfo').style.display = 'none';
    document.getElementById('chapterStatsSection').style.display = 'none';
    selectedStudentId = null;
    // selectedStudentData는 generateTestFromSearch에서 사용하므로 여기서 초기화하지 않음
}

export async function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    if (!searchTerm) {
        alert('검색어를 입력해주세요.');
        return;
    }
    
    try {
        const students = await window.api.searchStudents(searchTerm);
        const resultsDiv = document.getElementById('searchResults');
        
        // API 응답 검증 (배열이 아닐 경우 처리)
        if (!Array.isArray(students)) {
            console.error('검색 결과 형식이 올바르지 않습니다:', students);
            resultsDiv.innerHTML = '<div style="text-align: center; color: #fa5252; padding: 20px;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
            return;
        }
        
        if (students.length === 0) {
            resultsDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">검색 결과가 없습니다.</div>';
            document.getElementById('selectedStudentInfo').style.display = 'none';
            return;
        }
        
        // 학생별로 그룹화 (같은 학생의 여러 단어장)
        const studentMap = {};
        students.forEach(s => {
            if (!studentMap[s.name]) {
                studentMap[s.name] = {
                    id: s.id,
                    name: s.name,
                    class: s.class,
                    school: s.school,
                    grade: s.grade,
                    wordbooks: []
                };
            }
            if (s.wordbook) {
                studentMap[s.name].wordbooks.push({
                    wordbook: s.wordbook,
                    last_test_date: s.last_test_date || '',
                    test_count: s.test_count || 0
                });
            }
        });
        
        const uniqueStudents = Object.values(studentMap);
        
        resultsDiv.innerHTML = `
            <table class="search-results-table">
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>반</th>
                        <th>학교</th>
                        <th>학년</th>
                        <th>단어장</th>
                        <th>최근 시험 일시</th>
                        <th>시험 횟수</th>
                    </tr>
                </thead>
                <tbody>
                    ${uniqueStudents.map(student => {
                        if (student.wordbooks.length === 0) {
                            return `
                                <tr onclick="window.studentManager.selectStudent(${student.id}, '${student.name.replace(/'/g, "\\'")}', '${(student.class || '').replace(/'/g, "\\'")}', '${(student.school || '').replace(/'/g, "\\'")}', '${(student.grade || '').replace(/'/g, "\\'")}')">
                                    <td>${student.name}</td>
                                    <td>${student.class || ''}</td>
                                    <td>${student.school || ''}</td>
                                    <td>${student.grade || ''}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>-</td>
                                </tr>
                            `;
                        }
                        return student.wordbooks.map((wb, idx) => `
                            <tr onclick="window.studentManager.selectStudent(${student.id}, '${student.name.replace(/'/g, "\\'")}', '${(student.class || '').replace(/'/g, "\\'")}', '${(student.school || '').replace(/'/g, "\\'")}', '${(student.grade || '').replace(/'/g, "\\'")}')" ${idx === 0 ? 'class="selected"' : ''}>
                                <td>${idx === 0 ? student.name : ''}</td>
                                <td>${idx === 0 ? (student.class || '') : ''}</td>
                                <td>${idx === 0 ? (student.school || '') : ''}</td>
                                <td>${idx === 0 ? (student.grade || '') : ''}</td>
                                <td>${wb.wordbook}</td>
                                <td>${wb.last_test_date ? new Date(wb.last_test_date).toLocaleString('ko-KR') : '-'}</td>
                                <td>${wb.test_count}</td>
                            </tr>
                        `).join('');
                    }).join('')}
                </tbody>
            </table>
        `;
        
        // 첫 번째 학생 자동 선택
        if (uniqueStudents.length > 0) {
            const firstStudent = uniqueStudents[0];
            selectStudent(firstStudent.id, firstStudent.name, firstStudent.class || '', firstStudent.school || '', firstStudent.grade || '');
        }
    } catch (error) {
        document.getElementById('searchResults').innerHTML = 
            '<div style="text-align: center; color: #fa5252; padding: 20px;">오류: ' + error.message + '</div>';
    }
}

export async function selectStudent(studentId, name, className, school, grade) {
    selectedStudentId = studentId;
    selectedStudentData = { id: studentId, name, class: className, school, grade };
    
    // 테이블에서 선택 표시
    const rows = document.querySelectorAll('.search-results-table tbody tr');
    rows.forEach(row => row.classList.remove('selected'));
    event?.currentTarget?.classList.add('selected');
    
    // 학생 정보 표시
    document.getElementById('selectedStudentInfo').style.display = 'block';
    
    // 해당 학생의 단어장 목록 가져오기 (등록된 단어장 + 시험 기록이 있는 단어장)
    try {
        const wordbooks = await window.api.getStudentAllWordbooks(studentId);
        
        const wordbookListDiv = document.getElementById('wordbookList');
        
        if (!Array.isArray(wordbooks)) {
                wordbookListDiv.innerHTML = '<div style="text-align: center; color: #fa5252; padding: 20px;">단어장 목록을 불러오지 못했습니다.</div>';
                return;
        }

        if (wordbooks.length === 0) {
            wordbookListDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">등록된 단어장이 없습니다.</div>';
            return;
        }
        
        wordbookListDiv.innerHTML = wordbooks.map(wb => {
            const isRegistered = wb.is_registered === 1;
            const wordbookName = wb.wordbook || '';
            const escapedWordbook = wordbookName.replace(/'/g, "\\'");
            
            return `
            <div class="wordbook-item" style="cursor: pointer; ${!isRegistered ? 'opacity: 0.8;' : ''}" onclick="window.studentManager.loadChapterStats(${studentId}, '${escapedWordbook}')">
                <div class="wordbook-info" style="flex: 1;">
                    <div class="wordbook-name">
                        ${wordbookName}
                        ${!isRegistered ? '<span style="font-size: 10px; color: #868e96; margin-left: 5px;">(이전 기록)</span>' : ''}
                    </div>
                    <div class="wordbook-stats">
                        최근 시험: ${wb.last_test_date ? new Date(wb.last_test_date).toLocaleString('ko-KR') : '없음'} | 
                        시험 횟수: ${wb.test_count || 0}회
                    </div>
                </div>
                <div class="wordbook-actions">
                    <button class="action-btn btn-primary" style="width:auto; padding:6px 12px; height:auto; font-size:12px;" 
                            onclick="event.stopPropagation(); window.studentManager.generateTestFromSearch('${escapedWordbook}')">시험지 생성</button>
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        document.getElementById('wordbookList').innerHTML = 
            '<div style="text-align: center; color: #fa5252; padding: 20px;">오류: ' + error.message + '</div>';
    }
}

export async function loadChapterStats(studentId, wordbook) {
    try {
        const stats = await window.api.getStudentChapterStats(studentId, wordbook);
        const chapterStatsDiv = document.getElementById('chapterStatsList');
        const chapterStatsSection = document.getElementById('chapterStatsSection');
        
        if (!Array.isArray(stats)) {
            chapterStatsDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">데이터 오류가 발생했습니다.</div>';
            return;
        }

        if (stats.length === 0) {
            chapterStatsDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">챕터별 시험 기록이 없습니다.</div>';
        } else {
            chapterStatsDiv.innerHTML = `
                <table class="search-results-table">
                    <thead>
                        <tr>
                            <th>챕터</th>
                            <th>최근 시험 일시</th>
                            <th>시험 횟수</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map(stat => `
                            <tr>
                                <td>${stat.chapter}</td>
                                <td>${stat.last_test_date ? new Date(stat.last_test_date).toLocaleString('ko-KR') : '-'}</td>
                                <td>${stat.test_count || 0}회</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        chapterStatsSection.style.display = 'block';
        chapterStatsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        document.getElementById('chapterStatsList').innerHTML = 
            '<div style="text-align: center; color: #fa5252; padding: 20px;">오류: ' + error.message + '</div>';
    }
}

export async function generateTestFromSearch(wordbook) {
    // 학생 이름 먼저 저장 (모달 닫기 전에)
    const studentNameToSet = selectedStudentData ? selectedStudentData.name : null;
    
    // 검색 모달 닫기
    closeSearchModal();
    
    // 확장자명 제거 (혹시 포함되어 있을 수 있음)
    const wordbookName = wordbook.replace(/\.(xlsx|csv)$/i, '');
    
    // 메인 화면에서 해당 단어장 선택
    const allFiles = getAllFiles();
    const wordbookFile = allFiles.find(f => {
        const fileName = f.replace(/\.(xlsx|csv)$/i, '');
        return fileName === wordbookName;
    });
    
    if (wordbookFile) {
        setCurrentSelectedFile(wordbookFile);
        document.getElementById('fileSelect').value = wordbookFile;
        // fileSearchInput에는 확장자명 제거하여 표시
        document.getElementById('fileSearchInput').value = wordbookName;
        toggleClearButton();
        await loadSheetList(wordbookFile);
        updatePinButtonState(wordbookFile);
        
        // 챕터는 기본적으로 아무것도 선택하지 않음 (사용자가 직접 선택)
    } else {
        alert(`단어장 파일 "${wordbook}"을 찾을 수 없습니다.`);
    }
    
    // 학생 이름 및 ID 자동 입력 (검색 모달에서 선택한 경우)
    if (studentNameToSet && selectedStudentData && selectedStudentData.id) {
        document.getElementById('inputName').value = studentNameToSet;
        document.getElementById('inputStudentId').value = selectedStudentData.id;
        updateRealTimeInfo();
    }
    
    // selectedStudentData 초기화
    selectedStudentData = null;
}

export function openStudentsModal() {
    const modal = document.getElementById('studentsModal');
    if (modal) {
        modal.style.display = 'flex';
        // 모달이 열릴 때 메시지 숨기기
        hideStudentMessage();
    }
    loadStudents();
    loadWordbookOptions();
}

export function closeStudentsModal() {
    document.getElementById('studentsModal').style.display = 'none';
    // 입력 필드 초기화
    document.getElementById('newStudentName').value = '';
    document.getElementById('newStudentClass').value = '';
    document.getElementById('newStudentSchool').value = '';
    document.getElementById('newStudentGrade').value = '';
    document.getElementById('newStudentWordbook').value = '';
    // 선택된 단어장 초기화
    clearSelectedWordbooks('new');
    // 검색 필드 초기화
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    // 메시지 숨기기
    hideStudentMessage();
}

// 학생 관리 모달 내 메시지 표시 함수
function showStudentMessage(message, type = 'success') {
    let messageDiv = document.getElementById('studentMessage');
    if (!messageDiv) {
        // 메시지 div가 없으면 생성
        const studentsModalContent = document.querySelector('#studentsModal .modal');
        if (studentsModalContent) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'studentMessage';
            messageDiv.style.cssText = 'padding: 12px 15px; margin-bottom: 15px; border-radius: 6px; font-size: 13px; font-weight: 500; display: none;';
            studentsModalContent.insertBefore(messageDiv, studentsModalContent.firstChild.nextSibling);
        } else {
            return;
        }
    }
    
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    if (type === 'success') {
        messageDiv.style.background = '#d4edda';
        messageDiv.style.color = '#155724';
        messageDiv.style.border = '1px solid #c3e6cb';
    } else {
        messageDiv.style.background = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.style.border = '1px solid #f5c6cb';
    }
    
    // 3초 후 자동으로 숨기기
    setTimeout(() => {
        hideStudentMessage();
    }, 3000);
}

// 메시지 숨기기
function hideStudentMessage() {
    const messageDiv = document.getElementById('studentMessage');
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}

// 학생 관리 모달이 열려있도록 강제 보장
function ensureStudentsModalOpen() {
    const studentsModal = document.getElementById('studentsModal');
    if (!studentsModal) return;
    
    // 즉시 확인
    if (studentsModal.style.display !== 'flex') {
        studentsModal.style.display = 'flex';
    }
    
    // 여러 시점에 확인하여 모달이 닫히지 않도록 보장
    requestAnimationFrame(() => {
        if (studentsModal.style.display !== 'flex') {
            studentsModal.style.display = 'flex';
        }
    });
    
    setTimeout(() => {
        if (studentsModal.style.display !== 'flex') {
            studentsModal.style.display = 'flex';
        }
    }, 0);
    
    setTimeout(() => {
        if (studentsModal.style.display !== 'flex') {
            studentsModal.style.display = 'flex';
        }
    }, 100);
    
    setTimeout(() => {
        if (studentsModal.style.display !== 'flex') {
            studentsModal.style.display = 'flex';
        }
    }, 300);
}

let allWordbooks = []; // 전체 단어장 목록 저장
let selectedWordbooksNew = []; // 새 학생 추가 시 선택된 단어장 목록
let selectedWordbooksEdit = []; // 학생 수정 시 선택된 단어장 목록

// 선택된 단어장 가져오기
function getSelectedWordbooks(type) {
    return type === 'new' ? selectedWordbooksNew : selectedWordbooksEdit;
}

// 선택된 단어장 설정
function setSelectedWordbooks(type, wordbooks) {
    if (type === 'new') {
        selectedWordbooksNew = wordbooks;
    } else {
        selectedWordbooksEdit = wordbooks;
    }
}

// 선택된 단어장 초기화
function clearSelectedWordbooks(type) {
    if (type === 'new') {
        selectedWordbooksNew = [];
        updateSelectedWordbooksDisplay('new');
    } else {
        selectedWordbooksEdit = [];
        updateSelectedWordbooksDisplay('edit');
    }
}

// 단어장 추가
function addSelectedWordbook(type, wordbook) {
    if (!wordbook || wordbook.trim() === '') return;
    
    const wordbookName = wordbook.trim();
    const selected = type === 'new' ? selectedWordbooksNew : selectedWordbooksEdit;
    
    if (!selected.includes(wordbookName)) {
        selected.push(wordbookName);
        if (type === 'new') {
            selectedWordbooksNew = selected;
        } else {
            selectedWordbooksEdit = selected;
        }
        updateSelectedWordbooksDisplay(type);
    }
    
    // 검색 입력 필드 초기화
    const searchInput = document.getElementById(`${type}StudentWordbookSearch`);
    if (searchInput) {
        searchInput.value = '';
    }
    
    // 드롭다운 닫기
    const dropdown = document.getElementById(`${type}StudentWordbookDropdown`);
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

// 단어장 제거
function removeSelectedWordbook(type, wordbook) {
    const selected = type === 'new' ? selectedWordbooksNew : selectedWordbooksEdit;
    const index = selected.indexOf(wordbook);
    if (index > -1) {
        selected.splice(index, 1);
        if (type === 'new') {
            selectedWordbooksNew = selected;
        } else {
            selectedWordbooksEdit = selected;
        }
        updateSelectedWordbooksDisplay(type);
    }
}

// 선택된 단어장 목록 UI 업데이트
function updateSelectedWordbooksDisplay(type) {
    const containerId = `${type}SelectedWordbooks`;
    let container = document.getElementById(containerId);
    
    if (!container) {
        // 컨테이너가 없으면 생성
        const searchInputId = `${type}StudentWordbookSearch`;
        const searchInput = document.getElementById(searchInputId);
        if (!searchInput) return;
        
        const wordbookInputContainer = searchInput.parentElement;
        if (!wordbookInputContainer) return;
        
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = 'margin-top: 8px; min-height: 30px;';
        wordbookInputContainer.appendChild(container);
    }
    
    const selected = getSelectedWordbooks(type);
    
    if (selected.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${selected.map(wb => {
                const escapedWb = wb.replace(/'/g, "\\'");
                const displayWb = wb.replace(/'/g, "&#39;");
                return `
                    <div style="display: flex; align-items: center; gap: 6px; background: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; border: 1px solid #dee2e6;">
                        <span>${displayWb}</span>
                        <button onclick="window.studentManager.removeWordbook('${type}', '${escapedWb}')" 
                                style="background: none; border: none; color: #868e96; cursor: pointer; padding: 0; font-size: 14px; font-weight: bold; line-height: 1;" 
                                title="제거">×</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

export async function loadWordbookOptions() {
    try {
        const files = await window.api.getFiles();
        
        if (!Array.isArray(files)) {
            allWordbooks = [];
            return;
        }

        allWordbooks = files.map(file => ({
            file: file,
            name: file.replace(/\.(xlsx|csv)$/i, '')
        }));
        
        // select는 숨겨진 상태로 유지 (호환성)
        const select = document.getElementById('newStudentWordbook');
        if (select) {
            select.innerHTML = '<option value="">선택 안 함</option>';
            allWordbooks.forEach(wb => {
                const option = document.createElement('option');
                option.value = wb.name;
                option.textContent = wb.name;
                select.appendChild(option);
            });
        }
        
        // 검색 드롭다운 초기화 (표시하지 않음)
        const dropdown = document.getElementById('newStudentWordbookDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
        
        // 선택된 단어장 초기화 (새 학생 추가 시)
        clearSelectedWordbooks('new');
    } catch (error) {
        // 단어장 목록 로딩 실패
    }
}

export function filterWordbookList(type) {
    const searchInput = document.getElementById(`${type}StudentWordbookSearch`);
    const dropdown = document.getElementById(`${type}StudentWordbookDropdown`);
    const searchTerm = (searchInput?.value || '').toLowerCase();
    
    if (!dropdown) return;
    
    const filtered = allWordbooks.filter(wb => 
        wb.name.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="file-dropdown-item" style="color: #999; cursor: default;">검색 결과가 없습니다.</div>';
        // 드롭다운이 이미 표시된 경우에만 업데이트 (자동 표시하지 않음)
        if (dropdown.style.display === 'block') {
            // 이미 표시된 상태이면 그대로 유지
        } else {
            // 표시되지 않은 상태면 표시하지 않음
            dropdown.style.display = 'none';
        }
        return;
    }
    
    dropdown.innerHTML = filtered.map(wb => {
        return `
            <div class="file-dropdown-item" 
                    onclick="window.studentManager.selectWordbook('${type}', '${wb.name.replace(/'/g, "\\'")}')">
                <span>${wb.name}</span>
            </div>
        `;
    }).join('');
    
    // 드롭다운이 이미 표시된 경우에만 업데이트 (자동 표시하지 않음)
    if (dropdown.style.display === 'block') {
        // 이미 표시된 상태이면 그대로 유지
    } else {
        // 표시되지 않은 상태면 표시하지 않음
        dropdown.style.display = 'none';
    }
}

export function selectWordbook(type, wordbookName) {
    // 단어장을 선택된 목록에 추가
    addSelectedWordbook(type, wordbookName);
}

export function showWordbookDropdown(type) {
    const dropdown = document.getElementById(`${type}StudentWordbookDropdown`);
    if (dropdown) {
        if (dropdown.innerHTML === '') {
            filterWordbookList(type);
        } else {
            dropdown.style.display = 'block';
        }
    }
}

export function toggleWordbookDropdown(type) {
    const dropdown = document.getElementById(`${type}StudentWordbookDropdown`);
    if (dropdown) {
        const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
        if (isHidden) {
            // 드롭다운을 열 때: 비어있으면 필터링 후 표시
            if (dropdown.innerHTML === '' || dropdown.innerHTML.trim() === '') {
                filterWordbookList(type);
            }
            dropdown.style.display = 'block';
        } else {
            // 드롭다운을 닫을 때
            dropdown.style.display = 'none';
        }
    }
}

export async function loadStudents() {
    try {
        const students = await window.api.getStudents();
        
        // API 응답 검증
        if (!Array.isArray(students)) {
            document.getElementById('studentsList').innerHTML = 
            '<div style="text-align: center; color: #fa5252; padding: 20px;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
            return;
        }

        allStudentsList = students; // 전체 목록 저장 (검색용)
        
        // 검색어가 있으면 필터링
        const searchTerm = document.getElementById('studentSearchInput')?.value.trim().toLowerCase() || '';
        const filteredStudents = searchTerm 
            ? students.filter(s => {
                const searchText = `${s.name} ${s.class || ''} ${s.school || ''} ${s.grade || ''} ${s.wordbook || ''}`.toLowerCase();
                return searchText.includes(searchTerm);
            })
            : students;
        
        const listDiv = document.getElementById('studentsList');
        
        if (filteredStudents.length === 0) {
            listDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">' + 
                (searchTerm ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.') + '</div>';
            return;
        }
        
        // 학생별로 그룹화 (같은 학생의 여러 단어장)
        const studentMap = {};
        filteredStudents.forEach(student => {
            const key = `${student.name}_${student.class || ''}_${student.school || ''}_${student.grade || ''}`;
            if (!studentMap[key]) {
                studentMap[key] = {
                    name: student.name,
                    class: student.class,
                    school: student.school,
                    grade: student.grade,
                    ids: [],
                    wordbooks: []
                };
            }
            // 첫 번째 레코드의 ID를 대표 ID로 사용 (수정 모달에서 사용)
            if (studentMap[key].ids.length === 0) {
                studentMap[key].ids.push(student.id);
            }
            studentMap[key].wordbooks.push({
                id: student.id,
                wordbook: student.wordbook || '단어장 없음'
            });
        });
        
        const groupedStudents = Object.values(studentMap);
        
        // 학생별로 그룹화하여 표시
        listDiv.innerHTML = groupedStudents.map(studentGroup => {
            const infoText = [
                studentGroup.class ? `반: ${studentGroup.class}` : '',
                studentGroup.school ? `학교: ${studentGroup.school}` : '',
                studentGroup.grade ? `학년: ${studentGroup.grade}` : ''
            ].filter(Boolean).join(' | ');
            
            const representativeId = studentGroup.ids[0];
            const escapedName = studentGroup.name.replace(/'/g, "\\'");
            
            return `
                <div class="student-item" style="margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div class="student-name">${studentGroup.name}</div>
                        ${infoText ? `<div style="font-size: 11px; color: #868e96; margin-top: 4px;">${infoText}</div>` : ''}
                        <div style="margin-top: 8px;">
                            ${studentGroup.wordbooks.map((wb, idx) => `
                                <div style="display: inline-flex; align-items: center; gap: 6px; background: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #495057; margin-right: 6px; margin-bottom: 4px; border: 1px solid #dee2e6;">
                                    <span>📚 ${wb.wordbook.replace(/'/g, "&#39;")}</span>
                                    <button class="btn-icon" onclick="event.stopPropagation(); window.studentManager.deleteStudent(${wb.id}, '${escapedName}', '${(wb.wordbook || '').replace(/'/g, "\\'")}')" 
                                            title="이 단어장 제거" 
                                            style="background: none; border: none; color: #868e96; cursor: pointer; padding: 0; font-size: 12px; line-height: 1; margin-left: 4px;">×</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="student-actions">
                        <button class="btn-icon" onclick="window.studentManager.openEditModal(${representativeId})" title="수정">✏️</button>
                        <button class="btn-icon" onclick="window.studentManager.deleteStudent(${representativeId}, '${escapedName}', null, true)" title="전체 삭제">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        document.getElementById('studentsList').innerHTML = 
            '<div style="text-align: center; color: #fa5252; padding: 20px;">오류: ' + error.message + '</div>';
    }
}

export function filterStudents() {
    loadStudents();
}

export async function addStudent() {
    // 작업 진행 중 플래그 설정 (모달이 닫히지 않도록)
    window._isStudentOperationInProgress = true;
    
    const name = document.getElementById('newStudentName').value.trim();
    const className = document.getElementById('newStudentClass').value.trim();
    const school = document.getElementById('newStudentSchool').value.trim();
    const grade = document.getElementById('newStudentGrade').value.trim();
    
    // 여러 단어장 가져오기
    const selectedWordbooks = getSelectedWordbooks('new');
    
    if (!name) {
        window._isStudentOperationInProgress = false;
        showStudentMessage('학생 이름을 입력해주세요.', 'error');
        document.getElementById('newStudentName').focus();
        return;
    }
    
    if (selectedWordbooks.length === 0) {
        window._isStudentOperationInProgress = false;
        showStudentMessage('최소 한 개의 단어장을 선택해주세요.', 'error');
        return;
    }
    
    try {
        let successCount = 0;
        let errorMessages = [];
        
        // 각 단어장마다 학생 레코드 생성 (기존 구조 활용)
        for (const wordbook of selectedWordbooks) {
            const result = await window.api.addStudent({
                name,
                class: className || null,
                school: school || null,
                grade: grade || null,
                wordbook: wordbook || null
            });
            
            if (result.success) {
                successCount++;
            } else {
                errorMessages.push(`${wordbook}: ${result.error}`);
            }
        }
        
        if (successCount > 0) {
            // 입력 필드 초기화
            document.getElementById('newStudentName').value = '';
            document.getElementById('newStudentClass').value = '';
            document.getElementById('newStudentSchool').value = '';
            document.getElementById('newStudentGrade').value = '';
            clearSelectedWordbooks('new');
            
            await loadStudents();
            // 자동완성 캐시 업데이트 (즉시 반영)
            if (window.studentAutocomplete?.forceUpdateCache) {
                await window.studentAutocomplete.forceUpdateCache();
            }
            // 학생 관리 모달이 열려있도록 강제 보장 (여러 시점에 확인)
            ensureStudentsModalOpen();
            
            if (errorMessages.length > 0) {
                showStudentMessage(`${successCount}개 단어장이 추가되었습니다. 일부 오류: ${errorMessages.join(', ')}`, 'error');
            } else {
                showStudentMessage(`${successCount}개 단어장이 추가되었습니다!`, 'success');
            }
        } else {
            showStudentMessage('오류: ' + errorMessages.join(', '), 'error');
        }
    } catch (error) {
        showStudentMessage('오류: ' + error.message, 'error');
    } finally {
        // 작업 완료 후 플래그 해제
        setTimeout(() => {
            window._isStudentOperationInProgress = false;
        }, 500);
    }
}

export async function openEditModal(id) {
    editingStudentId = id;
    
    // 대표 레코드 찾기
    const representativeRecord = allStudentsList.find(s => s.id === id);
    if (!representativeRecord) {
        alert('학생 정보를 찾을 수 없습니다.');
        return;
    }
    
    // 같은 학생의 모든 레코드 가져오기 (같은 이름, 반, 학교, 학년을 가진 레코드)
    const studentRecords = allStudentsList.filter(s => 
        s.name === representativeRecord.name &&
        (s.class || '') === (representativeRecord.class || '') &&
        (s.school || '') === (representativeRecord.school || '') &&
        (s.grade || '') === (representativeRecord.grade || '')
    );
    
    // 수정 모달의 입력 필드에 현재 값 채우기
    document.getElementById('editStudentName').value = representativeRecord.name || '';
    document.getElementById('editStudentClass').value = representativeRecord.class || '';
    document.getElementById('editStudentSchool').value = representativeRecord.school || '';
    document.getElementById('editStudentGrade').value = representativeRecord.grade || '';
    
    // 등록된 단어장 목록 가져오기 (students 테이블에서)
    const registeredWordbooks = studentRecords
        .map(r => r.wordbook)
        .filter(wb => wb && wb.trim() !== '');
    
    // 수정 모달에 현재 등록된 단어장 목록 표시
    setSelectedWordbooks('edit', [...registeredWordbooks]);
    updateSelectedWordbooksDisplay('edit');
    
    // 단어장 옵션 로드
    try {
        const files = await window.api.getFiles();
        
        if (Array.isArray(files)) {
            allWordbooks = files.map(file => ({
                file: file,
                name: file.replace(/\.(xlsx|csv)$/i, '')
            }));
            
            // select는 숨겨진 상태로 유지 (호환성)
            const select = document.getElementById('editStudentWordbook');
            if (select) {
                select.innerHTML = '<option value="">선택 안 함</option>';
                allWordbooks.forEach(wb => {
                    const option = document.createElement('option');
                    option.value = wb.name;
                    option.textContent = wb.name;
                    select.appendChild(option);
                });
            }
        }
        
        // 검색 입력 필드 초기화
        const searchInput = document.getElementById('editStudentWordbookSearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // 검색 드롭다운 초기화
        filterWordbookList('edit');
    } catch (error) {
        // 단어장 목록 로딩 실패
        clearSelectedWordbooks('edit');
    }
    
    // 모달 표시
    document.getElementById('editStudentModal').style.display = 'flex';
}

export function closeEditModal() {
    document.getElementById('editStudentModal').style.display = 'none';
    editingStudentId = null;
    clearSelectedWordbooks('edit');
}

export async function saveEditStudent() {
    if (!editingStudentId) return;
    
    const name = document.getElementById('editStudentName').value.trim();
    const className = document.getElementById('editStudentClass').value.trim();
    const school = document.getElementById('editStudentSchool').value.trim();
    const grade = document.getElementById('editStudentGrade').value.trim();
    
    // 선택된 단어장 목록 가져오기
    const selectedWordbooks = getSelectedWordbooks('edit');
    
    if (!name) {
        showStudentMessage('학생 이름을 입력해주세요.', 'error');
        document.getElementById('editStudentName').focus();
        return;
    }
    
    if (selectedWordbooks.length === 0) {
        showStudentMessage('최소 한 개의 단어장을 선택해주세요.', 'error');
        return;
    }
    
    try {
        // 대표 레코드 찾기
        const representativeRecord = allStudentsList.find(s => s.id === editingStudentId);
        if (!representativeRecord) {
            showStudentMessage('학생 정보를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 같은 학생의 모든 레코드 가져오기 (같은 이름, 반, 학교, 학년을 가진 레코드)
        const existingRecords = allStudentsList.filter(s => 
            s.name === representativeRecord.name &&
            (s.class || '') === (representativeRecord.class || '') &&
            (s.school || '') === (representativeRecord.school || '') &&
            (s.grade || '') === (representativeRecord.grade || '')
        );
        
        const existingWordbooks = existingRecords.map(r => r.wordbook).filter(Boolean);
        
        // 기본 정보가 변경되었으면 모든 레코드 업데이트
        const infoChanged = 
            name !== (representativeRecord.name || '') ||
            (className || '') !== (representativeRecord.class || '') ||
            (school || '') !== (representativeRecord.school || '') ||
            (grade || '') !== (representativeRecord.grade || '');
        
        if (infoChanged) {
            // 모든 레코드의 기본 정보 업데이트
            for (const record of existingRecords) {
                await window.api.updateStudent(record.id, {
                    name,
                    class: className || null,
                    school: school || null,
                    grade: grade || null,
                    wordbook: record.wordbook || null // 기존 단어장 유지
                });
            }
        }
        
        // 제거할 단어장 찾기
        const toRemove = existingWordbooks.filter(wb => !selectedWordbooks.includes(wb));
        
        // 추가할 단어장 찾기
        const toAdd = selectedWordbooks.filter(wb => !existingWordbooks.includes(wb));
        
        // 제거할 레코드 삭제
        for (const wordbook of toRemove) {
            const recordToDelete = existingRecords.find(r => r.wordbook === wordbook);
            if (recordToDelete) {
                await window.api.deleteStudent(recordToDelete.id);
            }
        }
        
        // 추가할 단어장으로 새 레코드 생성
        for (const wordbook of toAdd) {
            await window.api.addStudent({
                name,
                class: className || null,
                school: school || null,
                grade: grade || null,
                wordbook: wordbook || null
            });
        }
        
        // 편집 모달만 닫고 학생 관리 모달은 유지
        closeEditModal();
        await loadStudents();
        // 자동완성 캐시 업데이트 (즉시 반영)
        if (window.studentAutocomplete?.forceUpdateCache) {
            await window.studentAutocomplete.forceUpdateCache();
        }
        // 학생 관리 모달이 열려있도록 강제 보장 (여러 시점에 확인)
        ensureStudentsModalOpen();
        // 성공 메시지 표시
        showStudentMessage('학생 정보가 수정되었습니다!', 'success');
    } catch (error) {
        showStudentMessage('오류: ' + error.message, 'error');
    } finally {
        // 작업 완료 후 플래그 해제
        setTimeout(() => {
            window._isStudentOperationInProgress = false;
        }, 500);
    }
}

export async function updateStudent(id, studentData) {
    try {
        const result = await window.api.updateStudent(id, studentData);
        if (result.success) {
            loadStudents();
        } else {
            showStudentMessage('오류: ' + result.error, 'error');
        }
    } catch (error) {
        showStudentMessage('오류: ' + error.message, 'error');
    }
}

export async function deleteStudent(id, name, wordbook = null, deleteAll = false) {
    let confirmTitle, confirmMessage;
    
    if (deleteAll) {
        // 해당 학생의 모든 레코드 삭제
        const allRecords = allStudentsList.filter(s => {
            const record = allStudentsList.find(r => r.id === id);
            if (!record) return false;
            return s.name === record.name && 
                   s.class === record.class && 
                   s.school === record.school && 
                   s.grade === record.grade;
        });
        
        confirmTitle = `"${name}" 학생의 모든 단어장을 삭제하시겠습니까?`;
        confirmMessage = `총 ${allRecords.length}개의 단어장 레코드와 관련된 모든 시험 기록이 삭제됩니다.`;
    } else if (wordbook) {
        // 특정 단어장만 삭제
        confirmTitle = `"${name}" 학생의 "${wordbook}" 단어장을 제거하시겠습니까?`;
        confirmMessage = '해당 단어장 레코드와 관련된 모든 시험 기록이 삭제됩니다.';
    } else {
        // 단일 레코드 삭제 (기존 방식)
        confirmTitle = `"${name}" 학생을 삭제하시겠습니까?`;
        confirmMessage = '관련된 모든 시험 기록도 함께 삭제됩니다.';
    }
    
    // 사용자 정의 확인 다이얼로그 표시
    const confirmed = await showConfirmDialog(
        confirmTitle,
        confirmMessage,
        '삭제',
        '취소'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        if (deleteAll) {
            // 대표 레코드 찾기
            const representativeRecord = allStudentsList.find(r => r.id === id);
            if (!representativeRecord) {
                showStudentMessage('학생 정보를 찾을 수 없습니다.', 'error');
                return;
            }
            
            // 해당 학생의 모든 레코드 삭제 (같은 이름, 반, 학교, 학년)
            const allRecords = allStudentsList.filter(s => 
                s.name === representativeRecord.name &&
                (s.class || '') === (representativeRecord.class || '') &&
                (s.school || '') === (representativeRecord.school || '') &&
                (s.grade || '') === (representativeRecord.grade || '')
            );
            
            let successCount = 0;
            for (const record of allRecords) {
                const result = await window.api.deleteStudent(record.id);
                if (result.success) {
                    successCount++;
                }
            }
            
            if (successCount > 0) {
                await loadStudents();
                if (window.studentAutocomplete?.forceUpdateCache) {
                    await window.studentAutocomplete.forceUpdateCache();
                }
                const nameInput = document.getElementById('inputName');
                const studentIdInput = document.getElementById('inputStudentId');
                if (nameInput && studentIdInput) {
                    const idsToCheck = allRecords.map(r => r.id.toString());
                    if (idsToCheck.includes(studentIdInput.value)) {
                        nameInput.value = '';
                        studentIdInput.value = '';
                        if (window.updateRealTimeInfo) {
                            window.updateRealTimeInfo();
                        }
                    }
                }
                ensureStudentsModalOpen();
                showStudentMessage(`${successCount}개의 레코드가 삭제되었습니다!`, 'success');
            } else {
                showStudentMessage('삭제에 실패했습니다.', 'error');
            }
        } else {
            // 단일 레코드 삭제
            const result = await window.api.deleteStudent(id);
            if (result.success) {
                await loadStudents();
                if (window.updateStudentsCache) {
                    await window.updateStudentsCache();
                }
                const nameInput = document.getElementById('inputName');
                const studentIdInput = document.getElementById('inputStudentId');
                if (nameInput && studentIdInput && studentIdInput.value === id.toString()) {
                    nameInput.value = '';
                    studentIdInput.value = '';
                    if (window.updateRealTimeInfo) {
                        window.updateRealTimeInfo();
                    }
                }
                ensureStudentsModalOpen();
                showStudentMessage('삭제되었습니다!', 'success');
            } else {
                showStudentMessage('오류: ' + result.error, 'error');
            }
        }
    } catch (error) {
        showStudentMessage('오류: ' + error.message, 'error');
    }
}

// 사용자 정의 확인 다이얼로그
function showConfirmDialog(title, message, confirmText = '확인', cancelText = '취소') {
    return new Promise((resolve) => {
        // 기존 확인 다이얼로그가 있으면 제거
        const existing = document.getElementById('customConfirmDialog');
        if (existing) {
            existing.remove();
        }
        
        // 확인 다이얼로그 생성
        const overlay = document.createElement('div');
        overlay.id = 'customConfirmDialog';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background: white; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">${title}</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.5;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="confirmCancelBtn" style="padding: 8px 20px; border: 1px solid #dee2e6; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; color: #495057;">${cancelText}</button>
                <button id="confirmOkBtn" style="padding: 8px 20px; border: none; background: #fa5252; color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">${confirmText}</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // 이벤트 핸들러
        const handleConfirm = () => {
            overlay.remove();
            resolve(true);
        };
        
        const handleCancel = () => {
            overlay.remove();
            resolve(false);
        };
        
        document.getElementById('confirmOkBtn').addEventListener('click', handleConfirm);
        document.getElementById('confirmCancelBtn').addEventListener('click', handleCancel);
        
        // ESC 키로 취소
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        // 배경 클릭으로 취소
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });
    });
}

// 단어장 제거 함수 (전역 노출용)
export function removeWordbook(type, wordbook) {
    removeSelectedWordbook(type, wordbook);
}

// 전역으로 노출
window.studentManager = {
    openSearchModal,
    closeSearchModal,
    performSearch,
    selectStudent,
    loadChapterStats,
    generateTestFromSearch,
    openStudentsModal,
    closeStudentsModal,
    loadStudents,
    filterStudents,
    addStudent,
    openEditModal,
    closeEditModal,
    saveEditStudent,
    deleteStudent,
    filterWordbookList,
    selectWordbook,
    showWordbookDropdown,
    toggleWordbookDropdown,
    removeWordbook
};

// HTML onclick 속성 호환을 위한 전역 함수
window.selectStudent = (studentId, name, className, school, grade) => 
    window.studentManager?.selectStudent(studentId, name, className, school, grade);
window.loadChapterStats = (studentId, wordbook) => 
    window.studentManager?.loadChapterStats(studentId, wordbook);
window.generateTestFromSearch = (wordbook) => 
    window.studentManager?.generateTestFromSearch(wordbook);
window.deleteStudent = (id, name) => 
    window.studentManager?.deleteStudent(id, name);