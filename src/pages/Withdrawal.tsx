import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle, Trash2, HeartOff, Database, Gift } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  GoogleAuthProvider, 
  EmailAuthProvider, 
  reauthenticateWithPopup, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Withdrawal() {
  const navigate = useNavigate();
  const { user, withdraw } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const isEmailUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');
  const isGoogleUser = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

  const handleWithdraw = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      // 1. Re-authentication
      if (isGoogleUser) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(auth.currentUser, provider);
      } else if (isEmailUser) {
        if (!password) {
          setShowPasswordInput(true);
          setLoading(false);
          alert('탈퇴를 위해 비밀번호를 다시 입력해 주세요.');
          return;
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      // 2. Data Deletion & Account Deletion
      await withdraw();
      alert(
        '탈퇴가 완료되었습니다.\n\n그동안 펫로그와 함께해주셔서 진심으로 감사했습니다.\n사용자님과 반려동물의 발자국이 남겨진 모든 순간들이\n저희에게는 참 따뜻하고 행복한 기억이었습니다.\n\n비록 지금은 헤어지지만, 언제든 다시 돌아오실 날을\n이곳에서 묵묵히 기다리고 있을게요.\n\n사용자님과 아이의 앞날에 늘 행복만 가득하시길 바랍니다.\n안녕히 가세요... 🐾'
      );
      navigate('/login');
    } catch (error: any) {
      console.error('Withdrawal failed:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('보안을 위해 다시 로그인한 뒤 탈퇴를 진행해 주세요.');
      } else if (error.code === 'auth/wrong-password') {
        alert('비밀번호가 올바르지 않습니다.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        alert('탈퇴를 계속하려면 Google 재인증이 필요합니다.');
      } else if (error.code === 'permission-denied' || error.code === 'storage/unauthorized') {
        alert('탈퇴 처리 중 일부 데이터 정리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        alert('탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
      setLoading(false);
    }
  };

  if (!user) return null;

  const lossItems = [
    { icon: <HeartOff className="w-5 h-5 text-red-500" />, label: '반려동물 프로필 및 추억 데이터' },
    { icon: <Database className="w-5 h-5 text-[#12B886]" />, label: '꼼꼼하게 기록한 모든 지출/가계부 내역' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">회원 탈퇴</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-6 py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-[#191F28] mb-3 tracking-tight">정말 펫로그를 떠나시나요?</h2>
          <p className="text-[#8B95A1] text-sm leading-relaxed font-medium">
            사용자님과 반려동물의 소중한 기록들이<br />
            모두 사라지게 됩니다. 다시 한번 생각해보시겠어요?
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-50 rounded-3xl p-6 mb-10"
        >
          <h3 className="text-[13px] font-black text-[#ADB5BD] uppercase tracking-widest mb-6">탈퇴 시 삭제되는 정보</h3>
          <div className="space-y-5">
            {lossItems.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  {item.icon}
                </div>
                <span className="text-sm font-bold text-[#4E5968]">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-[11px] text-[#ADB5BD] text-center px-4 leading-relaxed font-medium"
        >
          * 탈퇴 즉시 모든 데이터는 파기되며,<br />
          어떠한 경우에도 복구가 불가능함을 확인합니다.
        </motion.div>

        {isEmailUser && showPasswordInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-8 px-2"
          >
            <label className="block text-[12px] font-bold text-[#8B95A1] mb-2">비밀번호 확인</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-5 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 transition-all"
            />
          </motion.div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-12 pt-6 space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="w-full h-15 bg-[#12B886] text-white font-black rounded-2xl shadow-lg shadow-[#E9FBF5] active:scale-95 transition-all"
        >
          다시 생각해볼게요
        </button>
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="w-full h-15 bg-white text-red-400 font-bold text-sm rounded-2xl border border-red-50 hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
          ) : (
            <><Trash2 className="w-4 h-4" /> 네, 그래도 탈퇴할게요</>
          )}
        </button>
      </div>
    </div>
  );
}
