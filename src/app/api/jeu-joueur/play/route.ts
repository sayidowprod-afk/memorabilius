import { NextResponse } from 'next/server'
import { bobbleFor } from '@/lib/bobbleheadsServer'
import { compare, dayNumber, MAX_TRIES, parisDay, type Dataset } from '@/lib/jeuJoueur'
import raw from '@/data/jeu-joueur.json'

// Joueur mystère, côté serveur : le joueur du jour (le même pour tout le monde, jamais deux fois avant d'avoir fait le tour de la liste)
// n'est jamais envoyé avant la fin de la partie. POST { seed, ids } → les cases comparées pour chaque joueur proposé ;
// le joueur mystère n'est révélé que si la partie est gagnée ou si les 8 essais sont utilisés.
//  - seed = « AAAA-MM-JJ » (joueur du jour, pas de date future) ou « libre-xxxx » (partie libre d'entraînement)
const data = raw as unknown as Dataset
const byId = new Map(data.players.map(p => [p.id, p]))

export async function POST(req: Request) {
  let body: { seed?: unknown; ids?: unknown } = {}
  try { body = await req.json() } catch { /* corps vide */ }
  const seed = typeof body.seed === 'string' ? body.seed : ''
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids.filter((x): x is string => typeof x === 'string'))).slice(0, MAX_TRIES) : []

  let answerId: string | undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(seed)) {
    const n = dayNumber(seed)
    // seul le jour courant (heure de Paris, horloge du serveur) est jouable : le client ne décide jamais de la date
    if (n < 1 || seed !== parisDay()) return NextResponse.json({ error: 'Jour invalide', today: parisDay() }, { status: 400 })
    answerId = data.order[(n - 1) % data.order.length]
  } else return NextResponse.json({ error: 'Partie invalide' }, { status: 400 })   // plus de partie libre : un seul joueur par jour, à minuit (Paris)
  const answer = byId.get(answerId!)
  if (!answer) return NextResponse.json({ error: 'Données indisponibles' }, { status: 500 })

  const now = new Date()
  const rows: { id: string; cells: ReturnType<typeof compare> }[] = []
  let won = false
  for (const id of ids) {
    const g = byId.get(id); if (!g) continue
    rows.push({ id, cells: compare(g, answer, now) })
    if (id === answer.id) { won = true; break }
  }
  const over = won || rows.length >= MAX_TRIES
  let reveal: unknown = null
  if (over) {
    const f = bobbleFor(answer.name)
    reveal = { ...answer, head: f && !f.sport && f.headSrc ? f.headSrc : null }
  }
  return NextResponse.json({ rows, over, won, answer: reveal }, { headers: { 'Cache-Control': 'no-store' } })
}
