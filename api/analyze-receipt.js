import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * [PetLog 보안 강화 서버리스 함수]
 * 클라이언트에서 API 키를 노출하지 않기 위해 
 * Vercel 서버 내부에서 Gemini API를 호출합니다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType: rawMimeType, fileName: rawFileName } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ 
      ok: false,
      code: 'MISSING_IMAGE_BASE64',
      error: '이미지 데이터(imageBase64)가 필요합니다.',
      missingFields: ['imageBase64']
    });
  }

  // [v2.6.2] Base64 형식 정규화 (Data URL Prefix 제거)
  const normalizedBase64 = imageBase64.includes(',') 
    ? imageBase64.split(',')[1] 
    : imageBase64;

  // [v2.6.2] 필수 필드 Fallback 처리
  const mimeType = rawMimeType || 'image/jpeg';
  const fileName = rawFileName || 'receipt.jpg';

  // Vercel 서버 내부 환경 변수에서 키를 읽어옵니다. (외부 노출 불가)
  const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    console.error('[Security Error] GEMINI_API_KEY가 서버에 설정되지 않았습니다.');
    return res.status(500).json({ error: '서버 구성 오류: API 키가 없습니다.' });
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  try {
    // 하이브리드 모델 전략 유지 (Flash 최신 모델 우선 사용)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", // 서버 레벨에서 안정화된 최신 모델 고정
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
     - [0순위 금지 원칙]: 절대로 "집중 치료", "정밀 검사", "슬개골", "심장 질환", "취약", "회복 상태 관찰" 등의 단어를 사용하지 마라. 반려동물 품종과 특정 질병 가능성을 연결하지 마라.
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
  If the image is completely unrecognizable, blurry, or not a receipt, return an empty JSON object: {}.
  
  Return ONLY the JSON object.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: normalizedBase64,
          mimeType: mimeType || 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // JSON 문자열 정제 로직 및 Fallback 안전장치
    const cleanJson = text.replace(/```json|```/g, '').trim();
    let jsonResult;
    try {
      jsonResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn('[AI Warning] JSON Parsing failed, triggering ANALYSIS_FAILED fallback');
      jsonResult = { amount: 0, category: 'UNKNOWN', lineItems: [], categorySummary: {} };
    }

    console.log('[AI Success] Receipt analysis completed on server');
    
    // [v2.6.2] 서버 레벨에서 금지어 필터링 추가 (Extra Safety)
    const FORBIDDEN_WORDS = [
      "슬개골", "심장 질환", "질병 가능성", "질환 가능성", "정밀 검사", "집중 치료",
      "치료가 필요합니다", "처방했습니다", "약을 먹이세요", "회복 상태를 관찰하세요",
      "회복을 관찰", "파보", "필요한 치료", "치료가 진행", "상태를 면밀히",
      "AI가 진단했습니다", "AI가 처방했습니다", "처방이 필요합니다"
    ];
    const SAFE_FALLBACK = "진단이나 처방이 포함될 수 있는 표현이 발견되어 지출 정보 중심으로 정리했습니다. 정확한 내용은 병원 안내를 따라주세요.";
    
    if (jsonResult.careInsight) {
      const hasForbidden = FORBIDDEN_WORDS.some(word => jsonResult.careInsight.includes(word));
      if (hasForbidden) jsonResult.careInsight = SAFE_FALLBACK;
    }

    return res.status(200).json(jsonResult);

  } catch (error) {
    console.error('[AI Error] 서버 분석 실패:', error);
    return res.status(500).json({ 
      error: 'AI 분석 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
}
