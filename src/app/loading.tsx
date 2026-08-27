export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', perspective: 600 }}>
      <img
        src="/android-chrome-512x512.png"
        alt=""
        width={56}
        height={56}
        className="mb-loading-icon"
        style={{ width: 56, height: 56, background: 'none', animation: 'mbCardSpin 1.3s linear infinite' }}
      />
      <style>{`
        @keyframes mbCardSpin {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        html[data-theme="dark"] .mb-loading-icon { filter: invert(1); }
        @media (prefers-reduced-motion: reduce) {
          .mb-loading-icon { animation: none !important; opacity: 0.7 !important; transform: none !important; }
        }
      `}</style>
    </div>
  )
}
