import { ReceiptTrainingRecord } from '../lib/trainingPipeline';

/**
 * [PetLog v2.4 Developer Analysis Utils]
 * 
 * TrainingRecord 데이터를 분석하여 엔진 개선 인사이트를 도출하는 유틸리티 모음입니다.
 * 초기 단계에서는 관리자 UI 대신 콘솔 로그 및 이 유틸 함수들을 활용합니다.
 */

/**
 * 1. 전체적인 수정 통계를 반환합니다.
 */
export function getCorrectionStats(records: ReceiptTrainingRecord[]) {
  const total = records.length;
  if (total === 0) return null;

  const grades = { A: 0, B: 0, C: 0 };
  const methods = { ai_no_edit: 0, manual: 0, suggested_fix: 0 };
  const statuses = { VERIFIED: 0, USER_CORRECTED: 0, NEEDS_REVIEW: 0 };

  records.forEach(r => {
    grades[r.quality.grade]++;
    methods[r.correction.correctionMethod]++;
    statuses[r.quality.status]++;
  });

  return {
    total,
    grades,
    methodRates: {
      ai_no_edit: (methods.ai_no_edit / total * 100).toFixed(1) + '%',
      manual: (methods.manual / total * 100).toFixed(1) + '%',
      suggested_fix: (methods.suggested_fix / total * 100).toFixed(1) + '%',
    },
    userCorrectedRate: (statuses.USER_CORRECTED / total * 100).toFixed(1) + '%'
  };
}

/**
 * 2. 가장 많이 수정된 필드 TOP 10을 반환합니다.
 */
export function getMostEditedFields(records: ReceiptTrainingRecord[]) {
  const fieldCounts: Record<string, number> = {};

  records.forEach(r => {
    r.correction.editedFields.forEach(field => {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    });
  });

  return Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([field, count]) => ({ field, count, rate: (count / records.length * 100).toFixed(1) + '%' }));
}

/**
 * 3. 카테고리별 수정 빈도 및 평균 오차를 분석합니다.
 */
export function getCategoryErrorStats(records: ReceiptTrainingRecord[]) {
  const stats: Record<string, { editCount: number; totalDiff: number }> = {};
  
  const categories = ['consult', 'test', 'treatment', 'hospitalization', 'surgery', 'medicine'];
  categories.forEach(cat => stats[cat] = { editCount: 0, totalDiff: 0 });

  records.forEach(r => {
    categories.forEach(cat => {
      const aiVal = r.aiResult.categorySummary[cat as keyof typeof r.aiResult.categorySummary] || 0;
      const confVal = r.confirmedResult.categorySummary[cat as keyof typeof r.confirmedResult.categorySummary] || 0;
      const diff = Math.abs(aiVal - confVal);

      if (diff > 0) {
        stats[cat].editCount++;
        stats[cat].totalDiff += diff;
      }
    });
  });

  return Object.entries(stats).map(([cat, s]) => ({
    category: cat,
    editFrequency: (s.editCount / records.length * 100).toFixed(1) + '%',
    averageError: s.editCount > 0 ? Math.round(s.totalDiff / s.editCount).toLocaleString() + '원' : '0원'
  }));
}

/**
 * 4. 반복되는 오류 패턴을 텍스트로 요약하여 힌트를 제공합니다.
 */
export function getPromptImprovementHints(records: ReceiptTrainingRecord[]) {
  const hints: string[] = [];
  const total = records.length;
  if (total === 0) return ["분석할 데이터가 없습니다."];

  const catStats = getCategoryErrorStats(records);
  
  // 1. 수정 빈도가 높은 카테고리 식별
  const highErrorCats = catStats.filter(s => parseFloat(s.editFrequency) > 30);
  highErrorCats.forEach(s => {
    hints.push(`[카테고리] ${s.category} 항목의 수정 빈도가 ${s.editFrequency}로 높습니다. 관련 프롬프트/룰 확인 필요.`);
  });

  // 2. 특정 패턴 감지 (예: 할인 누락)
  const discountMissingCount = records.filter(r => 
    (r.aiResult.totalDiscount || 0) === 0 && (r.confirmedResult.totalDiscount || 0) > 0
  ).length;

  if (discountMissingCount / total > 0.2) {
    hints.push(`[패턴] 영수증 할인 금액을 인식하지 못하는 경우가 빈번합니다 (${(discountMissingCount/total*100).toFixed(1)}%).`);
  }

  // 3. 특정 필드 집중 수정 패턴
  const topFields = getMostEditedFields(records);
  if (topFields.length > 0 && parseFloat(topFields[0].rate) > 50) {
    hints.push(`[패턴] '${topFields[0].field}' 필드가 절반 이상의 케이스에서 수정되고 있습니다. 엔진의 기본 로직 점검이 시급합니다.`);
  }

  return hints.length > 0 ? hints : ["현재 특별한 반복 오류 패턴이 감지되지 않았습니다. 엔진이 안정적입니다."];
}
