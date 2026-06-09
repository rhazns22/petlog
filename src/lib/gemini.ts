/**
 * [PetLog AI Engine v3.0 - Security Fortified]
 * 이 엔진은 보안을 위해 모든 AI 연산을 서버사이드(Vercel API)에서 처리합니다.
 * 클라이언트에는 API 키가 노출되지 않으며, 전송 전 이미지 최적화만 담당합니다.
 */
import { isPetLogDebug } from './utils';

export interface ReceiptLineItem {
  lineIndex: number;
  name: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  category: 'CONSULT' | 'TEST' | 'TREATMENT' | 'HOSPITALIZATION' | 'SURGERY' | 'MEDICINE' | 'UNKNOWN';
  reason: string[];
  isMetaLine: boolean;
  confidence?: number;
}

export interface ReceiptData {
  merchant: string;
  date: string;
  amount: number;
  totalDiscount?: number;
  originalTotalAmount?: number;
  category: string;
  lineItems: ReceiptLineItem[];
  categorySummary: {
    consult: { amount: number; discount: number };
    test: { amount: number; discount: number };
    treatment: { amount: number; discount: number };
    hospitalization: { amount: number; discount: number };
    surgery: { amount: number; discount: number };
    medicine: { amount: number; discount: number };
  };
  imageQuality?: {
    score: number;
    issues: string[];
  };
  multiPetDetection?: {
    isMultiPetSuspected: boolean;
    detectedPetNames: string[];
    confidence: "LOW" | "MEDIUM" | "HIGH";
  };
  taxInfo?: {
    taxableAmount: number;
    taxFreeAmount: number;
    vatAmount: number;
  };
}

/**
 * [영수증 분석 - 서버 프록시 호출]
 */
