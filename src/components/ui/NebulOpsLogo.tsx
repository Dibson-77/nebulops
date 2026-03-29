/**
 * NebulOpsLogo — Custom SVG logo
 * Cloud + hexagonal node network = Nebula + Ops
 */

interface NebulOpsLogoProps {
  size?: number;
  className?: string;
}

export function NebulOpsLogo({ size = 40, className }: NebulOpsLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="nebul-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5B8DEF" />
          <stop offset="50%" stopColor="#7C5CFC" />
          <stop offset="100%" stopColor="#5B8DEF" />
        </linearGradient>
        <linearGradient id="nebul-inner" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#5B8DEF" />
        </linearGradient>
        <filter id="nebul-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#nebul-grad)" />

      {/* Cloud shape — the "Nebul" */}
      <path
        d="M14 30c-2.5 0-4.5-1.8-4.5-4s2-4 4.5-4c0.2-3.3 3-6 6.5-6 2.8 0 5.2 1.7 6.1 4.1C27.4 19.4 28.4 19 29.5 19c2.5 0 4.5 2 4.5 4.5 0 .3 0 .6-.1.9C35.6 25 37 26.8 37 29c0 2.5-2 4.5-4.5 4.5"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#nebul-glow)"
      />

      {/* Hexagonal nodes — the "Ops" / infrastructure */}
      {/* Center node */}
      <circle cx="24" cy="26" r="2.5" fill="white" />
      {/* Left node */}
      <circle cx="16" cy="30" r="1.8" fill="rgba(255,255,255,0.8)" />
      {/* Right node */}
      <circle cx="32" cy="30" r="1.8" fill="rgba(255,255,255,0.8)" />

      {/* Connection lines between nodes */}
      <line x1="24" y1="26" x2="16" y2="30" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      <line x1="24" y1="26" x2="32" y2="30" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      <line x1="16" y1="30" x2="32" y2="30" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" strokeDasharray="2 2" strokeLinecap="round" />

      {/* Top accent node */}
      <circle cx="24" cy="19" r="1.3" fill="rgba(255,255,255,0.6)" />
      <line x1="24" y1="19" x2="24" y2="23.5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
