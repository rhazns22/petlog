import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronUp, Search } from 'lucide-react';

export default function FAQ() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const faqs = [
    { 
      id: 1, 
      category: '영수증 분석', 
      q: '영수증 분석이 잘되지 않아요.', 
      a: '영수증이 너무 구겨졌거나, 빛 반사가 심할 경우 인식이 어려울 수 있습니다. 글자가 잘 보이도록 평평한 곳에서 촬영해 주세요. 분석이 어려운 경우 직접 수기 입력을 통해서도 기록이 가능합니다.' 
    },
    { 
      id: 2, 
      category: '지출 기록', 
      q: 'AI가 분석한 금액이나 카테고리가 달라요.', 
      a: 'AI 분석 결과는 영수증 상태에 따라 오차가 발생할 수 있는 참고용 데이터입니다. 저장 전 반드시 내용을 확인하고 수정해 주세요. 지속적인 학습을 통해 정확도를 높여가고 있습니다.' 
    },
    { 
      id: 3, 
      category: '지출 기록', 
      q: '지출 내역이 자동으로 불러와지지 않아요.', 
      a: 'PetLog는 현재 카드사나 은행 계좌와 자동으로 연동되는 기능을 제공하지 않습니다. 번거로우시더라도 영수증 분석 기능을 이용하시거나 직접 수기로 지출을 등록해 주세요.' 
    },
    { 
      id: 4, 
      category: '이용', 
      q: '카드 등록 기능이 있나요?', 
      a: '현재 PetLog는 앱 내 카드 등록이나 직접 결제 기능을 제공하지 않습니다. 지출을 관리하고 기록하는 용도로 이용해 주시기 바랍니다.' 
    },
    { 
      id: 5, 
      category: '계정', 
      q: '회원 탈퇴는 어떻게 하나요?', 
      a: '계정 설정 하단의 회원 탈퇴 버튼을 통해 진행하실 수 있습니다. 탈퇴 시 모든 데이터는 삭제되며 복구할 수 없습니다.' 
    },
    { 
      id: 6, 
      category: '반려동물', 
      q: '반려동물은 몇 마리까지 등록 가능한가요?', 
      a: '현재 인당 최대 10마리까지 등록하여 관리하실 수 있습니다.' 
    },
    { 
      id: 7, 
      category: '이용', 
      q: '예산 설정은 어떻게 변경하나요?', 
      a: '홈 화면 상단의 예산 관리 버튼을 클릭하여 카테고리별로 이번 달 예산을 수정하실 수 있습니다.' 
    },
    { 
      id: 8, 
      category: '케어 기록', 
      q: '케어 기록 후보는 무엇인가요?', 
      a: 'Care Insight에서 제공하는 정보는 진단이나 처방이 아닌, 영수증 내역을 바탕으로 분석된 케어 기록 후보입니다. 병원에서 안내받은 일정이나 관리 사항을 PetLog에 기록으로 남기는 용도로 활용해 주세요.' 
    },
    { 
      id: 9, 
      category: '계정', 
      q: '카카오나 Apple 로그인이 안 돼요.', 
      a: '현재 카카오 및 Apple 로그인은 준비 중입니다. 당분간은 이메일 가입 또는 Google 로그인을 이용해 주시기 바랍니다. 빠른 시일 내에 추가하도록 하겠습니다.' 
    },
    { 
      id: 10, 
      category: '서비스', 
      q: 'PetLog는 정식 출시된 서비스인가요?', 
      a: 'PetLog는 현재 클로즈 베타 서비스 중입니다. 이용 중 분석 오차나 예기치 못한 오류가 발생할 수 있습니다. 피드백을 주시면 더 나은 서비스로 보답하겠습니다.' 
    },
  ];

  const filteredFaqs = faqs.filter(f => f.q.includes(search) || f.category.includes(search));

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAF9]">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold">자주 묻는 질문</span>
        <div className="w-10" />
      </div>

      <div className="p-6">
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="궁금한 내용을 검색해보세요"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 bg-white border border-gray-100 rounded-[10px] px-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#E9FBF5] shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
        </div>

        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <div key={faq.id} className="bg-white rounded-[10px] border border-gray-100 overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full p-5 flex items-start gap-4 text-left active:bg-gray-50 transition-colors"
              >
                <span className="text-[#12B886] font-black text-sm">Q.</span>
                <div className="flex-1">
                  <span className="text-[10px] text-[#ADB5BD] font-bold block mb-1">{faq.category}</span>
                  <span className="text-sm font-bold text-[#191F28]">{faq.q}</span>
                </div>
                {openId === faq.id ? <ChevronUp className="w-5 h-5 text-gray-300" /> : <ChevronDown className="w-5 h-5 text-gray-300" />}
              </button>
              {openId === faq.id && (
                <div className="p-5 bg-gray-50 border-t border-gray-50 flex gap-4">
                  <span className="text-gray-300 font-black text-sm">A.</span>
                  <p className="text-xs text-[#8B95A1] leading-relaxed font-medium">
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 bg-[#12B886]/10 p-6 rounded-[28px] text-center border border-[#12B886]/20">
          <p className="text-sm font-bold text-[#191F28] mb-4">원하시는 답변을 찾지 못하셨나요?</p>
          <button 
            onClick={() => navigate('/inquiry')}
            className="w-full h-14 bg-[#12B886] text-white font-bold rounded-2xl shadow-lg shadow-[#12B886]/10"
          >
            1:1 문의하기
          </button>
        </div>
      </div>
    </div>
  );
}