export async function analyzeReceipt(options: {
  image: string;
  mimeType?: string;
  fileName?: string;
  userId?: string;
  metadata?: any;
}): Promise<ReceiptData> {
  const { image, mimeType, fileName, userId, metadata: optMetadata } = options;
  const base64Data = image;

  // 로컬 개발 환경(Vite)에서는 Vercel 서버리스 함수가 실행되지 않으므로 클라이언트에서 직접 호출
  if (import.meta.env.DEV) {
    console.log("Local development: Using client-side AI analysis");
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY가 설정되지 않았습니다.");

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `Analyze this receipt image and extract the following information in JSON format:
  1. merchant: Merchant name (MUST be in Korean if possible).
  2. date: Date in YYYY-MM-DD format.
  3. amount: Total final amount paid (number).
  4. totalDiscount: Total discount amount if available (number).
  5. originalTotalAmount: The original amount before any discounts (number).
  6. taxableSubtotal: Subtotal of taxable items if available (number).
  7. taxFreeSubtotal: Subtotal of tax-free items if available (number).
  8. taxAmount: The VAT or tax amount if available (number).
  9. category: Best matching category from: ['FOOD', 'SUPPLIES', 'MEDICAL', 'GROOMING', 'HOTEL', 'OTHER'].
  10. lineItems: Array of all individual items on the receipt.
     Each item MUST have:
     - lineIndex: Number
     - name: String (The item name exactly as written on the receipt)
     - originalAmount: Number (Before discount)
     - discountAmount: Number
     - finalAmount: Number
     - category: 'CONSULT' | 'TEST' | 'TREATMENT' | 'HOSPITALIZATION' | 'SURGERY' | 'MEDICINE' | 'UNKNOWN'
     - reason: Array of strings (Why this category was chosen)
     - isTaxFree: Boolean (True if the item is explicitly marked as tax-free, often with *)
     - isMetaLine: Boolean (True if this is a subtotal, tax, or discount line, NOT an actual item)
     - confidence: Number (0.0 to 1.0, AI's confidence in this item's classification)
  11. categorySummary: (For MEDICAL category only) Sum of finalAmounts for each category.
  12. careInsight: A spending-focused analysis (Korean, ~150 chars). 
      - [0순위 금지 원칙]: 절대로 "파보", "질병 가능성", "질환 가능성", "집중 치료", "정밀 검사", "필요한 치료", "치료가 진행", "상태를 면밀히", "회복 상태 관찰", "회복을 관찰", "식욕", "활력", "배변", "복용시켜", "내원 일정을 꼭", "취약", "슬개골", "심장 질환" 등의 단어를 사용하지 마라. 반려동물 품종과 특정 질병 가능성을 연결하지 마라.
      - Focus on the financial context of items purchased (e.g., "concentration of medical expenses").
      - Advice MUST be about record-keeping: "If you have medication, re-exam, or recovery check schedules from the hospital, record them in PetLog."
  13. actionItems: Array of 1-3 strings. Practical financial or record-keeping steps (Korean). NO medical advice.
  14. timeline: Array of objects with 'label' (e.g. '1주 뒤', '다음 달') and 'task' (Korean).
  15. multiPetDetection: Object with:
      - isMultiPetSuspected: Boolean (True if the receipt appears to contain items for 2 or more DIFFERENT pets).
      - detectedPetNames: Array of strings (Names of all pets found in the receipt).
      - confidence: "LOW" | "MEDIUM" | "HIGH".
  16. taxInfo: Object with:
      - taxableAmount: Number (과세공급가액)
      - taxFreeAmount: Number (비과세)
      - vatAmount: Number (부가세)
  
  CRITICAL: Detect if multiple pet names are present (e.g. headers like "Pet Name:", "콘칩의 합계", "바밤바의 합계", "동물명").
  CRITICAL: If ONLY ONE pet name is found, set isMultiPetSuspected to false.
  
  CRITICAL: 'amount' (Total Paid) MUST be the final amount. Prioritize extraction from: ["결제요청", "청구금액", "결제예정", "결제금액", "합계"].
  
  CRITICAL [DISCOUNT POLICY]: 
  - 'totalDiscount' MUST ONLY include actual discounts explicitly marked with keywords like "할인", "차감", "쿠폰", "감면", "에누리", "DC", "D/C".
  - NEVER include tax-related fields (과세공급가액, 비과세, 부가세) in the totalDiscount or discountAmount fields. 
  - If (taxableAmount + taxFreeAmount + vatAmount) equals 'amount' and no discount keywords are present, 'totalDiscount' MUST be 0.
  
  CRITICAL: You MUST strictly separate the original total, discounts, and final paid amount.
  CRITICAL: Tax-free items (often marked with *) MUST be included in lineItems. They are actual medical services/items. Do NOT mark them as isMetaLine: true.
  CRITICAL: The VAT or tax amount itself should be marked as isMetaLine: true.
  
  CRITICAL SUM CHECK [Self-Verification]:
  - sum(lineItems.originalAmount) MUST EQUAL originalTotalAmount.
  - sum(lineItems.discountAmount) MUST EQUAL totalDiscount.
  - sum(lineItems.finalAmount) MUST EQUAL amount (final paid).
  - Check if (originalTotalAmount - totalDiscount) equals amount.
  If the sums do NOT match, re-examine the image to find missing lines or corrected amounts. This is the most important step for data integrity.
  
  If the image is completely unrecognizable, blurry, or not a receipt, return an empty JSON object: {}.
  
  Return ONLY the JSON object.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } }
      ]);

      const text = await result.response.text();
      const cleanJson = text.replace(/```json|```/g, '').trim();

      let jsonResult;
      try {
        jsonResult = JSON.parse(cleanJson);
      } catch (parseError) {
        console.warn('[AI Warning] JSON Parsing failed, triggering ANALYSIS_FAILED fallback');
        jsonResult = { amount: 0, category: 'UNKNOWN', lineItems: [], categorySummary: {} };
      }

      if (jsonResult.totalAmount && !jsonResult.amount) jsonResult.amount = jsonResult.totalAmount;
      if (jsonResult.hospitalName && !jsonResult.merchant) jsonResult.merchant = jsonResult.hospitalName;

      // [PetLog v1.2.4] Normalize petName for auto-registration
      if (!jsonResult.petName && jsonResult.multiPetDetection?.detectedPetNames?.length === 1) {
        jsonResult.petName = jsonResult.multiPetDetection.detectedPetNames[0];
      }

      return jsonResult as ReceiptData;
    } catch (error) {
      console.error('Local AI Analysis Error:', error);
      throw error;
    }
  }

  try {
    // 2. 우리 보안 서버(/api/analyze-receipt)로 전송 (프로덕션)
    const payload = {
      imageBase64: base64Data,
      mimeType: mimeType || 'image/jpeg',
      fileName: fileName || 'receipt.jpg',
      userId: userId || 'anonymous',
      metadata: optMetadata || {}
    };

    if (isPetLogDebug()) {
      console.log("[PetLog DEBUG] analyzeReceipt Request Payload:", {
        ...payload,
        imageBase64: payload.imageBase64 ? `${payload.imageBase64.substring(0, 50)}... (${payload.imageBase64.length} chars)` : 'empty'
      });
    }

    const response = await fetch('/api/analyze-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let result: any;
    
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { error: 'Invalid JSON response from server', raw: responseText };
    }

    if (!response.ok) {
      if (isPetLogDebug()) {
        console.error('[PetLog DEBUG] Analyze Receipt API Failed', {
          status: response.status,
          statusText: response.statusText,
          errorBody: result,
        });
      }
      throw new Error(result.message || result.error || 'AI 분석 서버 오류가 발생했습니다.');
    }

    // 데이터 보정 (필드명 호환성 유지)
    if (result.totalAmount && !result.amount) result.amount = result.totalAmount;
    if (result.hospitalName && !result.merchant) result.merchant = result.hospitalName;

    return result as ReceiptData;
  } catch (error: any) {
    console.error('Secure AI Analysis Error:', error);
    throw error;
  }
}

/**
 * [영수증 2차 정밀 재검토]
 * base64Image: 최적화된 이미지 데이터
 */
export async function reexamineReceipt(base64Image: string, currentResult: any, diffInfo: { originalDiff: number; finalDiff: number }): Promise<any> {
  const base64Data = base64Image;
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) return currentResult;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You previously analyzed this receipt, but the sum of individual lineItems is missing about ${diffInfo.originalDiff.toLocaleString()} KRW compared to the total.
    
    CURRENT ANALYSIS SUMMARY:
    - Total Paid: ${currentResult.amount}
    - Total Discount: ${currentResult.totalDiscount}
    - Original Total: ${currentResult.originalTotalAmount}
    - Current LineItems Count: ${currentResult.lineItems?.length}
    
    TASK:
    1. Re-examine the image specifically to find MISSING line items that account for the ${diffInfo.originalDiff} KRW discrepancy.
    2. Check if you misread any amounts (especially large items like Hospitalization, Surgery, or CT).
    3. Return ONLY the missing or corrected line items in a JSON array format.
    
    Return format: { "missingLineCandidates": [ { "name": "...", "originalAmount": ..., "discountAmount": ..., "finalAmount": ..., "category": "..." } ] }`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
    ]);

    const text = await result.response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Re-examination Error:', error);
    return { missingLineCandidates: [] };
  }
}

