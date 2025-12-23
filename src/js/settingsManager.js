import { ACADEMY_NAME_KEY, ACADEMY_LOGO_KEY, ACADEMY_POS_KEY, ACADEMY_SIZE_KEY, SHOW_MAIN_TITLE_KEY, MAIN_TITLE_KEY } from './constants.js';
import { generateTest } from './testGenerator.js';

export function openSettings() { 
    document.getElementById('settingsModal').style.display = 'flex'; 
    loadSettingsToModal(); 
    loadDbPath();
    // 초기 탭(학원 정보) 버튼 표시
    const removeBtn = document.getElementById('removeSettingsBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (removeBtn) removeBtn.style.display = 'block';
    if (saveBtn) saveBtn.style.display = 'block';
}

export function closeSettings() { 
    document.getElementById('settingsModal').style.display = 'none'; 
}

export async function loadDbPath() {
    try {
        const path = await window.api.getDbPath();
        document.getElementById('currentDbPath').textContent = `현재 경로: ${path}`;
    } catch (error) {
        document.getElementById('currentDbPath').textContent = '경로 로딩 오류';
    }
}

export async function setDbPath() {
    const input = document.getElementById('dbPathInput');
    const path = input.value.trim();
    if (!path) {
        alert('경로를 입력해주세요.');
        return;
    }
    
    try {
        const result = await window.api.setDbPath(path);
        if (result.success) {
            alert('DB 경로가 설정되었습니다. 앱을 재시작하면 적용됩니다.');
            input.value = '';
            loadDbPath();
        } else {
            alert('오류: ' + result.error);
        }
    } catch (error) {
        alert('오류: ' + error.message);
    }
}

export function updateLogoSizeDisplay(value) {
    const display = document.getElementById('logoSizeDisplay');
    if (display) {
        display.textContent = value + '%';
    }
}

export function updateLogoPreview() {
    const sizeInput = document.getElementById('logoSize');
    const nameInput = document.getElementById('settingAcademyName');
    const logoFileInput = document.getElementById('settingLogoFile');
    const previewDiv = document.getElementById('logoSizePreview');
    
    if (!previewDiv || !sizeInput) return;
    
    const sizePercent = parseInt(sizeInput.value) / 100;
    // 학원 이름과 동일한 비율로 로고 크기 설정
    const textFontSize = 18 * sizePercent;
    const logoHeight = textFontSize * 1.2; // 학원 이름 폰트 크기의 1.2배로 로고 높이 설정
    const logoStyle = `height: ${logoHeight}px; max-width: 100%; object-fit: contain;`;
    const textStyle = `font-size: ${textFontSize}px; font-weight: bold; color: #555;`;
    
    // 로고 파일이 선택되어 있으면 로고 표시
    if (logoFileInput.files && logoFileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewDiv.innerHTML = `<img src="${e.target.result}" style="${logoStyle}">`;
        };
        reader.readAsDataURL(logoFileInput.files[0]);
    }
    // 저장된 로고가 있으면 표시
    else {
        const savedLogo = localStorage.getItem(ACADEMY_LOGO_KEY);
        if (savedLogo) {
            previewDiv.innerHTML = `<img src="${savedLogo}" style="${logoStyle}">`;
        }
        // 이름만 있으면 텍스트 표시
        else if (nameInput && nameInput.value.trim()) {
            previewDiv.innerHTML = `<span style="${textStyle}">${nameInput.value}</span>`;
        }
        // 아무것도 없으면 안내 메시지
        else {
            previewDiv.innerHTML = `<span style="color:#999; font-size:12px;">로고 또는 이름을 입력하면 미리보기가 표시됩니다</span>`;
        }
    }
}

export function loadSettingsToModal() {
    const savedName = localStorage.getItem(ACADEMY_NAME_KEY) || "";
    const savedLogo = localStorage.getItem(ACADEMY_LOGO_KEY) || "";
    const savedPos = localStorage.getItem(ACADEMY_POS_KEY) || "center";
    const savedSize = localStorage.getItem(ACADEMY_SIZE_KEY) || "100";
    const savedMainTitle = localStorage.getItem(MAIN_TITLE_KEY) || "VOCABULARY TEST";
    
    const nameInput = document.getElementById('settingAcademyName');
    nameInput.value = savedName;
    
    if (savedLogo) {
        document.getElementById('logoPreview').innerHTML = `<img src="${savedLogo}" style="max-height:100%; max-width:100%;">`;
    } else {
        document.getElementById('logoPreview').innerText = "이미지 미리보기";
    }
    const radios = document.getElementsByName('logoPos');
    radios.forEach(r => { if(r.value === savedPos) r.checked = true; });
    const logoSizeInput = document.getElementById('logoSize');
    logoSizeInput.value = savedSize;
    updateLogoSizeDisplay(savedSize);
    
    // 시험지 제목
    const mainTitleInput = document.getElementById('mainTitle');
    if (mainTitleInput) {
        mainTitleInput.value = savedMainTitle;
    }
    
    // 제목 표시 여부: 학원 이름이 있으면 기본적으로 해제, 없으면 체크
    const showMainTitleCheckbox = document.getElementById('showMainTitle');
    if (showMainTitleCheckbox) {
        const savedShowMainTitle = localStorage.getItem(SHOW_MAIN_TITLE_KEY);
        if (savedShowMainTitle === null) {
            // 저장된 값이 없으면 학원 이름 유무에 따라 기본값 설정
            showMainTitleCheckbox.checked = !savedName && !savedLogo;
        } else {
            showMainTitleCheckbox.checked = savedShowMainTitle === 'true';
        }
    }
    
    // 이름 입력 시 미리보기 업데이트
    nameInput.addEventListener('input', updateLogoPreview);
    
    // 로고 파일 선택 시 미리보기 업데이트
    const logoFileInput = document.getElementById('settingLogoFile');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', updateLogoPreview);
    }
    
    // 초기 미리보기 표시
    updateLogoPreview();
}

