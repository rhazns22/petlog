import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock as LockIcon } from 'lucide-react';
import { logSystem } from '../lib/logger';
import { useToast } from '../contexts/ToastContext';

import { getAuthErrorMessage } from '../lib/authErrorMessages';

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signInWithKakao, signInWithApple, signInAnonymously, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (user) navigate('/home');
  }, [user, navigate]);

  const handleEmailLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 모두 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
      try {
        logSystem({ level: 'SUCCESS', event: 'LOGIN_EMAIL', user: email });
      } catch (logErr) {
        console.warn('Logging skipped:', logErr);
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    setError('');
    try {
      await signInWithKakao();
      try {
        logSystem({ level: 'SUCCESS', event: 'LOGIN_KAKAO' });
      } catch (logErr) {
        console.warn('Logging skipped:', logErr);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || '카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setKakaoLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    setError('');
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || '애플 로그인 중 오류가 발생했습니다.');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] px-6 py-8 sm:py-12 landscape:py-6">
      <div className="flex flex-col items-center mt-12 mb-16 sm:mt-12 sm:mb-16 landscape:mt-4 landscape:mb-6 text-center">
        <img src="/logo.png?v=2" alt="PetLog Logo" className="w-20 h-20 landscape:w-16 landscape:h-16 mb-4 landscape:mb-2 rounded-[15px] overflow-hidden" />
        <p className="text-[#8B95A1] text-sm landscape:text-xs font-bold">동물병원 영수증 분석 및 의료비 케어</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleEmailLogin(); }}
        className="space-y-3"
      >
        {/* 이메일 */}
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="이메일을 입력해주세요."
          onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
          className="w-full h-14 bg-white border border-[#F2F4F6] rounded-[12px] px-5 text-base text-[#191F28] placeholder-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#12B886]/20 focus:border-[#12B886] transition-all shadow-sm"
        />

        {/* 비밀번호 */}
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="비밀번호를 입력해주세요."
            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
            className="w-full h-14 bg-white border border-[#F2F4F6] rounded-[12px] px-5 pr-12 text-base text-[#191F28] placeholder-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#12B886]/20 focus:border-[#12B886] transition-all shadow-sm"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B95A1]"
          >
            {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* 오류 메시지 */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs text-[#F04452] font-medium px-1"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          id="email-login-btn"
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-[#12B886] text-white text-base font-bold rounded-[12px] shadow-[0_4px_12px_rgba(18,184,134,0.2)] active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="mt-6 landscape:mt-4 text-center text-sm landscape:text-xs text-[#8B95A1]">
        회원이 아니신가요?{' '}
        <span
          onClick={() => navigate('/register')}
          className="text-[#12B886] font-bold cursor-pointer hover:underline underline-offset-4"
        >
          회원가입하기
        </span>
      </div>

      <div className="mt-10 text-center text-xs text-[#8B95A1]">
        <p>또는 간편하게 시작하기</p>
      </div>

      <div className="mt-4 space-y-3">
        {/* Google 로그인 */}
        <button
          id="google-login-btn"
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await signInWithGoogle();
            } catch (err: any) {
              if (err.code === 'auth/popup-closed-by-user') {
                // User closed the popup, handle gracefully
                return;
              }
              setError(getAuthErrorMessage(err.code));
            } finally {
              setLoading(false);
            }
          }}
          className="w-full h-14 bg-white border border-[#F2F4F6] rounded-[10px] flex items-center justify-center gap-3 text-sm font-semibold text-[#191F28] active:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Google로 시작하기
        </button>

        {/* Apple 로그인 - 준비 중 */}
        <button
          type="button"
          disabled
          className="w-full h-14 bg-white border border-[#F2F4F6] rounded-[10px] flex items-center justify-center gap-3 text-sm font-semibold text-[#8B95A1] transition-colors shadow-sm cursor-not-allowed opacity-50"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.96.95-2.06 2.15-3.48 2.15-1.36 0-1.87-.85-3.39-.85-1.52 0-2.09.85-3.39.85-1.42 0-2.52-1.2-3.48-2.15C1.3 18.28 0 15.35 0 12c0-3.35 1.3-6.28 3.31-8.28C4.27 2.76 5.37 1.56 6.79 1.56c1.36 0 1.87.85 3.39.85 1.52 0 2.09-.85 3.39-.85 1.42 0 2.52 1.2 3.48 2.15C19.06 5.72 20.36 8.65 20.36 12c0 3.35-1.3 6.28-3.31 8.28zM12 2c0-1.1.9-2 2-2 1.1 0 2 .9 2 2 0 1.1-.9 2-2 2-1.1 0-2-.9-2-2z" />
            </svg>
          </div>
          Apple로 시작하기 (준비 중)
        </button>

        {/* 카카오 로그인 - 준비 중 */}
        <button
          type="button"
          disabled
          className="w-full h-14 bg-[#FEE500]/30 text-[#3C1E1E]/30 rounded-[10px] flex items-center justify-center gap-3 text-sm font-bold transition-colors shadow-sm cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.477 2 12c0 3.694 2.072 6.912 5.15 8.653L6.2 23.5l4.09-2.7A11.1 11.1 0 0012 21c5.523 0 10-3.477 10-9S17.523 3 12 3z" />
          </svg>
          카카오로 시작하기 (준비 중)
        </button>

        {/* 비회원 둘러보기 & 개인정보 보호 안내 */}
        <div className="pt-8 text-center space-y-6">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await signInAnonymously();
                navigate('/home');
              } catch (error) {
                showToast('비회원 로그인 중 오류가 발생했습니다.', 'error');
              } finally {
                setLoading(false);
              }
            }}
            className="text-[14px] text-[#8B95A1] font-bold underline underline-offset-4 active:text-[#191F28] transition-colors"
          >
            비회원으로 먼저 둘러보기
          </button>

          <div className="pt-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAF9] rounded-full border border-[#F2F4F6]">
              <LockIcon className="w-3 h-3 text-[#12B886]/40" />
              <span className="text-[10px] text-[#12B886]/60 font-bold tracking-tight">Google Cloud 기반 데이터 보호</span>
            </div>
            <p className="text-[11px] text-[#8B95A1] font-medium leading-relaxed max-w-[240px]">
              민감한 고유식별정보는 수집하지 않으며,<br />
              데이터는 Google Cloud 보안 체계로 보호됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
