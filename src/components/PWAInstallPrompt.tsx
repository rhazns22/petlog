import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. iOS 환경인지 체크
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // 2. 이미 홈 화면에 추가되어 실행 중인지 체크 (Standalone 모드)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // 3. 사용자가 이번 세션에서 닫았는지 체크
    const isDismissed = sessionStorage.getItem('pwa-prompt-dismissed');

    if (isIOS && !isStandalone && !isDismissed) {
      // 3초 후 부드럽게 표시
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <div className="fixed inset-x-0 bottom-6 z-[1000] flex justify-center px-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="w-full max-w-[400px] bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-[#E9FBF5] p-6 pointer-events-auto"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#0B2F2A]/5 overflow-hidden border border-[#E9FBF5]">
                  <img src="/logo.png?v=2" alt="PetLog Logo" className="w-full h-full object-cover rounded-[15px]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#0B2F2A]">PetLog 앱으로 즐기기</h3>
                  <p className="text-[11px] text-[#8B95A1] font-medium">아이폰 홈 화면에 설치해 보세요!</p>
                </div>
              </div>
              <button onClick={handleDismiss} className="p-1 text-[#8B95A1]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#E9FBF5] rounded-[20px] p-5 space-y-4 border border-[#12B886]/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <Share className="w-4 h-4 text-[#12B886]" />
                </div>
                <p className="text-[12px] font-bold text-[#0B2F2A]">
                  1. 하단 도구바의 <span className="text-[#12B886]">'공유 버튼'</span>을 누릅니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <PlusSquare className="w-4 h-4 text-[#12B886]" />
                </div>
                <p className="text-[12px] font-bold text-[#0B2F2A]">
                  2. <span className="text-[#12B886]">'홈 화면에 추가'</span>를 선택해 주세요.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-[#12B886] rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-[#20C997] rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-[#E9FBF5] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
