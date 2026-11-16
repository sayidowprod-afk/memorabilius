import { cachedAsync } from '@/lib/ttlCache'
import { fetchPlayerManuelles } from '@/lib/playerManuelles'
import { fetchCsvCardsForProfilesCached } from '@/lib/csvCardsCache'
import { normalizeName } from '@/lib/playerSlug'
import { createServerClient } from '@/lib/supabaseServer'
import { demoUserIds } from '@/lib/demoUsers'

// Nombre de cartes d'un joueur par membre (cartes saisies + cartes des CSV importés, doublons d'image retirés) : sert au « Top x % des collectionneurs de ce joueur ».
// Même logique que la page joueur et /api/player-cards ; résultat gardé 10 minutes en mémoire.
const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv'])
const words = (t: string) => normalizeName(t).split(/[^a-z0-9]+/).filter(Boolean)
// Une carte « appartient » au joueur si son nom contient le nom complet, OU le nom de famille accompagné du prénom ou de son initiale
// (les CSV écrivent « Iguodala A », « Iguodala A / Gordon », « Iguodala, Andre »…).
export function matchesPlayer(cardName: string, playerName: string): boolean {
  const norm = normalizeName(cardName || '')
  if (norm.includes(normalizeName(playerName))) return true
  const pw = words(playerName).filter(w => !SUFFIX.has(w))
  if (pw.length < 2) return false
  const first = pw[0], last = pw[pw.length - 1], cw = words(cardName || '')
  if (!cw.includes(last)) return false
  return cw.some(w => w === first || w === first[0] || (w.length > 2 && first.startsWith(w)))
}

export async function playerOwnerCounts(playerName: string): Promise<Record<string, number>> {
  const sb = createServerClient()
  const normTarget = normalizeName(playerName)
  const parts = playerName.split(' ')
  return cachedAsync(`po2:${normTarget}`, (v: Record<string, number>) => (Object.keys(v).length ? 300_000 : 20_000), async () => {
    const demo = await demoUserIds(sb)
    const lastName = parts.filter(w => !SUFFIX.has(w.toLowerCase().replace(/\./g, ''))).pop() || parts[parts.length - 1]
    const all = await fetchPlayerManuelles(sb, 'id, nom, image_recto, user_id', lastName, lastName)
    const seen = new Set<string>(), counts: Record<string, number> = {}
    const add = (img: string, uid: string) => { if (!img || !uid || seen.has(img)) return; seen.add(img); counts[uid] = (counts[uid] || 0) + 1 }
    for (const m of all) if (!demo.has(m.user_id) && matchesPlayer(m.nom || '', playerName)) add(m.image_recto, m.user_id)
    const profiles: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('profiles').select('id, display_name, avatar_url, lien_csv, couleur_bordure').not('lien_csv', 'is', null).range(from, from + 999)
      if (error || !data || data.length === 0) break
      profiles.push(...data)
      if (data.length < 1000) break
    }
    const csv = await fetchCsvCardsForProfilesCached(profiles.filter((p: any) => !demo.has(p.id)))
    for (const c of csv) if (matchesPlayer(c.name, playerName)) add(c.img, c.user_id)
    return counts
  })
}

// Rang d'un membre pour ce joueur : { pct: « top x % », rank, total, cards } ou null s'il n'a aucune carte du joueur.
export function rankIn(counts: Record<string, number>, userId: string) {
  const mine = counts[userId]; if (!mine) return null
  const all = Object.values(counts), better = all.filter(n => n > mine).length
  const pct = Math.max(1, Math.ceil(((better + 1) / all.length) * 100))
  return { pct, rank: better + 1, total: all.length, cards: mine, label: better < 3 ? ['1er', '2ème', '3ème'][better] : `Top ${pct} %` }
}
