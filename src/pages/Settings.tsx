import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bell, Globe, Info, LogOut, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t, language } = useLanguage();
  const [notifications, setNotifications] = useState(true);

  const handleLogout = async () => {
    if (window.confirm(t.settings.logoutConfirm)) {
      await logout();
      navigate('/login');
    }
  };

  const sections = [
    {
      title: t.settings.appSettings,
      items: [
        { 
          icon: <Bell className="w-5 h-5" />, 
          label: t.settings.notifications, 
          type: 'link', 
          path: '/notification-settings'
        },
        { 
          icon: <Calendar className="w-5 h-5" />, 
          label: t.settings.recurringCare, 
          type: 'link', 
          path: '/recurring-settings'
        },
      ]
    },
    {
      title: t.settings.support,
      items: [
        { icon: <Info className="w-5 h-5" />, label: t.settings.faq, type: 'link', path: '/faq' },
        { icon: <Info className="w-5 h-5" />, label: t.settings.inquiry, type: 'link', path: '/inquiry' },
        { icon: <Info className="w-5 h-5" />, label: t.settings.version, type: 'text', value: 'v1.0.5' },
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-[17px] font-bold text-[#191F28]">{t.settings.title}</span>
        <div className="w-10" />
      </div>

      <div className="p-6 space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-[14px] font-bold text-[#8B95A1] px-1">{section.title}</h3>
            <div className="bg-white rounded-[24px] overflow-hidden">
              {section.items.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => item.path && navigate(item.path)}
                  className={`flex items-center justify-between p-5 active:bg-[#F9FAFB] transition-colors ${i !== section.items.length - 1 ? 'border-b border-[#F2F4F6]' : ''} ${item.path ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#F8FAF9] flex items-center justify-center text-[#12B886]">
                      {item.icon}
                    </div>
                    <span className="text-[15px] font-semibold text-[#191F28]">{item.label}</span>
                  </div>
                  
                  {item.type === 'link' ? (
                    <div className="flex items-center gap-2">
                      {item.value && <span className="text-[13px] text-[#ADB5BD] font-medium">{item.value}</span>}
                      <ChevronRight className="w-4 h-4 text-[#ADB5BD]" />
                    </div>
                  ) : (
                    <span className="text-[13px] text-[#ADB5BD] font-bold">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="w-full py-5 bg-white text-[#F04452] font-bold text-[15px] rounded-[24px] active:bg-[#F04452]/5 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <LogOut className="w-4 h-4" /> {t.settings.logout}
        </button>

        <div className="flex flex-col items-center gap-4 pt-4">
          <div className="bg-white/50 p-4 rounded-2xl border border-[#F2F4F6] text-center max-w-[280px]">
            <p className="text-[11px] text-[#8B95A1] leading-relaxed break-keep">
              PetLog는 현재 <span className="text-[#12B886] font-bold">베타 서비스</span>로, 일부 기능이 지연되거나 부정확할 수 있습니다. 문제가 발생하면 수기 입력 또는 문의하기를 이용해 주세요.
            </p>
          </div>
          <p className="text-center text-[11px] text-[#ADB5BD] font-medium">PetLog v1.5.6 • © 2026 PetLog Inc.</p>
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/withdrawal')}
              className="text-[11px] text-[#ADB5BD] font-bold underline"
            >
              회원 탈퇴
            </button>
            <button onClick={() => navigate('/terms/privacy')} className="text-[11px] text-[#ADB5BD] font-bold underline">개인정보 처리방침</button>
          </div>
        </div>
      </div>
    </div>
  );
}
