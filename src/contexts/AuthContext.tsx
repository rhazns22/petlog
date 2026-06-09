import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, OAuthProvider
} from 'firebase/auth';
import { auth, db, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { trackEvent } from '../lib/analytics';
import { secureStorage } from '../utils/secureStorage';
import { isPetLogDebug } from '../lib/utils';

// ── 카카오 유저 타입 ──
export interface KakaoUser {
  uid: string;          // "kakao_" + kakao id
  kakaoId: number;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'kakao';
  accessToken?: string;
}

// 앱 전체에서 사용하는 통합 유저 타입
export type AppUser = User | KakaoUser;

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY || '';
const KAKAO_STORAGE_KEY = 'petlog_kakao_user';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isKakaoUser: boolean;
  isAuthReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  withdraw: () => Promise<void>;
  setKakaoUser: (user: KakaoUser | null) => void;
  signInAnonymously: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Kakao SDK 초기화 (중복 방지)
function initKakao() {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_JS_KEY);
  }
}

// Global lock to prevent concurrent syncs that cause Firestore internal errors
let isSyncing = false;


// Firestore에 유저 문서를 생성 또는 업데이트
async function syncUserToFirestore(firebaseUser: User, extraData?: Record<string, unknown>) {
  if (isSyncing) return;
  isSyncing = true;

  const debug = {
    firebaseUserUid: firebaseUser.uid,
    authCurrentUid: auth.currentUser?.uid,
    docPath: `users/${firebaseUser.uid}`,
    projectId: auth.app.options.projectId,
    authDomain: auth.app.options.authDomain,
    storageBucket: auth.app.options.storageBucket,
  };

  try {
    // [v2.9.1] Debug Log 강제 출력 (Visibility 확보)
    if (isPetLogDebug()) console.error("[Auth Firestore Debug BEFORE setDoc]", debug);

    // [v2.9.2] Auth 토큰 강제 갱신 (Rules 전파 지연 방지)
    await firebaseUser.getIdToken(true);

    const userRef = doc(db, 'users', firebaseUser.uid);
    
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? null,
      displayName: firebaseUser.displayName || extraData?.displayName || '',
      photoURL: firebaseUser.photoURL || '',
      provider: firebaseUser.providerData?.[0]?.providerId || 'unknown',
      lastLoginAt: serverTimestamp(),
      ...(extraData || {}),
    }, { merge: true });

    if (isPetLogDebug()) console.error("[Auth Firestore Debug setDoc SUCCESS]", debug);

  } catch (error) {
    if (isPetLogDebug()) console.error("[Auth Firestore Debug setDoc FAILED]", { ...debug, error });
  } finally {
    isSyncing = false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [kakaoUser, setKakaoUser] = useState<KakaoUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // [v2.8.0] Firebase Auth 초기화 완료 여부
  const [loading, setLoading] = useState(true);

  // 통합 유저 (Firebase UID를 기준 식별자로 사용)
  const user: AppUser | null = useMemo(() => {
    // Firebase 인증 시스템이 준비되지 않았거나 세션이 없으면 무조건 null 반환
    // (보안 규칙 request.auth.uid == userId를 준수하기 위함)
    if (!isAuthReady || !firebaseUser) return null;
    
    if (!kakaoUser) return firebaseUser;
    
    // 카카오 유저일 경우에도 식별자는 반드시 Firebase UID를 사용
    return {
      ...kakaoUser,
      uid: firebaseUser.uid, // [CRITICAL] request.auth.uid와 일치시킴
      kakaoId: kakaoUser.kakaoId || (kakaoUser as any).id, // 카카오 고유 ID 보존
    };
  }, [firebaseUser, kakaoUser, isAuthReady]);

  const isKakaoUser = kakaoUser !== null;

  // 앱 시작 시 카카오 세션 복원
  useEffect(() => {
    const saved = secureStorage.getItem(KAKAO_STORAGE_KEY);
    if (saved) {
      setKakaoUser(saved);
      // 카카오 세션이 있으면 즉시 익명 로그인 시도하여 Firebase UID 확보
      if (!auth.currentUser) {
        signInAnonymously().catch(err => console.warn('Auto-anon login failed:', err));
      }
    }
  }, []);

  // Firebase Auth 상태 구독
  useEffect(() => {
    // 인증 상태 변화 구독
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        setFirebaseUser(fbUser);
        setIsAuthReady(true); // 인증 시스템 준비 완료
        
        if (fbUser) {
          // 1. Firestore 동기화는 백그라운드에서 시도 (실패해도 로그인 유지)
          syncUserToFirestore(fbUser).catch(err => {
            if (err.code !== 'permission-denied') console.warn('Background sync failed:', err);
          });

          // 2. 트래킹 이벤트도 비동기 처리
          trackEvent(fbUser.uid, {
            type: 'session_start',
            page: window.location.pathname,
            metadata: { provider: fbUser.providerData[0]?.providerId || 'anonymous' }
          }).catch(() => {});
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        // 어떤 상황에서도 로딩은 종료하여 화면 멈춤 방지
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ── Google 로그인 (팝업 방식) ──
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserToFirestore(result.user);
      await trackEvent(result.user.uid, {
        type: 'login',
        page: '/login',
        metadata: { provider: 'google' },
      });
    } catch (error: any) {
      if (isPetLogDebug()) {
        if (error.code === 'auth/popup-closed-by-user') {
          console.warn('[Auth] Google Login cancelled by user');
        } else {
          console.error('Google Sign In Error:', error);
        }
      }
      throw error;
    }
  };

  // ── Apple 로그인 (팝업 방식) ──
  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserToFirestore(result.user);
    } catch (error: any) {
      if (isPetLogDebug()) {
        if (error.code === 'auth/popup-closed-by-user') {
          console.warn('[Auth] Apple Login cancelled by user');
        } else {
          console.error('Apple Sign In Error:', error);
        }
      }
      throw error;
    }
  };

  // ── 카카오 로그인 (리다이렉트 방식, SDK v2) ──
  const signInWithKakao = () => {
    return new Promise<void>((resolve, reject) => {
      if (!window.Kakao) return reject(new Error('Kakao SDK not loaded'));

      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }

      try {
        window.Kakao.Auth.authorize({
          redirectUri: `${window.location.origin}/auth/kakao/callback`,
        });
        resolve();
      } catch (err) {
        console.error('Kakao authorize error:', err);
        reject(err);
      }
    });
  };

  // ── 이메일 회원가입 ──
  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName,
        photoURL: '',
        provider: 'email',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      await trackEvent(result.user.uid, {
        type: 'signup_start',
        page: '/register',
        metadata: { provider: 'email' },
      });
    } catch (error: any) {
      if (isPetLogDebug()) console.error('Email Register Error:', error);
      throw error;
    }
  };

  // ── 익명 로그인 ──
  const signInAnonymously = async () => {
    try {
      const { signInAnonymously: firebaseSignInAnonymously } = await import('firebase/auth');
      await firebaseSignInAnonymously(auth);
      await trackEvent('anonymous', { type: 'login', metadata: { provider: 'anonymous' } });
    } catch (error: any) {
      if (isPetLogDebug()) console.error('Anonymous Sign In Error:', error);
      throw error;
    }
  };

  // ── 이메일 로그인 ──
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await trackEvent(result.user.uid, {
        type: 'login',
        page: '/login',
        metadata: { provider: 'email' },
      });
    } catch (error: any) {
      if (isPetLogDebug()) console.error('Email Sign In Error:', error);
      throw error;
    }
  };

  // ── 로그아웃 ──
  const logout = async () => {
    try {
      // 1. 카카오 세션 정리
      if (kakaoUser) {
        await trackEvent(kakaoUser.uid, { type: 'logout', page: 'any' });
        if (window.Kakao?.Auth) {
          try {
            window.Kakao.Auth.logout();
          } catch (e) {
            console.warn('Kakao SDK logout failed (Safe to ignore):', e);
          }
        }
      }
      setKakaoUser(null);
      secureStorage.removeItem(KAKAO_STORAGE_KEY);

      // 2. Firebase 세션 정리
      if (auth.currentUser) {
        await trackEvent(auth.currentUser.uid, { type: 'logout', page: 'any' });
        await signOut(auth);
      }
      setFirebaseUser(null);

    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  // ── 회원 탈퇴 ──
  const withdraw = async () => {
    if (!user) return;
    const uid = user.uid;
    
    try {
      const { writeBatch, collection, getDocs, doc, query, where } = await import('firebase/firestore');
      const { ref, listAll, deleteObject } = await import('firebase/storage');
      const batch = writeBatch(db);

      if (isPetLogDebug()) console.log('[Withdrawal] Starting cleanup for user:', uid);

      // 1. [Storage] receipts/{uid}/ 이미지 삭제 (Fatal if permission denied)
      try {
        const storageFolderRef = ref(storage, `receipts/${uid}`);
        const files = await listAll(storageFolderRef);
        const deletePromises = files.items.map(fileRef => deleteObject(fileRef));
        await Promise.all(deletePromises);
        if (isPetLogDebug()) console.log('[Withdrawal] Storage receipts deleted');
      } catch (storageError: any) {
        if (storageError.code === 'storage/unauthorized') {
          if (isPetLogDebug()) console.error('[Withdrawal] Storage Permission Denied (Fatal)', storageError);
          throw storageError;
        }
        if (isPetLogDebug()) console.warn('[Withdrawal] Storage cleanup skipped (Non-fatal)', storageError.message);
      }

      // 2. [Firestore] Critical User Data (Fatal if permission denied)
      const criticalCollections = ['pets', 'transactions', 'usage', 'notifications', 'recurringExpenses', 'inquiries'];
      for (const col of criticalCollections) {
        try {
          const colRef = collection(db, 'users', uid, col);
          const snap = await getDocs(colRef);
          snap.forEach(d => batch.delete(d.ref));
          if (isPetLogDebug()) console.log(`[Withdrawal] Firestore ${col} items queued for deletion`);
        } catch (colErr: any) {
          if (colErr.code === 'permission-denied') {
            if (isPetLogDebug()) console.error(`[Withdrawal] Firestore ${col} Permission Denied (Fatal)`, colErr);
            throw colErr;
          }
          if (isPetLogDebug()) console.warn(`[Withdrawal] Firestore ${col} cleanup failed (Non-fatal)`, colErr.message);
        }
      }

      // 3. Optional Global Data (Non-fatal)
      const optionalCollections = ['receipt_cache', 'system_logs', 'training_records'];
      for (const col of optionalCollections) {
        try {
          // Note: Usually these are top-level or shared. If the user doesn't own them, delete will fail.
          // We treat these as non-fatal.
        } catch (optErr) {
          if (isPetLogDebug()) console.warn(`[Withdrawal] Optional ${col} cleanup skipped`);
        }
      }

      // 4. Delete the user document itself (Fatal)
      try {
        batch.delete(doc(db, 'users', uid));
        await batch.commit();
        if (isPetLogDebug()) console.log('[Withdrawal] Firestore batch committed');
      } catch (commitErr: any) {
        if (commitErr.code === 'permission-denied') {
          if (isPetLogDebug()) console.error('[Withdrawal] User document deletion denied (Fatal)', commitErr);
          throw commitErr;
        }
        throw commitErr;
      }

      // 5. Kakao Unlink (Non-fatal)
      if (isKakaoUser && (user as KakaoUser).accessToken) {
        try {
          await fetch('/api/kakao-api/v1/user/unlink', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${(user as KakaoUser).accessToken}` },
          });
        } catch (e) {
          if (isPetLogDebug()) console.warn('[Withdrawal] Kakao unlink failed', e);
        }
      }

      // 6. Auth 계정 삭제 (Final Step)
      if (!isKakaoUser && auth.currentUser) {
        const { deleteUser } = await import('firebase/auth');
        try {
          await deleteUser(auth.currentUser);
          if (isPetLogDebug()) console.log('[Withdrawal] Firebase Auth account deleted');
        } catch (authErr: any) {
          if (authErr.code === 'auth/requires-recent-login') {
            throw authErr;
          }
          if (isPetLogDebug()) console.error('[Withdrawal] Auth deletion failed', authErr);
          throw authErr;
        }
      } else if (isKakaoUser) {
        setKakaoUser(null);
        secureStorage.removeItem(KAKAO_STORAGE_KEY);
      }
      
      await trackEvent(uid, { type: 'withdrawal', page: '/withdrawal' });
    } catch (error: any) {
      if (isPetLogDebug()) console.error('[Withdrawal Final Error]', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isKakaoUser, 
      isAuthReady,
      signInWithGoogle, 
      signInWithKakao,
      signInWithApple,
      registerWithEmail,
      signInWithEmail,
      logout,
      withdraw,
      setKakaoUser,
      signInAnonymously,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
