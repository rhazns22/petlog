import { EngineHealthMetrics } from './qaDashboard';
import { ReleaseSnapshot } from './qaReleaseSnapshot';

export type RollbackReadinessStatus = "normal" | "watch" | "rollback_review" | "rollback_recommended";
export const manualVerificationStatus = 'normal' as 'normal' | 'watch'; // 실제 구현 시 정성 평가 결과 연동

export interface RollbackReadinessResult {
  status: RollbackReadinessStatus;
  reason: string;
  recommendedAction: string;
  diffs: {
    metric: string;
    before: any;
    after: any;
    change: string;
  }[];
}

/**
 * [PetLog v1.1.6 Rollback Readiness System]
 * 배포 후 품질 악화 시 롤백 여부를 판단합니다.
 */
export function evaluateRollbackReadiness(
  current: EngineHealthMetrics,
  latestSnapshot: ReleaseSnapshot | null
): RollbackReadinessResult {
  if (!latestSnapshot) {
    return {
      status: "normal",
      reason: "최근 배포 스냅샷이 없습니다.",
      recommendedAction: "배포를 먼저 완료하세요.",
      diffs: []
    };
  }

  const diffs: RollbackReadinessResult['diffs'] = [];
  let status: RollbackReadinessStatus = "normal";
  let reasons: string[] = [];
  let recommendedAction = "엔진이 정상 작동 중입니다.";

  // 1. 회귀 테스트 및 크리티컬 알림 (최우선)
  const regressionFailed = current.taxNotDiscount001Status === 'FAIL';
  const criticalExists = current.status === 'critical';

  if (regressionFailed || criticalExists) {
    status = "rollback_recommended";
    if (regressionFailed) reasons.push("핵심 회귀 테스트 실패");
    if (criticalExists) reasons.push("미해결 Critical 알림 존재");
  }

  // 2. 점수 비교
  const scoreDrop = latestSnapshot.engineHealthScore - current.healthScore;
  diffs.push({
    metric: "Health Score",
    before: latestSnapshot.engineHealthScore,
    after: current.healthScore,
    change: scoreDrop > 0 ? `-${scoreDrop}` : `+${Math.abs(scoreDrop)}`
  });

  if (scoreDrop >= 15 && status !== "rollback_recommended") {
    status = "rollback_recommended";
    reasons.push(`엔진 점수 급락 (-${scoreDrop})`);
  } else if (scoreDrop >= 8 && status === "normal") {
    status = "rollback_review";
    reasons.push(`엔진 점수 하락 (-${scoreDrop})`);
  }

  // 3. 수정률 비교
  const correctionIncrease = (current.userCorrectionRate - latestSnapshot.userCorrectionRate) * 100;
  diffs.push({
    metric: "Correction Rate",
    before: `${(latestSnapshot.userCorrectionRate * 100).toFixed(1)}%`,
    after: `${(current.userCorrectionRate * 100).toFixed(1)}%`,
    change: correctionIncrease > 0 ? `+${correctionIncrease.toFixed(1)}%p` : `${correctionIncrease.toFixed(1)}%p`
  });

  if (correctionIncrease >= 10 && status !== "rollback_recommended") {
    status = "rollback_recommended";
    reasons.push(`사용자 수정률 폭증 (+${correctionIncrease.toFixed(1)}%p)`);
  }

  if (status === "rollback_recommended") {
    recommendedAction = "긴급 롤백을 권장합니다. 배포 전 버전으로 엔진 복구를 검토하세요.";
  } else if (status === "rollback_review") {
    recommendedAction = "품질 저하 감지. 최근 변경된 룰셋에 대한 정밀 리뷰를 진행하세요.";
  } else if (status as string === "watch") {
    recommendedAction = "일부 지표 변동 중. 모니터링을 강화하세요.";
  }

  return {
    status,
    reason: reasons.join(", ") || "지표 정상",
    recommendedAction,
    diffs
  };
}
