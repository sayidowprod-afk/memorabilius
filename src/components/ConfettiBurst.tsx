'use client'

const PARTICLES = ['🎉', '✨', '🎊', '⭐', '💥']

// Petite pluie de confettis emoji, déclenchée brièvement à la révélation
// (voir justRevealed dans useLiveQuizPoll) -- pas de lib externe, juste des
// <span> animés en CSS, assez léger pour tourner en continu dans OBS.
export default function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2 }}>
      {Array.from({ length: 18 }).map((_, i) => {
        const left = 5 + Math.random() * 90
        const delay = Math.random() * 0.35
        const duration = 1 + Math.random() * 0.7
        const size = 16 + Math.random() * 16
        return (
          <span key={i} style={{
            position: 'absolute', left: `${left}%`, top: '35%', fontSize: size,
            animation: `quizConfettiFall ${duration}s ease-in ${delay}s both`,
          }}>{PARTICLES[i % PARTICLES.length]}</span>
        )
      })}
      <style>{`
        @keyframes quizConfettiFall {
          0% { transform: translateY(0) rotate(0deg) scale(0.4); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(180px) rotate(360deg) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
