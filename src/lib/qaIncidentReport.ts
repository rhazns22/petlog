
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { RollbackReadinessStatus } from './qaRollbackReadiness';

export interface IncidentReport {
  incidentId?: string;
  relatedReleaseVersion: string;
  rollbackReadinessStatus: RollbackReadinessStatus;
  triggeredAt: any;
  detectedByMetric: string;
  metricsBefore: {
    healthScore: number;
    correctionRate: number;
    confidence: number;
    otherRatio: number;
  };
  metricsCurrent: {
    healthScore: number;
    correctionRate: number;
    confidence: number;
    otherRatio: number;
  };
  failedGoldenTests: string[];
  topMisclassifiedKeywords: any[];
  impactSummary: string;
  rootCauseNote?: string;
  actionTaken?: string;
  preventionPlan?: string;
  status: "draft" | "in_review" | "resolved";
  createdAt: any;
  resolvedAt?: any;
}

/**
 * [PetLog v1.1.7 Incident Review / Postmortem]
 * 품질 사고 발생 시 원인과 조치 내용을 기록합니다.
 */
export async function createIncidentDraft(report: Omit<IncidentReport, 'createdAt' | 'status'>): Promise<string> {
  try {
    // 중복 생성 방지 (최근 1시간 내 동일 버전 사고)
    const q = query(
      collection(db, 'qa_incidents'),
      where('relatedReleaseVersion', '==', report.relatedReleaseVersion),
      where('status', 'in', ['draft', 'in_review']),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    const docRef = await addDoc(collection(db, 'qa_incidents'), {
      ...report,
      status: 'draft',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Failed to create incident draft:', e);
    throw e;
  }
}

export async function getRecentIncidents(count: number = 5): Promise<IncidentReport[]> {
  const q = query(collection(db, 'qa_incidents'), orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ incidentId: d.id, ...d.data() } as IncidentReport));
}

export async function updateIncidentReport(incidentId: string, updates: Partial<IncidentReport>): Promise<void> {
  const ref = doc(db, 'qa_incidents', incidentId);
  const data: any = { ...updates };
  if (updates.status === 'resolved') data.resolvedAt = serverTimestamp();
  await updateDoc(ref, data);
}
