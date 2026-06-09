import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Utensils, Stethoscope, Scissors, ShieldCheck, Tag, Plus, Camera, Image as ImageIcon, FileText, AlertCircle, Bell, Sparkles, CheckCircle2, Lock, Search, BookOpen, Check } from 'lucide-react';
import { analyzeReceipt, reexamineReceipt } from '../lib/gemini';
import { MedicalAnalysisEngine, AnalysisResult } from '../lib/medicalEngine';
import { createTrainingRecord, CategorySummary, VerificationStatus, determineTrainingQuality } from '../lib/trainingPipeline';
import { useAuth } from '../contexts/AuthContext';
import { useUsage } from '../contexts/UsageContext';
import { useToast } from '../contexts/ToastContext';
import { db, storage, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, updateDoc, query, onSnapshot, limit, where, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createAnalysisImage, blobToBase64 } from '../lib/imageUtils';
import PMFSurvey from '../components/PMFSurvey';
import { motion, AnimatePresence } from 'framer-motion';
import { logSystem } from '../lib/logger';
import { safeIncludes, safeText, isPetLogDebug, normalizeAmount, getTransactionAmount } from '../lib/utils';
import { getPetDefaultImage } from '../lib/petUtils';
import PetAvatar from '../components/PetAvatar';
import { getSafeAiContent } from '../lib/utils';

/**
 * [PetLog 지능형 사전 분류 사전]
 * AI 호출 전, 혹은 AI 분석 후 결과를 보강하기 위한 로직입니다.
 * 'propofol' 같은 전문 의약품 단어가 나오면 즉시 '수술/마취'로 분류하는 등
 * 반복적인 학습 데이터를 코드로 최적화하여 AI의 실수 가능성을 줄입니다.
 */

const GLOBAL_ITEM_CACHE: Record<string, string> = {
  'metronidazole': 'MEDICINE',
  'propofol': 'SURGERY',
  'x-ray': 'TEST',
  '광견병': 'DIAGNOSIS',
  '중성화': 'SURGERY',
  '생검': 'SURGERY',
  'biopsy': 'SURGERY',
  'ct': 'TEST',
  '초음파': 'TEST',
  '입원': 'HOSPITALIZATION',
  'hospital': 'HOSPITALIZATION',
  'hospitalization': 'HOSPITALIZATION',
  '면회': 'HOSPITALIZATION',
  '수액': 'TREATMENT',
  '지혈제': 'SURGERY',
  '마취': 'SURGERY'
};
const CATEGORIES = [
  { id: 'FOOD', label: '사료·간식', icon: <Utensils className="w-5 h-5" />, color: 'bg-[#F8FAF9] text-[#12B886]' },
  { id: 'MEDICAL', label: '병원비', icon: <Stethoscope className="w-5 h-5" />, color: 'bg-[#F8FAF9] text-[#12B886]' },
  { id: 'GROOMING', label: '미용·용품', icon: <Scissors className="w-5 h-5" />, color: 'bg-[#F8FAF9] text-[#12B886]' },
  { id: 'INSURANCE', label: '보험료', icon: <ShieldCheck className="w-5 h-5" />, color: 'bg-[#F8FAF9] text-[#12B886]' },
  { id: 'OTHER', label: '기타', icon: <Tag className="w-5 h-5" />, color: 'bg-[#F8FAF9] text-[#12B886]' },
];


