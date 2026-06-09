
import { safeIncludes, safeText } from './utils';

/**
 * Medical Analysis Engine v1.0.0
 * Probabilistic Hybrid Classification for Pet Medical Receipts
 */

export type MedicalCategory = 'DIAGNOSIS' | 'TEST' | 'TREATMENT' | 'SURGERY' | 'MEDICINE' | 'HOSPITALIZATION' | 'UNKNOWN';

export interface ScoreBreakdown {
  k: number;
  c: number;
  s: number;
}

export interface AnalysisResult {
  primary: MedicalCategory;
  secondary?: MedicalCategory;
  confidence: number;
  reasons: string[];
  breakdown: ScoreBreakdown;
  rawScores: Record<MedicalCategory, number>;
}

export interface EngineConfig {
  weights: {
    keyword: number;
    context: number;
    sequence: number;
  };
  caps: {
    keyword: number;
    context: number;
    sequence: number;
  };
  thresholds: {
    sumFallback: number;
    top2Difference: number;
    ruleConfidenceLow: number;
  };
  epsilon: number;
  engineVersion: string;
  configVersion: string;
}

const DEFAULT_CONFIG: EngineConfig = {
  weights: {
    keyword: 0.6,
    context: 0.3,
    sequence: 0.1,
  },
  caps: {
    keyword: 0.6,
    context: 0.3,
    sequence: 0.1,
  },
  thresholds: {
    sumFallback: 0.1,
    top2Difference: 0.15,
    ruleConfidenceLow: 0.3,
  },
  epsilon: 1e-6,
  engineVersion: "1.8.0",
  configVersion: "1.8.0",
};

const KEYWORD_MAP: Record<string, MedicalCategory[]> = {
  '진찰': ['DIAGNOSIS'], '상담': ['DIAGNOSIS'], '초진': ['DIAGNOSIS'], '재진': ['DIAGNOSIS'], '진료': ['DIAGNOSIS'], 'consult': ['DIAGNOSIS'],
  '검사': ['TEST'], 'x-ray': ['TEST'], 'ct': ['TEST'], 'ct검사': ['TEST'], 'mri': ['TEST'], '혈액': ['TEST'], 'cbc': ['TEST'], '초음파': ['TEST'], '영상': ['TEST'], 'lab': ['TEST'], '병리': ['TEST'], '채혈': ['TEST'], '소변': ['TEST'], '조직': ['TEST'],
  '수술': ['SURGERY'], '절개': ['SURGERY'], '봉합': ['SURGERY'], '마취': ['SURGERY'], 'propofol': ['SURGERY'], 'midazolam': ['SURGERY'], 'butorphanol': ['SURGERY'], 'isoflurane': ['SURGERY'], '가스마취': ['SURGERY'], '전신마취': ['SURGERY'], '부분마취': ['SURGERY'], '생검': ['SURGERY'], 'biopsy': ['SURGERY'], '배액': ['SURGERY'], 'rovac': ['SURGERY'], '폐쇄형': ['SURGERY'], '멸균': ['SURGERY'], '포': ['SURGERY'], '복': ['SURGERY'],
  '처치': ['TREATMENT'], '수액': ['TREATMENT'], 'infusion': ['TREATMENT'], 'fluid': ['TREATMENT'], '주사': ['TREATMENT'], '소독': ['TREATMENT'], '혈관': ['TREATMENT'], '카테터': ['TREATMENT'], '관류': ['TREATMENT'], '드레싱': ['TREATMENT'], '주사제': ['TREATMENT'], '펌프': ['TREATMENT'], '항생제주사': ['TREATMENT'], '네뷸': ['TREATMENT'],
  '입원': ['HOSPITALIZATION'], '입실': ['HOSPITALIZATION'], '면회': ['HOSPITALIZATION'], '산소방': ['HOSPITALIZATION'], 'icu': ['HOSPITALIZATION'], '호텔': ['HOSPITALIZATION'], '주간': ['HOSPITALIZATION'], '야간': ['HOSPITALIZATION'], 'hospital': ['HOSPITALIZATION'], 'hospitalization': ['HOSPITALIZATION'],
  '내복약': ['MEDICINE'], '조제': ['MEDICINE'], '정': ['MEDICINE'], '캡슐': ['MEDICINE'], '연고': ['MEDICINE'], '시럽': ['MEDICINE'], '안약': ['MEDICINE'], '외용': ['MEDICINE']
};

