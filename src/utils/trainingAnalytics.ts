import { ReceiptTrainingRecord } from '../lib/trainingPipeline';

/**
 * [PetLog v2.4 Developer Analytics Utils]
 * TrainingRecord 데이터를 분석하여 AI 엔진 개선을 위한 인사이트를 도출합니다.
 */

/**
 * 1. 전체적인 수정 및 품질 통계를 반환합니다.
 */
export function getCorrectionStats(records: ReceiptTrainingRecord[]) {
  const total = records.length;
  const stats = {
    totalRecords: total,
    gradeCounts: { A: 0, B: 0, C: 0 },
    correctionMethodCounts: { ai_no_edit: 0, manual: 0, suggested_fix: 0 },
    usableForTrainingCount: 0,
    unusableForTrainingCount: 0,
    userCorrectedRate: 0,
    aiNoEditRate: 0,
    manualRate: 0,
    suggestedFixRate: 0
  };

  if (total === 0) return stats;

  records.forEach(r => {
    // Grade 집계
    const grade = r.quality?.grade || 'C';
    if (stats.gradeCounts[grade] !== undefined) stats.gradeCounts[grade]++;

    // Method 집계
    const method = r.correction?.correctionMethod || 'manual';
    if (stats.correctionMethodCounts[method] !== undefined) stats.correctionMethodCounts[method]++;

    // 학습 가능 여부 집계
    if (r.quality?.isUsableForTraining) {
      stats.usableForTrainingCount++;
    } else {
      stats.unusableForTrainingCount++;
    }
  });

  // 비율 계산 (NaN 방지)
  const userCorrectedCount = stats.correctionMethodCounts.manual + stats.correctionMethodCounts.suggested_fix;
  stats.userCorrectedRate = (userCorrectedCount / total) * 100;
  stats.aiNoEditRate = (stats.correctionMethodCounts.ai_no_edit / total) * 100;
  stats.manualRate = (stats.correctionMethodCounts.manual / total) * 100;
  stats.suggestedFixRate = (stats.correctionMethodCounts.suggested_fix / total) * 100;

  return stats;
}

/**
 * 2. 가장 많이 수정된 필드 TOP N을 반환합니다.
 */
export function getMostEditedFields(records: ReceiptTrainingRecord[], limit: number = 10) {
  if (records.length === 0) return [];

  const fieldCounts: Record<string, number> = {};

  records.forEach(r => {
    const fields = r.correction?.editedFields || [];
    fields.forEach(f => {
      fieldCounts[f] = (fieldCounts[f] || 0) + 1;
    });
  });

  return Object.entries(fieldCounts)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * 3. 카테고리별 수정 빈도 및 오차를 분석합니다.
 */
export function getCategoryErrorStats(records: ReceiptTrainingRecord[]) {
  const categories = ['consult', 'test', 'treatment', 'hospitalization', 'surgery', 'medicine'] as const;
  const result: any = {};

  categories.forEach(cat => {
    result[cat] = { editedCount: 0, totalAmountDiff: 0, averageAmountDiff: 0 };
  });

  if (records.length === 0) return result;

  records.forEach(r => {
    categories.forEach(cat => {
      const aiVal = Number(r.aiResult?.categorySummary?.[cat]) || 0;
      const confVal = Number(r.confirmedResult?.categorySummary?.[cat]) || 0;
      const diff = Math.abs(aiVal - confVal);

      if (diff > 0) {
        result[cat].editedCount++;
        result[cat].totalAmountDiff += diff;
      }
    });
  });

  // 평균 계산
  categories.forEach(cat => {
    if (result[cat].editedCount > 0) {
      result[cat].averageAmountDiff = result[cat].totalAmountDiff / result[cat].editedCount;
    }
  });

  return result;
}

/**
 * 4. 반복 오류 패턴을 텍스트 힌트로 반환합니다.
 */
export function getPromptImprovementHints(records: ReceiptTrainingRecord[]) {
  const hints: string[] = [];
  const total = records.length;
  if (total === 0) return ["분석할 데이터가 없습니다."];

  const stats = getCorrectionStats(records);
  const catStats = getCategoryErrorStats(records);
  const topFields = getMostEditedFields(records);

  // 1. 특정 필드 집중 수정 패턴
  const surgeryDiscountEdited = topFields.find(f => f.field === 'discounts.surgery');
  if (surgeryDiscountEdited && (surgeryDiscountEdited.count / total) > 0.3) {
    hints.push("수술/마취 할인 누락이 반복되고 있습니다. 수술/마취 항목 주변의 할인 인식 프롬프트를 강화하세요.");
  }

  // 2. 카테고리 오분류 패턴 (약제 vs 처치)
  if (catStats.medicine.editedCount / total > 0.3 && catStats.treatment.editedCount / total > 0.3) {
    hints.push("주사제 또는 수액 항목이 약제/조제로 잘못 분류되는 경향이 있습니다. 주사/수액은 처치/주사 우선 규칙을 강화하세요.");
  }

  // 3. 검사 항목 오차 패턴
  if (catStats.test.editedCount / total > 0.4) {
    hints.push("검사/진단 항목이 과다 또는 과소 산정되는 경향이 있습니다. 검사와 수술/처치 경계 규칙을 점검하세요.");
  }

  // 4. 품질 저하 패턴
  if (stats.gradeCounts.C / total > 0.5) {
    hints.push("학습 사용 불가 데이터(C등급) 비율이 높습니다. OCR 원문 추출 또는 NEEDS_REVIEW 조건을 점검하세요.");
  }

  return hints.length > 0 ? hints : ["현재 특별한 반복 오류 패턴이 감지되지 않았습니다. 엔진이 안정적입니다."];
}

/**
 * [Developer Mock Test Example]
 * 이 코드는 개발 단계에서 유틸리티 동작을 확인하기 위한 용도입니다.
 */
export function runAnalyticsMockTest() {
  const mockRecords: any[] = [
    {
      quality: { grade: 'A', isUsableForTraining: true },
      correction: { correctionMethod: 'ai_no_edit', editedFields: [] },
      aiResult: { categorySummary: { consult: 10000 } },
      confirmedResult: { categorySummary: { consult: 10000 } }
    },
    {
      quality: { grade: 'C', isUsableForTraining: false },
      correction: { correctionMethod: 'manual', editedFields: ['categorySummary.test', 'discounts.surgery'] },
      aiResult: { categorySummary: { test: 50000 }, discounts: { surgery: 0 } },
      confirmedResult: { categorySummary: { test: 30000 }, discounts: { surgery: 5000 } }
    }
  ];

  console.log("=== PetLog Analytics Mock Test ===");
  console.log("Stats:", getCorrectionStats(mockRecords));
  console.log("Top Fields:", getMostEditedFields(mockRecords));
  console.log("Hints:", getPromptImprovementHints(mockRecords));
}
