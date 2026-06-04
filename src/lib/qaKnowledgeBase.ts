
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { safeIncludes, safeText } from './utils';

export interface QAEntry {
  entryId?: string;
  sourceIncidentId: string;
  title: string;
  issueType: string;
  affectedVersion: string;
  relatedMetric: string;
  rootCauseSummary: string;
  actionTakenSummary: string;
  preventionPlanSummary: string;
  relatedGoldenTests: string[];
  relatedKeywords: string[];
  relatedFiles: string[];
  createdAt: any;
  updatedAt: any;
}

/**
 * [PetLog v1.1.8 QA Knowledge Base]
 * 해결된 품질 사고를 지식 자산으로 축적합니다.
 */
export async function createKnowledgeEntry(entry: Omit<QAEntry, 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'qa_knowledge'), {
      ...entry,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Failed to create knowledge entry:', e);
    throw e;
  }
}

export async function searchKnowledge(params: {
  keyword?: string;
  issueType?: string;
  testName?: string;
}): Promise<QAEntry[]> {
  let q = query(collection(db, 'qa_knowledge'), orderBy('createdAt', 'desc'), limit(20));
  
  if (params.issueType) {
    q = query(q, where('issueType', '==', params.issueType));
  }
  
  // Firestore 복합 쿼리 제한으로 인해 키워드 및 테스트명 필터링은 
  // 실제 서비스 환경에서는 인덱싱 또는 클라이언트 사이드 필터링을 수행합니다.
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ entryId: d.id, ...d.data() } as QAEntry));

  if (params.keyword) {
    results = results.filter(r => 
      safeIncludes(r.title, params.keyword!) || 
      (r.relatedKeywords || []).some(k => safeIncludes(k, params.keyword!))
    );
  }
  
  if (params.testName) {
    results = results.filter(r => (r.relatedGoldenTests || []).some(t => safeIncludes(t, params.testName!)));
  }

  return results;
}
