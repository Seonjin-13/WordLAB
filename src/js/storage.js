import { PIN_KEY } from './constants.js';

// localStorage 관련 함수
export const getPinnedFiles = () => JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
export const setPinnedFiles = (list) => localStorage.setItem(PIN_KEY, JSON.stringify(list));

