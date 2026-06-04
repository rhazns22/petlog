import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const TERM_CONTENT: Record<string, { title: string; content: string; date: string }> = {
  service: {
    title: '서비스 이용약관',
    date: '2026.05.06 개정',
    content: `제1조(목적)
본 약관은 PetLog 서비스를 운영하는 주라클라바(대표 박주은)(이하 "회사")와 회원의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조(서비스의 내용)
회사는 반려동물 건강 및 지출 관리를 위해 다음과 같은 서비스를 제공합니다.
1. 반려동물 지출 내역 수기 입력 및 관리
2. 영수증 이미지 OCR 분석을 통한 데이터 추출
3. 병원비, 사료, 용품 등 카테고리별 지출 통계
4. AI 지출 브리핑 및 월간 리포트
5. 영수증 기반 케어 기록 후보 제공
6. 베타 서비스 개선을 위한 피드백 수집 및 분석

제3조(AI 분석 및 책임의 제한)
1. 서비스에서 제공하는 AI 분석 결과는 영수증 이미지를 바탕으로 생성된 참고용 데이터이며, 실제 영수증 내역과 다를 수 있습니다. 회원은 지출 내역 저장 전 반드시 내용을 직접 확인하고 수정해야 합니다.
2. PetLog는 질병의 진단, 처방, 치료 방법 안내 등 수의학적 판단을 제공하지 않습니다. 반려동물의 건강 상태에 대한 정확한 판단은 동물병원 또는 수의사의 안내를 따라야 합니다.
3. 회사는 현재 카드 결제, 금융사 계좌 연동, 보험 가입 추천 또는 보험 중개 서비스를 제공하지 않습니다.

제4조(베타 서비스 특약)
본 서비스는 현재 클로즈 베타 테스트 단계로, 기능의 변경, 분석 오류, 서비스 지연 또는 일시 중단이 발생할 수 있습니다. 회사는 베타 서비스 기간 동안 수집된 피드백을 바탕으로 서비스를 개선하며, 이 과정에서 사전 고지 없이 기능이 수정될 수 있습니다.`,
  },
  privacy: {
    title: '개인정보 처리방침',
    date: '2026.05.06 개정',
    content: `회사는 회원의 개인정보를 중요시하며, 개인정보 보호법 등 관련 법령을 준수합니다.

1. 개인정보의 수집 및 이용 목적
회사는 다음의 목적을 위하여 개인정보를 처리합니다.
- 회원 가입 및 관리
- 반려동물별 지출 분석 및 케어 이력 관리 지원
- 영수증 OCR 및 AI 분석을 통한 지출 기록 자동화
- 베타 서비스 기간 내 혜택 제공 및 피드백 수집
- 서비스 품질 개선 및 통계 분석

2. 수집하는 개인정보 항목
- 필수항목: 이메일, 닉네임, 서비스 이용 기록
- 서비스 이용정보 (회원 계정과 연결된 정보): 반려동물 정보(이름, 종류, 품종, 생일, 성별, 몸무게 등), 지출 내역, 분석 리포트 데이터
- 영수증 데이터: 업로드된 영수증 이미지 및 추출된 텍스트 데이터
- 영수증 이미지 안내: 영수증에는 병원명, 결제일, 금액, 카드 승인 정보, 보호자 이름 또는 연락처 등이 포함될 수 있으므로, 업로드 전 불필요한 개인정보를 가리는 것을 권장합니다.
- 기기 정보: 기기 모델명, OS 버전, 접속 로그 등

3. 개인정보의 처리위탁 및 국외 이전
회사는 서비스 제공을 위해 다음과 같이 외부 클라우드 및 인프라 서비스를 이용하고 있으며, 이 과정에서 개인정보 처리가 위탁될 수 있습니다.
- 인프라 제공 및 데이터 보관: Firebase (Authentication, Firestore, Storage), Google Cloud Platform
- 서비스 호스팅 및 API 프록시: Vercel
- AI 분석 엔진: Google Gemini API
- 국외 처리 및 이전 안내: Firebase, Google Cloud Platform, Google Gemini API 등 외부 서비스를 이용하는 과정에서 개인정보 또는 서비스 이용정보의 국외 처리 또는 국외 이전이 발생할 수 있습니다. 이는 글로벌 클라우드 인프라를 활용한 서비스 제공을 위해 필수적인 과정이며, 각 제공자의 보안 정책 및 표준 계약 조항에 따라 안전하게 관리됩니다. 구체적인 이전 항목, 국가 및 보유 기간은 해당 서비스 제공자의 정책에 따릅니다.

4. AI 분석 및 데이터 정책
- 회사는 영수증 OCR 분석 및 AI 지출 브리핑 제공을 위해 Google Gemini API를 사용합니다. Gemini API로 전송되는 정보(영수증 이미지 및 텍스트)는 영수증 분석, 지출 브리핑, 케어 기록 후보 생성을 위한 목적으로만 사용됩니다.
- AI 분석 결과는 지출 기록 및 케어 기록 관리를 돕는 참고 정보이며, 전문적인 진단이나 처방을 제공하지 않습니다.
- 회사는 이용자의 데이터를 PetLog 자체 AI 모델 학습 목적으로 사용하지 않습니다. 다만 외부 API 제공자의 데이터 처리 방식은 해당 제공자의 약관 및 개인정보 처리방침, API 이용 조건에 따를 수 있습니다.

5. 개인정보의 보유 및 이용기간, 파기 절차
- 회사는 회원 탈퇴 시까지 또는 이용 목적 달성 시까지 개인정보를 보유합니다. 이용 목적이 달성되거나 탈퇴 요청이 있는 경우, 수집된 개인정보는 지체 없이 파기합니다.
- 영수증 이미지는 분석 완료 후 안전한 클라우드 스토리지에 보관되며, 회원이 해당 기록을 삭제하거나 탈퇴하는 경우 파기 절차에 따라 삭제됩니다.
- 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 영구 삭제합니다.

6. 개인정보 보호책임자 및 문의
- 개인정보 보호책임자: 박주은
- 문의 이메일: pje698112@naver.com
- 문의 채널: PetLog 카카오톡 비즈니스 채널`,
  },
  location: {
    title: '위치기반 서비스 안내',
    date: '2026.05.06 고지',
    content: `현재 PetLog는 위치기반 서비스를 제공하지 않습니다.

향후 주변 동물병원 또는 펫샵 안내 등 위치 기반 기능을 제공할 경우, 관련 법령에 따른 절차와 별도 약관 고지를 진행할 예정입니다.`,
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    date: '선택사항',
    content: `회원은 회사가 제공하는 베타테스트 안내, 신규 기능, 이벤트, 혜택 정보를 이메일, 앱 푸시, 카카오톡 비즈니스 채널 또는 회원이 선택적으로 제공한 연락 수단을 통해 수신하는 것에 동의할 수 있습니다.

마케팅 정보 수신 동의는 선택사항이며, 동의하지 않아도 기본 서비스 이용은 가능합니다.`,
  },
};

export default function TermDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const data = id ? TERM_CONTENT[id] : null;

  if (!data) {
    return <div className="p-10 text-center">약관을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6 text-[#191F28]" />
        </button>
        <span className="text-base font-bold">{data.title}</span>
        <div className="w-10" />
      </div>

      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-xl font-black text-[#191F28] mb-2">{data.title}</h2>
          <p className="text-xs text-[#ADB5BD] font-bold">{data.date}</p>
        </div>

        <div className="prose prose-sm max-w-none">
          <pre className="text-xs text-[#4E5968] font-medium whitespace-pre-wrap leading-loose font-sans">
            {data.content}
          </pre>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col items-center gap-3">
          <img src="/logo.png?v=2" alt="PetLog Logo" className="w-6 h-6 rounded-[5px] opacity-50" />
          <p className="text-[10px] text-gray-300 font-bold text-center">
            PetLog 반려동물 지출 관리 플랫폼
          </p>
        </div>
      </div>
    </div>
  );
}
