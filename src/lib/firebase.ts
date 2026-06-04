import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// [v2.7.1] App Check 초기화 (Monitoring Mode)
if (typeof window !== 'undefined') {
  const isProd = import.meta.env.PROD;
  const isDev = import.meta.env.DEV;
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  const enableAppCheckDebug = import.meta.env.VITE_ENABLE_APPCHECK_DEBUG === 'true';

  if (isDev && enableAppCheckDebug) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  // 프로덕션이거나, 개발 환경에서 명시적으로 디버그 모드를 켠 경우에만 초기화
  if ((isProd || enableAppCheckDebug) && siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

// Singleton-like pattern to prevent re-initialization during HMR
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);
