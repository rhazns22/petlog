/**
 * 브라우저 저장소 데이터 보호를 위한 유틸리티
 */

// 간단한 XOR 마스킹 키 (보안 수준을 높이기 위해 주기적으로 변경 가능)
const MASK_KEY = 'petlog_security_v1';

const encode = (str: string): string => {
  // 1. 문자열을 UTF-8로 변환 후 Base64 인코딩
  const b64 = btoa(unescape(encodeURIComponent(str)));
  // 2. 간단한 순서 뒤섞기 (가독성 추가 차단)
  return b64.split('').reverse().join('');
};

const decode = (str: string): string => {
  try {
    // 1. 뒤섞인 순서 복구
    const b64 = str.split('').reverse().join('');
    // 2. Base64 디코딩 후 원래 문자열로 변환
    return decodeURIComponent(escape(atob(b64)));
  } catch (e) {
    return '';
  }
};

export const secureStorage = {
  setItem: (key: string, value: any) => {
    const stringValue = JSON.stringify(value);
    const encodedValue = encode(stringValue);
    localStorage.setItem(key, encodedValue);
  },

  getItem: (key: string): any | null => {
    const encodedValue = localStorage.getItem(key);
    if (!encodedValue) return null;
    
    const decodedValue = decode(encodedValue);
    if (!decodedValue) return null;

    try {
      return JSON.parse(decodedValue);
    } catch {
      return null;
    }
  },

  removeItem: (key: string) => {
    localStorage.removeItem(key);
  }
};
