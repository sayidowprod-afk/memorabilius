'use client'
// Petites aides de formulaire : alerte « Majuscules activées » et correction des domaines d'e-mail courants (« gmial.com »).
import { useState } from 'react'

export function useCapsLock() {
  const [capsOn, setCapsOn] = useState(false)
  const check = (e: React.KeyboardEvent<HTMLElement>) => { if (typeof e.getModifierState === 'function') setCapsOn(e.getModifierState('CapsLock')) }
  return { capsOn, capsProps: { onKeyDown: check, onKeyUp: check, onBlur: () => setCapsOn(false) } }
}

export function CapsLockHint({ on }: { on: boolean }) {
  if (!on) return null
  return <p role="status" className="da-hint warn">⇪ La touche Majuscules est activée.</p>
}

const DOMAINS = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'yahoo.fr', 'yahoo.com', 'free.fr', 'orange.fr', 'wanadoo.fr', 'laposte.net', 'icloud.com', 'live.fr', 'live.com', 'sfr.fr', 'neuf.fr', 'proton.me', 'protonmail.com', 'gmx.fr', 'bbox.fr']

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return dp[a.length][b.length]
}

// Renvoie l'adresse corrigée (ex. « toi@gmial.com » -> « toi@gmail.com ») si le domaine ressemble beaucoup à un domaine courant, sinon null.
export function suggestEmail(email: string): string | null {
  const m = email.trim().match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/)
  if (!m) return null
  const domain = m[2].toLowerCase()
  if (DOMAINS.includes(domain)) return null
  let best: string | null = null, bestD = 3
  for (const d of DOMAINS) {
    const dist = distance(domain, d)
    if (dist < bestD) { bestD = dist; best = d }
  }
  return best && bestD <= 2 ? `${m[1]}@${best}` : null
}
