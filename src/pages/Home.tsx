import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDocs } from 'firebase/firestore';
import { analyzeReceipt, generateCoachingInsight, SpendingAnalysisInput } from '../lib/gemini';
import { trackEvent } from '../lib/analytics';
import { getPetDefaultImage } from '../lib/petUtils';
import PetAvatar from '../components/PetAvatar';
import { Bell, ChevronRight, AlertCircle, ShoppingBag, Camera, Megaphone, Sparkles, X, MessageSquare, CheckCircle2 } from 'lucide-react';
import { safeIncludes, safeText, isPetLogDebug, getTransactionAmount, getSafeAiContent } from '../lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  MEDICAL: '병원비',
  FOOD: '사료·간식',
  SUPPLIES: '용품',
  GROOMING: '미용',
  INSURANCE: '보험료',
  OTHER: '기타',
};


const CATEGORY_STYLES: Record<string, { icon: string; color: string; barColor: string }> = {
  FOOD: { icon: '🍴', color: 'bg-[#F8FAF9]', barColor: 'bg-[#FFB020]' },
  MEDICAL: { icon: '🏥', color: 'bg-[#F8FAF9]', barColor: 'bg-[#12B886]' },
  GROOMING: { icon: '✂️', color: 'bg-[#F8FAF9]', barColor: 'bg-[#EC4899]' },
  SUPPLIES: { icon: '🧸', color: 'bg-[#F8FAF9]', barColor: 'bg-[#8B5CF6]' },
  INSURANCE: { icon: '🛡️', color: 'bg-[#F8FAF9]', barColor: 'bg-[#12B886]' },
  OTHER: { icon: '🏷️', color: 'bg-[#F8FAF9]', barColor: 'bg-[#ADB5BD]' },
};

const BETA_FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSed-MaJWJPmPKqKDnXQdy-puYshsrq2uXSIJ89Vl-A2YaO8Ig/viewform?usp=dialog';

const AI_BRIEFING_CACHE_VERSION = 'v1.2.5';

const extractInsightText = (result: any): string => {
  if (!result) return '';

  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      return extractInsightText(parsed);
    } catch {
      return result;
    }
  }

  if (typeof result.insight === 'string') {
    return result.insight;
  }

  if (typeof result.insight === 'object' && result.insight !== null) {
    return (
      result.insight.summary ??
      result.insight.message ??
      result.insight.text ??
      ''
    );
  }

  return (
    result.summary ??
    result.message ??
    result.text ??
    ''
  );
};

