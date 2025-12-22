import { getCurrentData, setCurrentData } from './fileManager.js';

export async function loadSheetList(filename) {
    const data = await window.api.readExcel(filename);
    setCurrentData(data);
    const listDiv = document.getElementById('chapterList');
    const sheets = Object.keys(data);
    
    // 챕터 정렬 (숫자 우선, 그 다음 알파벳/한글)
    const sortedSheets = sheets.sort((a, b) => {
        // 숫자 추출 (예: "Day 1" -> 1, "1강" -> 1)
        const getNumber = (str) => {
            const match = str.match(/(\d+)/);
            return match ? parseInt(match[1]) : Infinity;
        };
        
        const numA = getNumber(a);
        const numB = getNumber(b);
        
        // 둘 다 숫자가 있으면 숫자로 정렬
        if (numA !== Infinity && numB !== Infinity) {
            return numA - numB;
        }
        // 하나만 숫자가 있으면 숫자가 앞으로
        if (numA !== Infinity) return -1;
        if (numB !== Infinity) return 1;
        // 둘 다 숫자가 없으면 문자열로 정렬
        return a.localeCompare(b, 'ko');
    });
    
    listDiv.innerHTML = sortedSheets.map((sheet, idx) => `
        <label class="chapter-item">
            <input type="checkbox" value="${sheet}" onchange="window.sheetManager.updateStats()">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${sheet}">${sheet}</span>
        </label>
    `).join('');
    document.getElementById('checkAll').checked = false;
    updateStats();
}

export function toggleAllChapters() {
    const isChecked = document.getElementById('checkAll').checked;
    const checkboxes = document.querySelectorAll('#chapterList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = isChecked);
    updateStats();
}

export function updateStats() {
    const currentData = getCurrentData();
    const checkboxes = document.querySelectorAll('#chapterList input[type="checkbox"]');
    const display = document.getElementById('maxCountDisplay');
    let totalWords = 0;
    let checkedCount = 0;
    checkboxes.forEach(cb => {
        if(cb.checked) {
            checkedCount++;
            const sheetData = currentData[cb.value];
            if(sheetData) totalWords += Math.max(0, sheetData.length - 1);
        }
    });
    display.innerText = totalWords;
    
    // 문항 수 입력 필드의 최대값을 총 단어 수로 제한
    const qCountInput = document.getElementById('qCount');
    if (qCountInput && totalWords > 0) {
        qCountInput.setAttribute('max', totalWords);
        // 현재 입력값이 최대값보다 크면 최대값으로 조정
        if (parseInt(qCountInput.value) > totalWords) {
            qCountInput.value = totalWords;
        }
    }
    
    const allCheck = document.getElementById('checkAll');
    if (checkboxes.length > 0 && checkedCount === checkboxes.length) allCheck.checked = true;
    else allCheck.checked = false;
}

export function validateQuestionCount() {
    const qCountInput = document.getElementById('qCount');
    const maxCountDisplay = document.getElementById('maxCountDisplay');
    const maxCount = parseInt(maxCountDisplay.innerText) || 0;
    
    if (maxCount > 0) {
        const inputValue = parseInt(qCountInput.value) || 0;
        if (inputValue > maxCount) {
            qCountInput.value = maxCount;
        }
    }
}

// 전역으로 노출
window.sheetManager = {
    loadSheetList,
    toggleAllChapters,
    updateStats,
    validateQuestionCount
};

