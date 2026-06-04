import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

export default function Splash() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);


  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1500),
      setTimeout(() => setStep(3), 2800),
      setTimeout(() => {
        navigate('/login');
      }, 4000), 
    ];
    
    return () => timers.forEach(t => clearTimeout(t));
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white overflow-hidden touch-none select-none z-[9999]">
      
      {/* 배경 브랜딩 레이어 */}
      <div className="absolute inset-0 z-0">
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1], 
            rotate: [0, 5, 0],
            opacity: [0.3, 0.4, 0.3]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ willChange: "transform, opacity" }}
          className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-gradient-to-br from-[#12B886]/20 to-transparent rounded-full"
        />
        <motion.div
          animate={{ 
            scale: [1.1, 1, 1.1], 
            rotate: [0, -5, 0],
            opacity: [0.4, 0.5, 0.4]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          style={{ willChange: "transform, opacity" }}
          className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-gradient-to-tr from-[#12B886]/25 to-transparent rounded-full"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* 1단계: 감성적인 첫 인사 */}
        <div className="h-12 overflow-hidden flex flex-col items-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.p
                key="step1"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="text-[#ADB5BD] text-sm font-semibold tracking-tight"
              >
                반려동물 지출을 자동으로 기록하고 줄여주는 앱
              </motion.p>
            )}
            {step >= 2 && (
              <motion.div
                key="step2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex items-center gap-1 text-[#12B886] font-bold"
              >
                <Heart className="w-4 h-4 fill-current" />
                <span className="text-sm">함께해서 더 행복한 반려생활</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2단계: 메인 브랜드 아이덴티티 */}
        <AnimatePresence>
          {step >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg z-10"
                >
                  <span className="text-white text-lg">✨</span>
                </motion.div>
                <div className="p-0 bg-white shadow-2xl shadow-[#E9FBF5]/50 overflow-hidden rounded-[15px]">
                  <img src="/logo.png?v=2" alt="펫로그 로고" className="w-28 h-28" />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-[#191F28] tracking-tight">병원비 분석의 시작</h1>
                <p className="text-[#12B886] font-black text-lg tracking-tight">우리 아이 건강 지표, 펫로그</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3단계: 서비스 가치 */}
        <div className="mt-8 h-10">
          {step >= 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 text-xs font-bold text-[#ADB5BD]/60"
            >
              <span>영수증 AI 분석</span>
              <div className="w-1 h-1 bg-gray-200 rounded-full" />
              <span>스마트 지출 관리</span>
              <div className="w-1 h-1 bg-gray-200 rounded-full" />
              <span>의료비 리포트</span>
            </motion.div>
          )}
        </div>
      </div>


      {/* 하단 카피라이트 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed bottom-12 text-[10px] text-gray-300 font-bold tracking-widest"
      >
        © 2026 PETLOG. ALL RIGHTS RESERVED.
      </motion.div>
    </div>
  );
}
