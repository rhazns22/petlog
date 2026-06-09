import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const safeText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

export const safeIncludes = (value: unknown, keyword: unknown): boolean => {
  const target = safeText(value).toLowerCase();
  const query = safeText(keyword).toLowerCase();
  if (!query) return false;
  return target.includes(query);
};

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  console.error(`Firestore error during ${operationType} at ${path}:`, error);
  throw error;
}

// [v3.0.0] getPetDefaultImage moved to petUtils.ts

/**
 * [v2.6.2] Medical Safety Policy: AI Forbidden Words
 * These terms are strictly prohibited in AI-generated responses to prevent unauthorized medical diagnostic claims.
 * We block diagnostic terms while allowing record-keeping advice like "record prescription info".
 */
export const FORBIDDEN_WORDS = [
  "슬개골", "심장 질환", "질병 가능성", "질환 가능성", "정밀 검사", "집중 치료",
  "치료가 필요합니다", "처방했습니다", "약을 먹이세요", "회복 상태를 관찰하세요",
  "회복을 관찰", "파보", "필요한 치료", "치료가 진행", "상태를 면밀히",
  "AI가 진단했습니다", "AI가 처방했습니다", "처방이 필요합니다"
];

export const SAFE_AI_FALLBACK = "이번 달 지출 내역이 분석되었습니다. 병원에서 안내받은 복약, 재진, 회복 체크 일정이 있다면 PetLog에 기록으로 남겨보세요. 정확한 케어 판단은 전문가의 안내를 권장합니다.";

export const getSafeAiContent = (content: any): string => {
  const text = safeText(content);
  if (!text) return "";
  const hasForbidden = FORBIDDEN_WORDS.some(word => safeIncludes(text, word));
  return hasForbidden ? SAFE_AI_FALLBACK : text;
};

export const normalizeAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

/**
 * PetLog 공식 지출 금액 추출 유틸리티
 * 공식 필드: amount
 * 보조 필드: finalAmount
 * 하위 호환 필드: totalAmount
 */
export const getTransactionAmount = (transaction: any): number => {
  return normalizeAmount(
    transaction?.amount ??
    transaction?.finalAmount ??
    transaction?.totalAmount ??
    0
  );
};

export const isPetLogDebug = (): boolean => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('PETLOG_DEBUG') === 'true';
  } catch {
    return false;
  }
};
