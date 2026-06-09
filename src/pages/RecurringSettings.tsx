import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Bell, Plus, Trash2, Clock, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';

interface RecurringExpense {
  id: string;
  petId: string;
  petName: string;
  category: string;
  item: string;
  cycleDays: number;
  lastDate: string;
  nextDate: string;
  isActive: boolean;
}

const CATEGORY_MAP: Record<string, { label: string; color: string; icon: any }> = {
  'FOOD': { label: '식비', color: 'bg-orange-500', icon: <ShoppingCart className="w-4 h-4" /> },
  'MEDICAL': { label: '의료', color: 'bg-red-500', icon: <CheckCircle2 className="w-4 h-4" /> },
  'GROOMING': { label: '미용', color: 'bg-purple-500', icon: <Clock className="w-4 h-4" /> },
  'OTHER': { label: '기타', color: 'bg-gray-500', icon: <Calendar className="w-4 h-4" /> },
};

export default function RecurringSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pets, setPets] = useState<any[]>([]);
  
  const [newForm, setNewForm] = useState({
    petId: '',
    item: '',
    category: 'FOOD',
    cycleDays: 30,
    lastDate: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (!user) return;

    // Fetch Pets for dropdown
    const petQuery = query(collection(db, 'users', user.uid, 'pets'));
    const unsubPets = onSnapshot(petQuery, (snap) => {
      const p = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPets(p);
      if (p.length > 0 && !newForm.petId) {
        setNewForm(prev => ({ ...prev, petId: p[0].id }));
      }
    }, (err) => {
      console.error('Pets Fetch Error:', err);
      setLoading(false);
    });

    const q = query(collection(db, 'users', user.uid, 'recurringExpenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringExpense));
      setItems(fetched.sort((a, b) => a.nextDate.localeCompare(b.nextDate)));
      setLoading(false);
    }, (err) => {
      console.error('Recurring Fetch Error:', err);
      showToast('권한이 없거나 불러올 수 없습니다.', 'error');
      setLoading(false);
    });

    return () => {
      unsubPets();
      unsubscribe();
    };
  }, [user]);

  const handleAdd = async () => {
    if (!user) return;
    if (!newForm.item.trim()) {
      showToast('품목명을 입력해주세요.', 'error');
      return;
    }

    try {
      const selectedPet = pets.find(p => p.id === newForm.petId);
      
      // 날짜 유효성 검사 및 안전한 계산
      const lastPurchaseDate = new Date(newForm.lastDate);
      if (isNaN(lastPurchaseDate.getTime())) {
        showToast('유효한 구매 날짜를 입력해주세요.', 'error');
        return;
      }

      const nextDateTimestamp = lastPurchaseDate.getTime() + (newForm.cycleDays * 24 * 60 * 60 * 1000);
      const nextDateObj = new Date(nextDateTimestamp);
      const nextDate = nextDateObj.toISOString().slice(0, 10);
      
      await addDoc(collection(db, 'users', user.uid, 'recurringExpenses'), {
        ...newForm,
        userId: user.uid,
        petName: selectedPet?.name || '전체',
        nextDate,
        isActive: true,
        createdAt: serverTimestamp()
      });
      
      showToast('정기 지출 알림이 설정되었습니다.', 'success');
      setShowAddModal(false);
      setNewForm({ petId: pets[0]?.id || '', item: '', category: 'FOOD', cycleDays: 30, lastDate: new Date().toISOString().slice(0, 10) });
    } catch (error) {
      console.error('Error adding recurring:', error);
      showToast('저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'recurringExpenses', id), {
        isActive: !current
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'recurringExpenses', id));
      showToast('알림이 삭제되었습니다.', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const getDDay = (date: string) => {
    const diff = new Date(date).getTime() - new Date().setHours(0,0,0,0);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'D-Day';
    if (days < 0) return `${Math.abs(days)}일 지남`;
    return `D-${days}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-24 transition-colors">
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">일정 및 알림 관리</span>
        <button onClick={() => setShowAddModal(true)} className="p-2">
          <Plus className="w-6 h-6 text-[#12B886]" />
        </button>
      </div>

      <div className="px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-[#191F28]">똑똑한 일정 알림</h2>
          <p className="text-sm text-[#8B95A1] mt-2 font-medium">재구매 시점을 AI가 예측하고 알려드려요.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#12B886] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[32px] p-12 flex flex-col items-center justify-center text-center border-none shadow-sm">
            <div className="w-20 h-20 bg-[#F8FAF9] rounded-[30px] flex items-center justify-center mb-6">
              <Bell className="w-10 h-10 text-[#12B886] opacity-30" />
            </div>
            <p className="text-[#8B95A1] font-bold mb-6">아직 설정된 정기 알림이 없어요.<br/>사료나 영양제 주기를 등록해보세요!</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#12B886] text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-[#12B886]/10 active:scale-95 transition-all"
            >
              알림 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <motion.div
                layout
                key={item.id}
                className={`premium-card p-5 border-none flex items-center gap-4 transition-all ${!item.isActive ? 'opacity-50 grayscale' : ''}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${CATEGORY_MAP[item.category]?.color || 'bg-gray-500'}`}>
                  {CATEGORY_MAP[item.category]?.icon || <Calendar className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8FAF9] text-[#12B886] font-bold">{item.petName}</span>
                    <h3 className="font-bold text-[#191F28] truncate">{item.item}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#8B95A1] font-medium">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.cycleDays}일 주기</span>
                    <span>차기: {item.nextDate}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-black px-3 py-1 rounded-full ${getDDay(item.nextDate).includes('지남') ? 'bg-[#F04452]/10 text-[#F04452]' : 'bg-[#12B886]/10 text-[#12B886]'}`}>
                    {getDDay(item.nextDate)}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(item.id, item.isActive)} className="p-1.5 text-gray-300">
                      <Bell className={`w-4 h-4 ${item.isActive ? 'text-[#12B886]' : ''}`} />
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 text-gray-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[200] flex items-end justify-center px-4 pb-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[24px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-[#191F28] mb-6">정기 지출 알림 추가</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[#8B95A1] mb-2">반려동물</label>
                  <select 
                    value={newForm.petId}
                    onChange={(e) => setNewForm({...newForm, petId: e.target.value})}
                    className="w-full h-12 bg-white border border-[#F2F4F6] rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-[#12B886]"
                  >
                    {pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#8B95A1] mb-2">품목 (예: 사료, 심장약)</label>
                  <input
                    type="text"
                    value={newForm.item}
                    onChange={(e) => setNewForm({...newForm, item: e.target.value})}
                    placeholder="사료"
                    className="w-full h-12 bg-white border border-[#F2F4F6] rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-[#12B886]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#8B95A1] mb-2">알림 주기 (일)</label>
                    <input
                      type="number"
                      value={newForm.cycleDays}
                      onChange={(e) => setNewForm({...newForm, cycleDays: parseInt(e.target.value) || 0})}
                      className="w-full h-12 bg-white border border-[#F2F4F6] rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-[#12B886]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#8B95A1] mb-2">마지막 구매일</label>
                    <input
                      type="date"
                      value={newForm.lastDate}
                      onChange={(e) => setNewForm({...newForm, lastDate: e.target.value})}
                      className="w-full h-12 bg-white border border-[#F2F4F6] rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-[#12B886]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowAddModal(false)} className="flex-1 h-14 bg-gray-50 text-[#8B95A1] font-bold rounded-2xl">취소</button>
                <button onClick={handleAdd} className="flex-1 h-14 bg-[#12B886] text-white font-bold rounded-2xl shadow-lg shadow-[#12B886]/10">설정하기</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}