export function removeLogoOnly() {
    if(!confirm("로고 이미지를 삭제하시겠습니까?")) return;
    localStorage.removeItem(ACADEMY_LOGO_KEY);
    document.getElementById('settingLogoFile').value = "";
    document.getElementById('logoPreview').innerText = "이미지 미리보기";
}

export function removeSettings() {
    if(!confirm("학원 정보를 삭제하시겠습니까?")) return;
    localStorage.removeItem(ACADEMY_NAME_KEY);
    localStorage.removeItem(ACADEMY_LOGO_KEY);
    document.getElementById('settingAcademyName').value = "";
    document.getElementById('settingLogoFile').value = "";
    document.getElementById('logoPreview').innerText = "이미지 미리보기";
    alert("삭제되었습니다.");
    closeSettings();
    if(document.querySelector('.brand-header')) generateTest();
}

export function saveSettings() {
    const name = document.getElementById('settingAcademyName').value;
    const fileInput = document.getElementById('settingLogoFile');
    const pos = document.querySelector('input[name="logoPos"]:checked').value;
    const size = document.getElementById('logoSize').value;
    const mainTitle = document.getElementById('mainTitle').value.trim() || "VOCABULARY TEST";
    const showMainTitle = document.getElementById('showMainTitle').checked;

    localStorage.setItem(ACADEMY_NAME_KEY, name);
    localStorage.setItem(ACADEMY_POS_KEY, pos);
    localStorage.setItem(ACADEMY_SIZE_KEY, size);
    localStorage.setItem(MAIN_TITLE_KEY, mainTitle);
    localStorage.setItem(SHOW_MAIN_TITLE_KEY, showMainTitle ? 'true' : 'false');

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            localStorage.setItem(ACADEMY_LOGO_KEY, e.target.result); 
            alert("저장되었습니다!");
            closeSettings();
            if(document.querySelector('.brand-header')) generateTest(); 
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        alert("저장되었습니다!");
        closeSettings();
        if(document.querySelector('.brand-header')) generateTest();
    }
}

export function switchSettingsTab(tabName) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    // 선택한 탭 활성화
    const tabButton = document.querySelector(`.settings-tab[onclick="switchSettingsTab('${tabName}')"]`);
    const tabContent = document.getElementById(`${tabName}Tab`);
    
    if (tabButton) tabButton.classList.add('active');
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }
    
    // 탭별 버튼 표시/숨김 처리
    const removeBtn = document.getElementById('removeSettingsBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    if (tabName === 'academy') {
        // 학원 정보 탭: 정보 삭제, 저장하기 표시
        if (removeBtn) removeBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'block';
    } else {
        // 다른 탭: 정보 삭제, 저장하기 숨김
        if (removeBtn) removeBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
    }
    
    // 보안 탭으로 전환 시 에러 메시지 초기화 및 상태 업데이트
    if (tabName === 'security') {
        const errorDiv = document.getElementById('passwordReverifyError');
        if (errorDiv) {
            errorDiv.textContent = '';
        }
        // 라이선스 상태 확인
        if (window.authManager && typeof window.authManager.isPasswordSet === 'function') {
            window.authManager.isPasswordSet().then(isSet => {
                const statusDiv = document.getElementById('licenseStatus');
                if (statusDiv) {
                    if (isSet) {
                        statusDiv.textContent = '인증 완료';
                        statusDiv.style.color = '#28a745';
                    } else {
                        statusDiv.textContent = '미인증';
                        statusDiv.style.color = '#fa5252';
                    }
                }
            });
        }
    }
}

// 전역으로 노출
window.settingsManager = {
    openSettings,
    closeSettings,
    setDbPath,
    removeLogoOnly,
    removeSettings,
    saveSettings,
    updateLogoSizeDisplay,
    updateLogoPreview,
    switchSettingsTab
};

