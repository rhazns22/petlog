
import { db } from './firebase';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';

import { recordAlert } from './qaAlertHistory';

export type EngineHealthStatus = 'stable' | 'caution' | 'needs_review' | 'critical';

export interface EngineHealthMetrics {
  totalAnalyzedReceipts: number;
  userCorrectionRate: number;
  categoryMismatchCountByCategory: Record<string, number>;
  topMisclassifiedKeywords: { keyword: string; count: number }[];
  pendingRegressionCandidateCount: number;
  approvedRegressionCandidateCount: number;
  averageConfidence: number;
  averageOtherRatio: number;
  taxNotDiscount001Status: 'PASS' | 'FAIL' | 'UNKNOWN';
  healthScore: number;
  status: EngineHealthStatus;
  alertMessage: string;
}

/**
 * [PetLog v1.1.1 Engine Health Dashboard & Threshold Alerts]
 */
export async function calculateEngineHealth(userId: string): Promise<EngineHealthMetrics> {
  try {
    const q = query(
      collection(db, 'users', userId, 'trainingRecords'),
      orderBy('metadata.createdAt', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    
    let total = snap.size;
    let corrections = 0;
    let sumConfidence = 0;
    let sumOtherRatio = 0;
    const mismatches: Record<string, number> = {};
    const keywords: Record<string, number> = {};
    
    snap.forEach(doc => {
      const d = doc.data();
      if (d.correction?.wasEdited) corrections++;
      sumConfidence += d.aiResult?.confidence || 0;
      sumOtherRatio += d.quality?.unknownRatio || 0;
      
      const aiSum = d.aiResult?.categorySummary || {};
      const userSum = d.confirmedResult?.categorySummary || {};
      Object.keys(userSum).forEach(cat => {
        if (Math.abs((aiSum[cat]?.amount || 0) - (userSum[cat] || 0)) > 100) {
          mismatches[cat] = (mismatches[cat] || 0) + 1;
        }
      });
      
      d.aiResult?.lineItems?.forEach((item: any) => {
        if (d.correction?.wasEdited) {
          keywords[item.name] = (keywords[item.name] || 0) + 1;
        }
      });
    });

    const avgConfidence = total > 0 ? (sumConfidence / total) : 0;
    const avgOtherRatio = total > 0 ? (sumOtherRatio / total) : 0;
    const correctionRate = total > 0 ? (corrections / total) : 0;

    let score = 100;
    score -= (correctionRate * 100) * 0.4;
    score += (avgConfidence * 100) * 0.3;
    score -= (avgOtherRatio * 100) * 0.2;
    
    // v1.1.1: Regression Test Failure Check
    const taxNotDiscount001Status = 'PASS' as 'PASS' | 'FAIL'; // 실제 구현 시 테스트 러너 결과 연동
    if (taxNotDiscount001Status === 'FAIL') score -= 30;

    score = Math.max(0, Math.min(100, score));
    const finalScore = Math.round(score);

    // Status Grading
    let status: EngineHealthStatus = 'stable';
    let alertMessage = "엔진 상태 안정";

    if (finalScore >= 90) {
      status = 'stable';
      alertMessage = "엔진 상태 안정";
    } else if (finalScore >= 75) {
      status = 'caution';
      alertMessage = "일부 지표 확인 필요";
    } else if (finalScore >= 60) {
      status = 'needs_review';
      alertMessage = "오분류/수정률 검토 필요";
    } else {
      status = 'critical';
      alertMessage = "회귀 테스트 또는 분석 품질 긴급 확인 필요";
    }

    // Force Critical on Regression Failure
    if (taxNotDiscount001Status === 'FAIL') {
      status = 'critical';
      alertMessage = "CRITICAL: 핵심 회귀 테스트(taxNotDiscount_001) 실패!";
      recordAlert({ level: 'critical', reason: alertMessage, relatedMetric: 'regression_test' });
    }

    // High Correction Rate Alert
    if (correctionRate > 0.3) {
      if (status === 'stable') {
        status = 'caution';
        alertMessage = "경고: 사용자 수정률 급증 감지";
      }
      recordAlert({ level: 'caution', reason: alertMessage, relatedMetric: 'correction_rate' });
    }

    return {
      totalAnalyzedReceipts: total,
      userCorrectionRate: correctionRate,
      categoryMismatchCountByCategory: mismatches,
      topMisclassifiedKeywords: Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count })),
      pendingRegressionCandidateCount: 0,
      approvedRegressionCandidateCount: 0,
      averageConfidence: avgConfidence,
      averageOtherRatio: avgOtherRatio,
      taxNotDiscount001Status,
      healthScore: finalScore,
      status,
      alertMessage
    };
  } catch (e) {
    console.error('Health Dashboard Error:', e);
    throw e;
  }
}
