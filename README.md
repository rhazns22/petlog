# 🐾 PetLog (펫로그) v3.1.0 RC
> **AI 기반 반려동물 의료비 데이터 분석 및 관리 플랫폼 (Beta Release Candidate)**

<div align="center">
  <img src="logo.png" alt="PetLog Logo" width="220"/>
  <br/>
  
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-v12-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![Gemini](https://img.shields.io/badge/Google%20Gemini-Flash--2.5-4285F4?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
  [![License](https://img.shields.io/badge/License-Proprietary-red)](#)
</div>

---

## 🚀 Vision
동물병원 영수증은 복잡하고 어렵습니다. **PetLog**는 단순한 OCR을 넘어, AI 분석 결과와 사용자의 검증을 결합한 **Human-in-the-loop** 엔진을 통해 보호자가 반려동물의 의료 데이터를 완벽하게 이해하고 관리할 수 있도록 돕습니다.

## ⚙️ 핵심 파이프라인 (The Engine)

### 🖼️ 이미지 최적화 및 보호 시스템 (v3.5)
OCR 정확도를 유지하면서도 분석 속도와 비용을 최적화하기 위한 지능형 이미지 파이프라인을 탑재했습니다.
- **해상도 가변 최적화**: 긴 변 2000px 기준 리사이징 및 짧은 변 900px 가독성 보호 로직.
- **데이터 분리 저장**: 분석용 이미지는 휘발성 메모리에서 처리 후 즉시 파기되며, 원본 이미지는 고품질로 Firebase Storage에 별도 보관하여 데이터 무결성을 보장합니다.

### 📝 지출 기록 리포트 및 법적 리스크 완화
저장된 지출 기록은 구조화된 PDF 리포트로 제공되되, 공식 증빙과의 혼동을 방지하기 위한 가이드레일을 적용했습니다.
- **기록 리포트 (PDF)**: 스크린샷 캡처가 아닌 정돈된 데이터 기반의 리포트 생성.
- **고지 의무 준수**: 공식 영수증, 세무 증빙, 보험 청구용 서류를 대체하지 않음을 명확히 고지하여 법적 오해 소지를 최소화했습니다.

### 🛡️ 안전한 AI 가이드 (Care Insight)
반려동물 건강 정보는 예민합니다. PetLog는 법적·윤리적 가이드라인을 준수하기 위해 강력한 가이드레일을 적용합니다.
- **진단 및 처방 금지**: AI가 의학적 진단을 내리지 않도록 특정 질환 단어 사용 시 안전한 안내 문구(Fallback)로 실시간 대체.
- **기록 중심 제안**: 모든 조언은 "기록 관리" 및 "병원 안내 준수"에 한정됩니다.

---

## ✨ 주요 기능 (Beta RC)

| 기능 | 상세 설명 |
| :--- | :--- |
| **스마트 OCR** | 영수증 사진 한 장으로 상호명, 날짜, 결제 수단, 모든 세부 항목 자동 추출 |
| **의료비 6대 분류** | 진찰, 검사, 처치, 입원, 수술, 약제 항목을 전문적인 구조로 자동 분류 |
| **지출 기록 리포트** | 개인 기록 관리용 PDF 리포트 생성 및 저장 기능 (기록 PDF 저장) |
| **금융 데이터 처리** | 부가세(VAT) 분리 분석 및 전체 할인액(Global Discount) 자동 안분 처리 |
| **지출 코칭** | 주간 지출 트렌드 분석 및 예산 대비 효율적인 소비 제안 (AI 브리핑) |
| **문의하기 (Beta)** | 서비스 이용 중 불편 사항을 텍스트 기반으로 빠르게 접수 |

> [!NOTE]
> 포인트, 이벤트, 혜택 기능은 서비스 안정화를 위해 베타 기간 동안 비활성화되었습니다.

---

## 💻 Tech Stack

- **AI**: Google Gemini 2.5 Flash (Stable Model)
- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Animation**: Motion/React (Framer Motion)
- **Infrastructure**: Firebase (Auth, Firestore, Storage), Vercel
- **QA Metrics**: `compressionRatio`, `analysisDurationMs`, `avgConfidence` 등 상세 로그 추적

---

## 🛠️ Beta RC Stabilization (v3.1.0)
베타 릴리즈를 위한 최종 안정화 패치가 적용되었습니다.
- **Fail-Safe UI**: 네트워크 오류 또는 데이터 부재 시에도 화면 레이아웃이 깨지지 않도록 모든 AI 카드에 Fallback 상태 구현.
- **보안 강화 (Re-authentication)**: 서비스 탈퇴 등 민감한 작업 시 Google/Email 재인증 프로세스 의무화로 보안성 강화.
- **중앙집중형 디버그 시스템**: `isPetLogDebug()` 유틸리티를 통한 전역적 ReferenceError 방지 및 보안 로그 정책 강화.
- **AI 파이프라인 블록 해소**: `/api/analyze-receipt` 상호 스키마 불일치 해결 및 400 Bad Request 오류 완벽 수정.
- **Care Insight 안전 가이드**: 특정 질환 키워드 감지 시 AI 진단/처방 유도를 방지하는 세이프티 가드레일(Fallback) 강화.
- **한국어 전용 최적화**: 미완성된 다국어 기능을 제거하고 한국어 사용자 경험에 집중.

---

## 📘 Developer Guide

### 1. 로컬 환경 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# VITE_GEMINI_API_KEY 및 Firebase 정보 입력

# 개발 서버 실행
npm run dev
```

### 2. 디버그 모드 (PETLOG_DEBUG)
개발 및 품질 검수(QA)를 위해 상세 로그를 활성화할 수 있습니다.
- **활성화**: 브라우저 콘솔에서 `localStorage.setItem('PETLOG_DEBUG', 'true')` 실행 후 새로고침.
- **기능**: 이미지 최적화 지표, AI Raw Data, 정산 오차 상세 내역, 세니타이징 감지 로그 출력.

---

## 📂 프로젝트 구조

```text
src/
├── components/     # 재사용 가능한 UI 및 검증 오버레이
├── contexts/       # Auth, Usage, Toast 등 전역 상태 관리
├── lib/            # AI(Gemini), Firebase, 이미지 처리(imageUtils)
├── pages/          # ManualInput(핵심), TransactionDetail(리포트), Home 등
├── utils/          # 데이터 가공 및 포맷팅 유틸리티
└── styles/         # Tailwind CSS v4 기반 디자인 시스템
```

---

## ⚖️ 라이선스 및 저작권

**Produced by 박주원**  
© 2026 PetLog. All rights reserved.

본 프로젝트의 코드, UI 디자인, 데이터 처리 알고리즘 및 분석 로직의 무단 복제, 배포, 상업적 사용은 엄격히 금지됩니다. 본 서비스에서 생성된 PDF 리포트는 참고용이며 법적 증빙 자료로 활용될 수 없습니다. 위반 시 법적 책임이 발생할 수 있습니다.
