// 인증 관리 모듈 (앱 보호용 고정 비밀번호)

// 앱 보호용 고정 비밀번호 (실행파일 유출 방지)
// 환경 변수에서 가져오거나 기본값 사용
let APP_LICENSE_PASSWORD = null;

// 환경 변수에서 비밀번호 로드 (비동기)
async function loadLicensePassword() {
    if (APP_LICENSE_PASSWORD) {
        return APP_LICENSE_PASSWORD;
    }
    
    if (window.api && window.api.getEnv) {
        const envPassword = await window.api.getEnv('APP_LICENSE_PASSWORD');
        if (envPassword) {
            APP_LICENSE_PASSWORD = envPassword;
            return APP_LICENSE_PASSWORD;
        }
    }
    
    // 환경 변수가 없으면 기본값 사용 (개발용)
    APP_LICENSE_PASSWORD = 'WORDLAB2025!@!';
    return APP_LICENSE_PASSWORD;
}

const PASSWORD_PREFIX = 'app_password_hash_';
const PASSWORD_SET_PREFIX = 'app_password_set_';
let currentDeviceId = null;

/**
 * 간단한 해시 함수 (실제 프로덕션에서는 더 강력한 해시 사용 권장)
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit 정수로 변환
    }
    return hash.toString();
}

/**
 * 기기 ID 가져오기 및 초기화
 */
export async function getDeviceId() {
    if (currentDeviceId) {
        return currentDeviceId;
    }
    
    if (window.api && typeof window.api.getDeviceId === 'function') {
        currentDeviceId = await window.api.getDeviceId();
    } else {
        // API가 없으면 임시 ID 사용 (개발 환경)
        currentDeviceId = 'default-device';
    }
    
    return currentDeviceId;
}

/**
 * 기기별 키 생성
 */
function getDeviceKey(prefix, deviceId = null) {
    const id = deviceId || currentDeviceId;
    if (!id) {
        // 동기적으로 처리하기 위해 임시 ID 사용
        return prefix + 'default-device';
    }
    return prefix + id;
}

/**
 * 앱 라이선스 비밀번호가 입력되었는지 확인 (기기별)
 */
export async function isPasswordSet() {
    const deviceId = await getDeviceId();
    const setKey = getDeviceKey(PASSWORD_SET_PREFIX, deviceId);
    return localStorage.getItem(setKey) === 'true';
}

/**
 * 앱 라이선스 비밀번호 확인 (고정 비밀번호)
 */
export async function verifyLicensePassword(inputPassword) {
    // 비밀번호 로드 (환경 변수에서 가져오기)
    const correctPassword = await loadLicensePassword();
    
    // 간단한 해시 비교로 역공학 방지 (완벽하지 않지만 기본적인 보호)
    const inputHash = simpleHash(inputPassword);
    const correctHash = simpleHash(correctPassword);
    
    if (inputHash === correctHash) {
        return { success: true };
    } else {
        return { success: false, error: '잘못된 라이선스 비밀번호입니다.' };
    }
}

/**
 * 앱 라이선스 비밀번호 입력 및 저장 (기기별)
 */
export async function setPassword(inputPassword) {
    // 고정 비밀번호 확인
    const verify = await verifyLicensePassword(inputPassword);
    if (!verify.success) {
        return verify;
    }
    
    // 비밀번호가 맞으면 이 기기에 인증 완료 표시
    const deviceId = await getDeviceId();
    const setKey = getDeviceKey(PASSWORD_SET_PREFIX, deviceId);
    localStorage.setItem(setKey, 'true');
    return { success: true };
}

/**
 * 앱 라이선스 비밀번호 확인 (기기별 - 이미 인증된 기기인지 확인)
 */
export async function verifyPassword(inputPassword) {
    // 고정 비밀번호 확인
    return verifyLicensePassword(inputPassword);
}

/**
 * 비밀번호 변경은 불가 (고정 라이선스 비밀번호)
 */
export async function changePassword(oldPassword, newPassword) {
    // 고정 라이선스 비밀번호는 변경할 수 없음
    return { success: false, error: '라이선스 비밀번호는 변경할 수 없습니다.' };
}

/**
 * 비밀번호 초기화 (기기별, 현재 기기만)
 */
export async function resetPassword() {
    const deviceId = await getDeviceId();
    const passwordKey = getDeviceKey(PASSWORD_PREFIX, deviceId);
    const setKey = getDeviceKey(PASSWORD_SET_PREFIX, deviceId);
    
    localStorage.removeItem(passwordKey);
    localStorage.removeItem(setKey);
    return { success: true };
}

/**
 * 앱 라이선스 비밀번호 입력 UI (기기별)
 */
export async function setupPassword() {
    const password = document.getElementById('setupPassword')?.value;
    const errorDiv = document.getElementById('passwordSetupError');
    
    if (!password) {
        if (errorDiv) errorDiv.textContent = '라이선스 비밀번호를 입력해주세요.';
        return;
    }
    
    const result = await setPassword(password);
    if (result.success) {
        document.getElementById('passwordSetupModal').style.display = 'none';
        document.getElementById('setupPassword').value = '';
        if (errorDiv) errorDiv.textContent = '';
        // 앱 초기화
        if (window.main && typeof window.main.init === 'function') {
            window.main.init();
        }
    } else {
        if (errorDiv) errorDiv.textContent = result.error || '라이선스 비밀번호가 올바르지 않습니다.';
        document.getElementById('setupPassword').value = '';
        document.getElementById('setupPassword').focus();
    }
}

/**
 * 비밀번호 확인 UI
 */
export function verifyPasswordInput() {
    const password = document.getElementById('verifyPassword')?.value;
    const errorDiv = document.getElementById('passwordVerifyError');
    
    if (!password) {
        if (errorDiv) errorDiv.textContent = '비밀번호를 입력해주세요.';
        return;
    }
    
    const result = verifyPassword(password);
    if (result.success) {
        document.getElementById('passwordVerifyModal').style.display = 'none';
        document.getElementById('verifyPassword').value = '';
        if (errorDiv) errorDiv.textContent = '';
        // 앱 초기화
        if (window.main && typeof window.main.init === 'function') {
            window.main.init();
        }
    } else {
        if (errorDiv) errorDiv.textContent = result.error || '비밀번호가 일치하지 않습니다.';
        document.getElementById('verifyPassword').value = '';
        document.getElementById('verifyPassword').focus();
    }
}

/**
 * 라이선스 재인증 UI
 */
export async function reverifyLicense() {
    const password = document.getElementById('reverifyPassword')?.value;
    const errorDiv = document.getElementById('passwordReverifyError');
    
    if (!password) {
        if (errorDiv) errorDiv.textContent = '라이선스 비밀번호를 입력해주세요.';
        return;
    }
    
    const result = await setPassword(password);
    if (result.success) {
        document.getElementById('reverifyPassword').value = '';
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.color = '#28a745';
            errorDiv.textContent = '재인증이 완료되었습니다.';
            setTimeout(() => {
                errorDiv.textContent = '';
                errorDiv.style.color = '#fa5252';
            }, 2000);
        }
    } else {
        if (errorDiv) errorDiv.textContent = result.error || '라이선스 비밀번호가 올바르지 않습니다.';
        document.getElementById('reverifyPassword').value = '';
    }
}

// 전역으로 노출
window.authManager = {
    setupPassword,
    verifyPassword: verifyPasswordInput,
    reverifyLicense,
    isPasswordSet,
    verifyPasswordFunction: verifyPassword // 내부 함수는 별도 이름으로
};

