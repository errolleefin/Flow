import React from 'react';

interface FlowLogoProps {
  className?: string;
}

export const FlowLogo: React.FC<FlowLogoProps> = ({ className = 'w-8 h-8' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="Flow Logo"
    >
      <defs>
        <linearGradient
          id="flowAuroraBg"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="55%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient
          id="flowAuroraBar"
          x1="14"
          y1="16"
          x2="50"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0E7FF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#flowAuroraBg)" />
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="15"
        stroke="white"
        strokeOpacity="0.24"
        strokeWidth="1.5"
      />
      <rect x="14" y="15" width="36" height="8.5" rx="4.25" fill="url(#flowAuroraBar)" />
      <rect
        x="14"
        y="28.5"
        width="27"
        height="8.5"
        rx="4.25"
        fill="white"
        fillOpacity="0.92"
      />
      <rect
        x="14"
        y="42"
        width="15"
        height="8.5"
        rx="4.25"
        fill="white"
        fillOpacity="0.78"
      />
      <circle cx="40" cy="46.25" r="4.25" fill="#FDE047" />
    </svg>
  );
};