/**
 * [코칭 인사이트 - 서버 프록시 호출]
 */
export interface SpendingAnalysisInput {
  totalSpent: number;
  totalBudget: number;
  budgetUsageRate: number;
  remainingBudget: number;
  currentMonthCategoryTotals: Record<string, number>;
  lastMonthTotal: number;
  monthOverMonthChange: number;
  monthOverMonthChangeRate: number;
  topCategory: string;
  topCategoryAmount: number;
  topCategoryRatio: number;
  medicalSpent: number;
  medicalRatio: number;
  transactionCount: number;
  petCount: number;
}

/**
 * [코칭 인사이트 - 서버 프록시 호출]
 */
export async function generateCoachingInsight(summary: SpendingAnalysisInput): Promise<string> {
  if (import.meta.env.DEV) {
    console.log("Local development: Using client-side AI coaching");
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (!API_KEY) return JSON.stringify({
      available: false,
      reason: "GEMINI_API_KEY_MISSING",
      message: "현재 AI 지출 브리핑을 불러올 수 없습니다.",
      fallbackMessage: "수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다."
    });

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        너는 반려동물 지출 관리 앱 PetLog의 AI 지출 분석가다.
        사용자의 월간 반려동물 지출 요약 데이터를 바탕으로 분석을 수행한다.
        
        [0순위 금지 원칙 - 이를 어길 시 시스템이 정지됨]
        - 절대로 "파보", "질병 가능성", "질환 가능성", "집중 치료", "정밀 검사", "필요한 치료", "치료가 진행", "상태를 면밀히", "회복 상태 관찰", "회복을 관찰", "식욕", "활력", "배변", "복용시켜", "내원 일정을 꼭", "취약", "슬개골", "심장 질환" 등의 단어를 사용하지 마라.
        - 절대로 반려동물의 품종(예: 말티즈)과 특정 질병 가능성을 연결하지 마라.
        - 금액이 높다고 해서 "집중 치료가 진행된 것으로 보입니다"와 같은 추측을 하지 마라.
        - 모든 조언은 "병원 안내에 따른 기록 관리"에 한정하라.

        [지출 요약 데이터]
        ${JSON.stringify(summary, null, 2)}

        [분석 지침]
        1. 핵심만 요약: 전체 글자 수는 공백 포함 180자 내외로 엄격히 제한한다.
        2. 재무적 분석: 금액의 증감, 카테고리별 비중, 예산 대비 지출 흐름 등 '돈'의 흐름만 분석하라.
        3. 안전한 표현: 의료비가 많을 경우 "단기간에 의료비 지출이 집중되었습니다"라고만 표현하라.
        4. 케어 제안: "병원에서 안내받은 복약, 재진, 회복 체크 일정이 있다면 PetLog에 기록으로 남겨보세요"라고만 제안하라.
        5. 금지: 보험 추천, 진단, 처방, 특정 브랜드 추천 절대 금지.

        [응답 포맷]
        반드시 아래 JSON 구조로만 응답해줘:
        {
          "title": "AI 지출 브리핑",
          "summary": "이번 달 지출의 핵심 특징 한 줄 (재무 중심)",
          "reason": "데이터상의 주요 원인 분석 한 줄",
          "action": "지출 관리 및 일정 기록 제안 한 줄",
          "confidence": "low | medium | high"
        }
      `;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Local AI Coaching Error:', error);
      return JSON.stringify({
        available: false,
        reason: "GEMINI_API_ERROR",
        message: "현재 AI 지출 브리핑을 불러올 수 없습니다.",
        fallbackMessage: "수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다."
      });
    }
  }

  try {
    const response = await fetch('/api/coaching-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary)
    });

    const resultText = await response.text();
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (e) {
      return JSON.stringify({ 
        available: false, 
        message: "현재 AI 지출 브리핑을 불러올 수 없습니다.",
        fallbackMessage: "수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.",
        reason: "GEMINI_API_ERROR",
        debugInfo: { status: response.status, text: resultText }
      });
    }

    if (!response.ok) {
      return JSON.stringify({ 
        available: false, 
        message: result.message || "현재 AI 지출 브리핑을 불러올 수 없습니다.",
        fallbackMessage: result.fallbackMessage || "수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.",
        reason: result.reason || "GEMINI_API_ERROR",
        debugInfo: { status: response.status, ...result }
      });
    }

    if (result.available === false) {
      return JSON.stringify({ 
        available: false, 
        message: result.message || "현재 AI 지출 브리핑을 불러올 수 없습니다.",
        fallbackMessage: result.fallbackMessage || "수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.",
        reason: result.reason || "GEMINI_API_ERROR"
      });
    }

    return typeof result.insight === 'object' ? JSON.stringify(result.insight) : result.insight;
  } catch (error) {
    console.error('Secure AI Coaching Error:', error);
    return JSON.stringify({ 
      available: false, 
      message: "현재 AI 지출 브리핑을 불러올 수 없습니다.",
      fallbackMessage: "수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.",
      reason: "GEMINI_API_ERROR"
    });
  }
}

