

export const getPetDefaultImage = (options: { 
  type?: string; 
  species?: string; 
  breed?: string; 
} | string): string => {
  // 하위 호환성: string이 들어오면 type으로 처리
  let type = '';
  let breed = '';
  
  if (typeof options === 'string') {
    type = options;
  } else {
    type = options.type || options.species || '';
    breed = options.breed || '';
  }

  const safeType = type.toLowerCase();
  const safeBreed = breed.toLowerCase();

  // 1. 품종별 매핑
  const matches = (keywords: string[]) => keywords.some(k => safeBreed.replace(/\s+/g, '').includes(k.replace(/\s+/g, '').toLowerCase()));

  if (matches(['말티즈', '말티', 'maltese'])) return '/images/breeds/maltese.png';
  if (matches(['푸들', '토이푸들', 'poodle'])) return '/images/breeds/poodle.png';
  if (matches(['포메라니안', '포메', 'pomeranian'])) return '/images/breeds/pomeranian.png';
  if (matches(['비숑', '비숑프리제', 'bichon'])) return '/images/breeds/bichon.png';
  if (matches(['치와와', 'chihuahua'])) return '/images/breeds/chihuahua.png';
  if (matches(['시츄', '시추', 'shihtzu', 'shih tzu'])) return '/images/breeds/shihtzu.png';
  if (matches(['진돗개', '진도', 'jindo'])) return '/images/breeds/jindo.png';
  if (matches(['리트리버', 'retriever'])) return '/images/breeds/retriever.png';
  if (matches(['웰시코기', '웰시', 'corgi'])) return '/images/breeds/corgi.png';
  if (matches(['닥스훈트', '닥스', 'dachshund'])) return '/images/breeds/dachshund.png';
  if (matches(['러시안 블루', '러블', 'russian'])) return '/images/breeds/russianblue.png';
  if (matches(['코리안', '코숏', 'korean'])) return '/images/breeds/koreanshort.png';
  if (matches(['믹스견', '믹스']) && safeType === 'dog') return '/images/breeds/mix_dog.png';
  if (matches(['믹스묘', '믹스']) && safeType === 'cat') return '/images/breeds/mix_cat.png';

  // 2. 종류별 기본 매핑
  if (
    safeType.includes('cat') ||
    safeType.includes('고양이') ||
    safeType.includes('묘')
  ) {
    return '/images/breeds/cat_default.png';
  }

  if (
    safeType.includes('dog') ||
    safeType.includes('강아지') ||
    safeType.includes('개') ||
    safeType.includes('견')
  ) {
    return '/images/breeds/dog_default.png';
  }

  return '🐾';
};

export const isEmoji = (str: string): boolean => {
  // Simple check for common pet emojis
  return ['🐱', '🐶', '🐾'].includes(str);
};
