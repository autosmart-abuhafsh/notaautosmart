import React from 'react';

interface BrandLogoProps {
  logoUrl?: string;
  companyName?: string;
  tagline?: string;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoUrl,
  companyName = 'Autosmart Digital Solutions',
  tagline = 'Skill Up For Digital Collaboration',
  variant = 'dark',
  size = 'md',
  showTagline = true,
}) => {
  const iconDimensions =
    size === 'sm'
      ? 'w-8 h-8 text-sm'
      : size === 'lg'
        ? 'w-12 h-12 text-lg'
        : 'w-10 h-10 text-base';

  const titleClass =
    variant === 'light' ? 'text-white' : 'text-[#101B35]';
  const subClass =
    variant === 'light' ? 'text-[#C5A15B]' : 'text-[#800020]';

  return (
    <div className="flex items-center gap-3 select-none">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={companyName}
          referrerPolicy="no-referrer"
          className={`${iconDimensions} rounded-lg object-contain bg-white p-0.5 border border-slate-200/60 shrink-0`}
        />
      ) : (
        <div
          className={`${iconDimensions} rounded-lg bg-[#800020] text-white font-bold flex items-center justify-center shrink-0 border border-[#C5A15B]/40 shadow-xs`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="w-6 h-6"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 4L27 25H21.2L18.8 20H13.2L10.8 25H5L16 4ZM16 11.2L14.1 16H17.9L16 11.2Z"
              fill="#FFFFFF"
            />
            <path
              d="M9 27H23"
              stroke="#C5A15B"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <div
          className={`font-bold tracking-tight truncate ${
            size === 'lg'
              ? 'text-lg'
              : size === 'sm'
                ? 'text-sm'
                : 'text-base'
          } ${titleClass}`}
        >
          {companyName}
        </div>
        {showTagline && (
          <div
            className={`text-[11px] font-medium truncate ${subClass}`}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
};
