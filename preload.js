const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // 파일 관련
    getFiles: () => ipcRenderer.invoke('get-files'),
    readExcel: (filename) => ipcRenderer.invoke('read-excel', filename),

    // 학생 DB API
    getDbPath: () => ipcRenderer.invoke('get-db-path'),
    setDbPath: (path) => ipcRenderer.invoke('set-db-path', path),
    getStudents: () => ipcRenderer.invoke('get-students'),
    addStudent: (studentData) => ipcRenderer.invoke('add-student', studentData),
    updateStudent: (id, studentData) => ipcRenderer.invoke('update-student', id, studentData),
    deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),
    searchStudents: (searchTerm) => ipcRenderer.invoke('search-students', searchTerm),

    // 성적 기록 API
    saveTestRecord: (studentId, wordbook, testTitle, date, score, total, testData) => 
        ipcRenderer.invoke('save-test-record', studentId, wordbook, testTitle, date, score, total, testData),
    getTestRecords: (studentId) => ipcRenderer.invoke('get-test-records', studentId),
    getAllTestRecords: () => ipcRenderer.invoke('get-all-test-records'),
    getStudentWordbookStats: (studentId) => ipcRenderer.invoke('get-student-wordbook-stats', studentId),
    getStudentChapterStats: (studentId, wordbook) => ipcRenderer.invoke('get-student-chapter-stats', studentId, wordbook),
    getStudentAllWordbooks: (studentId) => ipcRenderer.invoke('get-student-all-wordbooks', studentId),

    // 기타 기능
    printPDF: (options) => ipcRenderer.invoke('print-pdf', options),
    getDeviceId: () => ipcRenderer.invoke('get-device-id'),
    getEnv: (key) => ipcRenderer.invoke('get-env', key)
});