export default function ManualInput() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const { user } = useAuth();
  const isAnonymous = user && 'isAnonymous' in user ? (user as any).isAnonymous : false;
  const { showToast } = useToast();
  const { ocrUsedToday, ocrSoftLimit, isOCRLimitReached, incrementOCR, isPro, togglePro } = useUsage();

  const [showOcrLimitModal, setShowOcrLimitModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showInsight, setShowInsight] = useState(false);
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  const [title, setTitle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('신용카드');
  const [amount, setAmount] = useState(''); // finalPaidAmount
  const [originalTotalAmount, setOriginalTotalAmount] = useState('');
  const [totalDiscountAmount, setTotalDiscountAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('FOOD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [registrationMethod, setRegistrationMethod] = useState<'MANUAL' | 'OCR' | 'GALLERY' | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStep, setOcrStep] = useState<'READING' | 'CLASSIFYING' | 'VALIDATING' | 'REEXAMINING'>('READING');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string>('');
  const [storagePath, setStoragePath] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [discountDiff, setDiscountDiff] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<string>('NEEDS_REVIEW');
  const [correctionMethod, setCorrectionMethod] = useState<'ai' | 'manual' | 'suggested_fix'>('ai');
  const [medicalDetails, setMedicalDetails] = useState<{
    diagnosis?: number;
    test?: number;
    treatment?: number;
    hospitalization?: number;
    surgery?: number;
    medicine?: number;
    food?: number;
    supplies?: number;
    grooming?: number;
    other?: number;
  } | null>(null);
  const [medicalDiscounts, setMedicalDiscounts] = useState<{
    diagnosis?: number;
    test?: number;
    treatment?: number;
    hospitalization?: number;
    surgery?: number;
    medicine?: number;
    food?: number;
    supplies?: number;
    grooming?: number;
    other?: number;
  } | null>(null);
  const [optimizationMetadata, setOptimizationMetadata] = useState<any>(null);
  const [optimizedImageBase64, setOptimizedImageBase64] = useState<string | null>(null);
  const [carePeriod, setCarePeriod] = useState<number>(30);
  const [nextCareDate, setNextCareDate] = useState<string>('');
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [medicationData, setMedicationData] = useState({ frequency: 2, duration: 3, startDate: new Date().toISOString().slice(0, 10) });
  const [avgConfidence, setAvgConfidence] = useState(0);
  const [isAbnormalDistribution, setIsAbnormalDistribution] = useState(false);
  const [showRetryWithOriginal, setShowRetryWithOriginal] = useState(false);
  const [isScheduleMode, setIsScheduleMode] = useState(location.state?.mode === 'SCHEDULE');
  const [scheduleType, setScheduleType] = useState<'VACCINATION' | 'CHECKUP' | 'GROOMING' | 'OTHER'>('VACCINATION');
  const [calculatedSum, setCalculatedSum] = useState(0);
  const [analysisDiff, setAnalysisDiff] = useState(0);
  const [analysisDuration, setAnalysisDuration] = useState(0);
  const [showVerification, setShowVerification] = useState(false);
  const [autoOcrAttempted, setAutoOcrAttempted] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [showPMFSurvey, setShowPMFSurvey] = useState(false);
  const [isGlobalDiscount, setIsGlobalDiscount] = useState(false);
  const [taxMode, setTaxMode] = useState<string>('NO_TAX_SUMMARY');
  const [taxInfo, setTaxInfo] = useState<{
    taxableAmount: number;
    taxFreeAmount: number;
    vatAmount: number;
  } | null>(null);
  const [analysisError, setAnalysisError] = useState<{
    stage: string;
    code: string;
    message: string;
    debugMessage?: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // [영수증 검증 및 정산 로직 개선]
  const itemTotal = selectedCategory === 'MEDICAL' && medicalDetails
    ? Object.values(medicalDetails).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
    : 0;
  const finalAmount = Number(amount) || 0;
  const totalDiscount = Number(totalDiscountAmount) || 0;
  const normalizedDiscount = totalDiscount > 0 ? -totalDiscount : totalDiscount;
  const expectedFinalAmount = itemTotal + normalizedDiscount;
  const difference = finalAmount - expectedFinalAmount;
  const amountMatched = Math.abs(difference) <= 100;

  const [debugClickCount, setDebugClickCount] = useState(0);
  const [analysisElapsedSec, setAnalysisElapsedSec] = useState(0);

  useEffect(() => {
    if (!ocrLoading) {
      setAnalysisElapsedSec(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [ocrLoading]);

  const getAnalysisTimeMessage = (seconds: number): string => {
    if (seconds < 30) {
      return '보통 10~30초 정도 걸릴 수 있어요.';
    }
    if (seconds < 60) {
      return '분석이 조금 길어지고 있어요. 잠시만 기다려 주세요.';
    }
    return '분석이 지연되고 있어요. 수기 입력으로 계속할 수도 있습니다.';
  };

  useEffect(() => {
    if (showInsight || showVerification || ocrLoading || showPMFSurvey) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [showInsight, showVerification, ocrLoading, showPMFSurvey]);

  const [debugToggling, setDebugToggling] = useState(false);

  const toggleDebugMode = () => {
    if (debugToggling) return;
    setDebugToggling(true);
    
    const current = localStorage.getItem('PETLOG_DEBUG') === 'true';
    localStorage.setItem('PETLOG_DEBUG', current ? 'false' : 'true');
    showToast(`디버그 모드가 ${!current ? '활성화' : '비활성화'}되었습니다.`, 'info');
    
    // 1초 후 새로고침하여 확실히 반영
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // [v2.7.0] 파일 선택창 자동 호출 로직 제거 (브라우저 정책 준수)
  useEffect(() => {
    if (location.state?.autoStartOCR && !editId && !autoOcrAttempted) {
      // 자동 시작이 필요한 경우, 사용자 클릭을 유도하는 토스트나 안내를 표시할 수 있음
      // 현재는 브라우저 보안 경고 방지를 위해 자동 클릭 로직만 제거
      setAutoOcrAttempted(true);
    }
  }, [location.state, editId, autoOcrAttempted]);

  // 파일명 안전하게 변환 (공백/특수문자 제거)
  const getSafeFilename = (filename: string): string => {
    return filename.replace(/[^a-zA-Z0-9.가-힣]/g, '_');
  };

  // [핵심 로직] 파일을 처리하는 공통 함수
  const processFile = async (file: File, skipCache: boolean = false) => {
    if (ocrLoading) return;
    
    if (!user || isAnonymous) {
      showToast('AI 분석을 위해 로그인이 필요합니다.', 'warning');
      navigate('/login');
      return;
    }

    if (isOCRLimitReached && !isPro) {
      setShowOcrLimitModal(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setRegistrationMethod('OCR');
    setOcrLoading(true);
    setAnalysisError(null);
    setCurrentFile(file);
    setShowInsight(false);
    showToast('영수증을 분석하고 있습니다...', 'info');

    try {
      logSystem({
        level: 'INFO',
        event: 'OCR_START',
        user: user.uid,
        data: { fileName: file.name, fileSize: file.size, skipCache }
      });
    } catch (e) {
      console.warn('Logging skipped:', e);
    }

    // [v2.5.2] Firebase Storage 업로드 자동화
    try {
      setIsUploading(true);
      const timestamp = Date.now();
      const safeName = getSafeFilename(file.name);
      const path = `receipts/${user.uid}/${timestamp}_${safeName}`;
      const storageRef = ref(storage, path);
      
      if (isPetLogDebug()) {
        console.log('[Storage Debug]', {
          uid: user.uid,
          path: path,
          bucket: storage.app.options.storageBucket
        });
      }
      
      if (isPetLogDebug()) {
        console.error('[Storage Debug BEFORE upload]', JSON.stringify({
          authUid: auth.currentUser?.uid,
          contextUserUid: user?.uid,
          storagePath: path,
          bucket: storage.app.options.storageBucket,
          projectId: storage.app.options.projectId,
        }, null, 2));
      }

      // [v2.6.0] 업로드 전 토큰 갱신 및 유효성 검사
      if (!auth.currentUser) {
        throw new Error('Storage upload blocked: auth.currentUser is null');
      }
      await auth.currentUser.getIdToken(true);
      
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      
      setReceiptImageUrl(downloadUrl);
      setStoragePath(path);
      if (isPetLogDebug()) console.log('[Storage] Upload success:', path);
    } catch (uploadError) {
      console.error('[Storage] Upload failed:', uploadError);
      // 업로드 실패가 OCR 분석을 방해하지 않도록 함
    } finally {
      setIsUploading(false);
    }

    let currentStage = 'INIT';
    try {
      setOcrStep('READING');
      currentStage = 'OPTIMIZATION';
      const { blob: analysisBlob, metadata } = await createAnalysisImage(file);
      const base64 = await blobToBase64(analysisBlob);
      
      setOptimizationMetadata(metadata);
      setOptimizedImageBase64(base64);
      
      currentStage = 'HASHING';
      const encoder = new TextEncoder();
      const data = encoder.encode(base64);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      currentStage = 'CACHE_CHECK';
      let result: any = null;
      if (!skipCache && !isPetLogDebug()) {
        try {
          const cacheDoc = await getDoc(doc(db, 'receipt_cache', `${user.uid}_${imageHash}`));
          if (cacheDoc.exists()) {
            if (isPetLogDebug()) console.log('[PetLog QA] Cache Hit: Using previous analysis result');
            result = cacheDoc.data().result;
            // 캐시 히트 시에는 사용량 카운트하지 않음 (서버 요청 미발생)
          }
        } catch (cacheError: any) {
          if (isPetLogDebug()) console.warn('Cache read bypassed:', cacheError);
        }
      }

      if (!result) {
        if (isPetLogDebug()) console.log('[PetLog QA] Cache Miss or Debug Mode: Requesting new AI analysis');
        incrementOCR();
        const startTime = Date.now();
        currentStage = 'GEMINI_ANALYSIS';
        result = await analyzeReceipt({
          image: base64,
          mimeType: analysisBlob.type || file.type || 'image/jpeg',
          fileName: file.name || 'receipt.jpg',
          userId: user.uid,
          metadata: metadata
        });
        setAnalysisDuration(Date.now() - startTime);
        const rawResult = { ...result };
        
        currentStage = 'REEXAMINATION';
        const tDiscount_ai = Number(result.totalDiscount) || 0;
        const origTotal_ai = Number(result.originalTotalAmount) || 0;
        const totalAmount_ai = getTransactionAmount(result);
        const initialLineItems = [...(result.lineItems || [])];
        const initialLineSum = initialLineItems.reduce((sum: number, item: any) => sum + (Number(item.originalAmount) || 0), 0);
        const beforeOriginalDiff = origTotal_ai - initialLineSum;

        if (origTotal_ai > 0 && beforeOriginalDiff > 100000 && beforeOriginalDiff / origTotal_ai > 0.05) {
          setOcrStep('REEXAMINING');
          const reexamResult = await reexamineReceipt(base64, result, { originalDiff: beforeOriginalDiff, finalDiff: totalAmount_ai - (initialLineSum - tDiscount_ai) });
          if (reexamResult.missingLineCandidates && reexamResult.missingLineCandidates.length > 0) {
            let acceptedCount = 0;
            let currentLineItems = [...initialLineItems];
            let currentAbsDiff = Math.abs(beforeOriginalDiff);
            reexamResult.missingLineCandidates.forEach((candidate: any) => {
              const cOrig = Number(candidate.originalAmount) || 0;
              const isDuplicate = currentLineItems.some((existing: any) => 
                (safeIncludes(existing?.name, safeText(candidate?.name)) || safeIncludes(candidate?.name, safeText(existing?.name))) && Math.abs((Number(existing.originalAmount) || 0) - cOrig) < 100
              );
              if (!isDuplicate) {
                const potentialItems = [...currentLineItems, { ...candidate, source: 'reexamine' }];
                const potentialSum = potentialItems.reduce((sum, item) => sum + (Number(item.originalAmount) || 0), 0);
                if (potentialSum <= origTotal_ai + 10) {
                  currentLineItems = potentialItems;
                  currentAbsDiff = Math.abs(origTotal_ai - potentialSum);
                  acceptedCount++;
                }
              }
            });
            if (acceptedCount > 0) {
              result.lineItems = currentLineItems;
              result.mergeApplied = true;
            }
          }
        }
        currentStage = 'CACHE_SAVE';
        try {
          // Overwrite instead of merge to ensure ownerUid is properly set on existing documents
          await setDoc(doc(db, 'receipt_cache', `${user.uid}_${imageHash}`), {
            result: rawResult,
            ownerUid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e: any) { 
          if (isPetLogDebug()) {
            console.warn('[PetLog QA] Cache write failed (Debug Mode):', e);
          } else {
            console.warn('Cache write failed');
          }
        }
      }

      currentStage = 'VALIDATION_PREP';
      const engine = new MedicalAnalysisEngine();
      const finalDetailsMap: Record<string, number> = { diagnosis: 0, test: 0, treatment: 0, hospitalization: 0, surgery: 0, medicine: 0, food: 0, supplies: 0, grooming: 0, other: 0 };
      const finalDiscountsMap: Record<string, number> = { diagnosis: 0, test: 0, treatment: 0, hospitalization: 0, surgery: 0, medicine: 0, food: 0, supplies: 0, grooming: 0, other: 0 };
      let sumOriginal = 0;
      let aiDiscountSum = 0;

      currentStage = 'ENGINE_ANALYSIS';
      if (result.lineItems && Array.isArray(result.lineItems)) {
        const analysisResults = engine.analyze(result.lineItems);
        result.lineItems.forEach((item: any, idx: number) => {
          if (!item.isMetaLine) {
            const analysis = analysisResults[idx];
            let category = 'other';
            const aiCat = safeText(item?.category).toUpperCase();
            if (aiCat === 'FOOD') category = 'food';
            else if (aiCat === 'SUPPLIES' || aiCat === 'TOY') category = 'supplies';
            else if (aiCat === 'GROOMING') category = 'grooming';
            else {
              const primary = analysis.primary;
              if (primary === 'DIAGNOSIS') category = 'diagnosis';
              else if (primary === 'TEST') category = 'test';
              else if (primary === 'TREATMENT') category = 'treatment';
              else if (primary === 'SURGERY') category = 'surgery';
              else if (primary === 'MEDICINE') category = 'medicine';
              else if (primary === 'HOSPITALIZATION') category = 'hospitalization';
              else category = 'other';
            }
            
            // QA 디버깅 로그
            if (isPetLogDebug()) console.log(`[Item #${idx}] Name: ${safeText(item?.name)} | AI Cat: ${aiCat} | Final Cat: ${category}`);

            const orig = Number(item.originalAmount) || 0;
            const disc = Number(item.discountAmount) || 0;
            const fin = Number(item.finalAmount) || 0;

            finalDetailsMap[category] += fin;
            finalDiscountsMap[category] += disc;
            sumOriginal += orig;
            aiDiscountSum += disc;
          }
        });
      }

      const finalDetails = {
        diagnosis: finalDetailsMap['diagnosis'] || 0,
        test: finalDetailsMap['test'] || 0,
        treatment: finalDetailsMap['treatment'] || 0,
        hospitalization: finalDetailsMap['hospitalization'] || 0,
        surgery: finalDetailsMap['surgery'] || 0,
        medicine: finalDetailsMap['medicine'] || 0,
        food: finalDetailsMap['food'] || 0,
        supplies: finalDetailsMap['supplies'] || 0,
        grooming: finalDetailsMap['grooming'] || 0,
        other: finalDetailsMap['other'] || 0
      };

      const finalDiscounts = {
        diagnosis: finalDiscountsMap['diagnosis'] || 0,
        test: finalDiscountsMap['test'] || 0,
        treatment: finalDiscountsMap['treatment'] || 0,
        hospitalization: finalDiscountsMap['hospitalization'] || 0,
        surgery: finalDiscountsMap['surgery'] || 0,
        medicine: finalDiscountsMap['medicine'] || 0,
        food: finalDiscountsMap['food'] || 0,
        supplies: finalDiscountsMap['supplies'] || 0,
        grooming: finalDiscountsMap['grooming'] || 0,
        other: finalDiscountsMap['other'] || 0
      };

      const detailsSum = Object.values(finalDetails).reduce((a, b) => a + b, 0);
      const discountSum = Object.values(finalDiscounts).reduce((a, b) => a + b, 0);

      const totalAmount_ai = getTransactionAmount(result);
      const origTotal_ai = Number(result.originalTotalAmount) || totalAmount_ai;
      const tDiscount_ai = Number(result.totalDiscount) || 0;
      const taxModeStr = result.taxAmount > 0 ? 'HAS_TAX' : 'NO_TAX_SUMMARY';

      const currentTotal = totalAmount_ai;
      const currentOrigTotal = origTotal_ai;
      const currentTDiscount = tDiscount_ai;

      const priceDiff = currentTotal - detailsSum;
      const dDiff = currentTDiscount - discountSum;
      
      // [QA 핵심] 원가(Original Amount) 합산 검증
      const extractedOriginalSum = detailsSum + discountSum;
      const originalDiff = currentOrigTotal - extractedOriginalSum;

      // [PetLog QA Logic] 실패 유형 자동 판별 (Failure Type Candidate)
      let failureType = 'NONE';
      if (priceDiff !== 0 || dDiff !== 0 || Math.abs(originalDiff) > 1000) {
        const itemCount = result.lineItems?.length || 0;
        const avgConf = (result.imageQuality?.score || 80) / 100;

        if (avgConf < 0.6) {
          failureType = 'LOW_CONFIDENCE';
        } else if (originalDiff < -1000 || priceDiff < -1000) {
          failureType = result.mergeApplied ? 'SAFE_MERGE_OVERSHOOT' : 'EXTRACTION_OVERREAD_ERROR';
        } else if (Math.abs(originalDiff) > 1000) {
          failureType = 'EXTRACTION_AMOUNT_ERROR'; // 분류보다 추출 누락을 우선 판정
        } else if (itemCount < 10 && Math.abs(priceDiff) > 50000) {
          failureType = 'EXTRACTION_MISSING_LINE';
        } else if (taxModeStr === 'NO_TAX_SUMMARY' && (result.taxAmount > 0 || result.taxableSubtotal > 0)) {
          failureType = 'TAX_MODE_ERROR';
        } else if (Math.abs(priceDiff) > 0 && Math.abs(priceDiff) <= 10) {
          failureType = 'GLOBAL_DISCOUNT_ALLOCATION_ERROR';
        } else if (Math.abs(dDiff) > 1000 && Math.abs(priceDiff) < 1000) {
          failureType = 'DISCOUNT_MAPPING_ERROR';
        } else if (Math.abs(priceDiff) > 1000) {
          failureType = 'CLASSIFICATION_ERROR';
        } else {
          failureType = 'TOTAL_SELECTION_ERROR';
        }
      }

      // [PetLog QA Logic] 최종 정산 결과 로깅
      if (isPetLogDebug()) {
        console.log('[PetLog QA] --- Analysis Summary ---');
        console.log(`- Original Total: ${currentOrigTotal} | Extracted Sum: ${extractedOriginalSum} | Original Diff: ${originalDiff}`);
        console.log(`- Final Paid: ${currentTotal} | Category Sum: ${detailsSum} | Price Diff: ${priceDiff}`);
        console.log(`- Total Discount: ${currentTDiscount} | Category Discount Sum: ${discountSum} | Discount Diff: ${dDiff}`);
        console.log(`- Failure Type: ${failureType}`);
        console.log(`- Tax Mode: ${taxModeStr} | Extraction: ${result.lineItems?.length || 0} items`);
      }

      setCalculatedSum(detailsSum);
      setAnalysisDiff(priceDiff);
      setDiscountDiff(dDiff);

      const mappedCategory = safeIncludes(result?.category || 'OTHER', 'MEDIC') ? 'MEDICAL' : safeText(result?.category || 'OTHER').toUpperCase();
      
      const coverageRatio = currentTotal > 0 ? detailsSum / currentTotal : 0;
      let verificationStatus = 'NEEDS_REVIEW';

      // GLOBAL_DISCOUNT 모드 상태 업데이트 (UI 표시용)
      setIsGlobalDiscount(failureType === 'GLOBAL_DISCOUNT_ALLOCATION_ERROR' || (currentTDiscount > 0 && aiDiscountSum === 0));

      if (currentTotal <= 0) {
        setAnalysisError({
          stage: 'VALIDATION',
          code: 'ZERO_AMOUNT',
          message: '영수증에서 결제 금액을 찾을 수 없습니다.',
          debugMessage: JSON.stringify(result)
        });
        setOcrLoading(false);
        return; // 중단
      } else if (mappedCategory === 'MEDICAL') {
        // [신규] TEST/SURGERY 경계 모호성 탐지
        const testKeywords = ['ct', '검사', '의뢰', '조직병리', 'lab', '판독'];
        const hasTestInSurgery = result.lineItems?.some((item: any) => {
          const name = safeText(item?.name).toLowerCase();
          const itemRes = engine.analyze([{ name: item?.name }])[0];
          return itemRes.primary === 'SURGERY' && testKeywords.some(kw => safeIncludes(name, kw));
        });
        
        const isAmbiguous = (Number(finalDetails.surgery) > Number(finalDetails.test) * 1.2) && hasTestInSurgery;

        if (Math.abs(priceDiff) <= 1 && Math.abs(dDiff) <= 1) {
          if (finalDetails.other > 0) {
            verificationStatus = 'REVIEW_RECOMMENDED';
          } else if (isAmbiguous) {
            verificationStatus = 'REVIEW_RECOMMENDED';
          } else {
            verificationStatus = 'VERIFIED';
          }
        } else {
          verificationStatus = 'NEEDS_REVIEW';
          if (coverageRatio < 0.9) {
            showToast('일부 항목이 누락되었습니다. 합계를 확인해주세요!', 'warning');
          }
        }
        
        // ocrResult에 상태 전달을 위해 result 객체 보강
        result.isAmbiguous = isAmbiguous;
      } else {
        verificationStatus = 'VERIFIED'; // 일반 영수증은 총액만 있으면 일단 PASS 처리
      }

      if (isPetLogDebug()) console.log(`[PetLog Pipeline] Status: ${verificationStatus}, FailureType: ${failureType}, Category: ${mappedCategory}`);

      const avgConf = result.imageQuality?.score || 80;
      const avgConfValue = avgConf / 100;
      setAvgConfidence(avgConfValue);

      // [PetLog QA Logic] 분석 결과의 신뢰도가 낮거나 합계 검증 실패 시 원본 재분석 옵션 활성화 구조 준비
      if (avgConfValue < 0.6 || failureType !== 'NONE' || verificationStatus === 'ANALYSIS_FAILED') {
        setShowRetryWithOriginal(true);
      }

      // [PetLog QA Logic] 최종 방어 필터: 음수 할인이 포함된 항목이 있다면 강제로 제거
      if (result.lineItems && Array.isArray(result.lineItems)) {
        const cleanLines = result.lineItems.filter((item: any) => (Number(item.discountAmount) || 0) >= 0);
        if (cleanLines.length !== result.lineItems.length) {
          if (isPetLogDebug()) console.warn(`[PetLog QA] Removed ${result.lineItems.length - cleanLines.length} invalid items with negative discounts.`);
          result.lineItems = cleanLines;
        }
      }

      setOcrResult({
        ...result,
        medicalDetails: finalDetails,
        medicalDiscounts: finalDiscounts,
        category: mappedCategory,
        calculatedTotal: detailsSum,
        diff: priceDiff,
        discountDiff: dDiff,
        status: verificationStatus,
        failureType: failureType,
        rawLineItemCount: result.lineItems?.length || 0,
        engineVersion: "3.1.0-line-item"
      });

      setTitle(result.merchant || '');
      setAmount(currentTotal.toString());
      setOriginalTotalAmount(currentOrigTotal.toString());
      setTotalDiscountAmount(currentTDiscount.toString());
      setTaxInfo(result.taxInfo || null);
      setSelectedCategory(mappedCategory);
      
      const isValidDate = result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date);
      setDate(isValidDate ? result.date : new Date().toISOString().split('T')[0]);
      
      setMedicalDetails(finalDetails);
      setMedicalDiscounts(finalDiscounts);
      setVerificationStatus(verificationStatus);
      setCorrectionMethod('ai');

      // [신규] 이미지 품질 체크 (흐릿함 방지)
      if (result.imageQuality && result.imageQuality.score < 70) {
        setShowQualityWarning(true);
      } else {
        // 모든 영수증 분석 결과를 확인 화면으로 이동
        setShowVerification(true);
      }

      // incrementOCR() call moved before analyzeReceipt

      try {
        logSystem({
          level: verificationStatus === 'VERIFIED' ? 'SUCCESS' : 'WARN',
          event: 'OCR_ANALYSIS_COMPLETED',
          user: user.uid,
          data: {
            merchant: result.merchant,
            amount: currentTotal,
            origTotal: currentOrigTotal,
            extractedOriginalSum,
            originalDiff,
            priceDiff,
            dDiff,
            failureType,
            status: verificationStatus,
            itemCount: result.lineItems?.length || 0,
            engineVersion: '3.0.0-line-item'
          }
        });
      } catch (logError) {
        console.warn('Logging skipped:', logError);
      }
    } catch (error: any) {
      setAnalysisError({
        stage: currentStage,
        code: error.code || 'UNKNOWN',
        message: '영수증 분석 중 오류가 발생했습니다.',
        debugMessage: error.message || String(error)
      });
      
      try {
        logSystem({
          level: 'ERROR',
          event: 'OCR_FAILED',
          user: user.uid,
          data: { error: error.message, stage: currentStage, errorStack: error.stack }
        });
      } catch (logErr) {
        console.warn('Logging skipped:', logErr);
      }
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // [메인 핸들러] 영수증 사진을 선택했을 때 실행
  const handleOCR = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // [재시도 핸들러] 실패 시 기존 파일로 다시 시도
  const handleRetry = () => {
    if (ocrLoading) return; // 중복 요청 방지
    if (currentFile) {
      processFile(currentFile, true); // Retry bypasses cache
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  useEffect(() => {
    if (editId && user) {
      const fetchTransaction = async () => {
        setFetching(true);
        try {
          // 기존 내역 수정을 위해 파이어베이스에서 데이터를 가져옵니다.
          const docRef = doc(db, 'users', user.uid, 'transactions', editId);
          console.log('Fetching transaction:', docRef.path);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const currentAmt = getTransactionAmount(data);
            setAmount(currentAmt.toString());
            setOriginalTotalAmount(data.originalTotalAmount?.toString() || currentAmt.toString());
            setTotalDiscountAmount(data.totalDiscountAmount?.toString() || '0');
            setSelectedCategory(data.category || 'FOOD');
            setDate(data.date || new Date().toISOString().split('T')[0]);
            setMemo(data.memo || '');
            setTitle(data.title || '');
            setPaymentMethod(data.paymentMethod || '신용카드');
            if (data.petId) setSelectedPetId(data.petId);
            if (data.medicalDetails) setMedicalDetails(data.medicalDetails);
          } else {
            console.warn('Transaction not found:', editId);
            showToast('존재하지 않는 내역입니다.', 'error');
            navigate('/home');
          }
        } catch (error: any) {
          console.error('Permission/Fetch Error:', {
            message: error.message,
            uid: user.uid,
            editId: editId
          });
          showToast('내역 접근 권한이 없거나 불러오기에 실패했습니다.', 'error');
          navigate('/home');
        } finally {
          setFetching(false);
        }
      };
      fetchTransaction();
    }
  }, [editId, user]);

  useEffect(() => {
    if (!user) return;

    // 등록된 반려동물 목록을 실시간으로 가져옵니다.
    const q = query(collection(db, 'users', user.uid, 'pets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPets: any[] = [];
      snapshot.forEach(doc => fetchedPets.push({ id: doc.id, ...doc.data() }));
      setPets(fetchedPets);

      // 초기 선택 (첫 번째 펫)
      if (fetchedPets.length > 0 && !selectedPetId && !editId) {
        setSelectedPetId(fetchedPets[0].id);
      }
    }, (err) => {
      console.error('Pets Fetch Error:', err);
    });

    return () => unsubscribe();
  }, [user, editId]);

  /**
   * [데이터 저장 핵심 핸들러]
   * 사용자가 '저장' 버튼을 누를 때 실행되며, 단순 저장을 넘어 
   * 지능형 자동화 로직들이 동시에 실행됩니다.
   */
  const handleSave = async (eOrOptions?: React.MouseEvent | { skipNavigation?: boolean }) => {
    const options = (eOrOptions && 'skipNavigation' in eOrOptions) ? (eOrOptions as { skipNavigation?: boolean }) : {};
    if (!user) return;
    if (!amount || Number(amount) <= 0) {
      showToast('금액을 올바르게 입력해주세요.', 'error');
      return;
    }
    if (!title.trim()) {
      showToast('사용처(결제처)를 입력해주세요.', 'error');
      return;
    }

    if (selectedCategory === 'MEDICAL' && medicalDetails) {
      const safeDetails = medicalDetails || {};
      const isAnyEmpty = Object.values(safeDetails).some(v => v === undefined || v === null || String(v) === '');
      if (isAnyEmpty) {
        showToast('모든 필드를 입력해주세요.', 'error');
        return;
      }

      if (!amountMatched) {
        showToast('AI가 계산한 항목 합계와 최종 결제금액이 일치하지 않습니다. 영수증 금액을 직접 확인한 뒤 저장해 주세요.', 'warning');
      }
    }

    setLoading(true);
    try {
      let petIdToUse = selectedPetId;

      /**
       * 1. [지능형 자동 등록] 새로운 반려동물 감지
       * 영수증에서 새로운 반려동물 이름이 발견되면, 별도의 등록 절차 없이 
       * 즉시 임시 프로필을 생성하여 사용자 경험을 극대화합니다.
       */
      const safeAmount = normalizeAmount(amount || 0);


      if (ocrResult?.petName && !editId) {
        const existingPet = pets.find(p => p.name === ocrResult.petName);
        if (existingPet) {
          petIdToUse = existingPet.id;
        } else {
          console.log('Registering new pet found in receipt:', ocrResult.petName);
          const newPetRef = await addDoc(collection(db, 'users', user.uid, 'pets'), {
            name: ocrResult.petName,
            type: 'DOG',
            createdAt: serverTimestamp(),
            isAutoRegistered: true
          });
          petIdToUse = newPetRef.id;
          showToast(`새로운 가족 '${ocrResult.petName}'(이)가 등록되었습니다!`, 'success');
        }
      }

      /**
       * 2. [AI 피드백 루프] 데이터 고도화 수집
       * AI의 분석 결과와 사용자의 최종 수정본을 비교하여 저장합니다.
       * 나중에 이 데이터를 분석하여 AI의 정확도를 더 높이는 학습 자료로 사용합니다.
       */
      if (ocrResult && !editId) {
        const isModified = ocrResult.category !== selectedCategory ||
          JSON.stringify(ocrResult.medicalDetails) !== JSON.stringify(medicalDetails);

        if (isModified) {
          try {
            await addDoc(collection(db, 'ai_feedback'), {
              userId: user.uid,
              originalCategory: ocrResult.category,
              editedCategory: selectedCategory,
              originalDetails: ocrResult.medicalDetails,
              editedDetails: medicalDetails,
              confidence: avgConfidence,
              engineVersion: "2.2.1",
              createdAt: serverTimestamp()
            });
          } catch (e) {
            console.warn('Feedback collection failed:', e);
          }
        }
      }

      if (isPetLogDebug()) {
        console.log('[PetLog DEBUG] ManualInput.handleSave starting...', {
          uid: user.uid,
          petId: petIdToUse,
          category: selectedCategory,
          amount: safeAmount,
          editId: editId
        });
      }

      const transactionData = {
        userId: user.uid,
        petId: petIdToUse,
        amount: safeAmount,
        finalAmount: safeAmount,
        originalTotalAmount: Number(originalTotalAmount) || safeAmount,
        totalDiscountAmount: Number(totalDiscountAmount) || 0,
        category: selectedCategory,
        date: date || new Date().toISOString().slice(0, 10),
        memo: memo,
        title: title.trim() || CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타 지출',
        paymentMethod: paymentMethod,
        type: 'expense',
        medicalDetails: medicalDetails,
        medicalDiscounts: medicalDiscounts,
        receiptImageUrl: receiptImageUrl || '',
        storagePath: storagePath || '',
        hasReceiptImage: !!storagePath,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(), // [v2.5.4] Ensure createdAt is always present
        validation: selectedCategory === 'MEDICAL' ? {
          amountMatched,
          itemTotal,
          finalAmount,
          totalDiscount: normalizedDiscount,
          expectedFinalAmount,
          difference,
          userConfirmed: true,
          userConfirmedDespiteAmountMismatch: !amountMatched,
          confirmedAt: new Date().toISOString()
        } : null,
        // [파이프라인 메타데이터 v2.2.1] - 나중에 데이터 분석을 위해 저장하는 상세 분석 정보
        analysisMetadata: ocrResult ? {
          isCorrected: correctionMethod !== 'ai',
          correctionMethod: correctionMethod,
          verificationStatus: correctionMethod !== 'ai' ? 'USER_CORRECTED' : verificationStatus,
          original: {
            amount: ocrResult.amount,
            category: ocrResult.category,
            merchant: ocrResult.merchant,
            details: ocrResult.categorySummary
          },
          final: {
            amount: Number(amount),
            category: selectedCategory,
            merchant: title
          },
          calculatedSum: calculatedSum,
          priceDiff: analysisDiff,
          discountDiff: discountDiff,
          confidence: avgConfidence,
          engineVersion: '2.2.1'
        } : null
      };

      let savedReceiptId = editId;
      let isFirstRecord = false;

      if (editId) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editId), transactionData);
      } else {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'transactions'), {
          ...transactionData,
          analysisImageUsed: optimizationMetadata?.analysisImageUsed || false,
          analysisImageMaxDimension: optimizationMetadata?.analysisImageMaxDimension || 2000,
          analysisImageQuality: optimizationMetadata?.analysisImageQuality || 0.85,
          analysisImageOriginalSize: optimizationMetadata?.analysisImageOriginalSize || 0,
          analysisImageOptimizedSize: optimizationMetadata?.analysisImageOptimizedSize || 0,
          compressionRatio: optimizationMetadata?.analysisImageOriginalSize ? (1 - (optimizationMetadata.analysisImageOptimizedSize / optimizationMetadata.analysisImageOriginalSize)) : 0,
          analysisDurationMs: analysisDuration,
          avgConfidence: avgConfidence,
          otherRatio: (Number(amount) > 0) ? (medicalDetails?.other || 0) / Number(amount) : 0,
          totalValidationPassed: ocrResult?.failureType === 'NONE',
          retryWithOriginalShown: showRetryWithOriginal,
          createdAt: serverTimestamp()
        });
        savedReceiptId = docRef.id;
        setLastSavedId(docRef.id);

        if (isPetLogDebug()) {
          console.log('[PetLog DEBUG] Transaction NEWLY saved successfully:', {
            id: docRef.id,
            path: `users/${user.uid}/transactions/${docRef.id}`,
            payload: transactionData
          });
        }

        // [신규] 사료/미용 등 정기 관리 일정 자동 저장
        if ((selectedCategory === 'FOOD' || selectedCategory === 'GROOMING') && nextCareDate) {
          await addDoc(collection(db, 'users', user.uid, 'recurringExpenses'), {
            userId: user.uid,
            petId: petIdToUse,
            type: selectedCategory === 'FOOD' ? 'REPURCHASE' : 'GROOMING',
            itemName: title,
            date: nextCareDate,
            nextDate: nextCareDate,
            period: carePeriod,
            isActive: true,
            createdAt: serverTimestamp(),
            isRead: false
          });
        }

        // [EVENT] 첫 지출 등록 체크 (보상 로직 제거)
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.data();

          if (userData && !userData.hasReceivedFirstBonus) {
            const txQuery = query(collection(db, 'users', user.uid, 'transactions'), limit(2));
            const txSnap = await getDocs(txQuery);

            if (txSnap.size === 1) {
              isFirstRecord = true;
              // 보상 없이 플래그만 업데이트하여 중복 체크 방지
              await updateDoc(userRef, {
                hasReceivedFirstBonus: true
              });
            }
          }
        } catch (e) {
          console.error('Error checking for first transaction:', e);
        }

        // 예산 초과 체크 및 알림 생성 (90% 사용 시 경고)
        try {
          const currentMonth = (date || new Date().toISOString()).slice(0, 7);
          const budgetsQuery = query(collection(db, 'users', user.uid, 'budgets'), where('month', '==', currentMonth));
          const txQuery = query(collection(db, 'users', user.uid, 'transactions'), where('date', '>=', `${currentMonth}-01`), where('date', '<=', `${currentMonth}-31`));

          const [budgetsSnap, txSnap] = await Promise.all([getDocs(budgetsQuery), getDocs(txQuery)]);

          let totalBudget = 0;
          budgetsSnap.forEach(d => totalBudget += d.data().amount);

          let totalSpent = 0;
          (txSnap?.docs ?? []).forEach(d => totalSpent += Number(d.data()?.amount ?? 0));

          if (totalBudget > 0 && totalSpent >= totalBudget * 0.9) {
            await addDoc(collection(db, 'users', user.uid, 'notifications'), {
              title: '예산 주의',
              message: `이번 달 예산의 90% 이상을 사용했습니다. 남은 예산을 확인해보세요!`,
              type: 'WARNING',
              isRead: false,
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error('Error generating notification:', e);
        }
      }

      /**
       * 3. [PetLog v2.4] Training Pipeline 연결
       * 저장이 완료된 후, AI 분석 데이터와 사용자 확정 데이터를 바탕으로 학습 레코드를 생성합니다.
       */
      if (ocrResult && savedReceiptId && verificationStatus !== 'NEEDS_REVIEW' && selectedCategory === 'MEDICAL') {
        try {
          const aiCatSum: CategorySummary = {
            consult: ocrResult.categorySummary?.consult?.amount || 0,
            test: ocrResult.categorySummary?.test?.amount || 0,
            treatment: ocrResult.categorySummary?.treatment?.amount || 0,
            hospitalization: ocrResult.categorySummary?.hospitalization?.amount || 0,
            surgery: ocrResult.categorySummary?.surgery?.amount || 0,
            medicine: ocrResult.categorySummary?.medicine?.amount || 0,
          };

          const aiDiscSum: CategorySummary = {
            consult: ocrResult.categorySummary?.consult?.discount || 0,
            test: ocrResult.categorySummary?.test?.discount || 0,
            treatment: ocrResult.categorySummary?.treatment?.discount || 0,
            hospitalization: ocrResult.categorySummary?.hospitalization?.discount || 0,
            surgery: ocrResult.categorySummary?.surgery?.discount || 0,
            medicine: ocrResult.categorySummary?.medicine?.discount || 0,
          };

          const confCatSum: CategorySummary = {
            consult: Number(medicalDetails?.diagnosis || 0),
            test: Number(medicalDetails?.test || 0),
            treatment: Number(medicalDetails?.treatment || 0),
            hospitalization: Number(medicalDetails?.hospitalization || 0),
            surgery: Number(medicalDetails?.surgery || 0),
            medicine: Number(medicalDetails?.medicine || 0),
          };

          const confDiscSum: CategorySummary = {
            consult: Number(medicalDiscounts?.diagnosis || 0),
            test: Number(medicalDiscounts?.test || 0),
            treatment: Number(medicalDiscounts?.treatment || 0),
            hospitalization: Number(medicalDiscounts?.hospitalization || 0),
            surgery: Number(medicalDiscounts?.surgery || 0),
            medicine: Number(medicalDiscounts?.medicine || 0),
          };

          const trainingRecord = await createTrainingRecord({
            userId: user.uid,
            receiptId: savedReceiptId,
            petId: petIdToUse,
            aiResult: {
              categorySummary: aiCatSum,
              discounts: aiDiscSum,
              paidTotal: ocrResult.amount || 0,
              originalTotal: ocrResult.originalTotalAmount,
              totalDiscount: ocrResult.totalDiscount,
              confidence: avgConfidence,
              statusBeforeUserConfirm: verificationStatus as any,
              lineItems: ocrResult.lineItems
            },
            confirmedResult: {
              categorySummary: confCatSum,
              discounts: confDiscSum,
              paidTotal: Number(amount) || 0,
              originalTotal: Number(originalTotalAmount) || 0,
              totalDiscount: Number(totalDiscountAmount) || 0,
            },
            correctionMethod: correctionMethod,
            finalStatus: correctionMethod === 'ai' ? 'VERIFIED' : 'USER_CORRECTED',
            amountDiffBeforeConfirm: analysisDiff,
            discountDiffBeforeConfirm: discountDiff,
            amountDiffAfterConfirm: 0,
            discountDiffAfterConfirm: 0,
            unknownRatio: (Number(medicalDetails?.other || 0)) / (Number(amount) || 1),
            engineVersion: '2.2.1',
            promptVersion: '2.2.1',
            configVersion: '2.2.1'
          });

          if (trainingRecord) {
            await updateDoc(doc(db, 'users', user.uid, 'transactions', savedReceiptId), {
              trainingRecordId: trainingRecord.trainingId,
              trainingGrade: trainingRecord.quality.grade,
              isUsableForTraining: trainingRecord.quality.isUsableForTraining,
              correctionMethod: trainingRecord.correction.correctionMethod,
              finalStatus: trainingRecord.quality.status
            });
          }
        } catch (pipelineError) {
          console.error('[TrainingPipeline Error] Failed to process training record:', pipelineError);
        }
      }

      try {
        logSystem({
          level: 'SUCCESS',
          event: 'TRANSACTION_SAVED',
          user: user.uid,
          data: {
            category: selectedCategory,
            amount: amount,
            isMedical: selectedCategory === 'MEDICAL',
            hasCorrection: analysisDiff !== 0
          }
        });
      } catch (logE) {
        console.warn('Logging skipped:', logE);
      }

      // [신규] 서비스 만족도 조사 (PMF 테스트) 트리거
      if (user && !isAnonymous && !editId) {
        try {
          const txSnap = await getDocs(query(collection(db, 'users', user.uid, 'transactions'), limit(10)));
          // Check in user's own surveys subcollection to avoid global permission issues
          const surveySnap = await getDocs(query(collection(db, 'users', user.uid, 'surveys'), where('type', '==', 'PMF'), limit(1)));

          if (txSnap.size >= 3 && surveySnap.empty) {
            setShowPMFSurvey(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Log but don't block the user flow for survey errors
          console.warn('PMF survey trigger skipped due to permission or network:', e);
        }
      }

      // [Google Sheet Webhook Integration] - Log beta test results to the Google Sheet
      try {
        const webhookUrl = "https://script.google.com/macros/s/AKfycbx7BbrBuFRCm7reYPtZasr7BeDsk7g1nEVWR77CrtzpxSukkdEV_Mt18eD3Kjb_C8jA/exec";

        let finalQaStatus = 'FAIL';
        if (verificationStatus === 'ANALYSIS_FAILED') {
          finalQaStatus = 'ANALYSIS_FAILED';
        } else if (correctionMethod === 'ai' && analysisDiff === 0 && discountDiff === 0) {
          finalQaStatus = isGlobalDiscount ? 'ESTIMATED_PASS' : 'AUTO_PASS';
        } else if (correctionMethod !== 'ai' && analysisDiff === 0 && discountDiff === 0) {
          finalQaStatus = 'HUMAN_PASS';
        }

        const safeDiscounts = medicalDiscounts || {};
        const safeDetails = medicalDetails || {};

        const payload = {
          testId: `Test-${new Date().getTime().toString().slice(-4)}`,
          date: new Date().toISOString(),
          receiptType: CATEGORIES.find(c => c.id === selectedCategory)?.label || selectedCategory,
          totalAmount: Number(amount) || 0,
          aiTotal: calculatedSum || 0,
          diff: analysisDiff,
          totalDiscount: Number(totalDiscountAmount) || 0,
          aiDiscount: Object.values(safeDiscounts).reduce((a, b) => Number(a) + Number(b), 0),
          dDiff: discountDiff,

          diagnosisAmount: safeDetails.diagnosis || 0,
          diagnosisDiscount: safeDiscounts.diagnosis || 0,
          testAmount: safeDetails.test || 0,
          testDiscount: safeDiscounts.test || 0,
          treatmentAmount: safeDetails.treatment || 0,
          treatmentDiscount: safeDiscounts.treatment || 0,
          hospitalizationAmount: safeDetails.hospitalization || 0,
          hospitalizationDiscount: safeDiscounts.hospitalization || 0,
          surgeryAmount: safeDetails.surgery || 0,
          surgeryDiscount: safeDiscounts.surgery || 0,
          medicineAmount: safeDetails.medicine || 0,
          medicineDiscount: safeDiscounts.medicine || 0,
          foodAmount: safeDetails.food || 0,
          foodDiscount: safeDiscounts.food || 0,
          suppliesAmount: safeDetails.supplies || 0,
          suppliesDiscount: safeDiscounts.supplies || 0,
          groomingAmount: safeDetails.grooming || 0,
          groomingDiscount: safeDiscounts.grooming || 0,
          otherAmount: safeDetails.other || 0,
          otherDiscount: safeDiscounts.other || 0,

          totalMatch: analysisDiff === 0 ? 'O' : 'X',
          discountMatch: discountDiff === 0 ? 'O' : 'X',
          errorCategory: '-',
          userEdited: correctionMethod !== 'ai',
          duration: 0,
          saved: true,
          comment: '-',
          memo: '-',

          verificationStatus: correctionMethod !== 'ai' ? 'USER_CORRECTED' : verificationStatus,
          correctionMethod: correctionMethod,
          engineVersion: 'v2.2.3-beta-stable',
          finalQaStatus: finalQaStatus,
          taxMode: taxMode
        };

        fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).catch(e => console.warn('Webhook silently failed:', e));
      } catch (e) {
        console.warn('Failed to send webhook', e);
      }

      if (options?.skipNavigation) {
        setLoading(false);
        return;
      }

      if (selectedCategory === 'MEDICAL' && !amountMatched) {
        showToast('금액이 완전히 일치하지 않았지만, 사용자 확인 후 저장되었습니다.', 'success');
      }

      if (isPetLogDebug()) {
        console.log('[PetLog DEBUG] ManualInput.handleSave navigation state:', {
          path: '/home',
          recordCompleted: true,
          addedAmount: Number(amount) || 0
        });
      }

      navigate('/home', { 
        state: { 
          recordCompleted: true, 
          addedAmount: Number(amount) || 0,
          categoryLabel: CATEGORIES.find(c => c.id === selectedCategory)?.label || '기타',
          isFirst: isFirstRecord 
        } 
      });
    } catch (error: any) {
      console.error('[ManualInput] Save Failed:', {
        code: error.code || 'unknown',
        message: error.message || String(error),
        userId: user?.uid,
        path: `users/${user?.uid}/transactions`,
        fullError: error
      });
      if (error.code === 'permission-denied') {
        showToast('저장 권한이 없습니다. (DB 규칙 확인 필요)', 'error');
      } else {
        showToast('내역 저장 중 오류가 발생했습니다.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // [PetLog v3.1] normalizeAmount utility is now imported from ../lib/utils

  const handleRecordAction = (type: 'VACCINATION' | 'CHECKUP' | 'MEDICATION' | 'OTHER', defaultTitle: string) => {
    // [v2.6.0] Initialize schedule mode as a draft
    setIsScheduleMode(true);
    setScheduleType(type === 'MEDICATION' ? 'OTHER' : type as any);
    setTitle(defaultTitle);
    setShowInsight(false);
    
    // [Safety] Don't pre-determine date arbitrarily. Use today.
    setDate(new Date().toISOString().split('T')[0]);
    
    // Metadata for tracking/reference
    const metadata = {
      source: 'careInsightCandidate',
      receiptId: lastSavedId || 'N/A',
      normalizedAmount: normalizeAmount(amount),
      petName: pets.find(p => p.id === selectedPetId)?.name || 'N/A'
    };

    if (metadata.normalizedAmount === 0) {
      showToast('금액을 확인해 주세요. 인식된 금액이 없어 0원으로 임시 입력되었습니다.', 'info');
    } else {
      showToast('일정 기록을 시작합니다. 내용을 확인 후 저장해 주세요.', 'info');
    }
  };

  const handleUpdateAndExit = async (target: 'HOME' | 'INPUT') => {
    if (!user) return;
    
    // [v2.6.0] 'INPUT' target (기록으로 남기기) transitions to schedule registration draft mode
    if (target === 'INPUT') {
      setIsScheduleMode(true);
      setScheduleType('OTHER');
      
      // Extract title from sanitized insight if possible, or use fallback
      const firstLine = ocrResult?.careInsight?.split('\n')[0] || '병원 방문 후 관리';
      setTitle(firstLine.length > 20 ? '병원 방문 후 기록' : firstLine);
      
      setShowInsight(false);
      showToast('일정 등록 모드로 전환되었습니다. 내용을 확인해 주세요.', 'info');
      return;
    }

    setLoading(true);
    try {
      const cleanAmount = normalizeAmount(amount);
      
      if (lastSavedId) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', lastSavedId), {
          medicalDetails: medicalDetails,
          updatedAt: serverTimestamp()
        });
      }
      
      navigate('/home', { 
        state: { 
          recordCompleted: true, 
          addedAmount: cleanAmount,
          categoryLabel: '병원비'
        } 
      });
    } catch (e) {
      console.error('Update failed:', e);
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex items-center justify-center min-h-screen">불러오는 중...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      {/* 헤더 */}
      <div className="h-14 flex items-center px-4 bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-[#F2F4F6]">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="flex-1 text-center text-base font-bold mr-8 text-[#191F28]">
          {isScheduleMode ? '일정 등록' : editId ? '기록 수정' : '기록하기'}
        </span>
      </div>

      <div className="px-6 py-8 sm:py-12 landscape:py-6">
        {/* 영수증 OCR을 위한 숨겨진 파일 선택기 */}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleOCR} />

        {/* Registration Method Selection */}
        {!editId && !ocrLoading && !isScheduleMode && (registrationMethod === null || registrationMethod === 'OCR' || registrationMethod === 'GALLERY') && (
          <div className={`${registrationMethod !== null ? 'opacity-50 pointer-events-none' : ''} space-y-12 landscape:space-y-6`}>
            {/* Hero Section */}
            {location.state?.autoStartOCR && !amount && !ocrLoading && (
              <motion.button
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 bg-[#F8FAF9] border border-[#12B886]/20 rounded-2xl flex items-center justify-between group active:scale-95 transition-all mb-8"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#12B886] rounded-xl flex items-center justify-center shadow-lg shadow-[#12B886]/10">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-black text-[#12B886]">영수증 분석 시작하기</p>
                    <p className="text-[11px] text-[#20C997]">자동 팝업이 뜨지 않았다면 클릭하세요</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#12B886]/40 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            )}

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-left pt-6 landscape:pt-2"
            >
              <h2 className="text-[26px] landscape:text-[22px] font-bold text-[#191F28] leading-tight">
                기록 방법을<br className="landscape:hidden" />선택해주세요
              </h2>
              <p className="text-[15px] landscape:text-[13px] font-medium text-[#8B95A1] mt-3 landscape:mt-1">영수증이 있다면 AI가 정보를 자동으로 채워줘요</p>

              {/* 지출 분석 현황 바 */}
              <div className="mt-8 landscape:mt-4 p-5 landscape:p-4 bg-white rounded-[20px] border border-[#F2F4F6]">
                <div className="flex justify-between items-center mb-2.5 landscape:mb-1.5">
                  <span className="text-[13px] landscape:text-[11px] font-semibold text-[#8B95A1]">오늘 AI 분석 가능 횟수</span>
                  <span className="text-[13px] landscape:text-[11px] font-bold text-[#12B886]">{ocrUsedToday}/{ocrSoftLimit}회</span>
                </div>
                <div className="h-1.5 bg-[#F8FAF9] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((ocrUsedToday / ocrSoftLimit) * 100, 100)}%` }}
                    className="h-full bg-[#12B886]"
                  />
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-4">
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => {
                  if (isOCRLimitReached) {
                    setShowOcrLimitModal(true);
                  } else {
                    fileInputRef.current?.setAttribute('capture', 'environment');
                    fileInputRef.current?.click();
                  }
                }}
                className="w-full p-6 landscape:p-4 bg-[#12B886] rounded-[24px] flex items-center gap-5 active:scale-[0.99] transition-all shadow-lg shadow-[#12B886]/10"
              >
                <div className="w-14 h-14 landscape:w-10 landscape:h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
                  <Camera className="w-7 h-7 landscape:w-5 landscape:h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-bold text-[18px] landscape:text-[16px]">영수증 촬영하기</p>
                  <p className="text-white/80 text-[13px] landscape:text-[11px] font-medium mt-0.5">AI가 3초 만에 정리해드려요</p>
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => {
                  if (isOCRLimitReached) {
                    setShowOcrLimitModal(true);
                  } else {
                    fileInputRef.current?.removeAttribute('capture');
                    fileInputRef.current?.click();
                  }
                }}
                className="w-full p-6 landscape:p-4 bg-white border border-[#F2F4F6] rounded-[24px] flex items-center gap-5 active:scale-[0.99] transition-all"
              >
                <div className="w-14 h-14 landscape:w-10 landscape:h-10 bg-[#F8FAF9] rounded-full flex items-center justify-center text-[#12B886]">
                  <ImageIcon className="w-7 h-7 landscape:w-5 landscape:h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-[#191F28] font-bold text-[18px] landscape:text-[16px]">갤러리에서 불러오기</p>
                  <p className="text-[#8B95A1] text-[13px] landscape:text-[11px] font-medium mt-0.5">저장된 영수증 사진 올리기</p>
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setRegistrationMethod('MANUAL')}
                className="w-full p-6 landscape:p-4 bg-white border border-[#F2F4F6] rounded-[24px] flex items-center gap-5 active:scale-[0.99] transition-all"
              >
                <div className="w-14 h-14 landscape:w-10 landscape:h-10 bg-[#F8FAF9] rounded-full flex items-center justify-center text-[#12B886]">
                  <FileText className="w-7 h-7 landscape:w-5 landscape:h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-[#191F28] font-bold text-[18px] landscape:text-[16px]">직접 입력하기</p>
                  <p className="text-[#8B95A1] text-[13px] landscape:text-[11px] font-medium mt-0.5">영수증 없이 내역만 작성하기</p>
                </div>
              </motion.button>
            </div>

            {/* [Closed Beta] AI 기록 가이드 & 개인정보 보호 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-[24px] p-6 landscape:p-4 border border-[#F2F4F6] shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-[#12B886]" />
                <span className="text-[14px] font-bold text-[#191F28]">안전한 베타 테스트를 위한 안내</span>
              </div>
              
              <div className="space-y-5">
                <div className="bg-[#F8FAF9]/30 p-4 rounded-xl border border-[#F2F4F6]">
                  <p className="text-[12px] font-bold text-[#12B886] mb-2 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> 개인정보 보호 안내
                  </p>
                  <p className="text-[11px] text-[#4E5968] leading-relaxed break-keep">
                    영수증 업로드 전, 아래 항목은 <span className="text-[#191F28] font-bold underline">펜으로 가리거나 접어서</span> 촬영해주세요.
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                    {['보호자 이름', '전화번호', '상세 주소', '카드/승인번호'].map(item => (
                      <li key={item} className="text-[10px] text-[#8B95A1] flex items-center gap-1">
                        <div className="w-1 h-1 bg-[#D1D6DB] rounded-full" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <ul className="space-y-3 px-1">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-[#12B886] rounded-full mt-1.5 shrink-0" />
                    <p className="text-[11px] text-[#4E5968] font-medium leading-relaxed">
                      AI 분석 결과는 <span className="font-bold">참고용</span>입니다. 저장 전 반드시 항목과 금액을 확인하고 수정해주세요.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-[#ADB5BD] rounded-full mt-1.5 shrink-0" />
                    <p className="text-[11px] text-[#8B95A1] font-medium leading-relaxed">
                      분석 실패 시 <span className="font-bold">수기 입력</span>을 통해 직접 내역을 작성하실 수 있습니다.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-[#ADB5BD] rounded-full mt-1.5 shrink-0" />
                    <p className="text-[11px] text-[#8B95A1] font-medium leading-relaxed">
                      업로드된 데이터는 베타 테스트 품질 개선 목적으로만 활용되며, 동의 시에만 수집됩니다.
                    </p>
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        )}

        {isScheduleMode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* [v2.6.0] Care Insight Banner */}
            <div className="info-banner mb-8">
              <Sparkles className="w-5 h-5 text-[#12B886] mt-0.5 shrink-0" />
              <p className="text-[13px] text-[#191F28] font-bold leading-relaxed">
                “AI가 기록 후보를 정리했어요. 병원 안내를 기준으로 내용을 확인한 뒤 저장해 주세요.”
              </p>
            </div>

            <div className="text-center pt-4 mb-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#F8FAF9] rounded-3xl mb-6 shadow-sm border border-[#F2F4F6]">
                <Calendar className="w-10 h-10 text-[#12B886]" />
              </div>
              <h2 className="text-2xl font-black text-[#191F28] mb-2">어떤 일정을 등록할까요?</h2>
              <p className="text-sm font-medium text-[#8B95A1]">아이의 소중한 일정을 기록해드려요</p>
            </div>

            {/* Pet Selection (Moved up) */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-[#ADB5BD] mb-4 px-1">반려동물 선택</label>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {pets.length > 0 ? (
                  pets.map((pet) => (
                    <button
                      key={pet.id}
                      onClick={() => setSelectedPetId(pet.id)}
                      className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[70px]"
                    >
                      <PetAvatar 
                        pet={pet} 
                        size="md" 
                        className={`transition-all duration-300 border-2 ${selectedPetId === pet.id ? 'border-[#12B886] ring-4 ring-[#E9FBF5]' : 'border-transparent'}`} 
                      />
                      <span className={`text-[11px] font-bold ${selectedPetId === pet.id ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}>
                        {pet.name}
                      </span>
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => navigate('/pet-registration')}
                    className="flex flex-col items-center gap-2 flex-shrink-0"
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#ADB5BD] flex items-center justify-center text-[#ADB5BD]">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-[#ADB5BD]">아이 등록</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'VACCINATION', label: '예방접종', icon: '💉' },
                { id: 'CHECKUP', label: '건강검진', icon: '🏥' },
                { id: 'GROOMING', label: '미용', icon: '✂️' },
                { id: 'OTHER', label: '기타 일정', icon: '🗓️' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setScheduleType(t.id as any)}
                  className={`p-6 rounded-[24px] border-2 flex flex-col items-center gap-3 transition-all ${scheduleType === t.id ? 'border-[#12B886] bg-[#F8FAF9] shadow-lg shadow-[#12B886]/10' : 'border-[#F2F4F6] bg-white opacity-60'}`}
                >
                  <span className="text-3xl">{t.icon}</span>
                  <span className={`text-sm font-black ${scheduleType === t.id ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-[#ADB5BD] mb-2 px-1">일정 이름</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 광견병 예방접종, 1차 정기검진"
                  className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-[#191F28]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#ADB5BD] mb-2 px-1">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 font-bold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#E9FBF5] box-border"
                />
                <p className="text-[11px] text-orange-500 font-bold mt-2 px-1">
                  “날짜와 시간은 병원에서 안내받은 내용을 기준으로 직접 확인해 주세요.”
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!user || !title) {
                  showToast('일정 이름을 입력해주세요.', 'error');
                  return;
                }
                if (!selectedPetId) {
                  showToast('반려동물을 선택해주세요.', 'error');
                  return;
                }
                setLoading(true);
                try {
                  await addDoc(collection(db, 'users', user.uid, 'recurringExpenses'), {
                    userId: user.uid,
                    type: scheduleType,
                    petId: selectedPetId,
                    title: title,
                    date: date,
                    nextDate: date,
                    isActive: true,
                    createdAt: serverTimestamp(),
                    isRead: false
                  });
                  showToast('일정이 등록되었습니다.', 'success');
                  navigate('/home');
                } catch (e) {
                  showToast('일정 등록 중 오류가 발생했습니다.', 'error');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || !title}
              className="w-full h-15 bg-[#12B886] text-white text-lg font-bold rounded-[24px] shadow-xl shadow-[#E9FBF5] mt-8 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              일정 등록 완료
            </button>
          </motion.div>
        )}

        {(registrationMethod === 'MANUAL' || editId) && !ocrLoading && !isScheduleMode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
            {/* Pet Selection */}
            <div>
              <label className="block text-[15px] font-bold text-[#191F28] mb-4 px-1">기록할 아이</label>
              <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPetId(pet.id)}
                    className="flex flex-col items-center gap-2 flex-shrink-0"
                  >
                    <PetAvatar 
                      pet={pet} 
                      size="md" 
                      className={`transition-all border-2 ${selectedPetId === pet.id ? 'border-[#12B886]' : 'border-transparent'}`} 
                    />
                    <span className={`text-[13px] font-semibold ${selectedPetId === pet.id ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}>
                      {pet.name}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => navigate('/pet-registration')}
                  className="w-14 h-14 rounded-full border-2 border-dashed border-[#F2F4F6] flex items-center justify-center text-[#ADB5BD] bg-white flex-shrink-0"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>



            {/* Manual Form Section */}
            <div className="space-y-8">
              <div>
                <label className="block text-[14px] font-bold text-[#8B95A1] mb-2 px-1">지출 금액</label>
                <div className="relative flex items-baseline gap-1 border-b-2 border-[#F2F4F6] pb-2 focus-within:border-[#12B886] transition-colors">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={amount ? parseInt(amount).toLocaleString() : ''}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full text-[36px] font-bold text-[#191F28] focus:outline-none bg-transparent"
                  />
                  <span className="text-[24px] font-bold text-[#191F28]">원</span>
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-bold text-[#8B95A1] mb-2 px-1">어디에 썼나요?</label>
                <input
                  type="text"
                  value={String(title ?? '')}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 이마트, 하나동물병원"
                  className="w-full h-14 bg-white border border-[#F2F4F6] rounded-2xl px-5 font-semibold text-[#191F28] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-bold text-[#8B95A1] mb-2 px-1">언제 썼나요?</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-14 bg-white border border-[#F2F4F6] rounded-2xl px-5 font-semibold text-[#191F28] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-bold text-[#8B95A1] mb-2 px-1">결제 수단</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-14 bg-white border border-[#F2F4F6] rounded-2xl px-5 font-semibold text-[#191F28] focus:outline-none appearance-none"
                  >
                    <option value="신용카드">신용카드</option>
                    <option value="체크카드">체크카드</option>
                    <option value="현금">현금</option>
                    <option value="페이">페이</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Medical Details */}
            {selectedCategory === 'MEDICAL' && medicalDetails && (
              <div className="bg-white border border-[#F2F4F6] rounded-[20px] p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[#12B886]">
                    <AlertCircle className="w-4 h-4" />
                    <h4 className="text-[13px] font-bold">병원비 상세 분석</h4>
                  </div>
                  {avgConfidence > 0 && (
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
                      <div className={`w-1.5 h-1.5 rounded-full ${amountMatched ? 'bg-green-500' : 'bg-orange-500'}`} />
                      <span className={`text-[11px] font-extrabold ${amountMatched ? 'text-green-600' : 'text-orange-600'}`}>
                        {amountMatched ? '정산 확인 완료' : '불일치 확인'}
                      </span>
                    </div>
                  )}
                </div>

                {isAbnormalDistribution && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-3 items-start"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold text-red-600 leading-relaxed">
                      검사 비용 비중이 비정상적으로 높습니다. (60% 초과)<br />
                      수술이나 처방 항목이 검사로 잘못 분류되었을 수 있으니 확인을 권장드려요.
                    </p>
                  </motion.div>
                )}

                <div className="space-y-3">
                  {[
                    { label: '진료/상담', value: medicalDetails.diagnosis },
                    { label: '검사/진단', value: medicalDetails.test },
                    { label: '처치/주사', value: medicalDetails.treatment },
                    { label: '입원/면회', value: medicalDetails.hospitalization },
                    { label: '수술/마취', value: medicalDetails.surgery },
                    { label: '약제/조제', value: medicalDetails.medicine },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center text-[13px] gap-4">
                      <span className="font-medium text-[#8B95A1] flex-shrink-0">{item.label}</span>
                      <span className="font-bold text-[#191F28] text-right truncate">{(item.value || 0).toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Care Alert */}
            {(selectedCategory === 'FOOD' || selectedCategory === 'GROOMING') && (
              <div className="bg-white border border-[#F2F4F6] rounded-[20px] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-[#12B886]">
                  <Bell className="w-4 h-4" />
                  <h4 className="text-[13px] font-bold">다음 알림</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B95A1] mb-1.5 uppercase">주기 (일)</label>
                    <input
                      type="number"
                      value={carePeriod}
                      onChange={(e) => {
                        const p = Number(e.target.value);
                        setCarePeriod(p);
                        const nd = new Date(date);
                        nd.setDate(nd.getDate() + p);
                        setNextCareDate(nd.toISOString().slice(0, 10));
                      }}
                      className="w-full h-11 bg-white rounded-xl px-4 text-[14px] font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#8B95A1] mb-1.5 uppercase">예정일</label>
                    <input
                      type="date"
                      value={nextCareDate}
                      onChange={(e) => setNextCareDate(e.target.value)}
                      className="w-full h-11 bg-white rounded-xl px-4 text-[14px] font-bold focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Category Grid */}
            <div>
              <label className="block text-[14px] font-bold text-[#8B95A1] mb-4 px-1">카테고리</label>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-[20px] transition-all duration-200 ${selectedCategory === cat.id
                      ? 'bg-white shadow-lg ring-2 ring-[#12B886]'
                      : 'bg-white grayscale opacity-60'
                      }`}
                  >
                    <div className="text-2xl">
                      {cat.icon}
                    </div>
                    <span className={`text-[12px] font-bold ${selectedCategory === cat.id ? 'text-[#12B886]' : 'text-[#8B95A1]'}`}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full app-button-primary disabled:bg-[#ADB5BD] flex items-center justify-center gap-2"
              >
                {loading ? '저장 중...' : (editId ? '수정 완료' : '기록하기')}
              </button>
            </div>
          </motion.div>
        )}

      </div>

      {/* Care Insight Overlay - Beta Record Assistant */}
      <AnimatePresence>
        {showInsight && ocrResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-[#F9FAFB] overflow-y-auto"
          >
            <div className="min-h-screen flex flex-col max-w-[480px] mx-auto bg-[#F9FAFB] pb-80">
              {/* Header */}
              <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => setShowInsight(false)} className="p-2">
                  <ChevronLeft className="w-6 h-6 text-[#191F28]" />
                </button>
                <span className="text-[16px] font-black text-[#191F28]">케어 기록 후보</span>
                <div className="w-10" />
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* 1. Cost Summary */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm border border-gray-50"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-[#E9FBF5] rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#12B886] fill-[#12B886]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-black text-[#12B886]">기록 도우미 리포트</span>
                      <span className="text-[10px] text-[#ADB5BD]">※ 실제 병원 안내를 우선해 주세요</span>
                    </div>
                  </div>
                  
                  <h2 className="text-[28px] font-black text-[#191F28] mb-2">
                    {Number(amount.replace(/[^0-9]/g, '')).toLocaleString()}원
                  </h2>
                  <p className="text-[15px] text-[#8B95A1] font-bold leading-relaxed">
                    {selectedCategory === 'MEDICAL' ? (
                      <>병원 방문 기록 분석 결과예요</>
                    ) : (
                      <>아이를 위한 소중한 소비 기록이에요</>
                    )}
                  </p>
                </motion.div>

                {/* 2. Care Insight Section (Always Shown for MEDICAL) */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm border border-gray-50"
                >
                  {(() => {
                    if (selectedCategory !== 'MEDICAL') return (
                      <div className="p-4 text-center text-[#ADB5BD] text-[14px] font-bold italic">
                        의료 기록 관리 전용 섹션입니다.
                      </div>
                    );

                    // 1. 의료 행위 신호 감지
                    const medicalKeywords = ['약', '조제', '처방', '재진', '방문', '수술', '마취', '봉합', '처치', '입원', '퇴원', '주사', '수액', '회복'];
                    const hasMedicalActionSignal = ocrResult.lineItems?.some((item: any) => 
                      medicalKeywords.some(kw => {
                        const itemName = safeText(item?.name);
                        // categoryEvidence 방어 처리 (문자열, 객체, 배열 대응)
                        let evidenceStr = '';
                        if (item?.reason) evidenceStr = safeText(item.reason);
                        else if (Array.isArray(item?.categoryEvidence)) evidenceStr = item.categoryEvidence.map((e: any) => safeText(e)).join(' ');
                        else if (typeof item?.categoryEvidence === 'object') evidenceStr = JSON.stringify(item.categoryEvidence);
                        else evidenceStr = safeText(item?.categoryEvidence);

                        return safeIncludes(itemName, kw) || safeIncludes(evidenceStr, kw);
                      })
                    ) || medicalKeywords.some(kw => safeIncludes(ocrResult?.merchant, kw));

                    // 2. 신뢰도 및 비율 계산
                    const otherRatio = (Number(medicalDetails?.other || 0)) / (Number(amount.replace(/[^0-9]/g, '')) || 1);
                    const quality = determineTrainingQuality({
                      amountDiffAfterConfirm: analysisDiff,
                      discountDiffAfterConfirm: discountDiff,
                      finalStatus: verificationStatus === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : (correctionMethod === 'ai' ? 'VERIFIED' : 'USER_CORRECTED'),
                      unknownRatio: otherRatio,
                      isSaved: true
                    });
                    const confidence: 'high' | 'medium' | 'low' = quality.grade === 'A' ? 'high' : (quality.grade === 'B' ? 'medium' : 'low');

                    // 3. Gating 상세 로직 (Beta 상시 노출 정책)
                    let displayType: 'full' | 'guide' = (confidence === 'high' && hasMedicalActionSignal && otherRatio <= 0.4) ? 'full' : 'guide';

                    const rawInsight = ocrResult.careInsight || '';
                    const sanitizedInsight = getSafeAiContent(rawInsight);
                    const detectedWord = '';

                    // 4. 동적 가이드 문구 선정
                    const getFallbackInsight = () => {
                      if (sanitizedInsight) return sanitizedInsight;
                      if (hasMedicalActionSignal) return "병원에서 복약 안내를 받았다면 기록해보세요. 다음 방문 일정이 안내되었다면 날짜를 기록해보세요.";
                      if (otherRatio > 0.4) return "회복 체크 안내를 받았다면 병원 안내 내용을 기준으로 메모해보세요. 사용자가 직접 확인 후 저장할 수 있습니다.";
                      return "병원 안내 사항이 있다면 기록으로 남겨보세요. 사용자가 직접 내용을 확인하고 수정할 수 있습니다.";
                    };

                    return (
                      <>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-lg">📝</div>
                            <span className="text-[15px] font-black text-[#191F28]">케어 기록 후보</span>
                          </div>
                          <div className="px-2 py-0.5 bg-gray-100 rounded-md">
                            <span className="text-[10px] font-black text-[#ADB5BD] uppercase tracking-wider">Beta Assist</span>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className={`p-5 rounded-[22px] border ${displayType === 'guide' ? 'bg-gray-50 border-gray-100' : 'bg-white border-[#E9FBF5] shadow-sm'}`}>
                            {displayType === 'guide' && (
                              <div className="flex items-center gap-1.5 mb-3">
                                <Sparkles className="w-3.5 h-3.5 text-[#12B886]" />
                                <span className="text-[11px] font-bold text-[#12B886]">기록 도우미 가이드</span>
                              </div>
                            )}
                            
                            {confidence === 'medium' && displayType === 'full' && (
                              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100/50 flex items-start gap-2 mb-4">
                                <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                <p className="text-[12px] text-orange-600 font-bold leading-relaxed">
                                  “분석 신뢰도가 보통이므로 병원 안내를 기준으로 직접 확인해 주세요.”
                                </p>
                              </div>
                            )}
                            
                            <p className={`${displayType === 'guide' ? 'text-[14px] text-[#4E5968]' : 'text-[16px] text-[#191F28]'} font-bold leading-relaxed break-keep`}>
                              {getFallbackInsight()}
                            </p>
                          </div>
                          
                          <div className="p-4 bg-gray-50 rounded-2xl">
                            <p className="text-[11px] text-[#8B95A1] font-medium leading-relaxed">
                              “이 내용은 진단이나 처방이 아닌 기록 관리용 참고 정보입니다. 정확한 케어 판단은 병원 안내를 따라주세요.”
                            </p>
                          </div>

                          {/* [v2.5.1] Beta Test Debug Info */}
                          {typeof window !== 'undefined' && localStorage.getItem('PETLOG_DEBUG') === 'true' && (
                            <div className="mt-4 p-4 bg-gray-900 rounded-2xl font-mono text-[10px] text-[#ADB5BD] space-y-1">
                              <p className="text-[#12B886]">DEBUG: Care Insight Sanitization</p>
                              <p className="text-pink-400">Raw: {rawInsight}</p>
                              {detectedWord && <p className="text-red-400 font-bold">Detected: {detectedWord}</p>}
                              <p className="text-green-400">Sanitized: {sanitizedInsight}</p>
                              <p>Confidence: {confidence} (Grade: {quality.grade})</p>
                              <p>Medical Signal: {hasMedicalActionSignal ? 'Detected' : 'Not Found'}</p>
                              <p>Other Ratio: {(otherRatio * 100).toFixed(1)}%</p>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </motion.div>

                {/* 3. Action Items */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm border border-gray-50"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-lg">🐾</div>
                    <span className="text-[15px] font-black text-[#191F28]">함께 기록해보세요</span>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const actionItems = [
                        { label: "복약 일정 기록하기", type: 'MEDICATION', title: '복약 알림', icon: '💊' },
                        { label: "다음 방문 일정 기록하기", type: 'CHECKUP', title: '다음 방문 일정', icon: '🏥' },
                        { label: "접종 기록 남기기", type: 'VACCINATION', title: '접종 기록', icon: '💉' },
                        { label: "회복 체크 메모하기", type: 'OTHER', title: '회복 체크 메모', icon: '🗓️' }
                      ];
                      
                      return actionItems.map((item, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => handleRecordAction(item.type as any, item.title)}
                          className="w-full flex items-center justify-between p-5 bg-[#F9FAFB] hover:bg-[#F8FAF9] rounded-[24px] transition-all group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-[14px] font-black text-[#4E5968]">{item.label}</span>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <ChevronRight className="w-4 h-4 text-[#8B95A1] group-hover:text-[#3182f6] transition-colors" />
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                </motion.div>

                {/* 5. Detailed Breakdown */}
                {selectedCategory === 'MEDICAL' && medicalDetails && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm border border-gray-50 mt-6"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-lg">📊</div>
                        <span className="text-[15px] font-black text-[#191F28]">상세 분석 데이터</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {[
                        { key: 'diagnosis', label: '진료/상담' },
                        { key: 'test', label: '검사/진단' },
                        { key: 'treatment', label: '처치/주사' },
                        { key: 'hospitalization', label: '입원/면회' },
                        { key: 'surgery', label: '수술/마취' },
                        { key: 'medicine', label: '약제/조제' },
                      ].map((item) => (
                        <div key={item.key} className="flex flex-col gap-1 group">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#ADB5BD] text-[14px]">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={medicalDetails[item.key as keyof typeof medicalDetails] ? medicalDetails[item.key as keyof typeof medicalDetails]!.toLocaleString() : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : parseInt(e.target.value.replace(/[^0-9]/g, ''));
                                  setMedicalDetails(prev => prev ? { ...prev, [item.key]: val } : null);
                                  setCorrectionMethod('manual');
                                }}
                                placeholder="0"
                                className="w-24 text-right font-black text-[#191F28] text-[15px] bg-transparent focus:outline-none"
                              />
                              <span className="text-[14px] font-black text-[#ADB5BD]">원</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* 6. Footer Button (Navigate to Input) */}
            <div className="fixed bottom-0 left-0 right-0 z-[160] pointer-events-none">
              <div className="max-w-[480px] mx-auto p-6 sm:p-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-auto space-y-4 pb-8 sm:pb-10">
                <p className="text-[10px] text-[#ADB5BD] text-center leading-relaxed break-keep px-4 pb-2">
                  AI 분석 결과는 영수증 기록 기반 참고용이며 수의사의 진단·처방을 대신할 수 없습니다. 
                  항목 분류 및 금액이 실제와 다를 수 있으니 저장 전 내용을 직접 확인해 주세요.
                </p>

                <button
                  onClick={() => handleUpdateAndExit('INPUT')}
                  disabled={isUploading}
                  className={`w-full h-16 bg-[#12B886] text-white text-[16px] font-black rounded-[22px] shadow-xl shadow-[#E9FBF5] active:scale-[0.98] transition-all flex items-center justify-center ${isUploading ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  {isUploading ? '이미지 업로드 중...' : '기록으로 남기기'}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdateAndExit('HOME')}
                    className="h-13 bg-[#F8FAF9] text-[#4E5968] text-[14px] font-bold rounded-[18px] active:scale-[0.98] transition-all flex items-center justify-center"
                  >
                    확인 완료
                  </button>
                  <button
                    onClick={() => setShowInsight(false)}
                    className="h-13 bg-white border border-gray-200 text-[#ADB5BD] text-[14px] font-bold rounded-[18px] active:scale-[0.98] transition-all flex items-center justify-center"
                  >
                    숨기기
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OCR Loading Overlay */}
      {ocrLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md p-6">
          <div className="relative w-24 h-32 bg-[#F8FAF9] rounded-xl border-2 border-[#12B886] overflow-hidden mb-8 shadow-2xl shadow-[#12B886]/10">
            <div className="absolute inset-0 flex flex-col gap-2 p-2 opacity-20">
              <div className="h-2 bg-[#12B886] rounded w-full"></div>
              <div className="h-2 bg-[#12B886] rounded w-3/4"></div>
              <div className="h-2 bg-[#12B886] rounded w-5/6"></div>
              <div className="h-10 bg-[#12B886]/30 rounded w-full mt-auto"></div>
            </div>
            <motion.div
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-1 bg-[#12B886] shadow-[0_0_15px_#12B886] z-10"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h3 className="text-xl font-black text-[#191F28] mb-2">
              AI가 영수증을 분석하고 있어요
            </h3>
            <p className="text-sm font-bold text-[#12B886] animate-pulse mb-1">
              {getAnalysisTimeMessage(analysisElapsedSec)}
            </p>
            <p className="text-[12px] font-medium text-[#ADB5BD] mb-8">
              경과 시간: {analysisElapsedSec}초
            </p>

            <div className="max-w-[280px] mb-8">
              <p className="text-[11px] text-[#8B95A1] leading-relaxed break-keep">
                AI 분석은 참고용이며 진단·처방을 제공하지 않습니다. 실제 영수증 내용과 다를 수 있으니 완료 전 꼭 확인해 주세요.
              </p>
            </div>

            <button
              onClick={() => setOcrLoading(false)}
              className="px-8 h-12 bg-[#F8FAF9] text-[#8B95A1] font-bold rounded-2xl hover:bg-[#E5E8EB] transition-colors"
            >
              분석 취소하기
            </button>
          </motion.div>
        </div>
      )}

      {/* Medication Reminder Modal */}
      <AnimatePresence>
        {showMedicationModal && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowMedicationModal(false)}>
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="bg-white w-full max-w-[480px] rounded-t-[32px] p-8 pb-12 landscape:p-6 landscape:pb-8 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
              <div className="flex flex-col items-center mb-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-red-500 animate-pulse" />
                </div>
                <h3 className="text-xl font-black text-[#191F28] mb-2">복약 알림을 설정할까요?</h3>
                <p className="text-sm text-[#ADB5BD] font-medium">병원 영수증에서 약 처방 내역이 확인되었습니다.</p>
              </div>

              <div className="space-y-6 mb-10">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#ADB5BD] mb-2 uppercase tracking-wider">하루 복용 횟수</label>
                    <select
                      value={medicationData.frequency}
                      onChange={(e) => setMedicationData({ ...medicationData, frequency: Number(e.target.value) })}
                      className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-red-100"
                    >
                      <option value={1}>하루 1번</option>
                      <option value={2}>하루 2번</option>
                      <option value={3}>하루 3번</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#ADB5BD] mb-2 uppercase tracking-wider">복용 기간 (일)</label>
                    <input
                      type="number"
                      value={medicationData.duration}
                      onChange={(e) => setMedicationData({ ...medicationData, duration: Number(e.target.value) })}
                      className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-red-100"
                      placeholder="3"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#ADB5BD] mb-2 uppercase tracking-wider">복용 시작일</label>
                  <input
                    type="date"
                    value={medicationData.startDate}
                    onChange={(e) => setMedicationData({ ...medicationData, startDate: e.target.value })}
                    className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-red-100"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMedicationModal(false)}
                  className="flex-1 h-14 bg-gray-50 text-[#ADB5BD] font-bold rounded-2xl active:scale-95 transition-transform"
                >
                  괜찮아요
                </button>
                <button
                  onClick={async () => {
                    if (user) {
                      await addDoc(collection(db, 'users', user.uid, 'reminders'), {
                        type: 'MEDICATION',
                        petId: selectedPetId,
                        itemName: title,
                        frequency: medicationData.frequency,
                        duration: medicationData.duration,
                        startDate: medicationData.startDate,
                        createdAt: serverTimestamp(),
                        isRead: false
                      });
                      showToast('복약 알림이 설정되었습니다.', 'success');
                      setShowMedicationModal(false);
                      setShowRecurringModal(true);
                    }
                  }}
                  className="flex-[2] h-14 bg-red-500 text-white font-bold rounded-2xl active:scale-95 transition-transform shadow-lg shadow-red-100"
                >
                  알림 예약하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecurringModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRecurringModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-[320px] rounded-[32px] p-8 relative z-10 shadow-2xl"
            >
              <div className="w-16 h-16 bg-[#E9FBF5] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                🗓️
              </div>
              <h3 className="text-xl font-black text-[#191F28] text-center mb-2">정기 알림 설정</h3>
              <p className="text-[13px] text-[#8B95A1] text-center mb-8 leading-relaxed font-medium">
                다음 구매/관리 예정일에 맞춰<br />리마인드 알림을 보내드릴까요?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRecurringModal(false)}
                  className="flex-1 h-14 bg-gray-50 text-[#ADB5BD] font-bold rounded-2xl active:scale-95 transition-transform"
                >
                  나중에
                </button>
                <button
                  onClick={() => navigate('/recurring-settings')}
                  className="flex-1 h-14 bg-[#12B886] text-white font-bold rounded-2xl active:scale-95 transition-transform shadow-lg shadow-[#E9FBF5]"
                >
                  설정하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Paywall Modal */}
      <AnimatePresence>
        {showPaywall && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaywall(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white w-full max-w-[340px] rounded-[40px] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-[#E9FBF5] rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-8">
                  ✨
                </div>
                <h3 className="text-[22px] font-black text-[#191F28] mb-3 leading-tight">
                  우리 아이 케어 흐름을<br />끝까지 확인해보세요
                </h3>
                <p className="text-[14px] text-[#ADB5BD] font-medium leading-relaxed mb-10">
                  AI가 분석한 미래 케어 시점과 상세 가이드를<br />
                  <span className="text-[#3182f6] font-bold">베타테스트 기간 동안 무료</span>로 모두 열어드릴게요.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      togglePro();
                      setShowPaywall(false);
                      showToast('베타테스트 혜택으로 모든 기능이 활성화되었습니다! ✨', 'success');
                    }}
                    className="w-full h-16 bg-[#12B886] text-white font-black rounded-2xl shadow-xl shadow-[#E9FBF5] active:scale-[0.98] transition-all"
                  >
                    무료로 시작하기
                  </button>
                  <button
                    onClick={() => setShowPaywall(false)}
                    className="w-full h-14 text-[#ADB5BD] font-bold text-[14px]"
                  >
                    나중에 하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OCR Limit Reached Modal [PetLog Beta Policy] */}
      <AnimatePresence>
        {showOcrLimitModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOcrLimitModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white w-full max-w-[340px] rounded-[40px] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-[#F8FAF9] rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-8">
                  🛑
                </div>
                <h3 className="text-[20px] font-black text-[#191F28] mb-4 leading-tight">
                  오늘의 AI 분석 가능 횟수를<br />모두 사용했어요
                </h3>
                <p className="text-[14px] text-[#8B95A1] font-medium leading-relaxed mb-10 break-keep">
                  베타 기간에는 하루 5회까지 AI 분석을 사용할 수 있습니다.<br />
                  <span className="text-[#12B886] font-bold">영수증 내용은 수기 입력으로 직접 기록할 수 있어요.</span>
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowOcrLimitModal(false);
                      setRegistrationMethod('MANUAL');
                    }}
                    className="w-full h-16 bg-[#12B886] text-white font-black rounded-2xl shadow-xl shadow-[#E9FBF5] active:scale-[0.98] transition-all"
                  >
                    수기 입력으로 기록하기
                  </button>
                  <button
                    onClick={() => setShowOcrLimitModal(false)}
                    className="w-full h-14 text-[#ADB5BD] font-bold text-[14px]"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. User Verification Overlay (Pipeline Step 9) */}
      <AnimatePresence>
        {showVerification && medicalDetails && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[250] bg-[#F8FAF9] overflow-y-auto"
          >
            <div className="min-h-screen flex flex-col max-w-[480px] mx-auto bg-[#F8FAF9] pb-40">
              <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-gray-100">
                <button onClick={() => setShowVerification(false)} className="p-2">
                  <ChevronLeft className="w-6 h-6 text-[#191F28]" />
                </button>
                <span 
                  className="text-[16px] font-black text-[#191F28]"
                  onClick={() => {
                    setDebugClickCount(prev => {
                      if (prev + 1 >= 5) {
                        toggleDebugMode();
                        return 0;
                      }
                      return prev + 1;
                    });
                  }}
                >
                  AI 분석 결과 확인
                </span>
                <div className="w-10" />
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[20px] font-black text-[#191F28] leading-tight">
                      AI가 영수증을 분석했어요
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 px-4 py-3 bg-[#E9FBF5]/30 rounded-2xl mb-6 border border-[#12B886]/20">
                    <Sparkles className="w-4 h-4 text-[#12B886] shrink-0" />
                    <p className="text-[12px] text-[#12B886] font-bold leading-relaxed">
                      항목명을 기반으로 지출 금액을 분류했습니다. 실제 영수증 내용과 맞는지 확인해 주세요.
                    </p>
                  </div>

                  {/* [v1.0.7] Developer Debug Mode: Category Evidence */}
                  {typeof window !== 'undefined' && localStorage.getItem('PETLOG_DEBUG') === 'true' && (
                    <div className="mb-6 space-y-4">
                      {/* Item Evidence */}
                      <div className="p-4 bg-gray-900 rounded-2xl overflow-hidden shadow-lg border border-gray-800">
                        <p className="text-[10px] text-[#12B886] font-mono mb-3 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#12B886] rounded-full animate-pulse" />
                          Category Evidence (v1.0.7)
                        </p>
                        <div className="space-y-3">
                          {(ocrResult?.lineItems ?? []).filter((item: any) => !item?.isMetaLine).map((item: any, idx: number) => (
                            <div key={idx} className="text-[11px] font-mono border-b border-gray-800/50 pb-2 last:border-0">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-gray-100">{item?.name ?? 'Unknown Item'}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${(item?.confidence ?? 0) > 0.8 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                  {item?.confidence ? Math.round(item.confidence * 100) : '??'}%
                                </span>
                              </div>
                              <div className="text-[#ADB5BD]">→ {item?.category ?? 'unclassified'}</div>
                              <div className="text-[#4E5968] text-[9px] mt-1 italic">{(item?.reason ?? []).join(', ')}</div>
                            </div>
                          ))}
                          {(!ocrResult?.lineItems || ocrResult.lineItems.length === 0) && (
                            <p className="text-[10px] text-[#8B95A1] italic text-center py-4">분석된 세부 항목이 없습니다.</p>
                          )}
                        </div>
                      </div>

                      {/* [v1.0.8] Internal QA Report Placeholder */}
                      <div className="p-4 bg-orange-950/30 rounded-2xl border border-orange-900/30">
                        <p className="text-[10px] text-orange-400 font-mono mb-2 uppercase tracking-widest">Internal QA Report (v1.0.8)</p>
                        <p className="text-[11px] text-orange-200/70 leading-relaxed break-keep">
                          수정된 데이터는 PetLog 내부 QA 파이프라인으로 전송되어 룰 개선 후보(misclassificationCandidates)로 분류됩니다.
                        </p>
                        {correctionMethod !== 'ai' && (
                          <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <div className="w-1 h-1 bg-orange-400 rounded-full" />
                            <span className="text-[10px] text-orange-400 font-bold">오분류 패턴 감지됨: 수동 수정 발생</span>
                          </div>
                        )}
                      </div>

                      {/* [v1.1.0] Engine Health Dashboard */}
                      <div className={`p-4 rounded-2xl border shadow-2xl transition-all duration-500 ${
                        avgConfidence > 0.8 ? 'bg-slate-900 border-slate-800' : 'bg-red-950/20 border-red-900/30'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${
                              avgConfidence > 0.8 ? 'bg-green-400 shadow-green-400' : 'bg-red-500 shadow-red-500 animate-pulse'
                            }`} />
                            Engine Health Dashboard (v1.1.1)
                          </p>
                          <div className="text-right">
                            <span className="text-[20px] font-black text-white">{Math.round(avgConfidence * 100)}</span>
                            <span className="text-[10px] text-slate-500 font-bold ml-1">/ 100</span>
                          </div>
                        </div>

                        {/* [v1.1.1] Threshold Alert Banner */}
                        <div className={`mb-4 px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
                          avgConfidence > 0.8 
                            ? 'bg-[#12B886]/10 border-[#12B886]/20 text-[#12B886]' 
                            : 'bg-red-500/10 border-red-500/20 text-red-400 animate-bounce'
                        }`}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{avgConfidence > 0.8 ? "엔진 상태 안정" : "회귀 테스트 또는 분석 품질 긴급 확인 필요"}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <p className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Correction Rate</p>
                            <p className="text-[14px] font-black text-slate-200">12.5%</p>
                          </div>
                          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <p className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Avg Confidence</p>
                            <p className="text-[14px] font-black text-slate-200">92%</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[9px] text-slate-500 font-bold uppercase px-1">Top Issues</p>
                          <div className="space-y-1.5">
                            {(ocrResult?.topIssues ?? [
                              { kw: '스케일링', count: 5, cat: 'Surgery → Treatment' },
                              { kw: '심장사상충', count: 3, cat: 'Supplies → Medicine' }
                            ]).map((issue: any, i: number) => (
                              <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-slate-800/30 rounded-lg">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-300 font-bold">{issue?.kw ?? 'Unknown'}</span>
                                  <span className="text-[8px] text-slate-500">{issue?.cat ?? '-'}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">x{issue?.count ?? 0}</span>
                              </div>
                            ))}
                            {(!ocrResult?.topIssues) && (
                              <p className="text-[9px] text-slate-600 italic px-1">감지된 오분류 패턴이 없습니다.</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 font-bold">Regression Fixture:</span>
                            <span className="text-[9px] text-green-400 font-bold">taxNotDiscount_001 PASS</span>
                          </div>
                        </div>
                      </div>

                      {/* [v1.1.2] Alert History & Resolution */}
                      <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
                        <p className="text-[10px] text-zinc-500 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Alert History (v1.1.2)</span>
                          <span className="text-[8px] opacity-50">Last 24h</span>
                        </p>
                        
                        <div className="space-y-3">
                          {/* Alert Item Placeholder */}
                          <div className="p-3 bg-zinc-800/40 rounded-xl border border-zinc-700/30">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                              <span className="text-[11px] text-zinc-200 font-bold">회귀 테스트 실패</span>
                              <span className="ml-auto text-[9px] text-zinc-500 font-mono">10m ago</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mb-3 break-keep">taxNotDiscount_001 실패로 인한 품질 점수 하락</p>
                            <div className="flex gap-2">
                              <button className="px-2 py-1 bg-zinc-700 text-zinc-300 text-[9px] rounded border border-zinc-600">확인함</button>
                              <button className="px-2 py-1 bg-[#12B886]/20 text-[#12B886] text-[9px] rounded border border-[#12B886]/30">해결 완료</button>
                            </div>
                          </div>

                          <button className="w-full py-2 text-[10px] text-zinc-600 font-bold border border-dashed border-zinc-800 rounded-lg hover:bg-zinc-800/20 transition-all">
                            전체 이력 보기
                          </button>
                        </div>
                      </div>

                      {/* [v1.1.3] Release Impact Report */}
                      <div className="p-4 bg-[#12B886] rounded-2xl border border-[#12B886] shadow-2xl">
                        <p className="text-[10px] text-[#12B886] font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Release Impact Report (v1.1.3)</span>
                          <span className="text-[8px] bg-[#12B886]/20 px-1 rounded">v1.1.2 → v1.1.3</span>
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-1">
                            <p className="text-[9px] text-[#12B886] font-bold uppercase">Before (v1.1.2)</p>
                            <p className="text-[16px] font-black text-[#20C997]/50">82</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] text-[#12B886] font-bold uppercase">After (v1.1.3)</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[16px] font-black text-[#12B886]">88</p>
                              <span className="text-[10px] text-green-400 font-bold">▲ 6</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-[#12B886]/5 rounded-xl border border-[#12B886]/10 mb-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] bg-green-500 text-white px-1 rounded-sm font-black">개선됨</span>
                            <span className="text-[11px] text-[#20C997] font-bold">엔진 품질 향상 감지</span>
                          </div>
                          <p className="text-[10px] text-[#20C997]/70 leading-relaxed">
                            v1.1.3 업데이트 이후 사용자 수정률이 5.5% 감소했으며, 전반적인 분석 신뢰도가 상승했습니다.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-[#8B95A1]">Correction Rate</span>
                            <span className="text-gray-300">18% → 12.5%</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-[#8B95A1]">Avg Confidence</span>
                            <span className="text-gray-300">88% → 92%</span>
                          </div>
                        </div>
                      </div>

                      {/* [v1.1.4] Release Gate */}
                      <div className={`p-4 rounded-2xl border shadow-2xl ${
                        avgConfidence > 0.8 ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-rose-950/20 border-rose-900/30'
                      }`}>
                        <p className="text-[10px] text-emerald-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Release Gate (v1.1.4)</span>
                          <span className={`px-1 rounded text-[8px] font-black ${
                            avgConfidence > 0.8 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                          }`}>
                            {avgConfidence > 0.8 ? 'PASS' : 'BLOCKED'}
                          </span>
                        </p>
                        
                        <div className="space-y-2 mb-4">
                         <div className="space-y-2 mb-4">
                           {(ocrResult?.releaseChecks ?? [
                             { name: 'Core Regressions', status: 'pass', val: 'PASS' },
                             { name: 'Critical Alerts', status: 'pass', val: 'Zero' },
                             { name: 'Health Score', status: (avgConfidence ?? 0) > 0.8 ? 'pass' : 'fail', val: Math.round((avgConfidence ?? 0) * 100) },
                           ]).map((check: any, i: number) => (
                             <div key={i} className="flex justify-between items-center text-[10px]">
                               <span className="text-[#ADB5BD]">{check?.name ?? 'Unknown Check'}</span>
                               <div className="flex items-center gap-2">
                                 <span className="text-gray-200 font-mono">{check?.val ?? '-'}</span>
                                 <div className={`w-1.5 h-1.5 rounded-full ${check?.status === 'pass' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                               </div>
                             </div>
                           ))}
                         </div>
                        </div>

                        <div className={`p-3 rounded-xl border ${
                          avgConfidence > 0.8 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'
                        }`}>
                          <p className={`text-[11px] font-bold mb-1 ${avgConfidence > 0.8 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {avgConfidence > 0.8 ? '배포 가능' : '배포 차단됨'}
                          </p>
                          <p className="text-[10px] text-[#ADB5BD] leading-relaxed">
                            {avgConfidence > 0.8 
                              ? '모든 핵심 품질 지표가 배포 기준을 충족합니다.' 
                              : '엔진 점수 미달로 인해 배포가 차단되었습니다. 룰 최적화가 필요합니다.'}
                          </p>
                        </div>
                      </div>

                      {/* [v1.1.5] Release Snapshot & Approval */}
                      <div className="p-4 bg-indigo-950/20 rounded-2xl border border-indigo-900/30 shadow-2xl">
                        <p className="text-[10px] text-indigo-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Release Snapshot (v1.1.5)</span>
                          <span className="text-[8px] opacity-50">History</span>
                        </p>
                        
                        <div className="space-y-3 mb-6">
                          <div className="flex flex-col gap-1 px-3 py-2 bg-indigo-900/20 rounded-xl border border-indigo-800/30">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-indigo-200 font-bold">Latest: v1.1.4</span>
                              <span className="text-[9px] text-indigo-500">2026-05-04</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="text-[10px] text-indigo-400 font-mono">Status: PASS (Score: 88)</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-[10px] text-indigo-300/50 font-bold uppercase px-1">Actions</p>
                          <div className="flex flex-col gap-2">
                            <button 
                              disabled={avgConfidence <= 0.8}
                              className={`w-full py-3 rounded-xl text-[12px] font-black transition-all ${
                                avgConfidence > 0.8 
                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 active:scale-[0.98]' 
                                  : 'bg-indigo-900/40 text-indigo-700 cursor-not-allowed border border-indigo-800/30'
                              }`}
                            >
                              정식 배포 승인
                            </button>
                            
                            {avgConfidence <= 0.8 && (
                              <button className="w-full py-2.5 rounded-xl text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all">
                                ⚠️ 강제 승인 (Override)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* [v1.1.6] Rollback Readiness */}
                      <div className={`p-4 rounded-2xl border shadow-2xl transition-colors duration-500 ${
                        avgConfidence > 0.8 ? 'bg-slate-900 border-slate-800' : 'bg-orange-950/20 border-orange-900/30'
                      }`}>
                        <p className="text-[10px] text-slate-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Rollback Readiness (v1.1.6)</span>
                          <span className={`px-1 rounded text-[8px] font-black ${
                            avgConfidence > 0.8 ? 'bg-slate-700 text-slate-300' : 'bg-orange-500 text-white animate-pulse'
                          }`}>
                            {avgConfidence > 0.8 ? 'NORMAL' : 'ROLLBACK REVIEW'}
                          </span>
                        </p>
                        
                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[#8B95A1]">Post-Release Drift</span>
                            <span className={`font-mono ${avgConfidence > 0.8 ? 'text-green-400' : 'text-orange-400'}`}>
                              {avgConfidence > 0.8 ? 'Low (-2pts)' : 'High (-9pts)'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[#8B95A1]">Critical Regression</span>
                            <span className="text-emerald-400 font-bold">NONE</span>
                          </div>
                        </div>

                        <div className={`p-3 rounded-xl border ${
                          avgConfidence > 0.8 ? 'bg-slate-800/50 border-slate-700/30' : 'bg-orange-500/5 border-orange-500/10'
                        }`}>
                          <p className={`text-[10px] leading-relaxed ${avgConfidence > 0.8 ? 'text-[#ADB5BD]' : 'text-orange-300'}`}>
                            {avgConfidence > 0.8 
                              ? '현재 엔진 상태가 이전 배포 수준을 유지하고 있습니다.' 
                              : '주의: 배포 후 품질 하락이 감지되었습니다. 최근 변경된 룰셋 리뷰를 권장합니다.'}
                          </p>
                        </div>
                      </div>

                      {/* [v1.1.7] Incident Review & Postmortem */}
                      <div className="p-4 bg-rose-950/20 rounded-2xl border border-rose-900/30 shadow-2xl">
                        <p className="text-[10px] text-rose-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Incident Review (v1.1.7)</span>
                          <span className="text-[8px] bg-rose-500 text-white px-1 rounded">DRAFT</span>
                        </p>
                        
                        <div className="space-y-3 mb-6">
                          <div className="p-3 bg-rose-900/20 rounded-xl border border-rose-800/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] text-rose-200 font-bold">Incident #260504</span>
                              <span className="text-[9px] text-rose-500 font-mono">v1.1.6 Regression</span>
                            </div>
                            <p className="text-[10px] text-rose-300/70 mb-3 leading-relaxed">
                              배포 후 특정 항목(스케일링)에 대한 분류 신뢰도가 15% 하락하여 롤백 검토가 트리거되었습니다.
                            </p>
                            
                            <div className="space-y-2 pt-2 border-t border-rose-900/30">
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-rose-500 font-bold uppercase">Root Cause</span>
                                <div className="text-[10px] text-[#ADB5BD] p-2 bg-black/20 rounded border border-rose-900/20 italic">
                                  수동 룰셋 추가 과정에서 키워드 우선순위 충돌 발생 가능성...
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-white bg-[#12B886] shadow-lg shadow-[#12B886]/40">리포트 작성</button>
                          <button className="px-4 py-2.5 rounded-xl text-[11px] font-bold text-[#12B886] border border-[#12B886]/30">보류</button>
                        </div>
                      </div>

                      {/* [v1.1.8] QA Knowledge Base */}
                      <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
                        <p className="text-[10px] text-slate-500 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>QA Knowledge Base (v1.1.8)</span>
                          <span className="text-[8px] opacity-50">Lessons Learned</span>
                        </p>
                        
                        <div className="flex gap-2 mb-4">
                          <div className="flex-1 h-9 bg-black/40 rounded-lg border border-slate-800 flex items-center px-3 gap-2">
                            <Search className="w-3.5 h-3.5 text-slate-600" />
                            <input 
                              placeholder="Search by keywords..." 
                              className="bg-transparent border-none text-[11px] text-slate-300 focus:outline-none w-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30">
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="w-3.5 h-3.5 text-[#12B886]" />
                              <span className="text-[11px] text-slate-200 font-bold">세금 정보 오인 사고 (Tax Misclassification)</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              <span className="px-1.5 py-0.5 bg-[#12B886]/10 text-[#12B886] text-[9px] rounded border border-[#12B886]/20">#taxInfo</span>
                              <span className="px-1.5 py-0.5 bg-slate-700/50 text-slate-400 text-[9px] rounded border border-slate-600/30">#regression</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed italic">
                              "taxInfo 분리 로직이 특정 병원 영수증 포맷에서 예외 발생... 해결 완료."
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* [v1.2.3] QA Operations Summary */}
                      <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
                        <p className="text-[10px] text-slate-500 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>QA Operations Summary (v1.2.3)</span>
                          <span className="text-[8px] bg-slate-800 px-1 rounded">Weekly: 04.28 - 05.04</span>
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30">
                            <p className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Issues Resolved</p>
                            <p className="text-[14px] font-black text-slate-200">12 / 15</p>
                          </div>
                          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30">
                            <p className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Avg Resolve Time</p>
                            <p className="text-[14px] font-black text-slate-200">18.4h</p>
                          </div>
                        </div>

                        <div className="p-3 bg-[#12B886]/5 rounded-xl border border-[#12B886]/10 mb-4">
                          <p className="text-[11px] text-[#20C997] font-bold mb-1">Weekly Summary</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            이번 주 엔진 헬스 스코어는 88점으로 안정적이었으나, P0 이슈 1건이 SLA를 초과했습니다. 스케일링 관련 반복 오분류 패턴이 감지되어 다음 주 집중 검토가 필요합니다.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[9px] text-slate-600 font-bold uppercase px-1">Next Week Focus</p>
                          <ul className="space-y-1">
                            <li className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="w-1 h-1 bg-[#12B886] rounded-full" />
                              SLA 초과 P0 이슈 원인 분석 및 해결
                            </li>
                            <li className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="w-1 h-1 bg-[#12B886] rounded-full" />
                              스케일링 키워드 Regression Candidate 검토
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* [v1.2.2] Triage SLA & Response Tracking */}
                      <div className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800 shadow-2xl">
                        <p className="text-[10px] text-zinc-500 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Triage SLA (v1.2.2)</span>
                          <span className="text-[8px] bg-red-500 text-white px-1 rounded animate-pulse">OVERDUE</span>
                        </p>
                        
                        <div className="space-y-4 mb-4">
                          <div className="p-3 bg-red-950/10 rounded-xl border border-red-900/20">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[11px] text-red-200 font-bold">P0 Critical Issue</span>
                              <span className="text-[9px] text-red-500 font-black">! LATE</span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500">Ack Due</span>
                                <span className="text-zinc-300 font-mono">Expired (2h)</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500">Resolve Due</span>
                                <span className="text-red-400 font-mono">14h 22m left</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[11px] text-zinc-400 font-bold">P1 High Priority</span>
                              <span className="text-[9px] text-emerald-500 font-bold">ON TRACK</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-zinc-500">Resolve Due</span>
                              <span className="text-zinc-300 font-mono">2d 04h left</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2 bg-red-500/5 border border-red-500/10 rounded-lg">
                          <p className="text-[9px] text-red-400 text-center font-bold">
                            P0 항목의 인지 기한이 초과되었습니다. 즉각적인 담당자 배정이 필요합니다.
                          </p>
                        </div>
                      </div>

                      {/* [v1.2.1] Validation Failure Triage */}
                      <div className="p-4 bg-orange-950/20 rounded-2xl border border-orange-900/30 shadow-2xl">
                        <p className="text-[10px] text-orange-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Validation Triage (v1.2.1)</span>
                          <span className="text-[8px] bg-orange-500 text-white px-1 rounded">P0 - CRITICAL</span>
                        </p>
                        
                        <div className="space-y-3 mb-6">
                          <div className="p-3 bg-orange-900/20 rounded-xl border border-orange-800/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] text-orange-200 font-bold">Triage #260504-F1</span>
                              <span className="text-[9px] text-orange-500 font-mono">Assigned: Dev-QA</span>
                            </div>
                            <p className="text-[10px] text-orange-300/70 mb-3 leading-relaxed">
                              taxNotDiscount_001 실패 감지. 룰 변경에 의한 부작용이 크리티컬 지표를 훼손했습니다.
                            </p>
                            
                            <div className="flex gap-2">
                              <span className="text-[8px] px-1.5 py-0.5 bg-black/40 text-orange-500 rounded border border-orange-900/20">Action: Incident Review</span>
                              <span className="text-[8px] px-1.5 py-0.5 bg-black/40 text-orange-500 rounded border border-orange-900/20">Status: In Progress</span>
                            </div>
                          </div>
                        </div>

                        <button className="w-full py-2.5 rounded-xl text-[11px] font-bold text-white bg-orange-600 shadow-lg shadow-orange-900/40">트리아지 리포트 상세보기</button>
                      </div>

                      {/* [v1.2.0] Change Validation Report */}
                      <div className={`p-4 rounded-2xl border shadow-2xl ${
                        avgConfidence > 0.8 ? 'bg-cyan-950/20 border-cyan-900/30' : 'bg-red-950/20 border-red-900/30'
                      }`}>
                        <p className="text-[10px] text-cyan-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Change Validation (v1.2.0)</span>
                          <span className={`px-1 rounded text-[8px] font-black ${
                            avgConfidence > 0.8 ? 'bg-cyan-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {avgConfidence > 0.8 ? 'VALIDATED' : 'VALIDATION FAILED'}
                          </span>
                        </p>
                        
                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-[#ADB5BD]">Target Rule</span>
                            <span className="text-cyan-200 font-mono">scalingRule</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-[#ADB5BD]">Core Regressions</span>
                            <span className="text-emerald-400 font-bold">PASS</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-[#ADB5BD]">Health Impact</span>
                            <span className={`font-mono ${avgConfidence > 0.8 ? 'text-green-400' : 'text-red-400'}`}>
                              {avgConfidence > 0.8 ? '+3pts' : '-12pts'}
                            </span>
                          </div>
                        </div>

                        <div className={`p-3 rounded-xl border ${
                          avgConfidence > 0.8 ? 'bg-cyan-500/5 border-cyan-500/10' : 'bg-red-500/5 border-red-500/10'
                        }`}>
                          <p className={`text-[10px] leading-relaxed ${avgConfidence > 0.8 ? 'text-[#ADB5BD]' : 'text-red-300'}`}>
                            {avgConfidence > 0.8 
                              ? '검증 성공. 핵심 회귀 테스트와 지표가 모두 안전 범주 내에 있습니다.' 
                              : '검증 실패: 룰 변경 후 핵심 회귀 테스트 또는 지표에서 예외가 발생했습니다.'}
                          </p>
                        </div>
                      </div>

                      {/* [v1.1.9] Engine Change Request */}
                      <div className="p-4 bg-teal-950/20 rounded-2xl border border-teal-900/30 shadow-2xl">
                        <p className="text-[10px] text-teal-400 font-mono mb-4 uppercase tracking-widest flex items-center justify-between">
                          <span>Engine Change Request (v1.1.9)</span>
                          <span className="text-[8px] bg-teal-500 text-white px-1 rounded">REVIEWING</span>
                        </p>
                        
                        <div className="space-y-3 mb-6">
                          <div className="p-3 bg-teal-900/20 rounded-xl border border-teal-800/30">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] text-teal-200 font-bold">CR #260504-01</span>
                              <span className="text-[9px] text-teal-500 font-bold uppercase">Risk: Medium</span>
                            </div>
                            <p className="text-[11px] text-teal-100 font-black mb-1">스케일링 분류 룰 개선</p>
                            <p className="text-[10px] text-teal-300/70 mb-3 leading-relaxed">
                              스케일링 항목을 '수술'에서 '치과 처치'로 분리하여 분석 정확도를 높이는 룰 수정을 제안합니다.
                            </p>
                            
                            <div className="flex gap-2">
                              <span className="text-[8px] px-1.5 py-0.5 bg-black/40 text-teal-500 rounded border border-teal-900/30">Source: RC-123456</span>
                              <span className="text-[8px] px-1.5 py-0.5 bg-black/40 text-teal-500 rounded border border-teal-900/30">Rule: scalingRule</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-white bg-teal-600 shadow-lg shadow-teal-900/40">승인하기</button>
                          <button className="px-4 py-2.5 rounded-xl text-[11px] font-bold text-teal-400 border border-teal-900/30">거절</button>
                        </div>
                      </div>

                      {/* [v1.0.9] Regression Candidates */}
                      <div className="p-4 bg-purple-950/30 rounded-2xl border border-[#12B886]/30">
                        <p className="text-[10px] text-[#12B886] font-mono mb-2 uppercase tracking-widest flex items-center justify-between">
                          <span>Regression Candidates (v1.0.9)</span>
                          <span className="bg-[#12B886] text-white px-1 rounded text-[8px]">WAITING REVIEW</span>
                        </p>
                         <div className="space-y-3 mt-3">
                           {(ocrResult?.regressionCandidates ?? [
                             { kw: '스케일링 (Dental Scaling)', count: 5, suggest: 'dentalScalingRule' }
                           ]).map((rc: any, idx: number) => (
                             <div key={idx} className="p-3 bg-[#12B886]/20 rounded-xl border border-[#12B886]/30">
                               <div className="flex justify-between items-start mb-1">
                                 <span className="text-[11px] text-purple-200 font-bold">{rc?.kw ?? 'Unknown Candidate'}</span>
                                 <span className="text-[10px] text-[#12B886] font-mono">Count: {rc?.count ?? 0}</span>
                               </div>
                               <div className="text-[10px] text-[#ADB5BD]">Suggest: {rc?.suggest ?? 'TBD'}</div>
                               <div className="mt-2 flex gap-2">
                                 <button className="px-2 py-1 bg-[#12B886]/20 text-purple-300 text-[9px] rounded border border-purple-500/30">승인 (fixture 추가)</button>
                                 <button className="px-2 py-1 bg-gray-800 text-[#8B95A1] text-[9px] rounded border border-gray-700">보류</button>
                               </div>
                             </div>
                           ))}
                           {(!ocrResult?.regressionCandidates) && (
                             <p className="text-[9px] text-[#12B886] italic px-1">대기 중인 룰 개선 후보가 없습니다.</p>
                           )}
                         </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-5 bg-[#F9FAFB] rounded-2xl border border-gray-50">
                      <span className="text-[14px] font-bold text-[#4E5968]">분석 합계</span>
                      <div className="text-right">
                        <span className="text-[22px] font-black text-[#191F28]">{Number(amount).toLocaleString()}원</span>
                        <div className="mt-1">
                          {Number(totalDiscountAmount) > 0 ? (
                            <div className="flex flex-col items-end">
                              <p className="text-[11px] text-red-500 font-bold">할인/차감 -{Number(totalDiscountAmount).toLocaleString()}원</p>
                              {originalTotalAmount && (
                                <p className="text-[10px] text-[#ADB5BD]">할인 전: {Number(originalTotalAmount).toLocaleString()}원</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#ADB5BD]">할인/차감 없음</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {ocrResult?.multiPetDetection?.isMultiPetSuspected && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 bg-[#E9FBF5] border border-[#E9FBF5] rounded-2xl mb-2"
                      >
                        <div className="flex gap-3 items-start">
                          <AlertCircle className="w-5 h-5 text-[#12B886] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[13px] font-black text-[#12B886] leading-tight">
                              여러 반려동물의 진료 내역이 함께 포함된 영수증일 수 있어요.
                            </p>
                             <p className="text-[11px] text-[#12B886] font-bold mt-1">
                               감지된 이름: {(ocrResult?.multiPetDetection?.detectedPetNames ?? []).join(', ')}
                             </p>
                            <p className="text-[11px] text-[#12B886] mt-1.5 leading-relaxed">
                              아이별 지출이 맞는지 저장 전 확인해 주세요.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {verificationStatus === 'REVIEW_RECOMMENDED' && ocrResult?.isAmbiguous && (
                      <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl mb-4">
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                        <p className="text-[12px] text-orange-700 font-bold leading-relaxed">
                          검사와 수술 항목의 경계가 모호합니다. 검사 항목이 수술/마취로 분류되지 않았는지 확인해 주세요.
                        </p>
                      </div>
                    )}

                    {verificationStatus === 'REVIEW_RECOMMENDED' && !ocrResult?.isAmbiguous && (medicalDetails && (Number(medicalDetails.other) || 0) > 0) && (
                      <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl mb-4">
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                        <p className="text-[12px] text-orange-700 font-bold leading-relaxed">
                          일부 항목이 '기타'로 분류되었습니다. 분류가 맞는지 확인해 주세요.
                        </p>
                      </div>
                    )}

                    {!amountMatched ? (
                      <>
                        <div className={`flex justify-between items-center p-5 rounded-2xl ${Math.abs(difference) > 1000 ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'}`}>
                          <div className="flex flex-col">
                            <span className={`text-[13px] font-bold ${Math.abs(difference) > 1000 ? 'text-red-600' : 'text-orange-600'}`}>확인이 필요한 차액</span>
                            <p className="text-[11px] text-[#8B95A1] mt-0.5">항목별 금액을 수정해 주세요</p>
                          </div>
                          <span className={`text-[18px] font-black ${Math.abs(difference) > 1000 ? 'text-red-600' : 'text-orange-600'}`}>
                            {difference > 0 ? '+' : ''}{difference.toLocaleString()}원
                          </span>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 items-start">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <p className="text-[12px] font-bold text-red-600 leading-relaxed">
                            AI가 계산한 항목 합계와 최종 결제금액이 일치하지 않습니다. 영수증 금액을 직접 확인한 뒤 저장해 주세요.
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center p-5 rounded-2xl bg-[#E9FBF5] border border-[#C2F3E1]">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-[#12B886]">정산 확인 완료</span>
                          <p className="text-[11px] text-[#8B95A1] mt-0.5">할인을 포함한 모든 금액이 일치합니다</p>
                        </div>
                        <div className="flex items-center gap-1 bg-[#12B886] text-white px-3 py-1 rounded-full text-[11px] font-black shadow-sm">
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>일치</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[15px] font-black text-[#191F28]">항목별 분류</h4>
                    <span className="text-[12px] font-bold text-[#12B886]">합계: {calculatedSum.toLocaleString()}원</span>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { id: 'diagnosis', label: '진료/상담', icon: '🩺' },
                      { id: 'test', label: '검사/진단', icon: '🏥' },
                      { id: 'treatment', label: '처치/주사', icon: '💉' },
                      { id: 'hospitalization', label: '입원/면회', icon: '🏠' },
                      { id: 'surgery', label: '수술/마취', icon: '✂️' },
                      { id: 'medicine', label: '약제/조제', icon: '💊' },
                      { id: 'food', label: '사료/간식', icon: '🍴' },
                      { id: 'supplies', label: '용품', icon: '🧸' },
                      { id: 'grooming', label: '미용', icon: '✂️' },
                      { id: 'other', label: '기타', icon: '🏷️' },
                    ].map(cat => {
                      const catAmount = medicalDetails[cat.id as keyof typeof medicalDetails];
                      if (catAmount === undefined || catAmount === null) return null;

                      return (
                        <div key={cat.id} className="flex flex-col gap-2 p-4 bg-[#F9FAFB] rounded-2xl border border-gray-50 transition-all focus-within:border-[#E9FBF5]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{cat.icon}</span>
                              <span className="text-[14px] font-bold text-[#4E5968]">{cat.label}</span>
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={medicalDetails[cat.id as keyof typeof medicalDetails] === undefined || medicalDetails[cat.id as keyof typeof medicalDetails] === 0 ? '' : medicalDetails[cat.id as keyof typeof medicalDetails]}
                              placeholder="0"
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                const newVal = rawValue === '' ? 0 : Math.max(0, Number(rawValue));
                                const newDetails = { ...medicalDetails, [cat.id]: newVal };
                                setMedicalDetails(newDetails);
                                setCorrectionMethod('manual');

                                const numericSum = Object.values(newDetails || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                                setCalculatedSum(numericSum);
                                setAnalysisDiff(Number(amount || 0) - Number(numericSum));
                              }}
                              className={`w-full h-10 bg-transparent text-right font-black text-[18px] focus:outline-none pr-8
                              ${(Number(medicalDetails[cat.id as keyof typeof medicalDetails]) || 0) === 0 ? 'text-gray-300' : 'text-[#191F28]'}`}
                            />
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#ADB5BD] pointer-events-none">원</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* 항목 추가 버튼 (간소화) */}
                    <button 
                      onClick={() => {
                        const newDetails = { ...medicalDetails };
                        ['diagnosis', 'test', 'treatment', 'hospitalization', 'surgery', 'medicine', 'food', 'supplies', 'grooming', 'other'].forEach(id => {
                          if (newDetails[id as keyof typeof medicalDetails] === undefined) {
                            newDetails[id as keyof typeof medicalDetails] = 0;
                          }
                        });
                        setMedicalDetails(newDetails);
                      }}
                      className="w-full py-3 border border-dashed border-gray-200 rounded-2xl text-[13px] font-bold text-[#ADB5BD] hover:bg-gray-50 transition-colors"
                    >
                      + 다른 항목 추가하기
                    </button>
                  </div>
                </div>

                <div className="px-2 space-y-2">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-[#ADB5BD] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#8B95A1] leading-relaxed">
                      AI 분석은 보조 도구로, 실제 영수증과 차이가 있을 수 있어요. 정확한 기록을 위해 항목을 확인한 뒤 저장해주세요.
                    </p>
                  </div>
                  {Math.abs(analysisDiff) > 0 && (
                    <div className="bg-orange-50 p-4 rounded-2xl">
                      <p className="text-[12px] text-orange-700 font-medium">
                        분석이 정확하지 않을 수 있어요. 직접 입력으로 더 정확하게 기록할 수 있습니다.
                      </p>
                    </div>
                  )}
                  {showRetryWithOriginal && (
                    <div className="bg-[#E9FBF5]/50 p-4 rounded-2xl border border-[#12B886]/10 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="w-3.5 h-3.5 text-[#12B886]" />
                        <p className="text-[12px] text-[#12B886] font-bold">분석 결과가 만족스럽지 않나요?</p>
                      </div>
                      <p className="text-[11px] text-[#20C997] mb-3 leading-relaxed">
                        현재 빠른 분석을 위해 최적화된 이미지를 사용했습니다. 글자가 뭉쳐 보이거나 금액이 틀리다면 원본 이미지 분석을 시도해 보세요.
                      </p>
                      <button 
                        disabled
                        className="w-full py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-400 cursor-not-allowed"
                      >
                        원본 이미지로 다시 분석하기 (준비 중)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[260] pointer-events-none">
              <div className="max-w-[480px] mx-auto p-6 sm:px-8 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-auto">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowVerification(false);
                      setRegistrationMethod('MANUAL');
                    }}
                    className="flex-1 h-16 bg-gray-100 text-[#8B95A1] font-bold rounded-2xl active:scale-[0.98] transition-all"
                  >
                    수정하기
                  </button>
                  <button
                    onClick={async () => {
                      if (isUploading) return;
                      if (selectedCategory === 'MEDICAL') {
                        await handleSave({ skipNavigation: true });
                        setShowVerification(false);
                        setShowInsight(true);
                      } else {
                        await handleSave();
                        setShowVerification(false);
                      }
                    }}
                    disabled={isUploading}
                    className={`flex-[2] h-16 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] ${isUploading ? 'bg-gray-300 shadow-none' : 'bg-[#12B886] shadow-[#E9FBF5]'}`}
                  >
                    {isUploading ? '업로드 중...' : '확인 완료'}
                  </button>
                </div>
                <p className="text-[10px] text-[#8B95A1] text-center leading-relaxed break-keep px-4 pt-4 mb-4">
                  AI 분석은 참고용이며 진단·처방을 대신할 수 없습니다. 실제 영수증 내역과 다를 수 있으니 저장 전 직접 확인해 주세요.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 10. Image Quality Warning Overlay */}
      <AnimatePresence>
        {showQualityWarning && ocrResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-10 h-10 text-orange-500" />
                </div>
                <h3 className="text-[20px] font-black text-[#191F28] mb-2">영수증이 잘 안 보여요</h3>
                <p className="text-[14px] text-[#8B95A1] font-medium leading-relaxed mb-6">
                  {(() => {
                    const issues = Array.isArray(ocrResult?.imageQuality?.issues) ? ocrResult.imageQuality.issues : [];
                    return (
                      <>
                        {issues.includes('blurry') && '사진이 조금 흐릿한 것 같아요. '}
                        {issues.includes('cut_off') && '영수증 끝부분이 잘려 보입니다. '}
                        {issues.includes('dark') && '조금 더 밝은 곳에서 촬영하면 정확해요. '}
                      </>
                    );
                  })()}
                  {(!ocrResult?.imageQuality || (ocrResult?.imageQuality?.issues ?? []).length === 0) && '분석 결과가 정확한지 확인해 주세요. '}
                  정확한 분석을 위해 다시 촬영해볼까요?
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowQualityWarning(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-14 bg-[#12B886] text-white font-black rounded-2xl shadow-lg shadow-[#E9FBF5] active:scale-95 transition-all"
                  >
                    다시 촬영하기
                  </button>
                  <button
                    onClick={() => {
                      setShowQualityWarning(false);
                      if (selectedCategory === 'MEDICAL') {
                        setShowVerification(true);
                      } else {
                        setShowInsight(true);
                      }
                    }}
                    className="w-full h-14 bg-gray-50 text-[#ADB5BD] font-bold rounded-2xl active:scale-95 transition-all"
                  >
                    그대로 확인하기
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* [NEW] 비회원 접근 제한 오버레이 */}
      <AnimatePresence>
        {isAnonymous && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl text-center border border-gray-100">
              <div className="w-20 h-20 bg-[#E9FBF5] rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-[#3182f6]" />
              </div>
              <h3 className="text-[22px] font-black text-[#191F28] mb-3">잠시만요!</h3>
              <p className="text-[14px] text-[#8B95A1] font-medium leading-relaxed mb-8">
                영수증 AI 분석과 정교한 지출 관리는<br />
                <span className="text-[#3182f6] font-bold">회원가입 후</span> 이용하실 수 있습니다.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full h-15 bg-[#12B886] text-white font-black rounded-2xl shadow-lg shadow-[#E9FBF5] active:scale-95 transition-all"
                >
                  로그인하고 시작하기
                </button>
                <button
                  onClick={() => navigate('/home')}
                  className="w-full h-15 bg-gray-50 text-[#ADB5BD] font-bold rounded-2xl active:scale-95 transition-all"
                >
                  그냥 둘러볼게요
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analysis Failure UI */}
      <AnimatePresence>
        {analysisError && (
          <div className="fixed inset-0 z-[450] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white w-full max-w-[360px] rounded-[40px] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-8">
                  ⚠️
                </div>
                <h3 className="text-[20px] font-black text-[#191F28] mb-4 leading-tight">
                  분석에 실패했습니다
                </h3>
                <p className="text-[14px] text-[#8B95A1] font-medium leading-relaxed mb-6 break-keep">
                  {analysisError.message}<br />
                  잠시 후 다시 시도하거나,<br />
                  수기 입력으로 직접 기록할 수 있어요.
                </p>

                {isPetLogDebug() && (
                  <div className="mb-8 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-left">
                    <p className="text-[10px] text-[#12B886] font-mono mb-2 uppercase tracking-widest">Debug Info</p>
                    <p className="text-[11px] text-slate-400 font-mono break-all line-clamp-3">
                      [{analysisError.stage}] {analysisError.debugMessage}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={handleRetry}
                    disabled={ocrLoading}
                    className="w-full h-16 bg-[#12B886] text-white font-black rounded-2xl shadow-xl shadow-[#E9FBF5] active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                  >
                    {ocrLoading ? '분석 중...' : '다시 분석하기'}
                  </button>
                  <button
                    onClick={() => {
                      setAnalysisError(null);
                      setRegistrationMethod('MANUAL');
                    }}
                    className="w-full h-14 bg-gray-50 text-[#191F28] font-bold rounded-2xl active:scale-[0.98] transition-all"
                  >
                    수기 입력으로 전환
                  </button>
                  <button
                    onClick={() => setAnalysisError(null)}
                    className="w-full h-10 text-[#ADB5BD] font-bold text-[14px]"
                  >
                    취소
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sean Ellis PMF Survey */}
      <AnimatePresence>
        {showPMFSurvey && (
          <PMFSurvey onClose={() => {
            setShowPMFSurvey(false);
            navigate('/home');
          }} />
        )}
      </AnimatePresence>
    </div>
  );
}