const FORCE_RULES = [
  // 1. [ULTRA_FORCE] 진단/검사 (절대 우선순위: 수술 맥락보다 무조건 우선)
  { keywords: ['조직병리', '병리검사', 'lab 의뢰', '검사 의뢰', '의뢰검사', '판독', '진단검사', '영상검사'], category: 'TEST' },
  { keywords: ['ct 촬영', 'ct 검사', 'ct 촬영료'], category: 'TEST' },
  
  // 2. [ULTRA_FORCE] 수술적 행위 (검사 키워드보다 구체적인 수술 행위 우선)
  { keywords: ['생검 수술', '수술적 생검', '절개 생검'], category: 'SURGERY' },
  { keywords: ['ct 마취료', 'ct 마취'], category: 'SURGERY' },
  
  // 3. 수술/마취 (배액관, 장착 등 수술 소모품 및 행위)
  { keywords: ['수술비', '수술료', '마취비', '마취료', '마취', '수술', 'propofol', 'midazolam', 'butorphanol', '외과 생검', 'biopsy', '배액관', 'rovac', '폐쇄형', '멸균포', '멸균복', '제거술', '봉합', '장착'], category: 'SURGERY' },
  
  // 4. 입원
  { keywords: ['입원', '입실', '산소방', 'icu', '주간 입원', '야간 입원', 'hospital', 'hospitalization'], category: 'HOSPITALIZATION' },
  
  // 5. 진찰/진료비
  { keywords: ['진찰', '진료비', '초진', '재진', '상담'], category: 'DIAGNOSIS' },
  
  // 6. 검사 (일반 검사 - 엑스레이, 방사선, 혈액 standalone, 세포검사 포함)
  { keywords: ['엑스레이', '방사선촬영', '방사선', 'x-ray', 'xray', '초음파', 'cbc', '혈액검사', '혈액(혈청)', '혈액(혈구)', '혈액-', '채혈', 'lab', '진단키트', '검사료', '검사', 'cytology', 'fna', 'fnab', 'chem', 'crp', 'saa', 'chemistry', '전해질', 'catalyst', 'procyte', 'idexx', 'nmb'], category: 'TEST' },
  
  // 7. 처치/주사 (약제와 혼동 방지)
  { keywords: ['수액', 'infusion', '주사', '피하', '정맥', '카테터', '드레싱', '처치', '펌프'], category: 'TREATMENT' },
  
  // 8. 약제/예방 (귀약, 코약, 비타민, 앰플, 처방약 포함)
  { keywords: ['내복약', '조제료', '약제비', '캡슐', '시럽', '연고', '안약', '외용제', '특수약물', '약물', '귀약', '코약', '비타민', 'ample', 'ampoule', '앰플', '처방', '접종', '백신', 'vaccine', 'advocate', 'frontline', 'bravecto', 'nexgard', 'rabies', 'rabbies', '광견병'], category: 'MEDICINE' }
];

// Regex-based pattern rules (숫자+mg 복용 패턴, 처방식 브랜드 등)
const REGEX_RULES: { pattern: RegExp; category: string }[] = [
  // MEDICINE: 숫자+mg/mcg 패턴 (ml 제외 - 수액/주사 오탐 방지)
  { pattern: /\d+\s*(mg|㎎|mcg|ug)(\s|\d|\/|$)/i, category: 'MEDICINE' },
  // MEDICINE: 복용 지시어 (BID, TID, SID, QD, PO, tab, cap, 정제 등)
  { pattern: /\b(bid|tid|sid|qd|po|ond|tablet|tab\b|cap\b|capsule|정제|복용|투약)\b/i, category: 'MEDICINE' },
  // FOOD: 로얄캐닌 및 처방식 사료 브랜드
  { pattern: /(로얄|로얄캐닌|royal\s*canin|royal|리커버리|recovery|베이비캣|babycat|처방식|사료)/i, category: 'FOOD' },
];


