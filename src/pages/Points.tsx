import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, TrendingUp, HelpCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import EmptyState from '../components/EmptyState';

export default function Points() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch User Points
    const fetchUserPoints = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setPoints(userDoc.data().points || 0);
      }
    };
    fetchUserPoints();

    // 2. Fetch Point History (from notifications with type CASHBACK)
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('type', '==', 'CASHBACK'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setHistory(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-black tracking-tight text-[#191F28]">포인트</span>
        <button className="p-2">
          <HelpCircle className="w-5 h-5 text-[#ADB5BD]" />
        </button>
      </div>

      <div className="px-6 py-8">
        {/* Total Points Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card p-8 border-none bg-gradient-to-br from-[#12B886] to-[#0D9488] text-white mb-8 relative overflow-hidden"
        >
          <div className="relative z-10">
            <p className="text-green-100 text-xs font-black mb-2 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5" /> 사용 가능한 포인트
            </p>
            <div className="flex items-end gap-2">
              <h2 className="text-4xl font-black">{points.toLocaleString()}</h2>
              <span className="text-xl font-bold text-green-100 mb-1.5">P</span>
            </div>
            
            <div className="mt-8 flex gap-3">
              <button className="flex-1 h-12 bg-white/20 backdrop-blur-md rounded-xl text-xs font-black border border-white/10 hover:bg-white/30 transition-colors">
                포인트 충전
              </button>
              <button className="flex-1 h-12 bg-white text-[#12B886] rounded-xl text-xs font-black shadow-lg shadow-green-900/20 active:scale-95 transition-all">
                상품권 교환
              </button>
            </div>
          </div>
          <div className="absolute right-[-20px] top-[-20px] text-9xl opacity-10 pointer-events-none transform rotate-12">
            🪙
          </div>
        </motion.div>

        {/* Banner - Updated for more general tip or just removed */}
        <div className="bg-[#E9FBF5] rounded-2xl p-4 flex items-center justify-between mb-10 border border-[#E9FBF5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <TrendingUp className="w-5 h-5 text-[#12B886]" />
            </div>
            <div>
              <p className="text-[11px] font-black text-[#12B886]">포인트 200% 활용 팁</p>
              <p className="text-[10px] font-bold text-green-400">지출을 꾸준히 기록하고 추가 포인트를 받아보세요!</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-green-300" />
        </div>

        {/* History Section */}
        <div>
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="text-[14px] font-black text-[#191F28]">적립/사용 내역</h3>
            <button className="text-[10px] font-bold text-[#ADB5BD]">전체보기</button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-4 border-[#12B886] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold text-[#ADB5BD]">내역을 불러오는 중...</p>
              </div>
            ) : history.length > 0 ? (
              history.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="premium-card p-5 border-none flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                      🎁
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-[#191F28]">{item.title}</p>
                      <p className="text-[10px] font-bold text-[#ADB5BD] mt-1">
                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : '방금 전'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black text-[#12B886]">
                      +{item.message.match(/\d+,\d+|\d+/)?.[0] || '0'}P
                    </p>
                    <p className="text-[10px] font-bold text-gray-300 mt-1">적립완료</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <EmptyState 
                title="포인트 내역이 없어요" 
                description="지출을 등록하고 첫 보상을 받아보세요!"
                actionLabel="첫 지출 등록하기"
                onAction={() => navigate('/input')}
              />
            )}
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  );
}
