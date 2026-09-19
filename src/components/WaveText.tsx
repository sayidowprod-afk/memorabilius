'use client'

// Texte "en attente" avec un effet de vague (chaque lettre monte/descend en
// decalé) plutôt qu'un texte statique -- demande "rendre le tout vivant" /
// "effet de vague sur le texte en attente de question" (overlay).
export default function WaveText({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-block', ...style }}>
      <style>{`
        @keyframes quizWaveChar { 0%, 100% { transform: translateY(0); opacity: 0.55; } 50% { transform: translateY(-0.2em); opacity: 1; } }
      `}</style>
      {text.split('').map((ch, i) => (
        <span key={i} style={{
          display: 'inline-block', animation: 'quizWaveChar 1.6s ease-in-out infinite',
          animationDelay: `${i * 45}ms`, whiteSpace: ch === ' ' ? 'pre' : undefined,
        }}>{ch}</span>
      ))}
    </span>
  )
}
