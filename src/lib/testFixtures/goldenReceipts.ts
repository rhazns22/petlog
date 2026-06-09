/**
 * [PetLog Regression Test Fixtures]
 * 골든 데이터는 운영 코드에서 정답을 주입하기 위한 용도가 아닙니다.
 * 엔진의 분석 결과와 비교하여 정확도를 측정하고 회귀 여부를 판정하기 위한 Benchmark 데이터입니다.
 */

export const goldenReceipt001 = {
  id: 'golden-001',
  description: '서울종합동물병원 - 대형 수술 및 입원 케이스',
  expected: {
    merchant: '서울종합동물병원',
    totalPaid: 3082800,
    totalDiscount: 785700,
    finalAmounts: {
      consult: 8000,
      test: 952000,
      treatment: 862400,
      hospitalization: 431200,
      surgery: 804000,
      medicine: 25200,
    },
    discounts: {
      consult: 2000,
      test: 253000,
      treatment: 215600,
      hospitalization: 107800,
      surgery: 201000,
      medicine: 6300,
    }
  }
};

export const taxNotDiscount_001 = {
  id: 'taxNotDiscount-001',
  description: '세금 합계가 부가세 제외 금액인 경우 (할인 오인 방지)',
  expected: {
    merchant: '동물병원 예시',
    totalPaid: 851800,
    totalDiscount: 0,
    taxInfo: {
      taxableAmount: 418000,
      taxFreeAmount: 392000,
      vatAmount: 41800
    },
    // 과세공급가액(418,000) + 비과세(392,000) = 810,000 (이 금액을 할인 전 금액으로 오인하지 않아야 함)
    originalTotalAmount: 851800 
  }
};

export const ALL_GOLDEN_RECEIPTS = [goldenReceipt001, taxNotDiscount_001];
