
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

export type ChangeRequestStatus = "draft" | "reviewing" | "approved" | "rejected" | "implemented";
export type RiskLevel = "low" | "medium" | "high";

export interface ChangeRequest {
  changeRequestId?: string;
  sourceType: "regression_candidate" | "incident_report" | "knowledge_base";
  sourceId: string;
  title: string;
  affectedRuleName: string;
  affectedCategory: string;
  issueSummary: string;
  evidenceSummary: string;
  suggestedChange: string;
  expectedImpact: string;
  relatedKeywords: string[];
  relatedGoldenTests: string[];
  relatedFiles: string[];
  riskLevel: RiskLevel;
  status: ChangeRequestStatus;
  createdAt: any;
  updatedAt: any;
}

/**
 * [PetLog v1.1.9 Engine Change Request / Rule Proposal]
 * 분석 엔진 룰 개선을 공식적으로 제안하고 관리합니다.
 */
export async function createChangeRequest(request: Omit<ChangeRequest, 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'qa_change_requests'), {
      ...request,
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Failed to create change request:', e);
    throw e;
  }
}

export async function getRecentChangeRequests(count: number = 10): Promise<ChangeRequest[]> {
  const q = query(collection(db, 'qa_change_requests'), orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ changeRequestId: d.id, ...d.data() } as ChangeRequest));
}

export async function updateChangeRequestStatus(requestId: string, status: ChangeRequestStatus): Promise<void> {
  const ref = doc(db, 'qa_change_requests', requestId);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp()
  });
}
