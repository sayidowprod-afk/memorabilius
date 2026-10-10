import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// CARTE DU JOUR : une carte de la communaute, la meme pour tout le monde toute la journee (fuseau de Paris), qui change a minuit.
// Choix : parmi les cartes recentes (60 derniers jours) qui ont une vraie photo et au moins un atout (RC, AUTO, PATCH ou numerotee),
// jamais une carte privee (table cartes_privees), jamais le compte de demonstration. La carte du jour est tiree de facon
// deterministe avec la date comme graine : pas de stockage, pas de tache planifiee, et tout le monde voit la meme.
// Reponse mise en cache au CDN au plus 1 h, et jamais au-dela de minuit (Paris).
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export async function GET() {
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date()) // AAAA-MM-JJ
  // minuit (Europe/Paris) du jour courant, en UTC
  const parisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const offsetMs = parisNow.getTime() - new Date().getTime() + new Date().getMilliseconds() * 0
  const startParis = new Date(Date.now() + offsetMs); startParis.setHours(0, 0, 0, 0)
  const startOfDayParis = new Date(startParis.getTime() - offsetMs).toISOString()
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const { data: recent } = await supabase
    .from('cartes_manuelles')
    .select('id, user_id, nom, annee, marque, collection, variation, num, rc, auto, patch, image_recto, is_horizontal, created_at')
    .not('image_recto', 'is', null)
    .gte('created_at', since)
    .lt('created_at', startOfDayParis)   // jamais les cartes ajoutees AUJOURD'HUI : le lot de candidats ne bouge plus de la journee
    .order('created_at', { ascending: false })
    .limit(1500)

  let cands = (recent || []).filter((c: any) =>
    /^https?:\/\//.test(c.image_recto || '') && !c.is_horizontal && c.nom && (c.rc || c.auto || c.patch || c.num))
  if (!cands.length) return NextResponse.json({ card: null })

  const userIds = [...new Set(cands.map((c: any) => c.user_id))]
  const [{ data: profiles }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, slug, is_demo, avatar_url, stats_total').in('id', userIds),
    supabase.from('cartes_privees').select('user_id, card_key').in('user_id', userIds),
  ])
  const demo = new Set((profiles || []).filter((p: any) => p.is_demo).map((p: any) => p.id))
  const hidden = new Set((priv || []).map((p: any) => `${p.user_id}|${p.card_key}`))
  cands = cands.filter((c: any) => !demo.has(c.user_id) && !hidden.has(`${c.user_id}|${c.image_recto}`))
  if (!cands.length) return NextResponse.json({ card: null })

  // tirage "au plus grand score" (hash date + id) : ajouter/retirer d'autres cartes ne change PAS la carte du jour, seule la
  // suppression de la carte elle-meme la change (avant : index modulo la taille du lot, qui changeait quand le lot bougeait)
  let pick: any = cands[0], top = -1
  for (const c of cands as any[]) { const sc = hash(`${day}|${c.id}`); if (sc > top) { top = sc; pick = c } }
  const prof: any = (profiles || []).find((p: any) => p.id === pick.user_id)
  const [y, m, d] = day.split('-').map(Number)
  // le cache CDN ne depasse jamais minuit (Paris) ; le client ajoute ?d=AAAA-MM-JJ, donc une nouvelle journee = une nouvelle entree de cache
  const secondsToMidnight = Math.max(60, Math.min(3600, Math.round((86400000 - (parisNow.getHours() * 3600000 + parisNow.getMinutes() * 60000 + parisNow.getSeconds() * 1000)) / 1000)))
  return NextResponse.json(
    {
      day: { y, m, d },
      card: {
        image: pick.image_recto, nom: pick.nom, annee: pick.annee, marque: pick.marque, collection: pick.collection, variation: pick.variation,
        num: pick.num, rc: !!pick.rc, auto: !!pick.auto, patch: !!pick.patch,
        owner: { id: pick.user_id, slug: prof?.slug || null, name: prof?.display_name || null, avatar: prof?.avatar_url || null, total: prof?.stats_total || 0 },
      },
    },
    { headers: { 'Cache-Control': `public, s-maxage=${secondsToMidnight}` } },
  )
}
