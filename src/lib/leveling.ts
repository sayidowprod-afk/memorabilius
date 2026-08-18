// Niveau global du compte — dérivé du total XP événementiel (voir
// src/lib/xp.ts et la table xp_events), jamais recalculé depuis les stats
// courantes : l'XP ne redescend donc jamais, même si l'utilisateur supprime
// des cartes ou quitte une team ensuite.
export interface LevelInfo {
  level: number
  xp: number
  xpIntoLevel: number
  xpForNextLevel: number
  pct: number
}

// Courbe xp(niveau) = 40 * niveau² — palier suivant toujours plus coûteux,
// mais reste atteignable même pour une collection de plusieurs centaines de
// cartes (555 cartes ≈ niveau 6, cohérent avec un rythme de progression sur
// plusieurs mois plutôt qu'en un après-midi).
export function levelFromXP(xp: number): LevelInfo {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1
  const floorXp = 40 * (level - 1) ** 2
  const nextXp = 40 * level ** 2
  const xpForNextLevel = nextXp - floorXp
  const xpIntoLevel = xp - floorXp
  return { level, xp, xpIntoLevel, xpForNextLevel, pct: xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 1 }
}
