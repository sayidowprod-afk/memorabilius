'use client'

// Keyframes partagés entre les deux variantes de l'overlay (compact et
// grand format) pour rendre le flux vivant : pulse du minuteur, rebond du
// compteur de votes, entrée en rebond des lignes du fil "plus rapides",
// pop-in des barres de choix à la révélation.
export default function QuizAnimStyles() {
  return (
    <style>{`
      @keyframes quizAnimPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      .quiz-anim-pulse { animation: quizAnimPulse 0.8s ease-in-out infinite; }
      @keyframes quizAnimBump { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }
      .quiz-anim-bump { animation: quizAnimBump 0.42s cubic-bezier(.3,1.6,.4,1); }
      @keyframes quizAnimRowIn { from { opacity: 0; transform: translateX(14px) scale(0.9); } to { opacity: 1; transform: translateX(0) scale(1); } }
      .quiz-anim-row-in { animation: quizAnimRowIn 0.4s cubic-bezier(.2,1.4,.4,1) both; }
      @keyframes quizAnimPop { from { opacity: 0; transform: scale(0.85) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .quiz-anim-pop { animation: quizAnimPop 0.35s cubic-bezier(.2,1.4,.4,1) both; }
    `}</style>
  )
}
