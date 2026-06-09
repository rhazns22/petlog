
import { EngineHealthMetrics } from './qaDashboard';
import { ReleaseImpactReport } from './qaReleaseReport';

export type ReleaseGateStatus = "pass" | "warning" | "blocked";

export interface ReleaseGateResult {
  status: ReleaseGateStatus;
  checks: {
    name: string;
    status: "pass" | "fail";
    value: any;
    threshold: any;
  }[];
  reason: string;
  recommendedAction: string;
}

/**
 * [PetLog v1.1.4 Release Gate System]
 * 배포 전 엔진 품질 요건 충족 여부를 자동 검증합니다.
 */
export function evaluateReleaseGate(
  currentMetrics: EngineHealthMetrics,
  impactReport: ReleaseImpactReport
): ReleaseGateResult {
  const checks: ReleaseGateResult['checks'] = [];
  let status: ReleaseGateStatus = "pass";
  let reasons: string[] = [];
  let recommendedAction = "배포 가능합니다.";

  // 1. 핵심 회귀 테스트 체크
  const regressionPass = currentMetrics.taxNotDiscount001Status === 'PASS';
  checks.push({
    name: "Core Regression Tests",
    status: regressionPass ? "pass" : "fail",
    value: currentMetrics.taxNotDiscount001Status,
    threshold: "PASS"
  });
  if (!regressionPass) {
    status = "blocked";
    reasons.push("핵심 회귀 테스트(taxNotDiscount_001) 실패");
  }

  // 2. 미해결 Critical 알림 체크
  const unresolvedCritical = currentMetrics.status === 'critical';
  checks.push({
    name: "Unresolved Critical Alerts",
    status: !unresolvedCritical ? "pass" : "fail",
    value: unresolvedCritical ? "Exist" : "Zero",
    threshold: "Zero"
  });
  if (unresolvedCritical) {
    status = "blocked";
    reasons.push("미해결 Critical 알림 존재");
  }

  // 3. Engine Health Score 체크
  checks.push({
    name: "Engine Health Score",
    status: currentMetrics.healthScore >= 75 ? "pass" : "fail",
    value: currentMetrics.healthScore,
    threshold: "75+"
  });
  if (currentMetrics.healthScore < 60) {
    status = "blocked";
    reasons.push(`엔진 점수 미달 (${currentMetrics.healthScore})`);
  } else if (currentMetrics.healthScore < 75 && status !== "blocked") {
    status = "warning";
    reasons.push(`엔진 점수 주의 (${currentMetrics.healthScore})`);
  }

  // 4. 수정률 급증 체크
  const correctionDiff = (currentMetrics.userCorrectionRate - (impactReport.metricsBefore.userCorrectionRate || 0)) * 100;
  checks.push({
    name: "Correction Rate Δ",
    status: correctionDiff <= 5 ? "pass" : "fail",
    value: `${correctionDiff.toFixed(1)}%`,
    threshold: "≤ 5%"
  });
  if (correctionDiff > 5 && status === "pass") {
    status = "warning";
    reasons.push("사용자 수정률 급증 감지");
  }

  if (status === "blocked") {
    recommendedAction = "배포 불가. 위 차단 요인을 해결하고 회귀 테스트를 다시 실행하세요.";
  } else if (status === "warning") {
    recommendedAction = "배포 전 수동 검토 권장. 특정 카테고리의 분석 품질을 재확인하세요.";
  }

  return {
    status,
    checks,
    reason: reasons.join(", ") || "모든 요건 충족",
    recommendedAction
  };
}
