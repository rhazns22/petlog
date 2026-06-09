import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * [PetLog 보안 강화 코칭 엔진]
 * 사용자의 지출 패턴을 서버에서 분석하여 인사이트를 생성합니다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const summary = req.body;
  const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const isSuspended = process.env.AI_SUSPENDED === 'true';

  // [v2.6.4] Validate Request Payload using SpendingAnalysisInput fields
  if (!summary || typeof summary.transactionCount !== 'number' || summary.transactionCount === 0) {
    return res.status(200).json({ 
      available: false, 
      reason: 'INSUFFICIENT_DATA',
      message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
      fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
    });
  }

  if (!summary.totalSpent || summary.totalSpent === 0) {
    return res.status(200).json({ 
      available: false, 
      reason: 'INSUFFICIENT_DATA',
      message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
      fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
    });
  }

  if (isSuspended) {
    return res.status(200).json({ 
      available: false, 
      reason: 'AI_SUSPENDED',
      message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
      fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
    });
  }

  if (!API_KEY) {
    return res.status(200).json({ 
      available: false, 
      reason: 'GEMINI_API_KEY_MISSING',
      message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
      fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
    });
  }

  const genAI = new GoogleGenerativeAI(API_KEY);

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      너는 반려동물 지출 관리 앱 PetLog의 AI 지출 분석가다.
      사용자의 월간 반려동물 지출 요약 데이터를 바탕으로, 병원비/사료비/용품비/기타 지출 흐름을 설명한다.
      
      [0순위 금지 원칙 - 이를 어길 시 시스템이 정지됨]
      - 절대로 "집중 치료", "정밀 검사", "슬개골", "심장 질환", "취약", "회복 상태 관찰" 등의 단어를 사용하지 마라.
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
    const response = await result.response;
    const text = response.text().trim();
    
    let jsonInsight;
    try {
      jsonInsight = JSON.parse(text);
    } catch (e) {
      console.warn('[Insight JSON Parse Warning]:', e, 'Raw text:', text);
      jsonInsight = {
        title: "AI 지출 브리핑",
        summary: text,
        reason: "분석 완료",
        action: "지출 내역을 확인해보세요.",
        confidence: "medium"
      };
    }

    // [v2.6.2] 서버 레벨에서 금지어 필터링 추가 (Extra Safety)
    const FORBIDDEN_WORDS = [
      "슬개골", "심장 질환", "질병 가능성", "질환 가능성", "정밀 검사", "집중 치료",
      "치료가 필요합니다", "처방했습니다", "약을 먹이세요", "회복 상태를 관찰하세요",
      "회복을 관찰", "파보", "필요한 치료", "치료가 진행", "상태를 면밀히",
      "AI가 진단했습니다", "AI가 처방했습니다", "처방이 필요합니다"
    ];
    
    if (jsonInsight.summary && FORBIDDEN_WORDS.some(word => jsonInsight.summary.includes(word))) {
      return res.status(200).json({ 
        available: false, 
        reason: 'GEMINI_API_ERROR',
        message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
        fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
      });
    }

    return res.status(200).json({ 
      available: true,
      insight: jsonInsight 
    });
  } catch (error) {
    // 1. HTTP Status 관련 에러 디테일 추출 (SDK 내부 에러 혹은 API 응답 오류 대응)
    if (error && typeof error === 'object') {
      const status = error.status || error.statusCode || error.code;
      const statusText = error.statusText || error.message;
      let responseBody = 'N/A';
      
      if (error.response) {
        try {
          if (typeof error.response.text === 'function') {
            responseBody = await error.response.text();
          } else {
            responseBody = JSON.stringify(error.response);
          }
        } catch (_) {
          responseBody = String(error.response);
        }
      }
      
      if (status || statusText || responseBody !== 'N/A') {
        console.error('[Coaching Error Detail - API Failure]:', {
          status: status || 'N/A',
          statusText: statusText || 'N/A',
          responseBody: responseBody
        });
      }
    }

    // 2. 일반 예외 디테일 (error.name, error.message, error.stack) 추출
    const errName = error instanceof Error ? error.name : 'UnknownError';
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : 'No stack trace';

    console.error('[Coaching Error Detail - Name]:', errName);
    console.error('[Coaching Error Detail - Message]:', errMsg);
    console.error('[Coaching Error Detail - Stack]:', errStack);
    
    return res.status(200).json({ 
      available: false, 
      reason: 'GEMINI_API_ERROR',
      debugMessage: errMsg,
      message: '현재 AI 지출 브리핑을 불러올 수 없습니다.',
      fallbackMessage: '수기 입력과 지출 기록은 정상적으로 이용할 수 있습니다.'
    });
  }
}
