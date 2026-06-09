import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, MessageSquare, CreditCard, Gift, Info } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { isPetLogDebug } from '../lib/utils';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [settings, setSettings] = useState({
    all: true,
    payment: true,
    marketing: false,
    repurchase: true,
    medication: true,
    vaccination: true,
    report: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data().notificationSettings;
          if (data) setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.error('Error fetching notification settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const toggleSetting = async (key: keyof typeof settings) => {
    if (!user) return;
    
    const newVal = !settings[key];
    let nextSettings = { ...settings };

    if (key === 'all') {
      if (newVal) {
        try {
          const { requestNotificationPermission } = await import('../lib/notificationService');
          const granted = await requestNotificationPermission();
          if (!granted) {
            showToast('알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.', 'error');
            return;
          }
        } catch (err) {
          if (isPetLogDebug()) {
            console.warn('notificationService import failed (stale bundle):', err);
          }
        }
      }
      nextSettings = {
        all: newVal,
        payment: newVal,
        marketing: newVal,
        repurchase: newVal,
        medication: newVal,
        vaccination: newVal,
        report: newVal,
      };
    } else {
      if (newVal) {
        try {
          const { requestNotificationPermission } = await import('../lib/notificationService');
          await requestNotificationPermission();
        } catch (err) {
          if (isPetLogDebug()) {
            console.warn('notificationService import failed (stale bundle):', err);
          }
        }
      }
      nextSettings[key] = newVal;
      const allSpecificOn = nextSettings.payment && nextSettings.marketing && nextSettings.repurchase && nextSettings.medication && nextSettings.vaccination && nextSettings.report;
      nextSettings.all = allSpecificOn;
    }
    
    setSettings(nextSettings);
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: nextSettings
      });
      showToast('알림 설정이 저장되었습니다.', 'info');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      showToast('설정 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const notificationGroups = [
    {
      title: '맞춤형 알림',
      items: [
        { key: 'repurchase', icon: <Gift className="w-5 h-5" />, label: '재구매 알림', desc: '사료, 배변패드 등 소모품 구매 시점을 알려드립니다.' },
        { key: 'medication', icon: <Bell className="w-5 h-5" />, label: '복약 알림', desc: '아이의 약 먹는 시간을 잊지 않게 챙겨드립니다.' },
        { key: 'vaccination', icon: <Info className="w-5 h-5" />, label: '예방접종 알림', desc: '정기적인 예방접종 및 건강검진 시기를 알려드립니다.' },
      ]
    },
    {
      title: '활동 및 리포트',
      items: [
        { key: 'payment', icon: <CreditCard className="w-5 h-5" />, label: '결제 및 지출 내역', desc: '지출 등록 및 예산 초과 시 즉시 알려드립니다.' },
        { key: 'report', icon: <Info className="w-5 h-5" />, label: '월간 리포트 알림', desc: '한 달간의 지출을 요약한 월간 리포트를 보내드립니다.' },
      ]
    }
  ];

  if (loading) return <div className="flex items-center justify-center min-h-screen">설정 불러오는 중...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-[#F2F4F6] sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">알림 설정</span>
        <div className="w-10" />
      </div>

      <div className="p-6 space-y-6">
        {/* 전체 알림 설정 */}
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-[#F2F4F6] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${settings.all ? 'bg-[#F8FAF9] text-[#12B886]' : 'bg-[#F8FAF9] text-[#8B95A1]'}`}>
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[#191F28]">전체 알림 받기</h4>
              <p className="text-[10px] text-[#8B95A1] font-medium">모든 푸시 알림을 한 번에 켜고 끕니다.</p>
            </div>
          </div>
          <button 
            onClick={() => toggleSetting('all')}
            className={`w-12 h-6 rounded-full relative transition-colors ${settings.all ? 'bg-[#12B886]' : 'bg-[#F8FAF9]'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.all ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {/* 상세 설정 그룹 */}
        {notificationGroups.map((group, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-xs font-bold text-[#8B95A1] px-1">{group.title}</h3>
            <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-[#F2F4F6]">
              {group.items.map((item, i) => (
                <div 
                  key={item.key}
                  className={`flex items-center justify-between p-5 ${i !== group.items.length - 1 ? 'border-b border-[#F2F4F6]' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#F8FAF9] flex items-center justify-center text-[#12B886]">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#191F28]">{item.label}</p>
                      <p className="text-[10px] text-[#8B95A1] leading-tight">{item.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleSetting(item.key as keyof typeof settings)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings[item.key as keyof typeof settings] ? 'bg-[#12B886]' : 'bg-[#F8FAF9]'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings[item.key as keyof typeof settings] ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="p-6 bg-white rounded-[28px] border border-[#F2F4F6]">
          <p className="text-[10px] text-[#8B95A1] font-medium leading-relaxed">
            * 야간 알림(오후 9시 ~ 오전 8시)은 법령에 따라 별도의 수신 동의가 필요하며, 마케팅 알림 설정 시 함께 적용됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
