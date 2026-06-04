
import { db } from './firebase';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';

export interface MisclassificationCandidate {
  itemName: string;
  aiCategory: string;
  userCategory: string;
  aiConfidence: number;
  aiReason: string[];
  receiptId: string;
  createdAt: any;
}

export interface GroupedMisclassification {
  keyword: string;
  aiCategory: string;
  frequentUserCategory: string;
  correctionCount: number;
  suggestedAction: string;
  samples: MisclassificationCandidate[];
}

export interface RegressionCandidate {
  candidateId: string;
  keyword: string;
  aiCategory: string;
  frequentUserCategory: string;
  correctionCount: number;
  exampleReceiptIds: string[];
  suggestedRuleName: string;
  suggestedAction: string;
  status: "pending_review" | "approved" | "rejected";
  approvalLog?: {
    status: string;
    timestamp: any;
    note?: string;
  }[];
}

/**
 * [PetLog v1.1.0 Regression & QA Workflow]
 */
export async function generateQAReport(userId: string): Promise<{
  candidates: MisclassificationCandidate[];
  groupedReport: GroupedMisclassification[];
  regressionCandidates: RegressionCandidate[];
}> {
  const candidates: MisclassificationCandidate[] = [];
  const regressionCandidatesMap = new Map<string, RegressionCandidate>();
  
  try {
    const q = query(
      collection(db, 'users', userId, 'trainingRecords'),
      orderBy('metadata.createdAt', 'desc'),
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const aiItems = data.aiResult?.lineItems || [];
      const aiSummary = data.aiResult?.categorySummary || {};
      const userSummary = data.confirmedResult?.categorySummary || {};
      
      const categories = ['consult', 'test', 'treatment', 'hospitalization', 'surgery', 'medicine'];
      const diffCategories = categories.filter(cat => 
        Math.abs((aiSummary[cat]?.amount || 0) - (userSummary[cat] || 0)) > 100
      );
      
      if (diffCategories.length > 0) {
        aiItems.forEach((item: any) => {
          const aiCatLower = item.category?.toLowerCase();
          if (diffCategories.includes(aiCatLower)) {
            candidates.push({
              itemName: item.name,
              aiCategory: item.category,
              userCategory: 'USER_EDITED',
              aiConfidence: item.confidence || 0,
              aiReason: item.reason || [],
              receiptId: data.receiptId,
              createdAt: data.metadata.createdAt
            });
          }
        });
      }
    });

    const groups: Record<string, GroupedMisclassification> = {};
    candidates.forEach(c => {
      const key = `${c.itemName}_${c.aiCategory}`;
      if (!groups[key]) {
        groups[key] = {
          keyword: c.itemName,
          aiCategory: c.aiCategory,
          frequentUserCategory: 'UNKNOWN (Review Required)',
          correctionCount: 0,
          suggestedAction: '룰엔진 키워드 매핑 검토 필요',
          samples: []
        };
      }
      groups[key].correctionCount++;
      if (groups[key].samples.length < 3) groups[key].samples.push(c);
    });

    const groupedReport = Object.values(groups).map(g => {
      if (g.keyword.includes('스케일링')) {
        g.suggestedAction = "치과/스케일링 관련 룰 분리 검토";
        g.frequentUserCategory = "TREATMENT";
      } else if (g.keyword.includes('검사')) {
        g.suggestedAction = "검사 세부 항목 분류 정교화 필요";
        g.frequentUserCategory = "TEST";
      }

      if (g.correctionCount >= 3) {
        const dedupeKey = `${g.keyword}_${g.aiCategory}_${g.frequentUserCategory}`;
        if (!regressionCandidatesMap.has(dedupeKey)) {
          regressionCandidatesMap.set(dedupeKey, {
            candidateId: `RC-${new Date().getTime().toString().slice(-6)}-${g.keyword.slice(0, 4)}`,
            keyword: g.keyword,
            aiCategory: g.aiCategory,
            frequentUserCategory: g.frequentUserCategory,
            correctionCount: g.correctionCount,
            exampleReceiptIds: g.samples.map(s => s.receiptId),
            suggestedRuleName: `${g.keyword.replace(/\s+/g, '')}Rule`,
            suggestedAction: g.suggestedAction,
            status: "pending_review",
            approvalLog: []
          });
        }
      }

      return g;
    });

    return { 
      candidates, 
      groupedReport, 
      regressionCandidates: Array.from(regressionCandidatesMap.values()) 
    };
  } catch (error) {
    console.error('[QA Pipeline Error]', error);
    return { candidates: [], groupedReport: [], regressionCandidates: [] };
  }
}
