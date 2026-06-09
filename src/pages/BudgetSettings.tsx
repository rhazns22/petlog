import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, AlertCircle, Bone, Stethoscope, Scissors, ShieldCheck, Tag, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { id: 'FOOD', label: '사료·간식', icon: <Bone className="w-5 h-5 text-[#FFB020]" /> },
  { id: 'MEDICAL', label: '병원비', icon: <Stethoscope className="w-5 h-5 text-[#12B886]" /> },
  { id: 'GROOMING', label: '미용·용품', icon: <Scissors className="w-5 h-5 text-[#EC4899]" /> },
  { id: 'INSURANCE', label: '보험료', icon: <ShieldCheck className="w-5 h-5 text-[#20C997]" /> },
  { id: 'OTHER', label: '기타', icon: <Tag className="w-5 h-5 text-[#8B95A1]" /> },
];

export default function BudgetSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prevMonthSpent, setPrevMonthSpent] = useState(0);
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  useEffect(() => {
    if (!user) return;

    async function fetchBudgets() {
      try {
        const q = query(
          collection(db, 'users', user!.uid, 'budgets'),
          where('month', '==', currentMonth)
        );
        const querySnapshot = await getDocs(q);
        const fetchedBudgets: Record<string, number> = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedBudgets[data.category] = data.amount;
        });
        setBudgets(fetchedBudgets);

        const prevMonthDate = new Date();
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
        const txQuery = query(
          collection(db, 'users', user.uid, 'transactions'),
          where('date', '>=', `${prevMonthStr}-01`),
          where('date', '<=', `${prevMonthStr}-31`)
        );
        const txSnapshot = await getDocs(txQuery);
        let spent = 0;
        txSnapshot.forEach(d => spent += Number(d.data().amount));
        setPrevMonthSpent(spent);
      } catch (error) {
        console.error('Error fetching budgets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBudgets();
  }, [user, currentMonth]);

  const handleBudgetChange = (category: string, value: string) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setBudgets((prev) => ({ ...prev, [category]: numValue }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const savePromises = CATEGORIES.map(cat => {
        const budgetId = `${currentMonth}_${cat.id}`;
        const ref = doc(db, 'users', user.uid, 'budgets', budgetId);
        return setDoc(ref, {
          userId: user.uid,
          category: cat.id,
          amount: budgets[cat.id] || 0,
          month: currentMonth,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await Promise.all(savePromises);
      showToast('예산이 성공적으로 저장되었습니다.', 'success');
      navigate('/home');
    } catch (error) {
      console.error('Error saving budgets:', error);
      showToast('예산 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] animate-pulse">
      <div className="h-14 bg-white border-b border-[#F2F4F6]" />
      <div className="flex-1 px-6 pt-8 pb-32">
        <div className="h-8 bg-white/50 rounded-md w-2/3 mb-2" />
        <div className="h-8 bg-white/50 rounded-md w-1/2 mb-8" />
        <div className="space-y-6">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-white rounded-[24px]" />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 sticky top-0 bg-white z-10 border-b border-[#F2F4F6]">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">이번 달 예산 정하기</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-32">
        <div className="mb-8">
          <h2 className="text-2xl font-black mb-2 text-[#191F28]">지출 카테고리별로</h2>
          <h2 className="text-2xl font-black text-[#191F28]">목표를 정해보세요</h2>
          <p className="text-sm text-[#8B95A1] font-medium mt-2">합리적인 소비를 위한 첫 걸음이에요!</p>
        </div>

        <div className="space-y-6">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    {cat.icon}
                  </div>
                  <span className="text-sm font-bold text-[#4E5968]">{cat.label}</span>
                </div>
                <span className="text-[10px] text-[#12B886] font-black opacity-0 group-focus-within:opacity-100 transition-opacity">입력 중...</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={budgets[cat.id] ? budgets[cat.id].toLocaleString() : ''}
                  onChange={(e) => handleBudgetChange(cat.id, e.target.value)}
                  placeholder="0"
                  className="w-full h-14 bg-white border border-transparent rounded-2xl px-5 text-lg font-black text-[#191F28] focus:ring-4 focus:ring-[#12B886]/10 outline-none transition-all text-right pr-12 shadow-sm"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[#8B95A1] font-bold">원</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tip Card */}
        <div className="mt-10 info-banner">
          <Sparkles className="w-5 h-5 text-[#12B886] mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-black text-[#191F28] mb-1">스마트한 예산 팁</h4>
            <p className="text-xs text-[#4E5968] font-bold leading-relaxed">
              지난달에는 평균적으로 <strong className="text-[#191F28]">₩{prevMonthSpent.toLocaleString()}원</strong>을 지출하셨네요. 이번 달은 조금 더 아껴볼까요?
            </p>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-6 bg-gradient-to-t from-[#E9FBF5] via-[#E9FBF5]/90 to-transparent">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-15 bg-[#12B886] text-white text-lg font-black rounded-2xl shadow-xl shadow-[#12B886]/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? '저장 중...' : <><Save className="w-5 h-5" /> 예산 확정하기</>}
        </button>
      </div>
    </div>
  );
}
