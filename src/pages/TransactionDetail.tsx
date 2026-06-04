import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Share2, Download, Printer, Scissors, Stethoscope, Utensils, ShieldCheck, Tag, Edit2, Trash2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { getPetDefaultImage } from '../lib/petUtils';
import PetAvatar from '../components/PetAvatar';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import { isPetLogDebug, getTransactionAmount } from '../lib/utils';

const CATEGORY_ICONS: Record<string, { icon: React.ReactNode, label: string, color: string }> = {
  'FOOD': { icon: <Utensils className="w-6 h-6" />, label: '사료·간식', color: 'bg-[#FFB020]' },
  'MEDICAL': { icon: <Stethoscope className="w-6 h-6" />, label: '병원비', color: 'bg-[#12B886]' },
  'GROOMING': { icon: <Scissors className="w-6 h-6" />, label: '미용·용품', color: 'bg-[#EC4899]' },
  'INSURANCE': { icon: <ShieldCheck className="w-6 h-6" />, label: '보험료', color: 'bg-[#20C997]' },
  'OTHER': { icon: <Tag className="w-6 h-6" />, label: '기타', color: 'bg-[#8B95A1]' },
};

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pet, setPet] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !id) return;

    async function fetchDetail() {
      try {
        const docRef = doc(db, 'users', user!.uid, 'transactions', id!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTransaction(data);
          
          if (data.petId) {
            const petRef = doc(db, 'users', user!.uid, 'pets', data.petId);
            const petSnap = await getDoc(petRef);
            if (petSnap.exists()) {
              setPet(petSnap.data());
            }
          }
        }
      } catch (error) {
        console.error('Error fetching detail:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [user, id]);

  const handleDelete = async () => {
    if (!user || !id) return;
    setDeleting(true);

    // [v2.5.2] Firebase Storage 영수증 이미지 자동 파기
    try {
      if (transaction?.storagePath) {
        try {
          await deleteObject(ref(storage, transaction.storagePath));
          if (isPetLogDebug()) console.log('[Storage] Image successfully deleted:', transaction.storagePath);
        } catch (error: any) {
          if (
            error?.code === 'storage/object-not-found' ||
            String(error?.message ?? '').includes('object-not-found') ||
            String(error?.message ?? '').includes('404')
          ) {
            if (isPetLogDebug()) console.warn('[Storage Delete] file already missing, continue deleting Firestore document');
          } else {
            console.error('Storage Delete Error:', error);
          }
        }
      }
    } catch (error: any) {
      if (isPetLogDebug()) console.warn('[Storage] Image deletion hook failed:', error);
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
      showToast('기록이 삭제되었습니다.', 'success');
      navigate('/home');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleEdit = () => {
    navigate(`/input?id=${id}`);
  };

  const handleDownload = () => {
    // [PetLog QA] PDF 저장 기능은 window.print()를 활용하여 
    // 브라우저의 PDF 저장 기능을 트리거합니다.
    // 인쇄 모드 시 전용 리포트 레이아웃이 활성화됩니다.
    window.print();
    showToast('PDF 저장 기능을 실행합니다. 프린터 설정에서 "PDF로 저장"을 선택해 주세요.', 'info');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9] animate-pulse">
      <div className="h-14 bg-white border-b border-[#F2F4F6]" />
      <div className="flex-1 px-6 pt-8 pb-32">
        <div className="bg-white rounded-[24px] h-[400px] w-full" />
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="h-14 bg-white rounded-[24px]" />
          <div className="h-14 bg-white rounded-[24px]" />
        </div>
      </div>
    </div>
  );
  if (!transaction) return <div className="flex flex-col items-center justify-center min-h-screen text-[#8B95A1] p-6 text-center">
    <p className="mb-4">거래 내역을 찾을 수 없습니다.</p>
    <button onClick={() => navigate(-1)} className="text-[#12B886] font-bold">돌아가기</button>
  </div>;

  const cat = CATEGORY_ICONS[transaction.category] || CATEGORY_ICONS['OTHER'];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-white sticky top-0 z-10 border-b border-[#F2F4F6] print:hidden">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold text-[#191F28]">결제 상세</span>
        <div className="flex items-center gap-1">
          <button onClick={handleEdit} className="p-2 text-[#8B95A1] hover:text-[#12B886] transition-colors">
            <Edit2 className="w-5 h-5" />
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="p-2 text-[#8B95A1] hover:text-[#F04452] transition-colors" disabled={deleting}>
            <Trash2 className="w-5 h-5" />
          </button>
          <button className="p-2 text-[#8B95A1]">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-32">
        <motion.div 
          ref={receiptRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-[#F2F4F6] flex flex-col relative"
        >
          {/* Top Receipt Decorative Edge */}
          <div className="absolute top-0 left-0 right-0 h-1 flex justify-around print:hidden">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="w-4 h-2 bg-[#F8FAF9] rounded-full -translate-y-1" />
            ))}
          </div>

          <div className="p-8 pb-6 flex flex-col items-center">
            <div className={`w-14 h-14 rounded-2xl ${cat.color} flex items-center justify-center text-white mb-4 shadow-lg shadow-[#0B2F2A]/5`}>
              {cat.icon}
            </div>
            <h2 className="text-xl font-bold text-[#191F28] mb-1">{transaction.title}</h2>
            <p className="text-sm text-[#8B95A1] font-medium mb-6">{cat.label} • {transaction.memo || '결제 완료'}</p>
            
            <div className="w-full h-px border-t border-dashed border-[#F2F4F6] mb-6" />
            
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#8B95A1] font-medium">결제 금액</span>
                <span className="text-lg font-black text-[#191F28]">-{getTransactionAmount(transaction).toLocaleString()}원</span>
              </div>

              {/* Medical Details Breakdown */}
              {transaction.category === 'MEDICAL' && transaction.medicalDetails && (
                <div className="my-4 p-6 px-10 bg-[#E9FBF5]/50 rounded-[24px] border border-[#12B886]/10">
                  <div className="flex items-center justify-center gap-1.5 mb-5">
                    <Sparkles className="w-3.5 h-3.5 text-[#12B886] fill-[#12B886]" />
                    <span className="text-[10px] font-black text-[#12B886] uppercase tracking-widest">병원비 상세 분석</span>
                  </div>
                  <div className="space-y-3 max-w-[280px] mx-auto">
                    {[
                      { label: '진료/상담', value: transaction.medicalDetails.diagnosis },
                      { label: '검사/진단', value: transaction.medicalDetails.test },
                      { label: '처치/주사', value: transaction.medicalDetails.treatment },
                      { label: '수술/마취', value: transaction.medicalDetails.surgery },
                      { label: '약제/조제', value: transaction.medicalDetails.medicine },
                    ].filter(item => (item.value || 0) > 0).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-[12px] font-bold text-[#8B95A1]">{item.label}</span>
                        <span className="text-[13px] font-black text-[#191F28]">{item.value.toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Subtle divider if there are items */}
                  {Object.values(transaction.medicalDetails).some(v => Number(v) > 0) && (
                    <div className="mt-5 pt-4 border-t border-[#12B886]/10 flex justify-between items-center max-w-[280px] mx-auto">
                      <span className="text-[11px] font-bold text-[#12B886]">분석 총액</span>
                      <span className="text-[14px] font-black text-[#12B886]">
                        {Object.values(transaction.medicalDetails).reduce((a: any, b: any) => Number(a) + Number(b), 0).toLocaleString()}원
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-[#8B95A1] font-medium">결제 일시</span>
                <span className="text-[#191F28] font-bold">{transaction.date}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#8B95A1] font-medium">대상 반려동물</span>
                <div className="flex items-center gap-1.5">
                   <PetAvatar pet={pet} size="sm" />
                   <span className="text-[#191F28] font-bold">{pet?.name || transaction.petName || '공통'}</span>
                 </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#8B95A1] font-medium">결제 수단</span>
                <span className="text-[#191F28] font-bold">{transaction.paymentMethod || '미상'}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 px-6 print:hidden space-y-4">
          <button 
            onClick={handleDownload}
            className="w-full h-14 bg-white rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-[#8B95A1] shadow-sm border border-[#F2F4F6] active:scale-95 transition-transform"
          >
            <Download className="w-4 h-4" /> 기록 PDF 저장
          </button>
          
          <div className="bg-[#F8FAF9] p-4 rounded-xl border border-[#F2F4F6]">
            <p className="text-[11px] text-[#8B95A1] leading-relaxed break-keep text-center">
              iPhone/Android에서는 <span className="font-bold">공유 또는 인쇄 메뉴</span>에서 PDF로 저장할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[200] flex items-end justify-center px-4 pb-10 print:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#FEF2F2] rounded-2xl flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-[#F04452]" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-[#191F28]">정말 삭제할까요?</h3>
              <p className="text-sm text-[#8B95A1] mb-6 font-medium leading-relaxed">
                삭제된 결제 내역은 다시 복구할 수 없어요.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 h-14 bg-[#F8FAF9] text-[#8B95A1] font-bold rounded-2xl active:scale-95 transition-transform"
                >
                  취소
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 h-14 bg-[#F04452] text-white font-bold rounded-2xl active:scale-95 transition-transform shadow-lg shadow-[#F04452]/20"
                >
                  삭제하기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Navbar />
      
      {/* [PetLog PDF Report] 인쇄 전용 리포트 레이아웃 (화면에서는 숨김) */}
      <div className="hidden print:block fixed inset-0 bg-white p-12 z-[500] text-[#191F28]">
        <div className="flex justify-between items-start border-b-2 border-[#12B886] pb-6 mb-8">
          <div>
            <h1 className="text-[28px] font-black text-[#12B886] mb-2">PetLog 지출 기록 리포트</h1>
            <p className="text-[12px] text-[#8B95A1] font-bold italic">펫로그 인공지능 영수증 분석 파이프라인 v3.5</p>
          </div>
          <div className="text-right">
            <p className="text-[14px] font-black text-[#191F28]">{transaction.title}</p>
            <p className="text-[12px] text-[#8B95A1] font-medium">{transaction.date} 결제</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-10">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-[#8B95A1] font-black uppercase mb-1 tracking-widest">반려동물 정보</p>
              <p className="text-[16px] font-black">{pet?.name || transaction.petName || '공통'}</p>
              <p className="text-[12px] text-[#8B95A1]">{pet?.breed || '품종 정보 없음'}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#8B95A1] font-black uppercase mb-1 tracking-widest">결제 일시 및 수단</p>
              <p className="text-[14px] font-bold">{transaction.date}</p>
              <p className="text-[12px] text-[#8B95A1]">{transaction.paymentMethod || '미상'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#8B95A1] font-black uppercase mb-1 tracking-widest">최종 지출 금액</p>
            <p className="text-[32px] font-black text-[#191F28] tracking-tighter">
              {getTransactionAmount(transaction).toLocaleString()}원
            </p>
            {transaction.totalDiscountAmount > 0 && (
              <p className="text-[12px] text-[#F04452] font-bold mt-1">할인 적용: -{transaction.totalDiscountAmount.toLocaleString()}원</p>
            )}
          </div>
        </div>

        {/* 상세 분석 항목 */}
        {transaction.category === 'MEDICAL' && transaction.medicalDetails && (
          <div className="bg-[#F8FAF9] rounded-2xl p-8 mb-10 border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-[#12B886] fill-[#12B886]" />
              <h3 className="text-[16px] font-black">병원비 AI 상세 분석 결과 (참고용)</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              {[
                { label: '진료/상담', value: transaction.medicalDetails.diagnosis },
                { label: '검사/진단', value: transaction.medicalDetails.test },
                { label: '처치/주사', value: transaction.medicalDetails.treatment },
                { label: '입원/면회', value: transaction.medicalDetails.hospitalization },
                { label: '수술/마취', value: transaction.medicalDetails.surgery },
                { label: '약제/조제', value: transaction.medicalDetails.medicine },
                { label: '사료/간식', value: transaction.medicalDetails.food },
                { label: '용품/기타', value: transaction.medicalDetails.supplies || transaction.medicalDetails.other },
              ].filter(item => (item.value || 0) > 0).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-gray-200/50 pb-2">
                  <span className="text-[13px] text-[#8B95A1] font-bold">{item.label}</span>
                  <span className="text-[14px] font-black text-[#191F28]">{item.value.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-8 mb-12">
          <div>
            <p className="text-[10px] text-[#8B95A1] font-black uppercase mb-2 tracking-widest">사용자 메모</p>
            <p className="text-[14px] leading-relaxed text-[#191F28] whitespace-pre-wrap">
              {transaction.memo || '저장된 메모가 없습니다.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-100">
            <div>
              <p className="text-[9px] text-[#8B95A1] font-bold mb-1">AI 분석 정보</p>
              <p className="text-[11px] font-bold">분석 상태: 참고용</p>
              <p className="text-[11px] font-bold">금액 검증: {transaction.totalValidationPassed ? '통과' : '확인 필요'}</p>
            </div>
            <div>
              <p className="text-[9px] text-[#8B95A1] font-bold mb-1">이미지 데이터</p>
              <p className="text-[11px] font-bold">원본 이미지: {transaction.storagePath ? '보관됨' : '미보관'}</p>
              <p className="text-[11px] font-bold">분석 방식: {transaction.analysisImageUsed ? '최적화 이미지' : '원본 이미지'}</p>
            </div>
            <div>
              <p className="text-[9px] text-zinc-400 font-bold mb-1">리포트 정보</p>
              <p className="text-[11px] font-bold">생성 일시: {new Date().toLocaleDateString()}</p>
              <p className="text-[11px] font-bold">기록 ID: {id?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* 법적 고지 문구 */}
        <div className="bg-[#FFFBEB] p-6 rounded-xl border border-[#FFB020]/20 mt-auto">
          <p className="text-[10px] text-[#FFB020] font-black uppercase mb-2 tracking-widest">필수 안내 및 법적 고지</p>
          <p className="text-[11px] text-[#666] leading-relaxed break-keep">
            본 문서는 PetLog 서비스에 저장된 반려동물 지출 기록 및 AI 분석 결과를 정리한 참고용 리포트입니다.
            본 문서는 병원, 카드사, 국세청 또는 결제기관이 발급한 공식 영수증, 세금계산서, 현금영수증, 카드매출전표를 대체하지 않습니다.
            AI 분석 결과는 실제 영수증 내역과 다를 수 있으며, 사용자가 저장 전 확인한 기록을 기준으로 표시됩니다.
            증빙 제출이 필요한 경우 원본 영수증, 카드매출전표, 현금영수증, 세금계산서 등 발급기관의 원본 자료를 함께 확인·보관해 주세요.
          </p>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[12px] text-[#12B886] font-black tracking-widest">PetLog Pet-Care Analytics</p>
        </div>
      </div>
    </div>
  );
}
