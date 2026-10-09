import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// CARTE DU JOUR : une carte de la communaute, la meme pour tout le monde toute la journee (fuseau de Paris), qui change a minuit.
// Choix : parmi les cartes recentes (60 derniers jours) qui ont une vraie photo et au moins un atout (RC, AUTO, PATCH ou numerotee),
// jamais une carte privee (table cartes_privees), jamais le compte de demonstration. La carte du jour est tiree de facon
// deterministe avec la date comme graine : pas de stockage, pas de tache planifiee, et tout le monde voit la meme.
// Reponse mise en cache 1 h au niveau du CDN.
export const revalidate = 3600

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export async function GET() {
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date()) // AAAA-MM-JJ
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const { data: recent } = await supabase
    .from('cartes_manuelles')
    .select('id, user_id, nom, annee, marque, collection, variation, num, rc, auto, patch, image_recto, is_horizontal, created_at')
    .not('image_recto', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(800)

  let cands = (recent || []).filter((c: any) =>
    /^https?:\/\//.test(c.image_recto || '') && !c.is_horizontal && c.nom && (c.rc || c.auto || c.patch || c.num))
  if (!cands.length) return NextResponse.json({ card: null })

  const userIds = [...new Set(cands.map((c: any) => c.user_id))]
  const [{ data: profiles }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, slug, is_demo').in('id', userIds),
    supabase.from('cartes_privees').select('user_id, card_key').in('user_id', userIds),
  ])
  const demo = new Set((profiles || []).filter((p: any) => p.is_demo).map((p: any) => p.id))
  const hidden = new Set((priv || []).map((p: any) => `${p.user_id}|${p.card_key}`))
  cands = cands.filter((c: any) => !demo.has(c.user_id) && !hidden.has(`${c.user_id}|${c.image_recto}`))
  if (!cands.length) return NextResponse.json({ card: null })

  // ordre stable (par identifiant) puis tirage deterministe sur la date
  cands.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
  const pick: any = cands[hash(day) % cands.length]
  const prof: any = (profiles || []).find((p: any) => p.id === pick.user_id)
  const [y, m, d] = day.split('-').map(Number)
  return NextResponse.json(
    {
      day: { y, m, d },
      card: {
        image: pick.image_recto, nom: pick.nom, annee: pick.annee, marque: pick.marque, collection: pick.collection, variation: pick.variation,
        num: pick.num, rc: !!pick.rc, auto: !!pick.auto, patch: !!pick.patch,
        owner: { id: pick.user_id, slug: prof?.slug || null, name: prof?.display_name || null },
      },
    },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
