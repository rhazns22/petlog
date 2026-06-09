
import { ChangeValidationReport } from './qaChangeValidation';
import { safeIncludes } from './utils';

export type TriageSeverity = "low" | "medium" | "high" | "critical";
export type TriagePriority = "p3" | "p2" | "p1" | "p0";
export type TriageStatus = "open" | "in_progress" | "resolved";

export interface TriageResult {
  triageId?: string;
  validationId: string;
  changeRequestId: string;
  severity: TriageSeverity;
  priority: TriagePriority;
  affectedArea: string;
  failureReason: string;
  failedTests: string[];
  impactedMetrics: string[];
  recommendedAction: string;
  assignedTo?: string;
  status: TriageStatus;
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * [PetLog v1.2.1 Validation Failure Triage]
 * 검증 실패 항목의 심각도와 우선순위를 분류하여 관리합니다.
 */
export function triageValidationFailure(report: ChangeValidationReport): TriageResult {
  let severity: TriageSeverity = "low";
  let priority: TriagePriority = "p3";
  let reasons: string[] = [];
  
  const scoreDrop = (report.metricsBefore.healthScore || 0) - (report.metricsAfter.healthScore || 0);
  const correctionIncrease = ((report.metricsAfter.userCorrectionRate || 0) - (report.metricsBefore.userCorrectionRate || 0)) * 100;
  
  // 1. Critical 분류 (핵심 회귀 테스트 실패 등)
  const hasCoreFailure = report.failedTests.some(t => ["goldenReceipt001", "taxNotDiscount_001"].some(core => safeIncludes(t, core)));
  if (hasCoreFailure || scoreDrop >= 15) {
    severity = "critical";
    priority = "p0";
    reasons.push(hasCoreFailure ? "핵심 회귀 테스트 실패" : "엔진 점수 급락");
  } 
  // 2. High 분류 (수정률 폭증 등)
  else if (report.failedTests.length > 0 || correctionIncrease >= 10) {
    severity = "high";
    priority = "p1";
    reasons.push(correctionIncrease >= 10 ? "수정률 폭증" : "연관 테스트 실패");
  }
  // 3. Medium 분류 (신뢰도 하락 등)
  else if (report.validationStatus === "warning") {
    severity = "medium";
    priority = "p2";
    reasons.push("지표 하락(주의)");
  }

  return {
    validationId: report.validationId || "unknown",
    changeRequestId: report.changeRequestId,
    severity,
    priority,
    affectedArea: report.affectedCategory,
    failureReason: reasons.join(", ") || report.validationSummary,
    failedTests: report.failedTests,
    impactedMetrics: scoreDrop > 0 ? ["healthScore"] : [],
    recommendedAction: report.recommendedAction,
    status: "open",
    createdAt: new Date()
  };
}
