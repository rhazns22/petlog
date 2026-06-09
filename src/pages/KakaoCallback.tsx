import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, KakaoUser } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { secureStorage } from '../utils/secureStorage';
import { trackEvent } from '../lib/analytics';

const KAKAO_STORAGE_KEY = 'petlog_kakao_user';
const REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
const CLIENT_SECRET = import.meta.env.VITE_KAKAO_CLIENT_SECRET;

export default function KakaoCallback() {
  const navigate = useNavigate();
  const { setKakaoUser } = useAuth();
  const [status, setStatus] = useState('로그인 처리 중...');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      setStatus('로그인이 취소되었습니다.');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
      return;
    }

    handleCode(code);
  }, [navigate]);

  const handleCode = async (code: string) => {
    console.log('[KakaoCallback] 현재 사용 중인 REST_API_KEY (앞 4자리):', REST_API_KEY?.substring(0, 4));
    try {
      const redirectUri = `${window.location.origin}/auth/kakao/callback`;
      
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', REST_API_KEY || '');
      params.append('redirect_uri', redirectUri);
      params.append('code', code);
      if (CLIENT_SECRET) params.append('client_secret', CLIENT_SECRET);

      const tokenRes = await fetch('/api/kakao-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        if (tokenData.debug) {
          const debugMsg = `서버 상태 체크:\n- REST 키: ${tokenData.debug.has_rest_key ? '✅ 있음' : '❌ 없음'}\n- Secret: ${tokenData.debug.has_secret ? '✅ 있음' : '❌ 없음'}\n- Redirect: ${tokenData.debug.redirect_uri_sent}`;
          console.table(tokenData.debug);
          alert(debugMsg); // 화면에 직접 띄움
        }
        console.groupEnd();

        const kakaoDetail = tokenData.kakao_detail;
        const detail = kakaoDetail 
          ? `[${kakaoDetail.error}] ${kakaoDetail.error_description}` 
          : (tokenData.details?.message || tokenData.error || '토큰 발급 실패');
        throw new Error(detail);
      }

      // 3. 사용자 정보 가져오기 (SDK 대신 직접 fetch 사용 - undefined 방지)
      const profileRes = await fetch('/api/kakao-api/v2/user/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      });

      const res = await profileRes.json();

      if (!profileRes.ok) {
        throw new Error('프로필 정보를 가져오지 못했습니다.');
      }

      // 4. Firebase 익명 로그인 (Firestore 권한 획득용)
      let firebaseUid = '';
      try {
        const authResult = await signInAnonymously(auth);
        firebaseUid = authResult.user.uid;
      } catch (authErr) {
        console.error('Firebase 익명 로그인 실패:', authErr);
        throw new Error('Firebase 인증에 실패했습니다.');
      }

      // 5. Firestore 동기화 데이터 준비
      const kakaoUser: KakaoUser = {
        uid: firebaseUid, // [CRITICAL] Firebase Auth UID를 문서 ID로 사용
        kakaoId: res.id,  // 카카오 고유 ID는 필드로 저장
        email: res.kakao_account?.email || `${res.id}@kakao.com`,
        displayName: res.properties?.nickname || '카카오 사용자',
        photoURL: res.properties?.profile_image || '',
        provider: 'kakao',
        accessToken: tokenData.access_token,
      };

      // 6. Firestore 동기화 (이제 request.auth.uid == firebaseUid 이므로 성공함)
      try {
        const userRef = doc(db, 'users', firebaseUid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            ...kakaoUser,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, { 
            lastLoginAt: serverTimestamp(),
            kakaoId: res.id // 기존 유저 문서에도 카카오 ID 필드 보완
          }, { merge: true });
        }
      } catch (fsError) {
        console.error('Firestore 동기화 실패 (보안 규칙 확인 필요):', fsError);
      }

      // 5. 세션 유지 및 이동
      secureStorage.setItem(KAKAO_STORAGE_KEY, kakaoUser);
      setKakaoUser(kakaoUser);
      
      await trackEvent(kakaoUser.uid, {
        type: 'login',
        page: '/login',
        metadata: { provider: 'kakao' },
      });

      navigate('/home', { replace: true });
    } catch (err: any) {
      console.error('KakaoCallback error:', err);
      setStatus(`오류: ${err.message}`);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="flex flex-col items-center gap-5">
        <div className="w-12 h-12 border-4 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#8B95A1] font-bold">{status}</p>
      </div>
    </div>
  );
}
