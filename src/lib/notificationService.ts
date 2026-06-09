import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * 브라우저 알림 권한을 요청합니다.
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('이 브라우저는 알림을 지원하지 않습니다.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('알림 권한 요청 중 오류:', error);
      return false;
    }
  }

  return false;
};

/**
 * 실제 알림을 발송합니다. 사용자 설정에 따라 필터링됩니다.
 */
export const sendLocalNotification = async (uid: string, type: 'payment' | 'marketing' | 'notice' | 'chat' | 'all', title: string, body: string) => {
  if (!uid) return;

  try {
    // 1. 사용자 설정 확인
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const settings = userSnap.data().notificationSettings;
      
      // 전체 알림이 꺼져있으면 중단
      if (settings?.all === false) return;
      
      // 개별 설정 확인
      if (type !== 'all' && settings?.[type] === false) return;
    }
  } catch (error) {
    console.error('알림 설정 확인 실패:', error);
    // 에러 발생 시 안전을 위해 중단하거나 기본값 적용 (여기서는 중단)
    return;
  }

  // 2. 권한 확인 및 발송
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      // 서비스 워커를 통한 알림 (배경 알림 지원)
      registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png', // 실제 아이콘 경로로 수정 필요
        badge: '/icons/badge-72x72.png',
        tag: type,
        vibrate: [200, 100, 200], // 진동 패턴
        data: {
          url: window.location.origin + '/notifications'
        }
      } as any);
    } else {
      // 일반 브라우저 알림
      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png'
      });
    }
  } else {
    console.log('알림 권한이 없습니다.');
  }
};
