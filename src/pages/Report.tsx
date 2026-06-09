import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, AlertCircle, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useUsage } from '../contexts/UsageContext';
import { generateSpendingInsight } from '../lib/aiService';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { safeIncludes, safeText, getTransactionAmount, getSafeAiContent } from '../lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#FFB020',
  MEDICAL: '#12B886',
  SUPPLIES: '#8B5CF6',
  GROOMING: '#EC4899',
  INSURANCE: '#20C997',
  OTHER: '#8B95A1',
};

export default function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { reportUsedToday, reportSoftLimit, isReportLimitReached, incrementReport } = useUsage();

  const [showReportLimitModal, setShowReportLimitModal] = useState(false);

  const [barData, setBarData] = useState<any[]>([]);
  const [petSpending, setPetSpending] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [sixMonthAvg, setSixMonthAvg] = useState(0);
  const [thisMonthTotal, setThisMonthTotal] = useState(0);
  const [lastMonthTotal, setLastMonthTotal] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  
  const [sortOrder, setSortOrder] = useState<'date' | 'amount'>('date');
  const { t, language } = useLanguage();
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pets, setPets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch Pets
    const petQuery = query(collection(db, 'users', user.uid, 'pets'));
    const unsubPets = onSnapshot(petQuery, (snapshot) => {
      const fetchedPets: any[] = [];
      snapshot.forEach(doc => fetchedPets.push({ id: doc.id, ...doc.data() }));
      setPets(fetchedPets);
    }, (err) => {
      console.warn('Report Pets subscription error:', err);
    });

    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', sixMonthsAgoStr),
      orderBy('date', 'asc')
    );

    const unsubTransactions = onSnapshot(q, (snapshot) => {
      const monthData: Record<string, number> = {};
      const petTotals: Record<string, number> = {};
      const currentMonthTx: any[] = [];
      let total6Months = 0;
      let monthCount = 0;

      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthData[mStr] = 0;
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const type = data.type?.toLowerCase();
        if (type === 'expense' || !type) {
          const mStr = data.date.substring(0, 7);
          const amt = getTransactionAmount(data);
          if (monthData[mStr] !== undefined) {
            monthData[mStr] += amt;
          }
          if (mStr === currentMonthStr) {
            currentMonthTx.push({ id: doc.id, ...data });
            if (data.petId) {
              petTotals[data.petId] = (petTotals[data.petId] || 0) + amt;
            }
          }
        }
      });

      const newBarData = Object.keys(monthData).map(mStr => {
        total6Months += monthData[mStr];
        if (monthData[mStr] > 0) monthCount++;
        return { name: `${parseInt(mStr.split('-')[1])}월`, value: monthData[mStr], fullMonth: mStr };
      });

      setBarData(newBarData);
      setSixMonthAvg(monthCount > 0 ? Math.round(total6Months / 6) : 0);
      setThisMonthTotal(monthData[currentMonthStr] || 0);
      
      const prevMonthD = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthStr = `${prevMonthD.getFullYear()}-${String(prevMonthD.getMonth() + 1).padStart(2, '0')}`;
      setLastMonthTotal(monthData[prevMonthStr] || 0);
      
      // Update recent transactions based on selected month
      const filteredTx = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((t: any) => {
          const type = t.type?.toLowerCase();
          return (type === 'expense' || !type) && t.date.startsWith(selectedMonth);
        });
      
      setRecentTransactions(filteredTx);
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Process pet spending after pets are loaded
      if (pets.length > 0) {
        let maxSpending = 1;
        const updatedPets = pets.map(p => {
          const total = petTotals[p.id] || 0;
          if (total > maxSpending) maxSpending = total;
          return {
            id: p.id,
            name: p.name,
            icon: p.type === 'DOG' ? '🐶' : p.type === 'CAT' ? '🐱' : '🐾',
            total,
            current: 0 // Will calculate below
          };
        });
        
        setPetSpending(updatedPets.map(p => ({
          ...p,
          current: maxSpending > 1 ? (p.total / maxSpending) * 100 : 0
        })).sort((a, b) => b.total - a.total));
      }
    }, (err) => {
      console.warn('Report Transactions subscription error:', err);
    });

    return () => {
      unsubPets();
      unsubTransactions();
    };
  }, [user, pets.length, selectedMonth]);

  const hasIncremented = React.useRef(false);

  // Track Report Usage
  useEffect(() => {
    if (!user || hasIncremented.current) return;
    
    const trackUsage = async () => {
      hasIncremented.current = true;
      await incrementReport();
      if (reportUsedToday + 1 >= reportSoftLimit) {
        setShowReportLimitModal(true);
      }
    };
    trackUsage();
  }, [user]);

  const fetchAIInsight = async (force = false) => {
    if (!user || recentTransactions.length === 0 || isAnalyzing) return;
    
    const cacheKey = `ai_insight_${user.uid}_${selectedMonth}_${recentTransactions.length}`;
    
    if (!force) {
      const cachedInsight = localStorage.getItem(cacheKey);
      if (cachedInsight && !cachedInsight.includes('혼잡합니다') && !cachedInsight.includes('오류가 발생')) {
        setAiInsight(cachedInsight);
        return;
      }
    }

    try {
      const insight = await generateSpendingInsight(recentTransactions, pets, language);
      const safeInsight = getSafeAiContent(insight);
      setAiInsight(safeInsight);
      localStorage.setItem(cacheKey, safeInsight);
    } catch (err) {
      console.error(err);
      showToast('AI 분석 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (recentTransactions.length > 0 && pets.length > 0 && !aiInsight) {
      fetchAIInsight();
    }
  }, [recentTransactions, pets]);

  const handleShare = async () => {
    const shareData = {
      title: '지출 상세 리포트',
      text: '이번 달 지출 상세 데이터입니다.',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('URL이 클립보드에 복사되었습니다.', 'success');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        showToast('URL이 클립보드에 복사되었습니다.', 'success');
      }
    }
  };

  let diffPercent: number | null = null;
  let diffLabel = '';
  if (lastMonthTotal > 0) {
    diffPercent = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
    diffLabel = `지난달보다 ${Math.abs(diffPercent)}% ${diffPercent > 0 ? '많이 썼어요' : '적게 썼어요'}`;
  } else if (thisMonthTotal > 0) {
    diffLabel = '지난달 기록이 없어 이번 달 지출만 요약했어요';
  }

  const sortedTransactions = [...recentTransactions].sort((a, b) => {
    if (sortOrder === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      return getTransactionAmount(b) - getTransactionAmount(a);
    }
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-24">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-[#F2F4F6]">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-[17px] font-bold text-[#191F28]">이번 달 펫로그 리포트</span>
        <button onClick={handleShare} className="p-2 text-[#12B886]">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* 1. Monthly Summary Hero */}
        <div className="bg-white rounded-[28px] p-8 shadow-sm">
          <p className="text-[14px] font-bold text-[#8B95A1] mb-2">{parseInt(selectedMonth.split('-')[1])}월 지출 요약</p>
          <div className="space-y-1 mb-6">
            <h2 className="text-[32px] font-black text-[#191F28]">
              {thisMonthTotal.toLocaleString()}원
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-[14px] font-bold ${diffPercent !== null && diffPercent > 0 ? 'text-[#F04452]' : diffPercent !== null && diffPercent < 0 ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}>
                {diffLabel}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {(() => {
              const categoryTotals: Record<string, number> = {};
              recentTransactions.forEach(t => {
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + getTransactionAmount(t);
              });
              const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
              
              if (!topCat) return null;

              const labels: Record<string, string> = {
                MEDICAL: '병원비',
                FOOD: '사료/간식',
                SUPPLIES: '용품',
                GROOMING: '미용',
                OTHER: '기타'
              };

              return (
                <div className="flex-1 bg-[#F9FAFB] p-4 rounded-2xl">
                  <p className="text-[11px] font-bold text-[#8B95A1] mb-1">가장 많이 쓴 항목</p>
                  <p className="text-[15px] font-black text-[#191F28]">{labels[topCat[0]] || '기타'}</p>
                </div>
              );
            })()}
            <div className="flex-1 bg-[#F9FAFB] p-4 rounded-2xl">
              <p className="text-[11px] font-bold text-[#8B95A1] mb-1">분석 내역</p>
              <p className="text-[15px] font-black text-[#191F28]">{recentTransactions.length}건</p>
            </div>
          </div>
        </div>

        {/* 2. AI Coaching Report */}
        <div className="bg-white rounded-[28px] p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F8FAF9] rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#12B886] fill-[#12B886]" />
            </div>
            <div>
              <h3 className="text-[18px] font-black text-[#191F28]">AI 지출 분석 리포트</h3>
              <p className="text-[11px] text-[#8B95A1] font-bold">맞춤형 지출 코칭</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {isAnalyzing ? (
              <div className="space-y-3 py-2">
                <div className="h-4 bg-gray-50 rounded-full w-full animate-pulse" />
                <div className="h-4 bg-gray-50 rounded-full w-[90%] animate-pulse" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 bg-[#F8FAF9]/50 rounded-[22px] border border-[#F2F4F6]">
                  <p className="text-[14px] text-[#12B886] font-bold leading-relaxed break-keep">
                    {aiInsight ? aiInsight.split('\n')[0] : (() => {
                      const categoryTotals: Record<string, number> = {};
                      recentTransactions.forEach((t: any) => {
                        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + getTransactionAmount(t);
                      });
                      const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
                      if (topCat === 'MEDICAL') {
                        return '이번 달 지출은 병원비 항목에 크게 몰려 있어, 단기간에 지출이 집중된 것으로 보입니다. 다음 달 예산을 세울 때 병원비처럼 변동이 큰 지출과 사료·용품처럼 반복되는 지출을 나누어 관리해보세요. 병원에서 안내받은 복약, 재진, 회복 체크 일정이 있다면 PetLog에 기록으로 남겨두는 것이 도움이 될 수 있습니다.';
                      } else if (topCat === 'FOOD') {
                        return '이번 달은 사료·간식 지출 비중이 높았습니다. 대량 구매나 품목 변경이 있었는지 확인해보고, 다음 달 예산에 반영해보세요.';
                      } else {
                        return '이번 달 지출 내역을 분석했습니다. 변동이 큰 지출과 반복되는 지출을 구분하여 다음 달 계획을 세워보세요.';
                      }
                    })()}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-[13px] font-black text-[#4E5968] ml-1">추천 액션</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {(() => {
                      const categoryTotals: Record<string, number> = {};
                      recentTransactions.forEach((t: any) => {
                        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + getTransactionAmount(t);
                      });
                      const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
                      const hasFood = (categoryTotals['FOOD'] || 0) > 0;
                      const hasMedical = (categoryTotals['MEDICAL'] || 0) > 0;
                      const hasVaccine = recentTransactions.some((t: any) =>
                        ['접종', '백신', '예방', 'vaccine', 'rabies'].some(kw => safeIncludes(t.title, kw))
                      );

                      const actions: { label: string; icon: string; onClick: () => void }[] = [];

                      if (hasMedical) {
                        actions.push({ label: '병원비 상세 기록 확인하기', icon: '🔍', onClick: () => navigate('/transactions', { state: { filterCategory: 'MEDICAL' } }) });
                        actions.push({ label: '복약/재진 일정 등록하기', icon: '📅', onClick: () => navigate('/recurring-settings') });
                        actions.push({ label: '이번 달 의료비 카테고리 확인하기', icon: '📋', onClick: () => navigate('/statistics') });
                      }
                      if (hasVaccine) {
                        actions.unshift({ label: '예방접종 예정일 등록하기', icon: '💉', onClick: () => navigate('/notifications') });
                      }
                      if (hasFood) {
                        actions.push({ label: '사료 정기구매 가격 비교하기', icon: '🛒', onClick: () => navigate('/transactions', { state: { filterCategory: 'FOOD' } }) });
                      }
                      if (actions.length === 0) {
                        actions.push({ label: '이번 달 지출 내역 확인하기', icon: '📊', onClick: () => navigate('/transactions') });
                      }

                      return actions.slice(0, 3).map((action, i) => (
                        <button key={i} onClick={action.onClick} className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl hover:bg-gray-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{action.icon}</span>
                            <span className="text-[13px] font-bold text-[#191F28]">{action.label}</span>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
                        </button>
                      ));
                    })()}
                  </div>
                </div>
                <p className="text-[10px] text-[#ADB5BD] font-medium mt-4">
                  * 본 분석은 지출 기록을 바탕으로 한 참고용 브리핑이며, 진단이나 처방을 제공하지 않습니다. 정확한 케어 판단은 병원 안내를 따라주세요.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Category Distribution */}
        <div className="bg-white rounded-[28px] p-8 shadow-sm">
          <h3 className="text-[16px] font-black text-[#191F28] mb-6">카테고리별 지출 비중</h3>
          <div className="space-y-6">
            {[
              { key: 'MEDICAL', label: '병원비' },
              { key: 'FOOD', label: '사료/간식' },
              { key: 'SUPPLIES', label: '용품' },
              { key: 'GROOMING', label: '미용' },
              { key: 'OTHER', label: '기타' },
            ].map(cat => {
              const amount = recentTransactions
                .filter(t => t.category === cat.key || (cat.key === 'OTHER' && !['MEDICAL', 'FOOD', 'SUPPLIES', 'GROOMING'].includes(t.category)))
                .reduce((acc, curr) => acc + getTransactionAmount(curr), 0);
              const color = CATEGORY_COLORS[cat.key] || CATEGORY_COLORS.OTHER;
              const percentage = thisMonthTotal > 0 ? (amount / thisMonthTotal) * 100 : 0;
              
              if (amount === 0) return null;

              return (
                <div key={cat.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#8B95A1]">{cat.label}</span>
                    <span className="text-[13px] font-black text-[#191F28]">{amount.toLocaleString()}원</span>
                  </div>
                  <div className="h-1.5 bg-[#F8FAF9] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenditure Trend Card */}
        <div className="bg-white rounded-[24px] p-6">
          <h3 className="text-[15px] font-bold text-[#191F28] mb-6">월별 지출 추이</h3>
          <div className="h-48 mb-6">
            <ResponsiveContainer width="100%" height={192}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar 
                  dataKey="value" 
                  radius={[10, 10, 10, 10]} 
                  barSize={14}
                  onClick={(data: any) => {
                    if (data && data.fullMonth) {
                      setSelectedMonth(data.fullMonth);
                      setAiInsight(null); // Reset insight for new month
                    }
                  }}
                >
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fullMonth === selectedMonth ? '#12B886' : '#E9FBF5'} 
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Bar>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: '600', fill: '#8B95A1' }} dy={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-[16px]">
            <span className="text-[13px] font-semibold text-[#8B95A1]">6개월 평균 ₩{sixMonthAvg.toLocaleString()}</span>
            <span className={`text-[13px] font-bold ${diffPercent !== null && diffPercent > 0 ? 'text-[#F04452]' : diffPercent !== null && diffPercent < 0 ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}>
              {diffPercent !== null ? `${diffPercent > 0 ? '▲' : diffPercent < 0 ? '▼' : '-'} ${Math.abs(diffPercent)}%` : '-'}
            </span>
          </div>
        </div>

        {/* Pet Spending Comparison */}
        <div className="bg-white rounded-[24px] p-6">
          <h3 className="text-[15px] font-bold text-[#191F28] mb-8">반려동물별 지출</h3>
          <div className="space-y-8">
            {petSpending.length > 0 ? petSpending.map((pet, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F8FAF9] flex items-center justify-center text-xl">
                      {pet.icon}
                    </div>
                    <span className="text-[15px] font-bold text-[#191F28]">{pet.name}</span>
                  </div>
                  <span className="text-[15px] font-bold text-[#191F28]">₩{pet.total.toLocaleString()}</span>
                </div>
                <div className="relative h-2 bg-[#F8FAF9] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pet.current}%` }}
                    className="h-full rounded-full bg-[#12B886]"
                    transition={{ duration: 1, delay: i * 0.1 }}
                  />
                </div>
              </div>
            )) : (
              <EmptyState title="내역 없음" description="이번 달 지출 내역이 없습니다." />
            )}
          </div>
        </div>

        {/* Transaction Detail Card */}
        <div className="bg-white rounded-[24px] overflow-hidden">
           <div className="p-6 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#191F28]">이달 지출 내역</h3>
              <div className="flex gap-1 p-1 bg-[#F8FAF9] rounded-xl">
                <button 
                  onClick={() => setSortOrder('date')}
                  className={`text-[12px] px-3 py-1.5 rounded-lg font-bold transition-all ${sortOrder === 'date' ? 'bg-white text-[#12B886] shadow-sm' : 'text-[#8B95A1]'}`}
                >날짜순</button>
                <button 
                  onClick={() => setSortOrder('amount')}
                  className={`text-[12px] px-3 py-1.5 rounded-lg font-bold transition-all ${sortOrder === 'amount' ? 'bg-white text-[#12B886] shadow-sm' : 'text-[#8B95A1]'}`}
                >금액순</button>
              </div>
           </div>
           
           <div className="divide-y divide-[#F2F4F6]">
              {sortedTransactions.length > 0 ? sortedTransactions.map((item, i) => {
                const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER;
                return (
                  <div key={i} className="p-5 flex items-center justify-between active:bg-[#F9FAFB] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[15px] font-semibold text-[#191F28]">{item.title}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-bold text-[#191F28]">- ₩{getTransactionAmount(item).toLocaleString()}</p>
                      <p className="text-[13px] text-[#8B95A1] font-medium mt-0.5">{item.date.slice(5)}</p>
                    </div>
                  </div>
                )
              }) : (
                <div className="py-12 text-center">
                  <p className="text-[14px] text-[#8B95A1] font-medium">내역이 없습니다.</p>
                </div>
              )}
           </div>
           
           {sortedTransactions.length > 0 && (
             <button 
               onClick={() => navigate('/transactions')} 
               className="w-full py-5 text-[14px] text-[#12B886] font-bold hover:bg-[#F8FAF9] transition-colors"
             >
               지출 전체보기
             </button>
           )}
        </div>
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Report Limit Reached Modal */}
      <AnimatePresence>
        {showReportLimitModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportLimitModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-[320px] rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-8 text-center"
            >
              <div className="w-16 h-16 bg-[#F8FAF9] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                📊
              </div>
              <h3 className="text-lg font-black text-[#191F28] mb-2">오늘 리포트 사용을<br/>모두 완료했습니다</h3>
              <p className="text-xs text-[#8B95A1] font-medium leading-relaxed mb-8">
                베타 기간 동안 추가 조회가 가능합니다.<br/>
                <span className="text-[#12B886] font-bold">마음껏 분석해보세요!</span>
              </p>
              
              <button
                onClick={() => setShowReportLimitModal(false)}
                className="w-full h-14 bg-[#12B886] text-white font-black rounded-2xl shadow-lg shadow-[#12B886]/10 active:scale-[0.98] transition-all"
              >
                계속 보기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
