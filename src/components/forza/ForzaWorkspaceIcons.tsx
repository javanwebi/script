import React from 'react';

type IconProps = {
  className?: string;
  size?: number;
};

const baseSvgProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: className ?? 'shrink-0',
  'aria-hidden': true as const,
});

/** ChatGPT-style new chat / compose icon */
export const NewComposeIcon: React.FC<IconProps> = ({ className, size = 18 }) => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12" />
    <path d="M18.375 3.625a1.768 1.768 0 0 1 2.5 2.5L12.5 14.5l-3.5.875.875-3.5 8.5-8.25z" />
  </svg>
);

/** ChatGPT-style crisp sidebar panel toggle icon */
export const SidebarToggleIcon: React.FC<IconProps> = ({ className, size = 18 }) => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M15 4.5v15" />
    <path d="M17.5 8.5h.5M17.5 11.5h.5" strokeWidth="1.9" />
  </svg>
);

/** Crisp geometric upward send arrow */
export const SendArrowIcon: React.FC<IconProps> = ({ className, size = 18 }) => (
  <svg {...baseSvgProps(size, className)} strokeWidth={2.1}>
    <path d="M12 18.5V5.5" />
    <path d="M6.5 11L12 5.5 17.5 11" />
  </svg>
);

/** V-belt and timing belt loop wrapped around driver/driven sheaves */
export const BeltIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="7" cy="12" r="4.25" fill="currentColor" fillOpacity="0.08" />
    <circle cx="17.5" cy="12" r="2.85" fill="currentColor" fillOpacity="0.08" />
    <path d="M7 7.75L17.6 9.15" />
    <path d="M7 16.25L17.6 14.85" />
    <circle cx="7" cy="12" r="1.35" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** Taper-lock industrial pulley with precision keyway bore */
export const PulleyIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="12" cy="12" r="8.75" fill="currentColor" fillOpacity="0.06" />
    <circle cx="12" cy="12" r="5.25" />
    <circle cx="12" cy="12" r="2.1" fill="currentColor" fillOpacity="0.14" />
    <path d="M12 3.25v3.5M12 17.25v3.5" />
    <path d="M4.42 7.62l3.03 1.75M16.55 14.63l3.03 1.75" />
    <path d="M19.58 7.62l-3.03 1.75M7.45 14.63l-3.03 1.75" />
  </svg>
);

/** Deep-groove ball bearing cross section */
export const BearingIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.06" />
    <circle cx="12" cy="12" r="3.6" fill="currentColor" fillOpacity="0.12" />
    <circle cx="12" cy="5.6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.4" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="5.6" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18.4" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="7.47" cy="7.47" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16.53" cy="16.53" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16.53" cy="7.47" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="7.47" cy="16.53" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

/** Roller chain & sprocket coupling */
export const ChainCouplingIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="3" y="7.25" width="9.25" height="5.75" rx="2.875" fill="currentColor" fillOpacity="0.08" />
    <rect x="11.75" y="11" width="9.25" height="5.75" rx="2.875" fill="currentColor" fillOpacity="0.08" />
    <path d="M8.5 10.125h7" strokeWidth="1.5" />
    <circle cx="6.25" cy="10.125" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="17.75" cy="13.875" r="1.05" fill="currentColor" stroke="none" />
  </svg>
);

/** Ceramic kiln roller with thermal flux waves */
export const KilnRollerIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="3" y="13.5" width="18" height="5.25" rx="2.25" fill="currentColor" fillOpacity="0.09" />
    <path d="M7.25 13.5v5.25M16.75 13.5v5.25" />
    <path d="M7.75 10c0-1.45 1.35-1.95 1.35-3.45" />
    <path d="M11.65 10c0-1.45 1.35-1.95 1.35-3.45" />
    <path d="M15.55 10c0-1.45 1.35-1.95 1.35-3.45" />
  </svg>
);

/** Precision machined bushing & mechanical seal profile */
export const MechanicalSealIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M4.5 6.75h15v3.75H17v3h2.5v3.75h-15V13.5H7v-3H4.5V6.75z" fill="currentColor" fillOpacity="0.08" />
    <path d="M9.75 10.5v3M14.25 10.5v3" />
  </svg>
);

/** DIN 2215 pulley center-distance & belt length geometry icon */
export const DinCalculatorIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="6.75" cy="9.75" r="3.5" fill="currentColor" fillOpacity="0.1" />
    <circle cx="17.25" cy="9.75" r="2.35" fill="currentColor" fillOpacity="0.1" />
    <path d="M6.75 6.25l10.5 1.15" />
    <path d="M6.75 13.25l10.5-1.15" />
    <path d="M6.75 18.5h10.5" strokeDasharray="2 1.8" />
    <path d="M6.75 16.5v3.75M17.25 16.5v3.75" />
  </svg>
);

/** Optical 4-corner reticle framing an industrial component */
export const VisualScannerIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M4 8.25V5.75A1.75 1.75 0 0 1 5.75 4h2.5" />
    <path d="M15.75 4h2.5A1.75 1.75 0 0 1 20 5.75v2.5" />
    <path d="M20 15.75v2.5A1.75 1.75 0 0 1 18.25 20h-2.5" />
    <path d="M8.25 20h-2.5A1.75 1.75 0 0 1 4 18.25v-2.5" />
    <circle cx="12" cy="12" r="3.25" fill="currentColor" fillOpacity="0.1" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** ChatGPT-inspired acoustic live voice equalizer icon */
export const LiveVoiceIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)} strokeWidth={2}>
    <path d="M5 10v4" />
    <path d="M8.5 7v10" />
    <path d="M12 4.5v15" />
    <path d="M15.5 7v10" />
    <path d="M19 10v4" />
  </svg>
);

/** Multi-layer blueprint & deep technical specification analysis icon */
export const DeepEngineeringIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <path d="M12 3.5L3.5 8 12 12.5 20.5 8 12 3.5z" fill="currentColor" fillOpacity="0.12" />
    <path d="M3.5 12.25L12 16.75l8.5-4.5" />
    <path d="M3.5 16.5L12 21l8.5-4.5" />
  </svg>
);

/** Precision catalog SKU finder lens */
export const CatalogFinderIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.07" />
    <path d="M15.4 15.4L20.25 20.25" strokeWidth="1.9" />
    <path d="M8.25 10.5h4.5M10.5 8.25v4.5" />
  </svg>
);

/** Engineering spec sheet / technical matching icon */
export const SpecSheetIcon: React.FC<IconProps> = ({ className, size = 20 }) => (
  <svg {...baseSvgProps(size, className)}>
    <rect x="4.75" y="3.5" width="14.5" height="17" rx="2.25" fill="currentColor" fillOpacity="0.06" />
    <path d="M8.25 8.25h7.5M8.25 12h7.5M8.25 15.75h4.25" />
  </svg>
);