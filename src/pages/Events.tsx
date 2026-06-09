import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, Calendar, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Events() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setPoints(docSnap.data().points || 0);
      }
    });
    return () => unsub();
  }, [user]);

  const events = [
    {
      id: 1,
      title: '첫 지출등록 이벤트',
      desc: '첫 지출 내역 입력하고 3,000P 받으세요!',
      date: '2026.04.15 ~ 2026.05.15',
      image: 'https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?w=500',
      tag: '진행중',
      color: 'bg-[#12B886]'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold">이벤트 및 혜택</span>
        <div className="w-10" />
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 bg-white p-5 rounded-[28px] shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-500">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm">보유 포인트</h3>
            <p className="text-xl font-black text-[#191F28]">{points.toLocaleString()} P</p>
          </div>
          <button className="ml-auto bg-gray-50 text-[#ADB5BD] font-bold text-[10px] px-3 py-1.5 rounded-full border border-gray-100">내역보기</button>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-black text-[#191F28] px-1">진행중인 이벤트</h2>
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 group active:scale-95 transition-transform"
            >
              <div className="h-40 relative">
                <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold text-white ${event.color}`}>
                  {event.tag}
                </div>
              </div>
              <div className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-base text-[#191F28] mb-1">{event.title}</h3>
                  <p className="text-xs text-[#8B95A1] mb-2 font-medium">{event.desc}</p>
                  <div className="flex items-center gap-1.5 text-gray-300 text-[10px] font-bold">
                    <Calendar className="w-3 h-3" />
                    {event.date}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
