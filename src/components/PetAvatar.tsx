import React from 'react';
import { getPetDefaultImage } from '../lib/petUtils';

interface PetAvatarProps {
  pet: {
    photoURL?: string;
    type?: string;
    species?: string;
    breed?: string;
    name?: string;
  } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const PetAvatar: React.FC<PetAvatarProps> = ({ pet, size = 'md', className = '' }) => {
  const [imgError, setImgError] = React.useState(false);

  const sizeClasses = {
    xs: 'w-8 h-8 text-base',
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-16 h-16 text-3xl',
    xl: 'w-24 h-24 text-4xl',
  };

  const defaultImg = getPetDefaultImage({
    type: pet?.type,
    species: pet?.species,
    breed: pet?.breed
  });

  const isEmoji = !defaultImg.startsWith('/');

  const [fallbackToEmoji, setFallbackToEmoji] = React.useState(false);

  const renderContent = () => {
    // 1. photoURL 우선
    if (pet?.photoURL && !imgError) {
      return (
        <img
          src={pet.photoURL}
          alt={pet.name || 'Pet'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      );
    }

    // 2. 이모지 또는 에러 발생 시 fallback
    if (isEmoji || fallbackToEmoji) {
      return (
        <span className="leading-none flex items-center justify-center">
          {fallbackToEmoji ? '🐾' : defaultImg}
        </span>
      );
    }

    // 3. 품종/종류별 기본 이미지 (PNG/SVG)
    return (
      <img
        src={defaultImg}
        alt={pet?.breed || 'Default Pet'}
        className="w-full h-full object-cover"
        onError={() => setFallbackToEmoji(true)}
      />
    );
  };

  return (
    <div className={`rounded-full flex items-center justify-center overflow-hidden bg-[#F8FAF9] border border-gray-100 shadow-sm ${sizeClasses[size]} ${className}`}>
      {renderContent()}
    </div>
  );
};

export default PetAvatar;
