import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Megaphone, CheckCircle, Clock, ChevronRight, Send, Image as ImageIcon, ShieldAlert, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'INQUIRY' | 'ADS'>('INQUIRY');
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [adMessage, setAdMessage] = useState('');
  const [adLoading, setAdLoading] = useState(false);

  // 긴급 점검 상태
  const [maintActive, setMaintActive] = useState(false);
  const [maintMessage, setMaintMessage] = useState('');
  const [maintEndTime, setMaintEndTime] = useState('');
  const [maintLoading, setMaintLoading] = useState(false);

  // 권한 체크
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const checkAdmin = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists() && docSnap.data().role === 'ADMIN') {
        setIsAdmin(true);
      } else {
        showToast('관리자 권한이 없습니다.', 'error');
        navigate('/home');
      }
      setLoading(false);
    };

    checkAdmin();
  }, [user, navigate]);

  // 광고 데이터 로드
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setAdMessage(data.adMessage || '');
        setMaintActive(data.maintenance?.active || false);
        setMaintMessage(data.maintenance?.message || '');
        setMaintEndTime(data.maintenance?.endTime || '');
      }
    });
    return () => unsub();
  }, [isAdmin]);

  const handleUpdateMaintenance = async () => {
    setMaintLoading(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      
      await setDoc(docRef, {
        maintenance: {
          active: maintActive,
          message: maintMessage.trim(),
          endTime: maintEndTime.trim(),
        },
        maintUpdatedAt: serverTimestamp(),
      }, { merge: true });

      showToast(maintActive ? '긴급 점검이 시작되었습니다.' : '점검 모드가 해제되었습니다.', 'success');
    } catch (error) {
      console.error('Maintenance update error:', error);
      showToast('점검 설정 업데이트 중 오류가 발생했습니다.', 'error');
    } finally {
      setMaintLoading(false);
    }
  };

  const handleUpdateAd = async () => {
    if (!adMessage.trim()) return;
    setAdLoading(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      
      await setDoc(docRef, {
        adMessage: adMessage.trim(),
        adUpdatedAt: serverTimestamp(),
      }, { merge: true });

      showToast('광고 문구가 업데이트되었습니다.', 'success');
    } catch (error) {
      console.error('Ad update error:', error);
      showToast('광고 업데이트 중 오류가 발생했습니다.', 'error');
    } finally {
      setAdLoading(false);
    }
  };

  // 문의 내역 실시간 리스너...
  // 주의: 실제 앱에서는 collectionGroup 쿼리나 별도의 전역 inquiries 컬렉션이 필요할 수 있습니다.
  // 여기서는 단순화를 위해 모든 유저의 inquiries를 가져오는 로직을 가정하거나, 
  // 특정 전역 컬렉션 'global_inquiries'를 사용한다고 가정하겠습니다.
  // 프로젝트 구조상 /users/{uid}/inquiries 형태이므로, 
  // 실제로는 Firebase Console에서 관리하거나 별도 인덱스가 필요합니다.
  // 여기서는 'inquiries'라는 전역 컬렉션이 있다고 가정하고 로직을 작성합니다.

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setInquiries(list);
    });

    return () => unsub();
  }, [isAdmin]);

  const handleReply = async () => {
    if (!selectedInquiry || !reply.trim()) return;
    setSubmitting(true);
    try {
      const inquiryRef = doc(db, 'inquiries', selectedInquiry.id);
      await updateDoc(inquiryRef, {
        reply: reply.trim(),
        status: 'COMPLETED',
        repliedAt: serverTimestamp(),
      });

      // 유저에게 알림 발송
      await addDoc(collection(db, 'users', selectedInquiry.userId, 'notifications'), {
        title: '1:1 문의 답변 완료',
        message: `문의하신 "${selectedInquiry.title}"에 대한 답변이 등록되었습니다.`,
        type: 'INFO',
        isRead: false,
        createdAt: serverTimestamp()
      });

      showToast('답변이 등록되었습니다.', 'success');
      setSelectedInquiry(null);
      setReply('');
    } catch (error) {
      console.error('Reply error:', error);
      showToast('답변 등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-[#E9FBF5] border-t-[#12B886] rounded-full animate-spin" />
    </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-20">
        <button onClick={() => navigate('/home')} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">관리자 패널</span>
        <div className="w-10" />
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        <button 
          onClick={() => setActiveTab('INQUIRY')}
          className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'INQUIRY' ? 'border-[#12B886] text-[#12B886]' : 'border-transparent text-[#ADB5BD]'}`}
        >
          1:1 문의 관리
        </button>
        <button 
          onClick={() => setActiveTab('ADS')}
          className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'ADS' ? 'border-[#12B886] text-[#12B886]' : 'border-transparent text-[#ADB5BD]'}`}
        >
          광고/공지 관리
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'INQUIRY' ? (
          <div className="space-y-4">
            {inquiries.length > 0 ? inquiries.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedInquiry(item)}
                className="bg-white p-5 rounded-[20px] shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${item.status === 'COMPLETED' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                    {item.status === 'COMPLETED' ? '답변완료' : '답변대기'}
                  </span>
                  <span className="text-[10px] text-[#ADB5BD] font-medium">
                    {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black text-[#191F28]">{item.userName}</span>
                  <span className="text-[10px] text-[#ADB5BD]">({item.userEmail})</span>
                </div>
                <h4 className="font-bold text-sm text-[#191F28] mb-1">{item.title}</h4>
                <p className="text-xs text-[#8B95A1] line-clamp-2">{item.content}</p>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-end">
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            )) : (
              <div className="text-center py-20 bg-white rounded-[20px] border border-dashed border-gray-200">
                <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-300">문의 내역이 없습니다.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-[20px] shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <Megaphone className="w-6 h-6 text-[#12B886]" />
              <h3 className="font-black text-lg">광고 및 공지 관리</h3>
            </div>
            <p className="text-xs text-[#ADB5BD] mb-8">메인 화면의 전광판 문구와 공지사항을 관리합니다.</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-[#ADB5BD] mb-2 px-1">현재 광고 문구</label>
                <textarea 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#E9FBF5]"
                  rows={3}
                  value={adMessage}
                  onChange={(e) => setAdMessage(e.target.value)}
                  placeholder="메인 화면에 표시될 광고 문구를 입력하세요."
                />
              </div>
              <button 
                onClick={handleUpdateAd}
                disabled={adLoading || !adMessage.trim()}
                className="w-full h-14 bg-[#12B886] text-white font-bold rounded-xl shadow-lg shadow-[#E9FBF5] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {adLoading ? '업데이트 중...' : '광고 업데이트'}
              </button>
            </div>

            {/* 긴급 점검 관리 */}
            <div className="bg-white p-6 rounded-[20px] shadow-sm border border-gray-100 mt-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                  <h3 className="font-black text-lg">긴급 점검 관리</h3>
                </div>
                <button 
                  onClick={() => setMaintActive(!maintActive)}
                  className={`w-14 h-7 rounded-full relative transition-colors ${maintActive ? 'bg-red-500' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${maintActive ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-[#ADB5BD] mb-2 px-1">점검 안내 메시지</label>
                  <input 
                    type="text"
                    value={maintMessage}
                    onChange={(e) => setMaintMessage(e.target.value)}
                    placeholder="현재 시스템 긴급 점검 중입니다."
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#ADB5BD] mb-2 px-1">종료 예정 시간</label>
                  <input 
                    type="text"
                    value={maintEndTime}
                    onChange={(e) => setMaintEndTime(e.target.value)}
                    placeholder="오후 2시까지"
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <button 
                  onClick={handleUpdateMaintenance}
                  disabled={maintLoading}
                  className={`w-full h-14 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] ${maintActive ? 'bg-red-500 text-white shadow-red-100' : 'bg-gray-900 text-white shadow-gray-100'}`}
                >
                  {maintLoading ? '저장 중...' : maintActive ? '긴급 점검 활성화' : '점검 설정 저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inquiry Detail Modal */}
      <AnimatePresence>
        {selectedInquiry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedInquiry(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-[440px] rounded-[32px] max-h-[80vh] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold text-[#12B886] bg-[#E9FBF5] px-3 py-1 rounded-full">{selectedInquiry.type}</span>
                  <button onClick={() => setSelectedInquiry(null)}>
                    <X className="w-6 h-6 text-gray-300" />
                  </button>
                </div>
                
                <h3 className="text-xl font-black text-[#191F28] mb-4">{selectedInquiry.title}</h3>
                <p className="text-sm text-[#4E5968] leading-relaxed mb-8 whitespace-pre-wrap">{selectedInquiry.content}</p>
                
                {selectedInquiry.imageUrls && selectedInquiry.imageUrls.length > 0 && (
                  <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    {selectedInquiry.imageUrls.map((url: string, i: number) => (
                      <img key={i} src={url} alt="Inquiry attachment" className="w-24 h-24 object-cover rounded-xl border border-gray-100" />
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-8 mt-8">
                  <label className="block text-xs font-bold text-[#ADB5BD] mb-4 px-1">답변 작성</label>
                  <textarea 
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="사용자에게 보낼 답변을 입력하세요."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E9FBF5] mb-4 h-32 resize-none"
                  />
                  <button 
                    onClick={handleReply}
                    disabled={!reply.trim() || submitting}
                    className="w-full h-14 bg-gray-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    답변 전송하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper icon
function X({ className, ...props }: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
