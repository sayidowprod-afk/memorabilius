import { NextResponse } from 'next/server'
import { bobbleFor } from '@/lib/bobbleheadsServer'
import { playerOwnerCounts, rankIn } from '@/lib/playerOwners'

// Figurines bobblehead prêtes (validées) pour une liste de noms de joueurs : GET /api/bobble-figs?names=Joel Embiid|Tyrese Maxey&userId=<membre>
// Sert à l'en-tête des galeries (joueurs des PCs). Les joueurs sans figurine validée sont simplement absents de la réponse.
// Avec `userId`, chaque figurine porte aussi `pct` : « top x % » des collectionneurs de ce joueur pour ce membre (absent s'il n'a aucune carte du joueur).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const raw = sp.get('names') || '', userId = sp.get('userId') || ''
  const names = Array.from(new Set(raw.split('|').map(s => s.trim()).filter(Boolean))).slice(0, 8)
  // un joueur après l'autre : calculer les 4 en parallèle surchargeait la base pour les joueurs très collectionnés (le calcul échouait, donc pas de %)
  const figs: { name: string; fig: NonNullable<ReturnType<typeof bobbleFor>>; pct?: number; label?: string }[] = []
  for (const name of names) {
    const fig = bobbleFor(name); if (!fig) continue
    let pct: number | undefined, label: string | undefined
    if (/^[0-9a-f-]{36}$/i.test(userId)) { try { const rk = rankIn(await playerOwnerCounts(name), userId); pct = rk?.pct; label = rk?.label } catch (e) { console.log('[bobble-figs] % impossible pour', name, String(e)) } }
    figs.push({ name, fig, ...(pct ? { pct, label } : {}) })
  }
  return NextResponse.json({ figs },{ headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
}
