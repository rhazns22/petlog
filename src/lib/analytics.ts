import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 세션 ID - 탭을 열 때마다 새로 생성
const SESSION_ID = (() => {
  const key = 'petlog_session_id';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
})();

export type EventType =
  | 'page_view'
  | 'login'
  | 'logout'
  | 'signup_start'
  | 'pet_added'
  | 'pet_deleted'
  | 'transaction_added'
  | 'transaction_edited'
  | 'transaction_deleted'
  | 'budget_updated'
  | 'payment_method_added'
  | 'notification_read'
  | 'inquiry_submitted'
  | 'profile_updated'
  | 'search'
  | 'filter_applied'
  | 'ocr_limit_reached'
  | 'ocr_continue_after_limit'
  | 'report_limit_reached'
  | 'report_continue_after_limit'
  | 'session_start'
  | 'withdrawal';

interface EventPayload {
  type: EventType;
  page?: string;
  metadata?: Record<string, any>;
}

/**
 * 데이터 내의 민감 정보(이메일 등)를 찾아 마스킹 처리합니다.
 */
function maskSensitiveData(data: any): any {
  if (typeof data === 'string') {
    // 이메일 패턴 마스킹 (ex: user@example.com -> u***@e***.com)
    return data.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,})/g, (match, p1, p2, p3) => {
      return `${p1[0]}***@${p2[0]}***.${p3}`;
    });
  }
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  if (data !== null && typeof data === 'object') {
    const masked: any = {};
    for (const key in data) {
      masked[key] = maskSensitiveData(data[key]);
    }
    return masked;
  }
  return data;
}

/**
 * Firestore에 사용자 이벤트를 기록합니다.
 * userId가 없으면 조용히 무시합니다.
 */
export async function trackEvent(userId: string | null | undefined, payload: EventPayload) {
  if (!userId) return;

  // 데이터 프라이버시 설정 확인
  const privacyEnabled = localStorage.getItem('petlog_privacy_enabled') !== 'false';
  if (!privacyEnabled) {
    // 프라이버시 설정이 꺼져 있으면 로그를 남기지 않음
    return;
  }

  try {
    const maskedPayload = maskSensitiveData(payload);
    await addDoc(collection(db, 'users', userId, 'events'), {
      ...maskedPayload,
      sessionId: SESSION_ID,
      platform: 'web',
      userAgent: navigator.userAgent.slice(0, 200),
      screenSize: `${window.screen.width}x${window.screen.height}`,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // analytics 실패는 앱 동작에 영향 없이 조용히 무시
    console.debug('[analytics] failed to track event:', e);
  }
}
