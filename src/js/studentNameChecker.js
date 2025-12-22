// 학생 이름 중복 체크 모듈
// 동명이인이 있을 때 사용자에게 알림

let duplicateCheckTimeout = null;

export async function checkDuplicateNames() {
    // 입력 중일 때는 체크하지 않음 (입력 완료 후 체크)
    if (duplicateCheckTimeout) {
        clearTimeout(duplicateCheckTimeout);
    }
    
    duplicateCheckTimeout = setTimeout(async () => {
        const nameInput = document.getElementById('inputName');
        const studentIdInput = document.getElementById('inputStudentId');
        
        if (!nameInput || !nameInput.value.trim()) {
            // 이름이 비어있으면 ID도 초기화
            if (studentIdInput) {
                studentIdInput.value = '';
            }
            return;
        }
        
        if (!window.api) return;
        
        try {
            const students = await window.api.getStudents();
            const inputName = nameInput.value.trim();
            const studentsWithSameName = students.filter(s => s.name === inputName);
            
            // 현재 저장된 ID가 유효한지 확인
            const currentId = studentIdInput?.value;
            if (currentId) {
                const currentStudent = students.find(s => s.id === parseInt(currentId));
                if (currentStudent && currentStudent.name === inputName) {
                    // 현재 ID가 입력한 이름과 일치하면 그대로 유지
                    return;
                }
            }
            
            // 동명이인 처리
            if (studentsWithSameName.length === 0) {
                // 학생이 없으면 ID 초기화
                if (studentIdInput) {
                    studentIdInput.value = '';
                }
            } else if (studentsWithSameName.length === 1) {
                // 동명이인이 없으면 자동으로 ID 설정
                if (studentIdInput) {
                    studentIdInput.value = studentsWithSameName[0].id.toString();
                }
            } else {
                // 동명이인이 있으면 ID 초기화하고 경고 표시
                if (studentIdInput) {
                    studentIdInput.value = '';
                }
                
                // 경고 메시지 표시 (선택적)
                // 사용자가 직접 선택하도록 검색 모달 사용 권장
                const warningMsg = `⚠️ 동명이인 발견: "${inputName}" (${studentsWithSameName.length}명)\n학생 검색 모달에서 정확한 학생을 선택해주세요.`;
                // 콘솔에만 표시 (사용자 경험을 위해 팝업은 표시하지 않음)
                console.warn(warningMsg);
            }
        } catch (error) {
            console.error('학생 이름 중복 체크 실패:', error);
        }
    }, 500); // 500ms 후 체크 (입력 완료 대기)
}

// 전역으로 노출
window.checkDuplicateNames = checkDuplicateNames;