export class MedicalAnalysisEngine {
  private config: EngineConfig;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  analyze(items: any[], aiConfidence: number = 0.5): AnalysisResult[] {
    const firstSurgeryIndex = items.findIndex(item => 
      ['SURGERY', 'ANESTHESIA', '마취', '수술', 'biopsy', '생검'].some(kw => safeIncludes(item?.name?.toLowerCase(), kw))
    );

    return items.map((item, index) => {
      const name = safeText(item?.name).toLowerCase();
      const reasons: string[] = [];

      // 0a. Regex Rules (숫자+mg 복용 패턴, 사료 브랜드 등)
      for (const rule of REGEX_RULES) {
        if (rule.pattern.test(safeText(item?.name))) {
          const cat = rule.category as MedicalCategory;
          return {
            primary: cat,
            confidence: 0.95,
            reasons: [`Regex Rule: Pattern '${rule.pattern}' matched '${safeText(item?.name)}'`],
            breakdown: { k: 0.6, c: 0, s: 0 },
            rawScores: { DIAGNOSIS: 0, TEST: 0, TREATMENT: 0, SURGERY: 0, MEDICINE: 0, HOSPITALIZATION: 0, UNKNOWN: 0, [cat]: 1 }
          };
        }
      }

      // 0b. High Priority Force Rules
      for (const rule of FORCE_RULES) {
        if (rule.keywords.some(kw => safeIncludes(name, kw))) {
          const cat = rule.category as MedicalCategory;
          return {
            primary: cat,
            confidence: 0.98,
            reasons: [`Force Rule: Match found for '${name}' in ${cat} whitelist`],
            breakdown: { k: 0.6, c: 0, s: 0 },
            rawScores: { DIAGNOSIS: 0, TEST: 0, TREATMENT: 0, SURGERY: 0, MEDICINE: 0, HOSPITALIZATION: 0, UNKNOWN: 0, [cat]: 1 }
          };
        }
      }

      const scores: Record<MedicalCategory, number> = {
        DIAGNOSIS: 0, TEST: 0, TREATMENT: 0, SURGERY: 0, MEDICINE: 0, HOSPITALIZATION: 0, UNKNOWN: 0
      };

      const breakdownMap: Record<MedicalCategory, ScoreBreakdown> = {
        DIAGNOSIS: { k: 0, c: 0, s: 0 },
        TEST: { k: 0, c: 0, s: 0 },
        TREATMENT: { k: 0, c: 0, s: 0 },
        SURGERY: { k: 0, c: 0, s: 0 },
        MEDICINE: { k: 0, c: 0, s: 0 },
        HOSPITALIZATION: { k: 0, c: 0, s: 0 },
        UNKNOWN: { k: 0, c: 0, s: 0 }
      };

      // 1. Keyword Scoring (K)
      Object.entries(KEYWORD_MAP).forEach(([kw, cats]) => {
        if (safeIncludes(name, kw)) {
          const weight = 1 / cats.length;
          cats.forEach(cat => {
            const kScore = Math.min(this.config.caps.keyword, this.config.weights.keyword * weight);
            scores[cat] += kScore;
            breakdownMap[cat].k += kScore;
            reasons.push(`Matched keyword: ${kw}`);
          });
        }
      });

      // 2. Context Scoring (C) - Sliding Window +-3
      const windowSize = 3;
      for (let i = Math.max(0, index - windowSize); i <= Math.min(items.length - 1, index + windowSize); i++) {
        if (i === index) continue;
        const neighbor = safeText(items[i]?.name).toLowerCase();
        const distance = Math.abs(i - index);
        const distWeight = 1 / (1 + distance);

        if (safeIncludes(neighbor, '마취') || safeIncludes(neighbor, 'anesthesia') || safeIncludes(neighbor, '수술')) {
          const cScore = Math.min(this.config.caps.context, this.config.weights.context * distWeight);
          scores['SURGERY'] += cScore;
          breakdownMap['SURGERY'].c += cScore;
          
          // Biopsy special handling: Biopsy near anesthesia = SURGERY
          if (safeIncludes(name, '생검') || safeIncludes(name, 'biopsy')) {
            scores['SURGERY'] += 0.2; // Extra boost for biopsy near anesthesia
            reasons.push(`Context: Biopsy with anesthesia detected`);
          }
          
          reasons.push(`Context: Near surgery/anesthesia (dist: ${distance})`);
        }
      }

      // Keyword Attenuation if strong context
      Object.keys(scores).forEach(cat => {
        const cScore = breakdownMap[cat as MedicalCategory].c;
        const kScore = breakdownMap[cat as MedicalCategory].k;
        if (cScore > kScore * 0.8 && kScore > 0) {
          const originalK = breakdownMap[cat as MedicalCategory].k;
          breakdownMap[cat as MedicalCategory].k *= 0.7;
          scores[cat as MedicalCategory] -= (originalK - breakdownMap[cat as MedicalCategory].k);
          reasons.push(`Attenuated ${cat} keyword due to strong context`);
        }
      });

      // 3. Sequence Scoring (S)
      if (firstSurgeryIndex !== -1) {
        const isBefore = index < firstSurgeryIndex;
        const isNear = Math.abs(index - firstSurgeryIndex) <= 2;
        
        if (isBefore) {
          const sScore = this.config.weights.sequence * 1.1;
          scores['TEST'] += sScore;
          breakdownMap['TEST'].s += sScore;
          reasons.push("Sequence: Pre-surgery phase (Test boost)");
        } else if (isNear) {
          // Guardrail: Surgery window 내에 있더라도 '검사' 키워드가 있으면 TEST 우선
          if (safeIncludes(name, '검사') || safeIncludes(name, 'lab') || safeIncludes(name, '의뢰')) {
            scores['TEST'] += 0.3;
            reasons.push("Guardrail: 'Exam' keyword detected in surgery window (TEST boost)");
          }
          const sScore = this.config.weights.sequence;
          scores['SURGERY'] += sScore;
          breakdownMap['SURGERY'].s += sScore;
          reasons.push("Sequence: During surgery window");
        } else {
          const sScore = this.config.weights.sequence * 0.9;
          scores['TREATMENT'] += sScore;
          breakdownMap['TREATMENT'].s += sScore;
          reasons.push("Sequence: Post-surgery recovery phase");
        }
      }

      // Final Score Normalization
      const sum = Object.values(scores).reduce((a, b) => a + b, 0);
      if (sum < this.config.thresholds.sumFallback) {
        return {
          primary: 'UNKNOWN',
          confidence: 0,
          reasons: ["Insufficient information for classification"],
          breakdown: { k: 0, c: 0, s: 0 },
          rawScores: scores
        };
      }

      const normalized: any = {};
      Object.entries(scores).forEach(([cat, val]) => {
        normalized[cat] = val / (sum + this.config.epsilon);
      });

      const sorted = Object.entries(normalized)
        .sort((a: any, b: any) => b[1] - a[1]) as [MedicalCategory, number][];

      const top1 = sorted[0];
      const top2 = sorted[1];
      
      const ruleConfidence = (top1[1] - top2[1]) / (top1[1] + top2[1] + this.config.epsilon);
      
      // Hybrid Confidence
      let finalConfidence;
      if (ruleConfidence < this.config.thresholds.ruleConfidenceLow) {
        finalConfidence = (aiConfidence * 0.3) + (ruleConfidence * 0.7);
      } else {
        finalConfidence = (aiConfidence * 0.5) + (ruleConfidence * 0.5);
      }

      const result: AnalysisResult = {
        primary: top1[0],
        confidence: finalConfidence,
        reasons: Array.from(new Set(reasons)),
        breakdown: breakdownMap[top1[0]],
        rawScores: scores
      };

      if (top1[1] - top2[1] < this.config.thresholds.top2Difference) {
        result.secondary = top2[0];
      }

      return result;
    });
  }

  getVersionInfo() {
    return {
      engine: this.config.engineVersion,
      config: this.config.configVersion
    };
  }
}
