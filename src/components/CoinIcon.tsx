import React, { useState } from 'react';
import { COIN_LOGO_URL } from '../config/constants';

interface CoinIconProps {
  className?: string;
  size?: number | string;
  alt?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({
  className = 'w-6 h-6 rounded-full inline-block object-cover',
  size,
  alt = 'X COIN',
}) => {
  const [imgSrc, setImgSrc] = useState<string>('/assets/coin.svg');

  const style = size
    ? { width: typeof size === 'number' ? `${size}px` : size, height: typeof size === 'number' ? `${size}px` : size }
    : undefined;

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={() => {
        if (imgSrc !== '/assets/coin.svg') {
          setImgSrc('/assets/coin.svg');
        }
      }}
      className={`rounded-full object-cover shrink-0 select-none shadow-[0_0_12px_rgba(212,175,55,0.35)] ${className}`}
      style={style}
      loading="lazy"
    />
  );
};
