
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';

export interface OperationsReport {
  reportId?: string;
  periodStart: Date;
  periodEnd: Date;
  totalAnalyzedReceipts: number;
  engineHealthScoreStart: number;
  engineHealthScoreEnd: number;
  userCorrectionRate: number;
  averageConfidence: number;
  averageOtherRatio: number;
  newValidationTriageCount: number;
  openTriageCount: number;
  resolvedTriageCount: number;
  p0IssueCount: number;
  p1IssueCount: number;
  slaOverdueCount: number;
  averageAcknowledgeTime: number; // minutes
  averageResolveTime: number; // minutes
  newIncidentCount: number;
  resolvedIncidentCount: number;
  newChangeRequestCount: number;
  implementedChangeRequestCount: number;
  releaseGateStatus: string;
  rollbackReadinessStatus: string;
  topMisclassifiedKeywords: any[];
  summary: string;
  recommendedFocus: string;
  createdAt: any;
}

/**
 * [PetLog v1.2.3 QA Operations Report]
 * 주간 또는 특정 기간의 엔진 품질 및 QA 운영 상태를 요약합니다.
 */
export async function createOperationsReport(report: Omit<OperationsReport, 'reportId' | 'createdAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'qa_operations_reports'), {
      ...report,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Failed to create operations report:', e);
    throw e;
  }
}

export async function getLatestOperationsReport(): Promise<OperationsReport | null> {
  const q = query(collection(db, 'qa_operations_reports'), orderBy('createdAt', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { reportId: snap.docs[0].id, ...snap.docs[0].data() } as OperationsReport;
}
