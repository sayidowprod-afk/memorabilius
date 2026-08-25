export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <img
        src="/memorabilius-logo.png"
        alt=""
        width={120}
        height={24}
        style={{ height: 24, width: 'auto', background: 'none', animation: 'mbLogoPulse 1.4s ease-in-out infinite' }}
      />
      <style>{`
        @keyframes mbLogoPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.96); }
          50%      { opacity: 1;    transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          img { animation: none !important; opacity: 0.7 !important; transform: none !important; }
        }
      `}</style>
    </div>
  )
}
