import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, ChevronRight } from 'lucide-react';

export default function Terms() {
  const navigate = useNavigate();

  const termItems = [
    { id: 'service', title: '서비스 이용약관', date: '2026.05.06 개정' },
    { id: 'privacy', title: '개인정보 처리방침', date: '2026.05.06 개정' },
    { id: 'location', title: '위치기반 서비스 안내', date: '2026.05.06 고지' },
    { id: 'marketing', title: '마케팅 정보 수신 동의', date: '선택사항' },
    { id: 'opensource', title: '오픈소스 라이선스', date: 'v1.0.4' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold">이용약관 및 정책</span>
        <div className="w-10" />
      </div>

      <div className="p-6">
        <div className="flex flex-col items-center py-10 mb-6">
          <div className="w-16 h-16 bg-white shadow-xl shadow-[#E9FBF5] flex items-center justify-center mb-6 overflow-hidden rounded-[15px]">
            <img src="/logo.png?v=2" alt="PetLog Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-lg font-black text-[#191F28] tracking-tight">반려동물 지출 관리 PetLog</h2>
          <p className="text-[10px] text-[#ADB5BD] mt-1 font-medium italic">건전하고 투명한 반려생활을 지향합니다.</p>
        </div>

        <div className="bg-white rounded-[10px] overflow-hidden shadow-sm border border-gray-100">
          {termItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => navigate(`/terms/${item.id}`)}
              className={`w-full p-6 flex items-center justify-between text-left active:bg-gray-50 transition-colors ${i !== termItems.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <div>
                <h4 className="text-sm font-black text-[#191F28] mb-0.5">{item.title}</h4>
                <p className="text-[10px] text-gray-300 font-bold">{item.date}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>

        <div className="mt-10 px-6 text-center">
           <p className="text-[10px] text-gray-300 leading-relaxed font-medium">
             본 약관은 PetLog 서비스 이용에 관한 권리와 의무를 규정합니다. 궁금한 사항이 있으시면 고객센터로 문의해 주세요.
           </p>
        </div>
      </div>
    </div>
  );
}
