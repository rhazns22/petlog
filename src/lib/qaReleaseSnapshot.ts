
import { db } from './firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { ReleaseGateStatus } from './qaReleaseGate';

export interface ReleaseSnapshot {
  snapshotId?: string;
  releaseVersion: string;
  releaseGateStatus: ReleaseGateStatus;
  engineHealthScore: number;
  goldenTestStatus: string;
  taxNotDiscount001Status: string;
  unresolvedCriticalAlertCount: number;
  userCorrectionRate: number;
  averageConfidence: number;
  averageOtherRatio: number;
  topMisclassifiedKeywords: any[];
  releaseImpactSummary: string;
  approvedBy?: string;
  approvedAt?: any;
  approvalNote?: string;
  overrideInfo?: {
    overrideBy: string;
    overrideReason: string;
    overrideAt: any;
  };
  createdAt: any;
}

/**
 * [PetLog v1.1.5 Release Checklist Snapshot]
 * 배포 당시의 품질 상태를 기록하고 관리합니다.
 */
export async function createReleaseSnapshot(snapshot: Omit<ReleaseSnapshot, 'createdAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'release_snapshots'), {
      ...snapshot,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Failed to create release snapshot:', e);
    throw e;
  }
}

export async function getRecentSnapshots(count: number = 5): Promise<ReleaseSnapshot[]> {
  const q = query(collection(db, 'release_snapshots'), orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ snapshotId: d.id, ...d.data() } as ReleaseSnapshot));
}
