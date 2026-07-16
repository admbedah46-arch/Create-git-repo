
import React from 'react';

export const BrandLogo: React.FC<{ 
  size?: 'sm' | 'md' | 'lg' | 'xl', 
  variant?: 'light' | 'dark' | 'full', 
  appName?: string, 
  appSlogan?: string, 
  fontColor?: string,
  logoUrl?: string
}> = ({ size = 'md', variant = 'full', appName, appSlogan, fontColor, logoUrl }) => {
  const sizes = {
    sm: { h: 'h-8', font: 'text-lg', slogan: 'text-[6px]' },
    md: { h: 'h-12', font: 'text-2xl', slogan: 'text-[8px]' },
    lg: { h: 'h-20', font: 'text-4xl', slogan: 'text-[10px]' },
    xl: { h: 'h-32', font: 'text-6xl', slogan: 'text-[14px]' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center gap-4 ${variant === 'full' ? 'flex-row' : 'flex-col text-center'}`}>
      {/* Shield Logo or custom image Logo */}
      <div className={`${currentSize.h} aspect-square relative flex items-center justify-center shrink-0`}>
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="App Logo" 
            className="w-full h-full object-contain drop-shadow-lg rounded-lg"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // If logo fails to load (e.g. invalid url), clear src or hide so fallback can be done
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-tr from-[#144272] via-[#3b82f6] to-[#8dc63f] rounded-[30%] rotate-12 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl relative z-10">
              <defs>
                <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e4b8f" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8dc63f" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path 
                d="M50 5 L15 20 Q15 60 50 95 Q85 60 85 20 L50 5 Z" 
                fill="white" 
                className="drop-shadow-sm"
              />
              <path 
                d="M50 5 L15 20 Q15 60 50 95 Q85 60 85 20 L50 5 Z" 
                fill="url(#shieldGradient)" 
                fillOpacity="0.05"
                stroke="url(#shieldGradient)" 
                strokeWidth="8" 
                strokeLinejoin="round"
              />
              <path 
                d="M30 40 L40 60 L50 40 L60 60 L70 40" 
                fill="none" 
                stroke="url(#shieldGradient)" 
                strokeWidth="8" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                filter="url(#glow)"
              />
              <circle cx="50" cy="75" r="5" fill="#8dc63f" />
            </svg>
          </>
        )}
      </div>

      {variant !== 'dark' && (
        <div className="flex flex-col justify-center">
          <div className={`${currentSize.font} font-black tracking-tighter leading-none flex items-baseline gap-1`}>
            {appName ? (
              <span className="tracking-normal" style={{ color: fontColor || '#144272' }}>{appName}</span>
            ) : (
              <>
                <span className="text-[#3b82f6] drop-shadow-sm">Si</span>
                <span className="tracking-normal" style={{ color: fontColor || '#144272' }}>MANTAP</span>
              </>
            )}
          </div>
          <div className={`${currentSize.slogan} font-black uppercase tracking-[0.2em] mt-2 whitespace-nowrap`} style={{ color: fontColor ? `${fontColor}99` : '#14427299' }}>
            {appSlogan || 'Sistem Manajemen Laporan Terpadu'}
          </div>
        </div>
      )}
    </div>
  );
};