function AdMarquee({ adMessage, maintenance }: { adMessage: string; maintenance: any }) {
  if (maintenance.active) {
    return (
      <div className="w-full bg-[#F04452] py-3 px-4 flex items-center justify-center gap-2 overflow-hidden border-b border-[#F04452]/10 sticky top-0 z-[60]">
        <span className="text-white text-[13px] font-bold flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          {maintenance.message || '시스템 점검 중입니다.'}
        </span>
      </div>
    );
  }

  return (
    <div className="px-5 mt-2">
      <div className="w-full h-12 bg-white rounded-2xl flex items-center overflow-hidden border border-[#F2F4F6] px-4 gap-3 shadow-sm">
        <div className="flex items-center justify-center w-8 h-8 bg-[#F8FAF9] rounded-xl">
          <Megaphone className="w-4 h-4 text-[#12B886]" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-[13px] font-bold text-[#8B95A1] whitespace-nowrap animate-marquee">
            {adMessage}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthReady } = useAuth();
  const { language } = useLanguage();
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [displaySpent, setDisplaySpent] = useState(0);
  const [medicalSpent, setMedicalSpent] = useState(0);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lastMonthTransactions, setLastMonthTransactions] = useState<any[]>([]);
  const [recurringItems, setRecurringItems] = useState<any[]>([]);
  const [adMessage, setAdMessage] = useState('PetLog 클로즈 베타 테스트 진행 중! 소중한 의견을 들려주세요⭐');
  const [maintenance, setMaintenance] = useState({ active: false, message: '', endTime: '' });
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number, category: string, isFirst: boolean } | null>(null);
  const [aiBriefing, setAiBriefing] = useState<{
    title?: string;
    summary?: string;
    reason?: string;
    action?: string;
    confidence?: string;
    available?: boolean;
    message?: string;
    fallbackMessage?: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiDetailExpanded, setIsAiDetailExpanded] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [spendingAnalysisState, setSpendingAnalysisState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [aiBriefingState, setAiBriefingState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  // 저장 후 피드백 처리
  useEffect(() => {
    if (location.state?.recordCompleted) {
      setSuccessData({
        amount: location.state.addedAmount,
        category: location.state.categoryLabel,
        isFirst: location.state.isFirst
      });
      setShowSuccessModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 총 지출 금액 애니메이션
  useEffect(() => {
    const controls = animate(displaySpent, totalSpent, {
      duration: 1,
      onUpdate: (value) => setDisplaySpent(Math.floor(value)),
      ease: "easeOut"
    });
    return () => controls.stop();
  }, [totalSpent]);

  // 데이터 로드 및 실시간 구독
  useEffect(() => {
    if (!isAuthReady || !user?.uid) return;

    if (isPetLogDebug()) {
      console.error("[Home Firestore Start]", {
        isAuthReady,
        userUid: user.uid,
        transactionsPath: `users/${user.uid}/transactions`,
        petsPath: `users/${user.uid}/pets`,
      });
    }

    const petQuery = query(collection(db, 'users', user.uid, 'pets'));
    const unsubPets = onSnapshot(petQuery, (snapshot) => {
      const fetchedPets: any[] = [];
      snapshot.forEach(doc => fetchedPets.push({ id: doc.id, ...doc.data() }));
      setPets(fetchedPets);
    });

    // [v2.5.5] Simplify query to bypass Listen 400 / Index issues
    const transactionQuery = collection(db, 'users', user.uid, 'transactions');
    
    if (isPetLogDebug()) {
      console.log('[PetLog DEBUG] Home.tsx: Initializing simplified onSnapshot', {
        uid: user.uid,
        path: `users/${user.uid}/transactions`
      });
    }

    const unsubTransactions = onSnapshot(transactionQuery, (snapshot) => {
      if (isPetLogDebug()) {
        console.log('[PetLog DEBUG] Home.tsx: onSnapshot received', {
          size: snapshot.size,
          fromCache: snapshot.metadata.fromCache,
          currentMonth: currentMonth
        });
      }
      try {
        let currentSpent = 0;
        let currentMedical = 0;
        const transactions: any[] = [];
        
        // Month range for local filtering
        const startOfMonth = `${currentMonth}-01`;
        const endOfMonth = `${currentMonth}-${lastDayOfMonth}`;

        snapshot.forEach(doc => {
          try {
            const data = doc.data();
            
            // [v2.5.5] Client-side date filtering
            const txDate = data.date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().slice(0, 10) : '');
            if (txDate < startOfMonth || txDate > endOfMonth) return;

            const amt = getTransactionAmount(data);
            const safeAmt = Number.isFinite(amt) ? amt : 0;
            
            // [v2.5.3] Only count expenses (case-insensitive)
            const type = data.type?.toLowerCase();
            if (type === 'expense' || !type) {
              if (data.category === 'MEDICAL') currentMedical += safeAmt;
              currentSpent += safeAmt;
              
              // [v2.5.4] Ensure date fallback for display
              transactions.push({ id: doc.id, ...data, date: txDate });
            } else {
              if (isPetLogDebug()) console.log('[PetLog DEBUG] Home.tsx: Skipping non-expense item', { id: doc.id, type: data.type });
            }
          } catch (txErr) {
            if (isPetLogDebug()) console.warn('[Transaction Parse Error]', txErr);
          }
        });

        // [v2.5.5] Client-side sorting (descending by date)
        transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        setTotalSpent(currentSpent);
        setMedicalSpent(currentMedical);
        setCurrentMonthTransactions(transactions);
        
        if (isPetLogDebug()) {
          console.log('[PetLog DEBUG] Home.tsx: Snapshot Summary', {
            snapshotSize: snapshot.size,
            processedTransactions: transactions.length,
            currentMonth: currentMonth,
            totalSpent: currentSpent,
            medicalSpent: currentMedical
          });
        }
        
        // 데이터 로딩 완료 처리
        if (transactions.length > 0) {
          setSpendingAnalysisState('ready');
        } else {
          if (isPetLogDebug()) console.log('[PetLog DEBUG] Home.tsx: No valid expense transactions found for this month');
          setSpendingAnalysisState('empty');
        }
      } catch (err) {
        if (isPetLogDebug()) console.error('[PetLog DEBUG] Home Spending Analysis Error', err);
        setSpendingAnalysisState('error');
      }
    }, (error) => {
      if (isPetLogDebug()) console.error('[PetLog DEBUG] Home.tsx: onSnapshot Global Error (Index?)', error);
      setSpendingAnalysisState('error');
    });

    const recentQuery = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubRecent = onSnapshot(recentQuery, (snapshot) => {
      let txs: any[] = [];
      snapshot.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));
      setRecentTransactions(txs);
    });

    const recurringQuery = query(
      collection(db, 'users', user.uid, 'recurringExpenses'),
      where('isActive', '==', true),
      orderBy('nextDate', 'asc'),
      limit(10)
    );
    const unsubRecurring = onSnapshot(recurringQuery, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setRecurringItems(items);
    });

    const notiQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('isRead', '==', false),
      limit(1)
    );
    const unsubNoti = onSnapshot(notiQuery, (snapshot) => {
      setHasUnreadNotifications(!snapshot.empty);
    });

    const fetchSettings = async () => {
      return onSnapshot(doc(db, 'settings', 'global'), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          if (data.adMessage) setAdMessage(data.adMessage);
          if (data.maintenance) setMaintenance(data.maintenance);
        }
      });
    };
    fetchSettings();

    const fetchLastMonth = async () => {
      const lm = new Date();
      lm.setMonth(lm.getMonth() - 1);
      const lmStr = lm.toISOString().slice(0, 7);
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', `${lmStr}-01`),
        where('date', '<=', `${lmStr}-31`)
      );
      const snap = await getDocs(q);
      const txs: any[] = [];
      snap.forEach(d => txs.push({ id: d.id, ...d.data() }));
      setLastMonthTransactions(txs);
    };
    fetchLastMonth();

    const timer = setTimeout(() => setLoading(false), 800);
    return () => {
      clearTimeout(timer);
      unsubPets();
      unsubTransactions();
      unsubRecent();
      unsubRecurring();
      unsubNoti();
    };
  }, [user, currentMonth]);

  // AI 브리핑 로직
  const AI_BRIEFING_CACHE_VERSION = 'v2_safe_spending_briefing';
  useEffect(() => {
    if (!user || loading || currentMonthTransactions.length === 0) return;

      const triggerAI = async () => {
        const cacheKey = `petlog_ai_${AI_BRIEFING_CACHE_VERSION}_${user.uid}_${currentMonthTransactions.length}_${totalSpent}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setAiBriefing(parsed);
            setAiBriefingState('success');
            return;
          } catch (e) {
            sessionStorage.removeItem(cacheKey);
          }
        }

        setAiBriefingState('loading');
        setIsGenerating(true);
        
        try {
          const catTotals: Record<string, number> = {};
          currentMonthTransactions.forEach(t => {
            const amt = getTransactionAmount(t);
            const safeAmt = Number.isFinite(amt) ? amt : 0;
            catTotals[t.category] = (catTotals[t.category] || 0) + safeAmt;
          });

          const lastMonthTotal = lastMonthTransactions.reduce((acc, c) => {
            const amt = getTransactionAmount(c);
            return acc + (Number.isFinite(amt) ? amt : 0);
          }, 0);
          
          const topCategoryEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0] || ['UNKNOWN', 0];

          const input: SpendingAnalysisInput = {
            totalSpent,
            totalBudget,
            budgetUsageRate: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
            remainingBudget: Math.max(0, totalBudget - totalSpent),
            currentMonthCategoryTotals: catTotals,
            lastMonthTotal,
            monthOverMonthChange: totalSpent - lastMonthTotal,
            monthOverMonthChangeRate: lastMonthTotal > 0 ? ((totalSpent - lastMonthTotal) / lastMonthTotal) * 100 : 0,
            topCategory: topCategoryEntry[0],
            topCategoryAmount: topCategoryEntry[1],
            topCategoryRatio: totalSpent > 0 ? (topCategoryEntry[1] / totalSpent) * 100 : 0,
            medicalSpent,
            medicalRatio: totalSpent > 0 ? (medicalSpent / totalSpent) * 100 : 0,
            transactionCount: currentMonthTransactions.length,
            petCount: pets.length
          };

          if (isPetLogDebug()) {
            console.log('[PetLog DEBUG] Home.tsx: Triggering AI Briefing with input', {
              transactionsLength: currentMonthTransactions.length,
              currentMonthTransactionsLength: currentMonthTransactions.length,
              totalSpent: totalSpent,
              categorySummary: catTotals,
              payload: input
            });
          }

          try {
            const resultString = await generateCoachingInsight(input);
            
            let resultJson;
            try {
              if (typeof resultString === 'string') {
                try {
                  resultJson = JSON.parse(resultString);
                } catch (e) {
                  resultJson = { available: true, insight: resultString };
                }
              } else {
                resultJson = resultString;
              }
            } catch (jsonErr) {
              resultJson = { available: false, reason: 'PARSE_ERROR', raw: resultString };
            }

            const insightText = extractInsightText(resultJson);

            if (isPetLogDebug()) {
              console.log('[PetLog DEBUG] Home.tsx: AI Briefing RAW Result', {
                status: resultJson.available === false ? 'FAILED' : 'SUCCESS',
                responseBody: resultJson,
                available: resultJson.available,
                reason: resultJson.reason || 'NONE',
                insightOrSummary: insightText,
                debugMessage: resultJson.debugInfo || resultJson.debugMessage || 'NONE'
              });
            }
            
            if (resultJson?.available === false) {
              if (isPetLogDebug()) console.warn('[PetLog DEBUG] AI Briefing Unavailable Reason:', resultJson?.reason || 'Unknown');
              setAiBriefing(resultJson);
              setAiBriefingState('empty');
              return;
            }

            if (!insightText) {
              if (isPetLogDebug()) console.warn('[PetLog DEBUG] Home.tsx: AI Briefing Fallback Reason: No text extracted');
              setAiBriefing({
                available: false,
                reason: 'GEMINI_API_ERROR',
                message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
                fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
              });
              setAiBriefingState('empty');
              return;
            }

            const safeText = getSafeAiContent(insightText);
            resultJson.summary = safeText; // For backwards compatibility with rendering
            setAiBriefing(resultJson);
            setAiBriefingState('success');
            sessionStorage.setItem(cacheKey, JSON.stringify(resultJson));
          } catch (innerErr) {
            if (isPetLogDebug()) console.error('[PetLog DEBUG] AI Briefing Inner Error:', innerErr);
            setAiBriefingState('error');
            setAiBriefing({
              available: false,
              reason: 'GEMINI_API_ERROR',
              message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
              fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
            });
          }
        } catch (e) {
          if (isPetLogDebug()) console.error('[PetLog DEBUG] AI Briefing Global Error:', e);
          setAiBriefingState('error');
          setAiBriefing({
            available: false,
            reason: 'GEMINI_API_ERROR',
            message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
            fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
          });
        } finally {
          setIsGenerating(false);
        }
      };

    const timeout = setTimeout(triggerAI, 2000);
    return () => clearTimeout(timeout);
  }, [currentMonthTransactions, user, loading]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] pb-24 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/logo.png?v=2" alt="PetLog Logo" className="w-8 h-8 rounded-[15px] overflow-hidden" />
          <span className="text-[#191F28] text-xl font-black tracking-tight">PetLog</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/notifications')} className="relative p-1">
            <Bell className="w-6 h-6 text-[#191F28]" />
            {hasUnreadNotifications && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#F04452] rounded-full ring-2 ring-white"></div>
            )}
          </button>
        </div>
      </div>

      <AdMarquee adMessage={adMessage} maintenance={maintenance} />

      <div className="px-5 space-y-6 py-4">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="bg-white rounded-[28px] p-7 h-48 border border-[#F2F4F6] shadow-sm" />
            <div className="bg-white rounded-[28px] p-7 h-32 border border-[#F2F4F6] shadow-sm" />
            <div className="bg-white rounded-[28px] p-7 h-64 border border-[#F2F4F6] shadow-sm" />
          </div>
        ) : (
          <>
            {/* 1. Dashboard */}
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-[#F2F4F6]">
              <div className="space-y-1 mb-6">
                <h2 className="text-[15px] font-bold text-[#8B95A1]">이번 달 반려동물 지출</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-[32px] font-black text-[#191F28]">{displaySpent.toLocaleString()}</span>
                  <span className="text-[20px] font-bold text-[#191F28]">원</span>
                </div>
                {lastMonthTransactions.length > 0 && (
                  <p className={`text-[13px] font-bold ${totalSpent > lastMonthTransactions.reduce((a, c) => a + getTransactionAmount(c), 0) ? 'text-[#F04452]' : 'text-[#12B886]'}`}>
                    지난달보다 {Math.abs(totalSpent - lastMonthTransactions.reduce((a, c) => a + getTransactionAmount(c), 0)).toLocaleString()}원 {totalSpent > lastMonthTransactions.reduce((a, c) => a + getTransactionAmount(c), 0) ? '증가했어요' : '줄었어요'}
                  </p>
                )}
              </div>

              <div className="info-banner">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#12B886] fill-[#12B886]" />
                    <span className="text-[13px] font-black text-[#191F28]">AI 지출 브리핑</span>
                  </div>
                  {spendingAnalysisState === 'loading' || aiBriefingState === 'loading' ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-[#12B886]/10 rounded w-full" />
                      <p className="text-[13px] text-[#8B95A1] font-bold">AI 지출 브리핑을 준비하고 있어요.</p>
                    </div>
                  ) : spendingAnalysisState === 'empty' ? (
                    <p className="text-[13px] text-[#8B95A1] font-bold">아직 지출 기록이 없어요. 첫 지출을 기록하면 분석을 확인할 수 있습니다.</p>
                  ) : spendingAnalysisState === 'error' ? (
                    <p className="text-[13px] text-[#F04452] font-bold">지출 분석을 불러오는 중 문제가 발생했습니다. 기록은 정상적으로 저장되어 있습니다.</p>
                  ) : aiBriefingState === 'success' && aiBriefing && (aiBriefing as any).available !== false ? (
                    <div className="space-y-3">
                      <p className="text-[13px] text-[#191F28] font-bold leading-relaxed">{aiBriefing.summary}</p>
                      {isAiDetailExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-2 pt-2 border-t border-[#F2F4F6]">
                          <p className="text-[12px] text-[#4E5968] font-bold"><span className="text-[#12B886]">분석:</span> {aiBriefing.reason}</p>
                          <p className="text-[12px] text-[#4E5968] font-bold"><span className="text-[#20C997]">제안:</span> {aiBriefing.action}</p>
                        </motion.div>
                      )}
                      <button onClick={() => setIsAiDetailExpanded(!isAiDetailExpanded)} className="text-[11px] font-black text-[#12B886] flex items-center gap-1">
                        {isAiDetailExpanded ? '접기' : '자세히 보기'} <ChevronRight className={`w-3 h-3 transition-transform ${isAiDetailExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#8B95A1] font-bold leading-relaxed break-keep">
                      {aiBriefing?.message || '현재 AI 지출 브리핑을 불러올 수 없습니다.'}{' '}
                      <span className="block text-[11px] text-[#ADB5BD] mt-1 font-medium">
                        {aiBriefing?.fallbackMessage || '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'}
                      </span>
                    </p>
                  )}

                  <div className="pt-2 border-t border-[#F2F4F6]">
                    <p className="text-[10px] text-[#ADB5BD] leading-relaxed break-keep">
                      * AI 지출 브리핑은 참고용이며 진단·처방을 제공하지 않습니다. 정확한 케어 판단은 수의사 등 전문가의 안내를 권장합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Schedule */}
            {recurringItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-bold text-[16px] text-[#8B95A1]">기억해야 할 일정</h2>
                  <button onClick={() => navigate('/recurring-settings')} className="text-[12px] text-[#12B886] font-bold">전체보기</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
                  {recurringItems.map(item => (
                    <div key={item.id} onClick={() => navigate('/recurring-settings')} className="flex-shrink-0 w-[180px] bg-white p-5 rounded-[24px] border border-[#F2F4F6] shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="badge-primary">D-Day</div>
                        <div className="text-xl">🏥</div>
                      </div>
                      <div>
                        <h3 className="text-[14px] font-black text-[#191F28] truncate">{item.title || item.item}</h3>
                        <p className="text-[11px] text-[#8B95A1] font-bold mt-0.5">{item.petName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. CTA */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/input', { state: { autoStartOCR: true } })}
              className="w-full h-20 bg-[#12B886] rounded-[28px] shadow-lg shadow-[#12B886]/20 flex items-center justify-center gap-4 text-white"
            >
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Camera className="w-6 h-6" /></div>
              <div className="text-left">
                <span className="block text-[18px] font-black">영수증 분석하기</span>
                <span className="block text-white/70 text-[12px] font-bold">진료·용품·사료 자동 분석</span>
              </div>
            </motion.button>

            {/* 4. Pets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-bold text-[16px] text-[#8B95A1]">나의 반려동물</h2>
                <button onClick={() => navigate('/pet-registration')} className="text-[12px] text-[#12B886] font-bold">추가</button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {pets.map(pet => {
                  return (
                    <div key={pet.id} onClick={() => setSelectedPet(pet)} className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer">
                      <PetAvatar pet={pet} size="md" />
                      <span className="text-[11px] font-bold text-[#4E5968]">{pet.name || '반려동물'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Categories */}
            <div className="bg-white rounded-[28px] p-7 border border-[#F2F4F6] shadow-sm">
              <h2 className="text-[16px] font-bold text-[#8B95A1] mb-6">카테고리별 지출</h2>
              <div className="space-y-5">
                {['MEDICAL', 'FOOD', 'SUPPLIES', 'GROOMING', 'OTHER'].map(cat => {
                  const amount = currentMonthTransactions.filter(t => t.category === cat).reduce((acc, c) => acc + getTransactionAmount(c), 0);
                  const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES.OTHER;
                  const percent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${style.color} flex items-center justify-center text-lg`}>{style.icon}</div>
                          <span className="text-[14px] font-bold text-[#8B95A1]">{CATEGORY_LABELS[cat] || cat}</span>
                        </div>
                        <span className="text-[14px] font-black text-[#191F28]">{amount.toLocaleString()}원</span>
                      </div>
                      <div className="h-1.5 bg-[#F8FAF9] rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full ${style.barColor}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-bold text-[16px] text-[#8B95A1]">최근 분석 내역</h2>
                <button onClick={() => navigate('/transactions')} className="text-[12px] text-[#8B95A1] font-bold">전체보기</button>
              </div>
              <div className="bg-white rounded-[28px] overflow-hidden border border-[#F2F4F6] shadow-sm divide-y divide-[#E9FBF5]">
                {recentTransactions.map(item => {
                  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.OTHER;
                  return (
                    <div key={item.id} onClick={() => navigate(`/transaction/${item.id}`)} className="p-5 flex items-center gap-3 active:bg-[#F8FAF9]/30">
                      <div className={`w-10 h-10 rounded-xl ${style.color} flex items-center justify-center text-xl`}>{style.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] text-[#191F28] truncate">{item.title || '분석 중'}</h3>
                        <p className="text-[11px] text-[#8B95A1] font-bold mt-0.5">{item.date} · {CATEGORY_LABELS[item.category] || item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[16px] text-[#191F28]">{getTransactionAmount(item).toLocaleString()}원</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pet Detail Modal */}
      {selectedPet && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedPet(null)}>
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="bg-white w-full max-w-[480px] rounded-t-[32px] p-8 pb-12" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
            <div className="flex flex-col items-center mb-8">
              <PetAvatar pet={selectedPet} size="xl" className="mb-4 border-4 border-white shadow-xl" />
              <h2 className="text-2xl font-black text-[#191F28]">{selectedPet.name}</h2>
              <p className="text-sm font-bold text-[#12B886] mt-1">{selectedPet.breed}</p>
            </div>
            <button onClick={() => navigate('/pet-management', { state: { editPetId: selectedPet.id } })} className="w-full h-14 bg-[#F8FAF9] text-[#12B886] font-bold rounded-2xl">상세 정보 수정하러 가기</button>
          </motion.div>
        </div>
      )}

      {/* Premium 준비중 모달 */}
      <AnimatePresence>
        {showPremiumModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPremiumModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-[340px] rounded-[32px] p-8 text-center relative z-10 shadow-2xl">
              <Sparkles className="w-12 h-12 text-[#12B886] mx-auto mb-4" />
              <h3 className="text-xl font-black text-[#191F28] mb-2">프리미엄 준비 중! 🚀</h3>
              <p className="text-sm text-[#8B95A1] font-medium mb-6">베타 기간 동안 모든 기능을 무료로 제공해드려요!</p>
              <button onClick={() => setShowPremiumModal(false)} className="w-full h-14 bg-[#12B886] text-white font-black rounded-2xl">알림 받기</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Floating Button */}
      <a
        href={BETA_FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="feedback-button"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      <Navbar />
    </div>
  );
}
