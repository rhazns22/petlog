import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface PMFSurveyProps {
  onClose: () => void;
}

export default function PMFSurvey({ onClose }: PMFSurveyProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const options = [
    { id: 'very_disappointed', label: '매우 실망할 것이다', icon: '😭' },
    { id: 'somewhat_disappointed', label: '다소 실망할 것이다', icon: '😥' },
    { id: 'not_disappointed', label: '별로 실망하지 않을 것이다', icon: '😐' },
    { id: 'dont_use', label: '이미 사용하고 있지 않다', icon: '😶' },
  ];

  const handleSelect = async (optionId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'surveys'), {
        type: 'PMF',
        answer: optionId,
        createdAt: serverTimestamp(),
        version: '1.0.0'
      });
      setStep(2);
    } catch (error) {
      console.error('Survey save error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[#0B2F2A]/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-[#8B95A1] hover:text-[#0B2F2A] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pt-12 text-center">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="w-16 h-16 bg-[#E9FBF5] rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Heart className="w-8 h-8 text-[#12B886] fill-[#12B886]" />
                </div>
                <h3 className="text-[20px] font-black text-[#0B2F2A] mb-2 leading-tight">
                  잠시만요!<br />솔직한 의견이 궁금해요
                </h3>
                <p className="text-[14px] text-[#8B95A1] font-medium leading-relaxed mb-8">
                  만약 PetLog 서비스를 더 이상<br />
                  사용할 수 없게 된다면 기분이 어떨까요?
                </p>

                <div className="space-y-3">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      disabled={loading}
                      onClick={() => handleSelect(opt.id)}
                      className="w-full h-14 bg-[#F2F4F6] hover:bg-[#E9FBF5] hover:text-[#12B886] border border-transparent hover:border-[#12B886]/10 text-[#0B2F2A] font-bold rounded-2xl transition-all flex items-center px-6 gap-4 group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{opt.icon}</span>
                      <span className="text-[14px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="w-16 h-16 bg-[#E9FBF5] rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">
                  🎁
                </div>
                <h3 className="text-[20px] font-black text-[#0B2F2A] mb-2">
                  소중한 답변 감사합니다!
                </h3>
                <p className="text-[14px] text-[#8B95A1] font-medium leading-relaxed mb-8">
                  보내주신 의견은 PetLog가<br />
                  더 나은 서비스가 되는 데 큰 힘이 됩니다.
                </p>
                <button
                  onClick={onClose}
                  className="w-full h-14 bg-[#0B2F2A] text-white font-black rounded-2xl shadow-lg shadow-[#0B2F2A]/20 active:scale-95 transition-all"
                >
                  확인
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
