
/**
 * [PetLog v2.4 Confirmed Data Learning Pipeline]
 * 
 * 1. 데이터 구분
 * - Golden Data: 개발자가 직접 검증한 회귀 테스트용 기준 데이터
 * - User Confirmed Data: 실제 서비스 운영을 통해 축적되는 개선 자산
 * 
 * 2. 학습 정책
 * - Gemini API는 호출 시마다 자동 학습되지 않으며, PetLog가 자체적으로 데이터를 수집합니다.
 * - 수집된 데이터는 프롬프트, 룰엔진 개선 및 향후 자체 모델 고도화의 기반이 됩니다.
 * 
 * 3. 생성 규칙
 * - 사용자 확정 시점에만 생성 (NEEDS_REVIEW 상태 제외)
 * - 등급제(A/B/C)를 통한 데이터 신뢰도 관리 및 케어 인사이트 노출 제어
 */
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type CorrectionMethod = "ai_no_edit" | "manual" | "suggested_fix";
export type TrainingGrade = "A" | "B" | "C";
export type VerificationStatus = "VERIFIED" | "USER_CORRECTED" | "NEEDS_REVIEW";

export interface CategorySummary {
  consult: number;
  test: number;
  treatment: number;
  hospitalization: number;
  surgery: number;
  medicine: number;
}

export interface ReceiptTrainingRecord {
  trainingId: string;
  receiptId: string;
  userId: string;
  petId?: string;

  aiResult: {
    categorySummary: CategorySummary;
    discounts: CategorySummary;
    paidTotal: number;
    originalTotal?: number;
    totalDiscount?: number;
    confidence?: number;
    statusBeforeUserConfirm: "VERIFIED" | "REVIEW_RECOMMENDED" | "NEEDS_REVIEW";
    lineItems?: any[]; // Added for v1.0.7
  };

  confirmedResult: {
    categorySummary: CategorySummary;
    discounts: CategorySummary;
    paidTotal: number;
    originalTotal?: number;
    totalDiscount?: number;
  };

  correction: {
    wasEdited: boolean;
    correctionMethod: CorrectionMethod;
    editedFields: string[];
    amountDiffBeforeConfirm: number;
    discountDiffBeforeConfirm: number;
    amountDiffAfterConfirm: number;
    discountDiffAfterConfirm: number;
  };

  quality: {
    status: VerificationStatus;
    grade: TrainingGrade;
    isUsableForTraining: boolean;
    reason: string[];
    unknownRatio: number;
  };

  metadata: {
    engineVersion: string;
    promptVersion: string;
    configVersion: string;
    createdAt: any; // Firestore Timestamp or Date
    updatedAt?: any;
  };
}

/**
 * AI 분석 결과와 사용자가 확정한 결과를 비교하여 수정된 필드 목록을 반환합니다.
 */
export function getEditedFields(
  aiResult: { categorySummary: CategorySummary; discounts: CategorySummary; paidTotal: number; totalDiscount?: number },
  confirmedResult: { categorySummary: CategorySummary; discounts: CategorySummary; paidTotal: number; totalDiscount?: number }
): string[] {
  const editedFields: string[] = [];

  const categories: (keyof CategorySummary)[] = [
    'consult', 'test', 'treatment', 'hospitalization', 'surgery', 'medicine'
  ];

  // 카테고리별 금액 비교
  categories.forEach(cat => {
    if (aiResult.categorySummary[cat] !== confirmedResult.categorySummary[cat]) {
      editedFields.push(`categorySummary.${cat}`);
    }
  });

  // 카테고리별 할인 비교
  categories.forEach(cat => {
    if (aiResult.discounts[cat] !== confirmedResult.discounts[cat]) {
      editedFields.push(`discounts.${cat}`);
    }
  });

  // 총액 비교
  if (aiResult.paidTotal !== confirmedResult.paidTotal) {
    editedFields.push('paidTotal');
  }

  if (aiResult.totalDiscount !== confirmedResult.totalDiscount) {
    editedFields.push('totalDiscount');
  }

  return editedFields;
}

/**
 * 기존 correctionMethod를 TrainingRecord용으로 변환합니다.
 */
export function transformCorrectionMethod(method: 'ai' | 'manual' | 'suggested_fix' | string): CorrectionMethod {
  if (method === 'ai') return 'ai_no_edit';
  if (method === 'manual') return 'manual';
  if (method === 'suggested_fix') return 'suggested_fix';
  return 'manual'; // Fallback
}

/**
 * 데이터의 품질 등급을 산정합니다.
 */
