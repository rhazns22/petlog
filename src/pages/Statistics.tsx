import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Share2, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#FFB020',
  MEDICAL: '#12B886',
  GROOMING: '#EC4899',
  INSURANCE: '#20C997',
  OTHER: '#8B95A1',
};

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: '사료·간식',
  MEDICAL: '병원비',
  GROOMING: '미용·용품',
  INSURANCE: '보험료',
  OTHER: '기타',
};

export default function Statistics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalSpent, setTotalSpent] = useState(0);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<any[]>([]);
  const [prevMonthSpent, setPrevMonthSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const prevMonthDate = new Date(year, month - 2, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();

    const currentQuery = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', `${currentMonthStr}-01`),
      where('date', '<=', `${currentMonthStr}-${lastDayOfMonth}`)
    );

    const unsubCurrent = onSnapshot(currentQuery, (snapshot) => {
      let total = 0;
      const categoryTotals: Record<string, number> = {
        FOOD: 0, MEDICAL: 0, GROOMING: 0, INSURANCE: 0, OTHER: 0
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'EXPENSE') {
          total += Number(data.amount);
          if (categoryTotals[data.category] !== undefined) {
            categoryTotals[data.category] += Number(data.amount);
          } else {
            categoryTotals['OTHER'] += Number(data.amount);
          }
        }
      });

      setTotalSpent(total);
      
      const newCategoryData = Object.entries(categoryTotals)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => ({
          id: key,
          name: CATEGORY_LABELS[key] || '기타',
          value,
          color: CATEGORY_COLORS[key] || CATEGORY_COLORS.OTHER,
        }))
        .sort((a, b) => b.value - a.value);

      setCategoryData(newCategoryData);
    }, (err) => {
      console.error('Error fetching current month data:', err);
      setError('이번 달 통계 데이터를 불러오는데 실패했습니다.');
    });

    const prevQuery = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', `${prevMonthStr}-01`),
      where('date', '<=', `${prevMonthStr}-${lastDayOfPrevMonth}`)
    );

    const unsubPrev = onSnapshot(prevQuery, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'EXPENSE') {
          total += Number(data.amount);
        }
      });
      setPrevMonthSpent(total);
    }, (err) => {
      console.error('Error fetching previous month data:', err);
    });

    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      clearTimeout(timer);
      unsubCurrent();
      unsubPrev();
    };
  }, [user, currentDate]);

  useEffect(() => {
    setLineData([
      { name: '이전달', value: prevMonthSpent },
      { name: '', value: prevMonthSpent + (totalSpent - prevMonthSpent) * 0.3 },
      { name: '', value: prevMonthSpent + (totalSpent - prevMonthSpent) * 0.6 },
      { name: '이번달', value: totalSpent },
    ]);
  }, [totalSpent, prevMonthSpent]);

  const handleShare = async () => {
    const shareData = {
      title: '우리 아이 이번 달 통계',
      text: '반려동물 지출 데이터 상세 리포트입니다.',
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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const currentMonthLabel = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-24">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-[#F2F4F6]">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-[17px] font-bold text-[#191F28]">월별 통계</span>
        <button onClick={handleShare} className="p-2 text-[#12B886]">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-6 space-y-6">
        {error && (
          <div className="badge-error w-full py-3 px-4 flex items-center gap-3">
            <span className="font-bold text-sm">!</span>
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="bg-white rounded-[24px] p-6 h-[250px] w-full" />
            <div className="bg-white rounded-[24px] p-6 h-[300px] w-full" />
          </div>
        ) : (
          <>
        {/* Main Consumption Card */}
        <div className="bg-white rounded-[28px] p-7 space-y-6 shadow-sm border border-[#F2F4F6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevMonth} className="p-1">
                <ChevronLeft className="w-4 h-4 text-[#8B95A1]" />
              </button>
              <span className="text-[15px] font-black text-[#191F28]">{currentMonthLabel}</span>
              <button onClick={handleNextMonth} className="p-1">
                <ChevronRight className="w-4 h-4 text-[#8B95A1]" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[14px] font-bold text-[#8B95A1]">이번 달 지출</p>
            <h2 className="text-[32px] font-black text-[#191F28] tracking-tight">{totalSpent.toLocaleString()}원</h2>
          </div>
          
          <div className="flex flex-col gap-8">
            <div className="w-full h-48 relative overflow-hidden">
              {isMounted && (
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie
                      data={categoryData.length > 0 ? categoryData : [{value: 1, color: '#E9FBF5'}]}
                      cx="50%" cy="50%"
                      innerRadius="70%"
                      outerRadius="95%"
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={categoryData.length > 1 ? 2 : 0}
                    >
                      {categoryData.length > 0 ? categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      )) : <Cell fill="#E9FBF5" />}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#0B2F2A] text-white p-3 rounded-2xl shadow-xl text-xs font-bold border border-white/10">
                              <p className="text-white/60 mb-1">{payload[0].name}</p>
                              <p className="text-[#12B886] text-[14px]">{payload[0].value.toLocaleString()}원</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black text-[#8B95A1] uppercase tracking-widest mb-1">Ratio</span>
                <span className="text-lg font-black text-[#191F28]">{totalSpent > 0 ? `${((totalSpent / (totalSpent + 50000)) * 100).toFixed(0)}%` : '0%'}</span>
              </div>
            </div>
            
            <div className="w-full h-20 relative bg-[#F8FAF9]/30 rounded-2xl p-4 overflow-hidden border border-[#F2F4F6]">
              {isMounted && (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={lineData}>
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#12B886" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#12B886', strokeWidth: 0 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <div className="absolute top-2 right-4 text-[10px] text-[#12B886] font-black">이번달</div>
              <div className="absolute bottom-2 left-4 text-[10px] text-[#8B95A1] font-black">지난달</div>
            </div>
          </div>
        </div>

        {/* Comparison Chart */}
        <div className="bg-white rounded-[28px] p-7 shadow-sm border border-[#F2F4F6]">
          <h3 className="text-[15px] font-bold text-[#191F28] mb-8">
            지난달과 비교
          </h3>
          <div className="h-64 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={[
                  { name: '지난달', value: prevMonthSpent, fill: '#F2F4F6' },
                  { name: '이번달', value: totalSpent, fill: '#12B886' }
                ]}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fontWeight: '700', fill: '#8B95A1' }} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Bar 
                    dataKey="value" 
                    radius={[12, 12, 12, 12]} 
                    barSize={48} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-8 p-5 bg-[#F8FAF9]/50 rounded-[22px] text-center border border-[#F2F4F6]">
            <p className="text-[14px] text-[#4E5968] font-bold leading-relaxed">
              지난달보다 <span className={`font-black ${totalSpent > prevMonthSpent ? 'text-[#F04452]' : 'text-[#12B886]'}`}>
                {Math.abs(totalSpent - prevMonthSpent).toLocaleString()}원
              </span> {totalSpent > prevMonthSpent ? '더 썼어요' : '적게 썼어요'}!
            </p>
          </div>
        </div>

        {/* Category List */}
        <div className="bg-white rounded-[28px] overflow-hidden p-7 shadow-sm border border-[#F2F4F6]">
          <h3 className="text-[15px] font-bold text-[#191F28] mb-8">카테고리별</h3>
          <div className="space-y-7">
            {categoryData.length > 0 ? categoryData.map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color }}>
                    <span className="text-[15px] font-black">{cat.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[15px] font-bold text-[#4E5968]">{cat.name}</span>
                      <span className="text-[15px] font-black text-[#191F28]">{cat.value.toLocaleString()}원</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F8FAF9] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.value / totalSpent) * 100}%` }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <EmptyState 
                title="데이터가 없어요" 
                description="이번 달에는 아직 지출 내역이 없네요."
              />
            )}
          </div>

          {totalSpent > 0 && (
            <button 
              onClick={() => navigate('/report')}
              className="w-full toss-button-primary mt-10"
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                분석 리포트 보기
              </div>
            </button>
          )}
        </div>
        </>
        )}
      </div>

      <Navbar />
    </div>
  );
}
