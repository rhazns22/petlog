import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { isPetLogDebug } from './utils';

// Discord Webhook URL (실제 운영 시 환경변수로 관리 권장)
// 일단 구조만 잡아두고, URL이 있으면 해당 곳으로도 쏩니다.
const DISCORD_WEBHOOK_URL = ""; 

type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'CRITICAL';

interface LogPayload {
  level: LogLevel;
  event: string;
  user?: string;
  data?: any;
  message?: string;
}

export const logSystem = async (payload: LogPayload) => {
  const { level, event, user, data, message } = payload;

  // 1. Firestore에 저장 (권한 에러 방지를 위해 사용자 하위 컬렉션 우선 사용)
  try {
    const logData = {
      level,
      event,
      userId: user || 'anonymous',
      message: message || '',
      data: data ? JSON.stringify(data) : null,
      timestamp: serverTimestamp(),
      env: import.meta.env.MODE
    };

    if (user && user !== 'anonymous') {
      // 사용자가 로그인된 경우, 해당 사용자의 전용 로그 공간에 저장 (보안 규칙 통과)
      await addDoc(collection(db, 'users', user, 'system_logs'), logData);
    } else {
      // 비로그인 상태이거나 전역 로그가 필요한 경우
      await addDoc(collection(db, 'system_logs'), logData);
    }
  } catch (e: any) {
    // 권한 에러 등 발생 시 서비스 흐름을 방해하지 않도록 조용히 로그만 남김
    if (e.code !== 'permission-denied') {
      console.warn('Logging failed:', e.message);
    }
  }

  // 2. Discord Webhook 전송 (실시간 알림용)
  if (DISCORD_WEBHOOK_URL) {
    try {
      const colorMap = {
        'INFO': 3447003,    // Blue
        'SUCCESS': 3066993, // Green
        'WARN': 15105570,   // Orange
        'ERROR': 15158332,  // Red
        'CRITICAL': 10038562 // Dark Red
      };

      const discordBody = {
        embeds: [{
          title: `[${level}] ${event}`,
          description: message || '상세 내용 없음',
          color: colorMap[level],
          fields: [
            { name: 'User', value: user || 'anonymous', inline: true },
            { name: 'Env', value: import.meta.env.MODE, inline: true },
            { name: 'Data', value: data ? `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` : 'N/A' }
          ],
          timestamp: new Date().toISOString()
        }]
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordBody)
      });
    } catch (e) {
      console.error('Failed to send discord webhook:', e);
    }
  }

  // 3. 콘솔 출력 (개발용)
  if (isPetLogDebug()) {
    const styles = {
      INFO: 'color: #3182f6',
      SUCCESS: 'color: #2ecc71',
      WARN: 'color: #f1c40f',
      ERROR: 'color: #e74c3c',
      CRITICAL: 'background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px'
    };
    console.log(`%c[${level}] ${event}`, styles[level], { message, data, user });
  }
};
