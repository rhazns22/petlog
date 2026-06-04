import { GoogleGenerativeAI } from "@google/generative-ai";
import { isPetLogDebug } from "./utils";

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 지출 내역을 바탕으로 AI 통찰력을 생성합니다.
 * 여러 모델을 시도하고 할당량 초과 시 재시도합니다.
 */
export async function generateSpendingInsight(transactions: any[], petInfo: any[], language: string = 'ko') {
  if (!genAI) {
    throw new Error("AI API Key가 설정되지 않았습니다.");
  }

  if (transactions.length === 0) {
    return language === 'ko' ? "아직 분석할 지출 내역이 없어요. 영수증을 등록하시면 제가 꼼꼼하게 분석해 드릴게요! 🐾" : "No transactions to analyze yet. Register a receipt and I'll analyze it for you! 🐾";
  }

  // 지출 데이터를 요약하여 프롬프트 작성
  const summary = transactions.map(t => ({
    title: t.title,
    amount: t.amount,
    category: t.category,
    date: t.date,
    memo: t.memo,
    petName: petInfo.find(p => p.id === t.petId)?.name || '알수없음'
  }));

  const prompt = `You are a professional pet health and financial advisor. Based on the following monthly pet-related spending data, provide exactly 3 helpful insights in ${language === 'ko' ? 'Korean' : 'English'}.
  
  Spending Data: ${JSON.stringify(summary)}
  Pet Info: ${JSON.stringify(petInfo.map(p => ({ name: p.name, type: p.type, breed: p.breed, age: p.birthDate, weight: p.weight })))}
  
  Guidelines:
  1. Use ONLY these 3 prefixes: [분석], [팁], [칭찬].
  2. Provide exactly one insight for EACH category (One [분석], one [팁], and one [칭찬]).
  3. Start each line DIRECTLY with the prefix like "[분석] ...". Do NOT use bullet points or stars.
  4. [0순위 금지 원칙]: 절대로 "파보", "질병 가능성", "질환 가능성", "집중 치료", "정밀 검사", "필요한 치료", "치료가 진행", "상태를 면밀히", "회복 상태 관찰", "회복을 관찰", "식욕", "활력", "배변", "복용시켜", "내원 일정을 꼭", "취약", "슬개골", "심장 질환" 등의 단어를 사용하지 마라. 반려동물 품종과 특정 질병 가능성을 연결하지 마라.
  5. IMPORTANT: Focus on financial spending patterns. AI MUST NOT provide diagnosis or prescription. 
  6. If medical spending is high, describe it as "concentration of medical expenses" and suggest record-keeping: "If you have medication or re-exam schedules from the hospital, record them in PetLog."
  
  Format Example:
  [분석] 🦴 이번 달 사료 지출이 지난달보다 40% 늘어났어요: 대량 구매나 품목 변경이 있었는지 지출 내역을 확인해보세요.
  [팁] 🏥 단기간에 병원비 지출이 집중되었습니다: 병원에서 안내받은 복약, 재진, 회복 체크 일정이 있다면 PetLog에 기록으로 남겨두는 것이 도움이 됩니다.
  [칭찬] 💖 아이를 위해 꼼꼼하게 지출을 기록하고 계시네요: 소중한 기록들이 모여 아이를 위한 더 나은 케어 계획을 세우는 데 큰 힘이 될 거예요!
  `;

  // 시도할 모델 리스트 (현재 환경에서 검증된 모델명 우선순위 적용)
  const MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-pro"
  ];

  for (const modelName of MODELS_TO_TRY) {
    let retries = 0;
    const maxModelRetries = 2;

    while (retries < maxModelRetries) {
      try {
        if (isPetLogDebug()) console.log(`AI Insight: Trying ${modelName} (Attempt ${retries + 1})...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (text) {
          if (isPetLogDebug()) console.log(`AI Insight success with ${modelName}`);
          return text;
        }
      } catch (error: any) {
        const status = error.status;
        const message = String(error.message || "");
        
        console.warn(`AI Insight Error with ${modelName}:`, message);

        // 404면 이 모델은 버리고 다음 모델로
        if (status === 404 || message.includes('404') || message.includes('not found')) {
          break; 
        }

        // 429 또는 503이면 조금 기다렸다가 이 모델로 다시 시도
        if (status === 429 || status === 503 || message.includes('429') || message.includes('503') || message.includes('quota')) {
          retries++;
          if (retries < maxModelRetries) {
            const waitTime = retries * 1000; // Reduced from 3000
            if (isPetLogDebug()) console.log(`AI busy (${modelName}). Waiting ${waitTime}ms...`);
            await delay(waitTime);
            continue;
          }
        }

        // 그 외 에러는 다음 모델로
        break;
      }
    }
  }

  return language === 'ko' ? "현재 AI 서비스가 매우 혼잡합니다. 1분 후 다시 시도해 주세요." : "AI service is currently very busy. Please try again in a minute.";
}
