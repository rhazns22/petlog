import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Settings, 
  CreditCard, 
  History, 
  Dog, 
  FileText, 
  LogOut, 
  Bell,
  ChevronRight,
  ShieldCheck,
  UserX
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, withdraw } = useAuth();
  const [profileData, setProfileData] = React.useState<any>(null);

  React.useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        setProfileData(docSnap.data());
      }
    };
    fetchProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleWithdraw = () => {
    if (isPetLogDebug()) {
      console.log('탈퇴 안내 페이지로 이동 시도...');
    }
    navigate('/withdrawal');
  };

  if (!user) return null;

  const menuItems = [
    { icon: <Dog className="w-5 h-5" />, label: '나의 반려동물', path: '/pet-management', color: 'text-[#12B886]', bg: 'bg-[#F8FAF9]' },
    { icon: <History className="w-5 h-5" />, label: '결제 내역', path: '/transactions', color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10' },
    // { icon: <CreditCard className="w-5 h-5" />, label: '결제 수단 관리', path: '/payment-registration', color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: <Bell className="w-5 h-5" />, label: '알림 설정', path: '/notifications', color: 'text-[#12B886]', bg: 'bg-[#E9FBF5]' },
  ];

  const subItems = [
    { icon: <Settings className="w-5 h-5" />, label: '계정 설정', path: '/settings', color: 'text-[#8B95A1]', bg: 'bg-[#F8FAF9]' },
    { icon: <ShieldCheck className="w-5 h-5" />, label: '보안 및 권한', path: '/security', color: 'text-[#12B886]', bg: 'bg-[#F8FAF9]' },
    { icon: <FileText className="w-5 h-5" />, label: '이용약관 및 정책', path: '/terms', color: 'text-[#FFB020]', bg: 'bg-[#FFB020]/10' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-32">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">마이페이지</span>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="px-6 py-8">
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-6 border-none flex items-center gap-5 mb-6 shadow-sm"
        >
          <div className="w-20 h-20 rounded-2xl bg-[#F8FAF9] flex items-center justify-center text-3xl overflow-hidden border-4 border-white shadow-sm">
            {(profileData?.photoURL || user.photoURL) ? (
              <img src={profileData?.photoURL || user.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              '👤'
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-[#191F28] tracking-tight">{user.displayName || '사용자'}님</h2>
            <p className="text-xs text-[#8B95A1] leading-relaxed font-medium">{user.email}</p>
            <button 
              onClick={() => navigate('/profile-edit')}
              className="mt-3 text-[10px] bg-[#F8FAF9] text-[#12B886] px-4 py-1.5 rounded-full font-black hover:bg-[#12B886] hover:text-white transition-colors"
            >
              프로필 관리
            </button>
          </div>
        </motion.div>

        {/* Main Menu */}
        <div className="space-y-4 mb-10">
          <h3 className="text-[11px] font-black text-[#8B95A1] px-1 uppercase tracking-widest">서비스 이용</h3>
          {menuItems.map((item, i) => (
            <div
              key={i}
              onClick={() => item.path !== '#' && navigate(item.path)}
              className="bg-white rounded-[24px] p-4 flex items-center justify-between border-none active:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.bg} ${item.color} shadow-sm group-hover:scale-110 transition-transform`}>
                   {item.icon}
                </div>
                <span className="text-[14px] font-black text-[#191F28] tracking-tight">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-200 transition-transform group-hover:translate-x-1" />
            </div>
          ))}
        </div>

        {/* Sub Menu */}
        <div className="premium-card p-2 border-none mb-10">
          {subItems.map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.path)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.bg} ${item.color}`}>
                   {item.icon}
                </div>
                <span className="text-[13px] font-bold text-[#191F28] tracking-tight">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleLogout}
          className="w-full h-15 bg-white text-[#8B95A1] font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm mb-6 hover:text-[#F04452] border border-[#F2F4F6]"
        >
          <LogOut className="w-5 h-5" /> 로그아웃
        </button>

        <button
          onClick={handleWithdraw}
          className="w-full py-4 bg-transparent text-[#ADB5BD] font-bold text-[13px] flex items-center justify-center gap-2 hover:text-red-500 transition-colors mb-6 relative z-10 active:scale-95"
        >
          <UserX className="w-4 h-4" /> 서비스 탈퇴하기
        </button>

        <p className="text-center text-[10px] text-gray-300 font-black tracking-widest uppercase">PetLog v1.0.6 • © 2026 PetLog Inc.</p>
      </div>

      <Navbar />
    </div>
  );
}
