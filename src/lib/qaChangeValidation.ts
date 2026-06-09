
import { EngineHealthMetrics } from './qaDashboard';
import { ChangeRequest } from './qaChangeRequest';

export type ValidationStatus = "pass" | "warning" | "failed";

export interface ChangeValidationReport {
  validationId?: string;
  changeRequestId: string;
  affectedRuleName: string;
  affectedCategory: string;
  implementedAt: any;
  validatedAt: any;
  validationStatus: ValidationStatus;
  linkedGoldenTests: string[];
  linkedRegressionCandidates: string[];
  passedTests: string[];
  failedTests: string[];
  impactedCategories: string[];
  metricsBefore: Partial<EngineHealthMetrics>;
  metricsAfter: Partial<EngineHealthMetrics>;
  riskLevel: string;
  validationSummary: string;
  recommendedAction: string;
  createdAt: any;
}

/**
 * [PetLog v1.2.0 Rule Implementation Verification]
 * 배포 완료된(Implemented) 룰 변경 사항이 안전한지 검증합니다.
 */
export function validateRuleChange(
  cr: ChangeRequest,
  beforeMetrics: Partial<EngineHealthMetrics>,
  afterMetrics: EngineHealthMetrics,
  testResults: { testName: string; passed: boolean }[]
): ChangeValidationReport {
  const passedTests = testResults.filter(t => t.passed).map(t => t.testName);
  const failedTests = testResults.filter(t => !t.passed).map(t => t.testName);
  
  let status: ValidationStatus = "pass";
  let summary = "룰 변경이 성공적으로 검증되었습니다.";
  let recommendedAction = "검증 완료. 다음 릴리즈 게이트로 진행 가능합니다.";

  // 1. 핵심 회귀 테스트 검증
  const coreTests = ["goldenReceipt001", "taxNotDiscount_001"];
  const failedCore = coreTests.filter(ct => failedTests.includes(ct));
  
  if (failedCore.length > 0) {
    status = "failed";
    summary = `CRITICAL: 핵심 회귀 테스트(${failedCore.join(", ")}) 실패 감지!`;
    recommendedAction = "즉각적인 코드 수정 또는 롤백 검토가 필요합니다 (Incident Review 연동 필요).";
  } else if (failedTests.length > 0) {
    status = "warning";
    summary = "일부 연관 테스트 실패. 룰의 부작용(Side Effect)이 감지되었습니다.";
    recommendedAction = "실패한 테스트 케이스를 분석하고 룰을 재조정하세요.";
  }

  // 2. 지표 악화 검증
  const scoreDiff = (afterMetrics.healthScore - (beforeMetrics.healthScore || 0));
  if (status === "pass" && scoreDiff < -5) {
    status = "warning";
    summary = `지표 악화: 엔진 점수 하락(${scoreDiff})이 감지되었습니다.`;
    recommendedAction = "사용자 수정률과 신뢰도 변화를 정밀 모니터링하세요.";
  }

  return {
    changeRequestId: cr.changeRequestId || "unknown",
    affectedRuleName: cr.affectedRuleName,
    affectedCategory: cr.affectedCategory,
    implementedAt: cr.updatedAt,
    validatedAt: new Date(),
    validationStatus: status,
    linkedGoldenTests: cr.relatedGoldenTests,
    linkedRegressionCandidates: [cr.sourceId],
    passedTests,
    failedTests,
    impactedCategories: [cr.affectedCategory],
    metricsBefore: beforeMetrics,
    metricsAfter: afterMetrics,
    riskLevel: cr.riskLevel,
    validationSummary: summary,
    recommendedAction,
    createdAt: new Date()
  };
}
