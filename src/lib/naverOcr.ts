import axios from 'axios';

interface OCRResult {
  merchant: string;
  date: string;
  amount: number;
  category: string;
}

export const analyzeReceiptWithNaver = async (file: File): Promise<OCRResult> => {
  try {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });

    const now = Date.now();
    const requestData = {
      images: [{ 
        format: file.name.split('.').pop()?.toLowerCase() || 'jpg', 
        name: 'receipt', 
        data: base64Data 
      }],
      requestId: `petlog-${now}`,
      timestamp: now,
      version: 'V2',
    };

    // 로컬 환경과 프로덕션 환경 구분
    const isLocal = window.location.hostname === 'localhost';
    const apiUrl = isLocal 
      ? 'https://clovaocr-api-kr.ncloud.com/external/v1/52328/4fdb26aa714cfb1dde640907f6dded4b4ea32425059d52c41d3538e0b0b3162a'
      : '/api/ocr';

    const headers: any = {
      'Content-Type': 'application/json'
    };

    // 로컬 테스트 시에는 헤더에 직접 키를 넣음 (프록시 우회)
    if (isLocal) {
      headers['X-OCR-SECRET'] = 'aERjUWpIeHNVQWVYQWF4c0R3Z0VpaW9jaHpEQm5VaXA=';
    }

    const response = await axios.post(apiUrl, requestData, { headers });

    const result = response.data;
    if (!result.images || result.images.length === 0) throw new Error('인식 실패');

    const fields = result.images[0].fields || [];
    const fullText = fields.map((f: any) => f.inferText).join(' ');

    // 1. 금액 추출 (합계 키워드 근처 우선)
    let amount = 0;
    const cleanText = fullText.replace(/,/g, '');
    const amountMatches = cleanText.match(/\d{3,}/g);
    if (amountMatches) {
      const totalKeywords = ['합계', '결제금액', '받을금액', 'TOTAL', 'Total'];
      let found = false;
      for (const kw of totalKeywords) {
        const kwIdx = cleanText.indexOf(kw);
        if (kwIdx !== -1) {
          const afterKw = cleanText.substring(kwIdx, kwIdx + 30);
          const match = afterKw.match(/\d{3,}/);
          if (match) {
            amount = Number(match[0]);
            found = true;
            break;
          }
        }
      }
      if (!found) amount = Math.max(...amountMatches.map(Number));
    }

    // 2. 날짜 추출
    let date = new Date().toISOString().split('T')[0];
    const datePattern = /(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})[일\s]*/;
    const dateMatch = fullText.match(datePattern);
    if (dateMatch) {
      const y = dateMatch[1];
      const m = dateMatch[2].padStart(2, '0');
      const d = dateMatch[3].padStart(2, '0');
      date = `${y}-${m}-${d}`;
    }

    // 3. 상호명 추출
    let merchant = '';
    const titleCandidates = fields.slice(0, 10).map((f: any) => f.inferText);
    merchant = titleCandidates.find((t: string) => t.length >= 2 && !/\d/.test(t)) || titleCandidates[0] || '알 수 없는 상호';

    // 4. 지능형 카테고리 분류
    let category = 'OTHER';
    if (fullText.match(/병원|의원|의료|약국|진료|백신/)) category = 'MEDICAL';
    else if (fullText.match(/사료|간식|식품|정육|마트|푸드/)) category = 'FOOD';
    else if (fullText.match(/미용|컷|샴푸|목욕|그루밍/)) category = 'GROOMING';
    else if (fullText.match(/보험|공제|보장/)) category = 'INSURANCE';
    else if (fullText.match(/카페|커피|베이커리|디저트/)) category = 'FOOD';

    return { merchant: merchant.substring(0, 20), date, amount, category };
  } catch (error: any) {
    console.error('Naver OCR Detail Error:', error.response?.data || error.message);
    throw new Error('네이버 OCR 분석에 실패했습니다.');
  }
};