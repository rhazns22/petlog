/**
 * [PetLog Image Optimization Utility]
 * OCR 분석 정확도와 속도 사이의 최적의 밸런스를 위해 이미지를 리사이징합니다.
 */

export async function createAnalysisImage(file: File): Promise<{ blob: Blob; metadata: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_DIMENSION = 2000;
        const MIN_SHORT_SIDE = 900;
        const QUALITY = 0.85;

        // 긴 변과 짧은 변 계산
        const longSide = Math.max(width, height);
        const shortSide = Math.min(width, height);

        let usedWidth = width;
        let usedHeight = height;
        let wasResized = false;
        let usedQuality = QUALITY;

        // 리사이징 로직 (긴 변 기준 2000px)
        if (longSide > MAX_DIMENSION) {
          let ratio = MAX_DIMENSION / longSide;
          
          // [PetLog QA] 짧은 변 보호 로직 (영수증 판독 가독성 확보)
          // 리사이즈 결과 짧은 변이 900px 미만이 될 경우, 900px에 맞추거나 원본 유지
          if (shortSide * ratio < MIN_SHORT_SIDE) {
            if (shortSide > MIN_SHORT_SIDE) {
              ratio = MIN_SHORT_SIDE / shortSide;
            } else {
              ratio = 1; // 원본이 이미 작으면 다운스케일 하지 않음
            }
          }

          if (ratio < 1) {
            usedWidth = width * ratio;
            usedHeight = height * ratio;
            wasResized = true;
          }
        }

        // 품질 방어 로직 (이미지가 작으면 원본 품질에 가깝게 보존)
        if (shortSide < MIN_SHORT_SIDE) {
          usedQuality = 0.92; // 0.85 -> 0.92로 완화
        }

        canvas.width = usedWidth;
        canvas.height = usedHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, usedWidth, usedHeight);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                metadata: {
                  analysisImageUsed: true,
                  analysisImageMaxDimension: MAX_DIMENSION,
                  analysisImageQuality: usedQuality,
                  originalWidth: img.width,
                  originalHeight: img.height,
                  resizedWidth: Math.round(usedWidth),
                  resizedHeight: Math.round(usedHeight),
                  wasResized,
                  analysisImageOriginalSize: file.size,
                  analysisImageOptimizedSize: blob.size
                }
              });
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          usedQuality
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Blob을 Base64 문자열로 변환 (Gemini API 전송용)
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
