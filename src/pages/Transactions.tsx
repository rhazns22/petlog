import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Filter, Search, X, RotateCcw, Calendar, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import EmptyState from '../components/EmptyState';
import { isPetLogDebug } from '../lib/utils';


interface Transaction {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  type: 'expense' | 'income' | 'EXPENSE' | 'INCOME';
  memo?: string;
}

const CATEGORIES = [
  { id: 'ALL', label: '전체', icon: '✨' },
  { id: 'FOOD', label: '사료·간식', icon: '🦴' },
  { id: 'MEDICAL', label: '병원비', icon: '🏥' },
  { id: 'GROOMING', label: '미용·용품', icon: '✂️' },
  { id: 'INSURANCE', label: '보험료', icon: '🛡️' },
  { id: 'OTHER', label: '기타', icon: '🏷️' },
];

export default function Transactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState((location.state as any)?.filterCategory || 'ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'expense' | 'income'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!user) return;

    // [v2.5.5] Simplify query to bypass Listen 400 / Index issues
    const q = collection(db, 'users', user.uid, 'transactions');

    if (isPetLogDebug()) {
      console.log('[PetLog DEBUG] Transactions.tsx: Initializing simplified onSnapshot', {
        uid: user.uid,
        path: `users/${user.uid}/transactions`
      });
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isPetLogDebug()) {
        console.log('[PetLog DEBUG] Transactions.tsx: snapshot received', {
          size: snapshot.size,
          fromCache: snapshot.metadata.fromCache
        });
      }
      const fetched: Transaction[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const displayDate = data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().slice(0, 10) : '날짜 미상');
        fetched.push({ id: doc.id, ...data, date: displayDate } as Transaction);
      });

      // [v2.5.5] Client-side sorting (descending by date and createdAt)
      fetched.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        
        // Secondary sort by createdAt (if available)
        const aTime = (a as any).createdAt?.seconds || 0;
        const bTime = (b as any).createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setHistory(fetched);
      setLoading(false);
    }, (error) => {
      if (isPetLogDebug()) {
        console.error('[PetLog DEBUG] Transactions.tsx: snapshot error', error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const resetFilters = () => {
    setFilterCategory('ALL');
    setFilterType('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memo?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
    
    const matchesType = filterType === 'ALL' || item.type?.toLowerCase() === filterType;
    
    const matchesDate = (!startDate || item.date >= startDate) && 
                       (!endDate || item.date <= endDate);
    
    const result = matchesSearch && matchesCategory && matchesType && matchesDate;
    return result;
  });

  if (isPetLogDebug() && !loading) {
    console.log('[PetLog DEBUG] Transactions.tsx: Filter stats', {
      total: history.length,
      filtered: filteredHistory.length,
      filterCategory,
      filterType,
      dateRange: `${startDate} ~ ${endDate}`
    });
  }

  const activeFilterCount = [
    filterCategory !== 'ALL',
    filterType !== 'ALL',
    startDate !== '',
    endDate !== ''
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-24">
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-20 border-b border-[#F2F4F6]">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">전체 지출 내역</span>
        <button 
          onClick={() => setShowFilters(true)}
          className={`p-2 relative ${activeFilterCount > 0 ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}
        >
          <Filter className="w-5 h-5" />
          {activeFilterCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-[#12B886] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="p-4">
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="내역 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-white border border-[#F2F4F6] rounded-full px-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#12B886]/10 shadow-sm text-[#191F28]"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B95A1]" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
            >
              <X className="w-4 h-4 text-[#8B95A1]" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
             <div className="w-10 h-10 border-4 border-[#12B886] border-t-transparent rounded-full animate-spin"></div>
             <p className="text-xs font-bold text-[#8B95A1]">내역을 불러오는 중...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <EmptyState 
            title="검색 결과가 없어요" 
            description="다른 검색어나 필터를 적용해 보세요!"
            actionLabel="필터 초기화"
            onAction={resetFilters}
          />
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <motion.div
                layout
                key={item.id}
                onClick={() => navigate(`/transaction/${item.id}`)}
                className="premium-card p-4 flex items-center justify-between border-none active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F8FAF9] flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                    <span className="drop-shadow-md">
                      {item.category === 'FOOD' ? '🦴' : 
                       item.category === 'MEDICAL' ? '🏥' : 
                       item.category === 'GROOMING' ? '✂️' :
                       item.category === 'INSURANCE' ? '🛡️' : '🐾'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-black text-[14px] text-[#191F28] tracking-tight">{item.title}</h4>
                    <p className="text-[11px] text-[#8B95A1] font-bold mt-1">
                      {item.date} • {item.memo || '일반 지출'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-[15px] ${item.type?.toLowerCase() === 'income' ? 'text-[#12B886]' : 'text-[#191F28]'}`}>
                    {item.type?.toLowerCase() === 'income' ? '+' : '-'}{item.amount.toLocaleString()}원
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <Check className="w-3 h-3 text-[#12B886]" />
                    <p className="text-[10px] text-[#8B95A1] font-bold">결제완료</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-[#0B2F2A]/40 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-[32px] z-40 px-6 pt-8 pb-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-[#191F28] tracking-tight">필터 상세 설정</h3>
                <div className="flex items-center gap-1 bg-[#F8FAF9] p-1 rounded-xl">
                  <button onClick={resetFilters} className="p-2 text-[#8B95A1] hover:text-[#12B886] transition-colors">
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowFilters(false)} className="p-2 text-[#8B95A1] hover:text-[#12B886] transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-[#8B95A1] mb-3">거래 유형</label>
                <div className="flex gap-2">
                  {['ALL', 'expense', 'income'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type as any)}
                      className={`flex-1 h-12 rounded-[10px] text-xs font-bold transition-all border ${
                        filterType === type 
                          ? 'border-[#12B886] bg-[#F8FAF9] text-[#12B886]' 
                          : 'border-transparent bg-[#F8FAF9] text-[#8B95A1]'
                      }`}
                    >
                      {type === 'ALL' ? '전체' : type === 'expense' ? '지출' : '수입'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-[#8B95A1] mb-3">카테고리</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilterCategory(cat.id)}
                      className={`h-28 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all border-2 ${
                        filterCategory === cat.id
                          ? 'border-[#12B886] bg-[#F8FAF9] text-[#12B886]'
                          : 'border-transparent bg-[#F8FAF9] text-[#8B95A1]'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl active:translate-y-0 ${filterCategory === cat.id ? 'bg-white shadow-[#12B886]/10' : 'bg-white'}`}>
                        <span className="drop-shadow-md">{cat.icon}</span>
                      </div>
                      <span className="text-xs font-black tracking-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-10">
                <label className="block text-sm font-bold text-[#8B95A1] mb-3">기간 설정</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-12 bg-[#F8FAF9] rounded-[10px] px-4 text-xs font-bold text-[#191F28] focus:outline-none border-none appearance-none"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A1] pointer-events-none" />
                  </div>
                  <span className="text-[#8B95A1] font-bold">~</span>
                  <div className="flex-1 relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full h-12 bg-[#F8FAF9] rounded-[10px] px-4 text-xs font-bold text-[#191F28] focus:outline-none border-none appearance-none"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B95A1] pointer-events-none" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="w-full h-15 bg-[#12B886] text-white font-black rounded-2xl shadow-xl shadow-[#12B886]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" /> 적용하기
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}
