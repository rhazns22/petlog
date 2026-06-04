import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, Settings as SettingsIcon, Check, CreditCard, ShoppingBag, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'CASHBACK' | 'WARNING' | 'EVENT';
  isRead: boolean;
  createdAt: any;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Notification[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Notification);
      });
      setNotifications(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', id), {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'CASHBACK': return <CreditCard className="w-5 h-5 text-[#12B886]" />;
      case 'EVENT': return <ShoppingBag className="w-5 h-5 text-orange-500" />;
      default: return <Bell className="w-5 h-5 text-[#8B95A1]" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'CASHBACK': return 'bg-[#E9FBF5]';
      case 'EVENT': return 'bg-orange-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">알림 내역</span>
        <button onClick={() => navigate('/notification-settings')} className="p-2">
          <SettingsIcon className="w-6 h-6 text-[#ADB5BD]" />
        </button>
      </div>

      <div className="flex-1 px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
             <div className="w-8 h-8 border-4 border-[#12B886] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#ADB5BD]">
            <Bell className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">새로운 알림이 없어요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((noti) => (
              <div key={noti.id} className="relative overflow-hidden rounded-[10px]">
                {/* Delete Background Layer (Right side) */}
                <div 
                  className="absolute inset-0 bg-red-500 flex items-center justify-end px-8 cursor-pointer"
                  onClick={() => deleteNotification(noti.id)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Trash2 className="w-5 h-5 text-white" />
                    <span className="text-white text-[10px] font-black">삭제</span>
                  </div>
                </div>

                {/* Draggable Notification Card */}
                <motion.div
                  drag="x"
                  dragConstraints={{ left: -100, right: 0 }}
                  dragElastic={0.05}
                  dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                  whileTap={{ cursor: 'grabbing' }}
                  onClick={() => markAsRead(noti.id)}
                  className={`p-5 rounded-[10px] border ${noti.isRead ? 'bg-white border-transparent' : 'bg-white border-[#E9FBF5] ring-2 ring-[#E9FBF5]'} shadow-sm relative z-10 overflow-hidden active:scale-[0.98]`}
                >
                  {!noti.isRead && <div className="absolute top-0 right-0 w-8 h-8 bg-[#12B886] rounded-bl-[10px] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>}
                  
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 ${noti.isRead ? 'bg-gray-50' : 'bg-[#E9FBF5]'}`}>
                      {getIcon(noti.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm text-[#191F28]">{noti.title}</h4>
                        <span className="text-[10px] text-gray-300 font-medium">
                          {noti.createdAt?.toDate().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-[#8B95A1] leading-relaxed pr-2">{noti.message}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
