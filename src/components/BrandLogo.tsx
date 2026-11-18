import React, { useState } from 'react';

export const DEFAULT_COMPANY_LOGO_URL = '/assets/autosmart-logo.png';

interface BrandLogoProps {
  companyName?: string;
  tagline?: string;
  logoUrl?: string;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  companyName = 'Autosmart Digital Solutions',
  tagline = 'Skill Up For Digital Collaboration',
  logoUrl,
  variant = 'light',
  size = 'md',
}) => {
  const [useDefaultLogo, setUseDefaultLogo] = useState(false);
  const [imgError, setImgError] = useState(false);
  const titleColor = variant === 'light' ? 'text-white' : 'text-[#101B35]';
  const taglineColor =
    variant === 'light' ? 'text-[#C5A15B]' : 'text-[#800020]';

  const boxSize =
    size === 'sm'
      ? 'w-8 h-8'
      : size === 'lg'
        ? 'w-12 h-12'
        : 'w-9 h-9';

  const titleText =
    size === 'sm'
      ? 'text-sm'
      : size === 'lg'
        ? 'text-lg'
        : 'text-[15px]';

  const resolvedLogoUrl =
    !useDefaultLogo && logoUrl && logoUrl.trim()
      ? logoUrl.trim()
      : DEFAULT_COMPANY_LOGO_URL;

  return (
    <div className="flex items-center gap-3 select-none min-w-0">
      {!imgError && resolvedLogoUrl ? (
        <img
          src={resolvedLogoUrl}
          alt={`Logo ${companyName}`}
          onError={() => {
            if (!useDefaultLogo && resolvedLogoUrl !== DEFAULT_COMPANY_LOGO_URL) {
              setUseDefaultLogo(true);
            } else {
              setImgError(true);
            }
          }}
          className={`${boxSize} rounded-lg object-contain bg-white p-0.5 border border-slate-200/40 shrink-0 shadow-2xs`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`${boxSize} rounded-lg bg-[#800020] border border-[#C5A15B]/40 flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 32 32"
            className="w-5 h-5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 4L5 26H10.5L13 20.5H19L21.5 26H27L16 4ZM14.6 16.5L16 13.2L17.4 16.5H14.6Z"
              fill="#FFFFFF"
            />
            <path d="M9 27.5H23" stroke="#C5A15B" strokeWidth="2" />
          </svg>
        </div>
      )}

      <div className="leading-tight min-w-0">
        <div
          className={`font-bold tracking-tight truncate ${titleText} ${titleColor}`}
        >
          {companyName}
        </div>
        {tagline && (
          <div
            className={`text-[11px] font-medium tracking-wide truncate ${taglineColor}`}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
};
