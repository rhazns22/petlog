import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function InquiryHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'inquiries'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setInquiries(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="h-14 flex items-center px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold ml-2">문의 내역</span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#E9FBF5] border-t-[#12B886] rounded-full animate-spin" />
          </div>
        ) : inquiries.length > 0 ? (
          <div className="space-y-4">
            {inquiries.map((item) => (
              <div key={item.id} className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
                <div 
                  className="p-5 cursor-pointer active:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${item.status === 'COMPLETED' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                      {item.status === 'COMPLETED' ? '답변완료' : '접수완료'}
                    </span>
                    <span className="text-[10px] text-[#ADB5BD] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#191F28]">{item.title}</h4>
                    {expandedId === item.id ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === item.id && (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="border-t border-gray-50"
                    >
                      <div className="p-5 bg-gray-50/50">
                        <div className="mb-4">
                          <p className="text-xs font-bold text-[#ADB5BD] mb-2">문의 내용</p>
                          <p className="text-sm text-[#4E5968] leading-relaxed whitespace-pre-wrap">{item.content}</p>
                          {item.imageUrls && item.imageUrls.length > 0 && (
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                              {item.imageUrls.map((url: string, i: number) => (
                                <img key={i} src={url} alt="Attached" className="w-20 h-20 object-cover rounded-lg border border-gray-100" />
                              ))}
                            </div>
                          )}
                        </div>

                        {item.reply && (
                          <div className="mt-6 pt-6 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 bg-[#12B886] rounded-lg flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                              <span className="text-xs font-black text-[#191F28]">관리자 답변</span>
                              <span className="text-[10px] text-[#ADB5BD] font-medium ml-auto">
                                {item.repliedAt?.toDate ? new Date(item.repliedAt.toDate()).toLocaleString() : ''}
                              </span>
                            </div>
                            <div className="bg-[#E9FBF5] rounded-2xl p-4">
                              <p className="text-sm text-[#4E5968] leading-relaxed whitespace-pre-wrap">{item.reply}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[24px] border border-dashed border-gray-200">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-bold text-gray-300">문의하신 내역이 없습니다.</p>
            <button 
              onClick={() => navigate('/inquiry')}
              className="mt-4 text-xs font-bold text-[#12B886] underline"
            >
              문의하러 가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
