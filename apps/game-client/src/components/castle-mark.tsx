export function CastleMark() {
  return (
    <svg className="castle-mark" viewBox="0 0 320 220" aria-hidden="true">
      <defs>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d89a" />
          <stop offset="1" stopColor="#8e6335" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8e321f" />
          <stop offset="1" stopColor="#3e1714" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="160" cy="202" rx="124" ry="14" fill="#0d0a08" opacity=".52" />
      <circle cx="160" cy="79" r="60" fill="#c78b33" opacity=".18" filter="url(#glow)" />
      <path d="M76 84h54v112H76zM190 84h54v112h-54zM120 64h80v132h-80z" fill="url(#stone)" />
      <path d="M66 86l37-48 37 48zM180 66l20-28 20 28zM180 86l37-48 37 48z" fill="url(#roof)" />
      <path d="M107 38V12h38l-12 10 12 9h-30v17" fill="#d5a940" />
      <path d="M146 54V24h30l-10 8 10 8h-22v17" fill="#bd8a31" />
      <path d="M144 196v-45c0-24 32-24 32 0v45z" fill="#291d18" />
      <g fill="#30221b">
        <path d="M91 110h22v29H91zM207 110h22v29h-22zM149 91h22v30h-22z" />
      </g>
      <g fill="#f7bd56" opacity=".85">
        <path d="M96 115h12v18H96zM212 115h12v18h-12zM154 96h12v19h-12z" />
      </g>
      <path d="M49 196h222" stroke="#d8ad5c" strokeWidth="4" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}