export function determineTrainingQuality(input: {
  amountDiffAfterConfirm: number;
  discountDiffAfterConfirm: number;
  finalStatus: VerificationStatus;
  unknownRatio: number;
  isSaved: boolean;
}): { grade: TrainingGrade; isUsableForTraining: boolean; reason: string[] } {
  const { amountDiffAfterConfirm, discountDiffAfterConfirm, finalStatus, unknownRatio, isSaved } = input;

  const amountVerified = amountDiffAfterConfirm === 0;
  const discountVerified = discountDiffAfterConfirm === 0;
  const userConfirmed = isSaved === true;
  const unknownLow = unknownRatio < 0.1;
  const unknownMedium = unknownRatio < 0.2;
  const validStatus = finalStatus === "VERIFIED" || finalStatus === "USER_CORRECTED";

  // A등급 조건
  if (userConfirmed && validStatus && amountVerified && discountVerified && unknownLow) {
    return {
      grade: "A",
      isUsableForTraining: true,
      reason: [
        "결제 총액 일치",
        "할인 총액 일치",
        "사용자 저장 완료",
        "UNKNOWN 비율 낮음"
      ]
    };
  }

  // B등급 조건
  if (userConfirmed && validStatus && amountVerified && unknownMedium) {
    return {
      grade: "B",
      isUsableForTraining: true,
      reason: [
        "결제 총액 일치",
        "사용자 저장 완료",
        "일부 검토 가능 데이터"
      ]
    };
  }

  // C등급 조건 (학습 불가)
  const reasons: string[] = [];
  if (!userConfirmed) reasons.push("저장 미완료");
  if (!amountVerified) reasons.push("총액 불일치");
  if (finalStatus === "NEEDS_REVIEW") reasons.push("검토 필요 상태");
  if (unknownRatio >= 0.2) reasons.push("UNKNOWN 비율 높음");
  
  if (reasons.length === 0) reasons.push("학습 데이터로 사용하기에 신뢰도 부족");

  return {
    grade: "C",
    isUsableForTraining: false,
    reason: reasons
  };
}

/**
 * [Training Pipeline 핵심 저장 함수]
 * 사용자가 영수증 분석 결과를 저장/확정했을 때 호출됩니다.
 */
export async function createTrainingRecord(input: {
  userId: string;
  receiptId: string;
  petId?: string;
  aiResult: {
    categorySummary: CategorySummary;
    discounts: CategorySummary;
    paidTotal: number;
    originalTotal?: number;
    totalDiscount?: number;
    confidence?: number;
    statusBeforeUserConfirm: VerificationStatus | "REVIEW_RECOMMENDED";
    lineItems?: any[];
  };
  confirmedResult: {
    categorySummary: CategorySummary;
    discounts: CategorySummary;
    paidTotal: number;
    originalTotal?: number;
    totalDiscount?: number;
  };
  correctionMethod: 'ai' | 'manual' | 'suggested_fix' | string;
  finalStatus: VerificationStatus;
  amountDiffBeforeConfirm: number;
  discountDiffBeforeConfirm: number;
  amountDiffAfterConfirm: number;
  discountDiffAfterConfirm: number;
  unknownRatio: number;
  engineVersion: string;
  promptVersion: string;
  configVersion: string;
}): Promise<ReceiptTrainingRecord | null> {
  const {
    userId,
    receiptId,
    petId,
    aiResult,
    confirmedResult,
    correctionMethod: rawCorrectionMethod,
    finalStatus,
    amountDiffBeforeConfirm,
    discountDiffBeforeConfirm,
    amountDiffAfterConfirm,
    discountDiffAfterConfirm,
    unknownRatio,
    engineVersion,
    promptVersion,
    configVersion
  } = input;

  // 1. NEEDS_REVIEW 상태이면 생성하지 않음
  if (finalStatus === "NEEDS_REVIEW") {
    console.log("[TrainingRecord Skipped] Status is NEEDS_REVIEW");
    return null;
  }

  // 2. 수정 필드 계산
  const editedFields = getEditedFields(aiResult, confirmedResult);

  // 3. correctionMethod 변환
  const correctionMethod = transformCorrectionMethod(rawCorrectionMethod);

  // 4. 품질 등급 산정
  const { grade, isUsableForTraining, reason } = determineTrainingQuality({
    amountDiffAfterConfirm,
    discountDiffAfterConfirm,
    finalStatus,
    unknownRatio,
    isSaved: true // 이 함수가 호출된 시점은 저장 버튼을 누른 시점임
  });

  const wasEdited = editedFields.length > 0 || correctionMethod !== "ai_no_edit";

  // 5. TrainingRecord 객체 구성
  const trainingRecordData: Omit<ReceiptTrainingRecord, 'trainingId'> = {
    receiptId,
    userId,
    petId,
    aiResult: {
      ...aiResult,
      statusBeforeUserConfirm: aiResult.statusBeforeUserConfirm as any
    },
    confirmedResult,
    correction: {
      wasEdited,
      correctionMethod,
      editedFields,
      amountDiffBeforeConfirm,
      discountDiffBeforeConfirm,
      amountDiffAfterConfirm,
      discountDiffAfterConfirm
    },
    quality: {
      status: finalStatus,
      grade,
      isUsableForTraining,
      reason,
      unknownRatio
    },
    metadata: {
      engineVersion,
      promptVersion,
      configVersion,
      createdAt: serverTimestamp()
    }
  };

  try {
    // 6. Firestore 저장 (users/{userId}/trainingRecords/)
    const docRef = await addDoc(
      collection(db, 'users', userId, 'trainingRecords'),
      trainingRecordData
    );

    const record: ReceiptTrainingRecord = {
      trainingId: docRef.id,
      ...trainingRecordData
    };

    // 7. 결과 출력
    console.log("[TrainingRecord Created]", {
      receiptId,
      trainingId: docRef.id,
      grade,
      isUsableForTraining,
      correctionMethod,
      editedFields
    });

    return record;
  } catch (error) {
    console.error("[TrainingRecord Creation Failed] Firestore Error:", error);
    throw error;
  }
}
