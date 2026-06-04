import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Lock, Eye, Fingerprint, ChevronRight, Check, Camera, Image as ImageIcon, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';

export default function Security() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isSimplePwActive, setIsSimplePwActive] = useState(true);
  const [isPrivacyActive, setIsPrivacyActive] = useState(() => {
    return localStorage.getItem('petlog_privacy_enabled') !== 'false';
  });

  React.useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.privacyEnabled !== undefined) {
          setIsPrivacyActive(data.privacyEnabled);
          localStorage.setItem('petlog_privacy_enabled', String(data.privacyEnabled));
        }
      }
    };
    fetchSettings();
  }, [user]);

  const togglePrivacy = async () => {
    if (!user) return;
    const newVal = !isPrivacyActive;
    setIsPrivacyActive(newVal);
    localStorage.setItem('petlog_privacy_enabled', String(newVal));
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        privacyEnabled: newVal
      });
      showToast(`프라이버시 설정이 ${newVal ? '활성화' : '비활성화'} 되었습니다.`, 'info');
    } catch (err) {
      console.error('Privacy update failed:', err);
    }
  };
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast('비밀번호 재설정 이메일이 발송되었습니다.', 'success');
    } catch (error) {
      console.error('Password reset error:', error);
      showToast('이메일 발송 중 오류가 발생했습니다.', 'error');
    }
  };

  const securityItems = [
    { 
      icon: <Lock className="w-5 h-5" />, 
      label: '비밀번호 변경', 
      desc: '이메일로 재설정 링크를 보내드립니다.',
      action: handlePasswordReset 
    },
    { 
      icon: <Fingerprint className="w-5 h-5" />, 
      label: '간편 비밀번호 관리', 
      desc: '앱 결제 시 사용하는 비밀번호 설정',
      type: 'toggle',
      value: isSimplePwActive,
      onToggle: () => {
        setIsSimplePwActive(!isSimplePwActive);
        showToast(`간편 비밀번호가 ${!isSimplePwActive ? '활성화' : '비활성화'} 되었습니다.`, 'info');
      }
    },
    { 
      icon: <Eye className="w-5 h-5" />, 
      label: '데이터 프라이버시', 
      desc: '내 활동 내역 노출 및 분석 활용 설정',
      type: 'toggle',
      value: isPrivacyActive,
      onToggle: togglePrivacy
    },
  ];

  const permissionItems = [
    {
      icon: <Camera className="w-5 h-5" />,
      label: '카메라 권한',
      desc: '지출 기록을 위한 영수증 촬영에 사용됩니다.',
    },
    {
      icon: <ImageIcon className="w-5 h-5" />,
      label: '사진첩 접근 권한',
      desc: '갤러리에 저장된 영수증 및 프로필 사진 업로드에 사용됩니다.',
    },
    {
      icon: <Bell className="w-5 h-5" />,
      label: '푸시 알림 권한',
      desc: '사료 구매 주기 및 병원 예약 알림을 보내드립니다.',
    },
  ];

  const getSecurityStatus = () => {
    let score = 20; // 기본 점수
    if (isSimplePwActive) score += 30;
    if (isPrivacyActive) score += 30;
    
    if (score <= 20) return { label: '위험', color: 'bg-red-500', desc: '보안 상태가 매우 취약합니다. 설정을 검토하세요.', shadow: 'shadow-red-100' };
    if (score <= 50) return { label: '보통', color: 'bg-orange-500', desc: '비밀번호를 더 복잡하게 설정하면 안전합니다.', shadow: 'shadow-orange-100' };
    if (score <= 80) return { label: '안전', color: 'bg-[#12B886]', desc: '기본적인 보안 설정이 완료되었습니다.', shadow: 'shadow-[#E9FBF5]' };
    return { label: '최고', color: 'bg-green-500', desc: '강력한 보안 상태로 데이터를 보호하고 있습니다.', shadow: 'shadow-green-100' };
  };

  const status = getSecurityStatus();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold">보안 및 권한</span>
        <div className="w-10" />
      </div>

      <div className="p-6">
        <div className={`${status.color} rounded-[32px] p-8 text-white mb-8 shadow-xl ${status.shadow} relative overflow-hidden transition-colors duration-500`}>
          <Shield className="absolute right-[-20px] bottom-[-20px] w-40 h-40 opacity-10" />
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-2">보안 상태: {status.label}</h2>
            <p className="text-xs text-white/80 font-medium leading-relaxed">
              {status.desc}<br />정기적인 비밀번호 변경을 권장합니다.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#ADB5BD] px-1">상세 설정</h3>
          <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
            {securityItems.map((item, i) => (
              <div
                key={i}
                className={`w-full p-6 flex items-center gap-5 ${i !== securityItems.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#E9FBF5] flex items-center justify-center text-[#12B886]">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-[#191F28] mb-1">{item.label}</h4>
                  <p className="text-[10px] text-[#ADB5BD] font-medium">{item.desc}</p>
                </div>
                {item.type === 'toggle' ? (
                  <button
                    onClick={item.onToggle}
                    className={`w-12 h-6 rounded-full relative transition-colors ${item.value ? 'bg-[#12B886]' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.value ? 'right-1' : 'left-1'}`} />
                  </button>
                ) : (
                  <button onClick={item.action} className="p-2 active:scale-95 transition-transform">
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 mt-10">
          <h3 className="text-xs font-bold text-[#ADB5BD] px-1">앱 권한 안내</h3>
          <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
            {permissionItems.map((item, i) => (
              <div
                key={i}
                className={`w-full p-6 flex items-center gap-5 ${i !== permissionItems.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-[#ADB5BD]">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-[#191F28] mb-1">{item.label}</h4>
                  <p className="text-[10px] text-[#ADB5BD] font-medium">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 p-6 bg-green-50 rounded-[28px] border border-green-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-100">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-green-700 mb-1">내 데이터 보호 중</h4>
              <p className="text-[10px] text-green-600/70 font-medium leading-relaxed">
                petlog는 금융권 수준의 암호화 기술을 사용하여 모든 데이터를 안전하게 보호하고 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
