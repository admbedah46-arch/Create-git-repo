
import React from 'react';

export const BrandLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl', variant?: 'light' | 'dark' | 'full' }> = ({ size = 'md', variant = 'full' }) => {
  const sizes = {
    sm: { h: 'h-8', font: 'text-lg', slogan: 'text-[6px]' },
    md: { h: 'h-12', font: 'text-2xl', slogan: 'text-[8px]' },
    lg: { h: 'h-20', font: 'text-4xl', slogan: 'text-[10px]' },
    xl: { h: 'h-32', font: 'text-6xl', slogan: 'text-[14px]' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${variant === 'full' ? 'flex-row' : 'flex-col'}`}>
      {/* Shield Logo with Gradient */}
      <div className={`${currentSize.h} aspect-square relative flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
          <defs>
            <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e4b8f" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8dc63f" />
            </linearGradient>
          </defs>
          {/* External Shield Shape */}
          <path 
            d="M50 5 L15 20 Q15 60 50 95 Q85 60 85 20 L50 5 Z" 
            fill="none" 
            stroke="url(#shieldGradient)" 
            strokeWidth="6" 
            strokeLinejoin="round"
          />
          {/* Inner details: Arrow and Checkmark motif inspired by the image */}
          <path 
            d="M30 45 L45 60 L80 25 M30 80 Q10 50 30 20" 
            fill="none" 
            stroke="url(#shieldGradient)" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M50 35 L50 75 M35 55 L65 55" 
            fill="none" 
            stroke="url(#shieldGradient)" 
            strokeWidth="4" 
            strokeLinecap="round" 
            opacity="0.3"
          />
        </svg>
      </div>

      {variant !== 'dark' && (
        <div className="flex flex-col justify-center">
          <div className={`${currentSize.font} font-black tracking-tighter leading-none flex items-baseline`}>
            <span className="text-[#3b82f6]">Si</span>
            <span className="text-[#144272]">MANTAP</span>
          </div>
          <div className={`${currentSize.slogan} font-bold text-[#144272] uppercase tracking-[0.1em] mt-0.5 opacity-80 whitespace-nowrap`}>
            Aplikasi Manajemen Laporan Terpadu & Akurat
          </div>
        </div>
      )}
    </div>
  );
};
