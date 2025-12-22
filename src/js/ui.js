import { getLastAutoTitle } from './testGenerator.js';

export function changeZoom(val) {
    const papers = document.querySelectorAll('.paper');

    const firstPaper = papers[0];
    if (!firstPaper) return;
    
    const originalHeight = firstPaper.offsetHeight; 
    const desiredGap = 5; // 100%일 때 유지하고 싶은 간격 (px)

    papers.forEach(p => {
        p.style.transformOrigin = 'top center';
        p.style.transform = `scale(${val})`;

        const computedMargin = desiredGap - (originalHeight * (1 - val));
        
        p.style.marginBottom = `${computedMargin}px`;
    });

    document.getElementById('zoomValue').innerText = Math.round(val * 100) + "%";
}

export function updateRealTimeInfo() {
    const dateVal = document.getElementById('inputDate').value;
    const nameVal = document.getElementById('inputName').value;
    if(!dateVal && !nameVal) return;
    const dates = document.querySelectorAll('.live-date');
    if(dates.length > 0) dates.forEach(el => el.innerText = dateVal);
    const names = document.querySelectorAll('.live-name');
    if(names.length > 0) names.forEach(el => el.innerText = nameVal);
}

// --- [제목 실시간 업데이트] ---
export function updateRealTimeTitle() {
    const inputVal = document.getElementById('inputTitle').value;
    const subtitle = document.querySelectorAll('.test-subtitle');
    if (subtitle.length > 0) {
        // 입력값이 있으면 입력값, 없으면 자동생성된 제목 사용
        const targetText = inputVal ? inputVal : getLastAutoTitle();
        subtitle.forEach(el => el.innerText = targetText);
    }
}

// 전역으로 노출
window.ui = {
    changeZoom,
    updateRealTimeInfo,
    updateRealTimeTitle
};

