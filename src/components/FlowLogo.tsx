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
        {/* Background rounded container gradient */}
        <linearGradient
          id="flowBgGrad"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Primary flow wave: Sapphire to Cyan */}
        <linearGradient
          id="flowWaveGrad1"
          x1="12"
          y1="16"
          x2="52"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="60%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>

        {/* Secondary wave: Cyan to Emerald glow */}
        <linearGradient
          id="flowWaveGrad2"
          x1="12"
          y1="34"
          x2="48"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>

        {/* Top bar highlight */}
        <linearGradient
          id="flowPillGrad"
          x1="14"
          y1="16"
          x2="50"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>

      {/* Rounded tile with subtle border */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#flowBgGrad)" />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="15.25"
        stroke="white"
        strokeOpacity="0.14"
        strokeWidth="1.5"
      />

      {/* Dynamic continuous Kanban/Stream Flow Bars */}
      {/* Top Bar - Full width agile stream */}
      <rect
        x="14"
        y="15"
        width="36"
        height="8"
        rx="4"
        fill="url(#flowWaveGrad1)"
      />
      {/* Middle Bar - In-progress flow */}
      <rect
        x="14"
        y="28"
        width="27"
        height="8"
        rx="4"
        fill="url(#flowWaveGrad2)"
      />
      {/* Bottom Bar - Velocity indicator */}
      <rect
        x="14"
        y="41"
        width="16"
        height="8"
        rx="4"
        fill="#38BDF8"
        fillOpacity="0.9"
      />

      {/* Pulse / Focus Spark Dot */}
      <circle cx="42" cy="45" r="4.5" fill="#38BDF8" />
      <circle cx="42" cy="45" r="2.5" fill="#FFFFFF" />
    </svg>
  );
};
