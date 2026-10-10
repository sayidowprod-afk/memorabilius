'use client'

// Flamme de serie : vacille doucement, et grossit avec la serie (petite au 1er jour, pleine taille a partir de ~60 jours).
export default function StreakFlame({ streak }: { streak: number }) {
  const k = Math.max(0, Math.min(1, streak / 60))
  const h = Math.round(30 + k * 30)   // 30 -> 60 px
  return (
    <svg className="flame-ic" width={h * 0.78} height={h} viewBox="0 0 100 130" aria-hidden>
      <defs>
        <linearGradient id="sfl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff3b00" /><stop offset=".55" stopColor="#ff9a00" /><stop offset="1" stopColor="#ffe26a" /></linearGradient>
      </defs>
      <path d="M50 4 C58 28 86 40 86 78 C86 108 68 126 50 126 C32 126 14 108 14 78 C14 58 26 50 30 34 C40 44 40 56 44 60 C50 44 46 24 50 4Z" fill="url(#sfl)" />
      <path d="M50 52 C56 68 70 78 70 96 C70 112 60 122 50 122 C40 122 30 112 30 96 C30 82 42 76 44 62 C48 68 48 60 50 52Z" fill="#fff3b0" opacity=".85" />
    </svg>
  )
}
