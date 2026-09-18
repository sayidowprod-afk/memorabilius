import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { isBasketballTeam } from '@/lib/basketballTeamMatch'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Candidats pour le quiz "devine le joueur" (voir autograph_quiz_cards) :
// cartes AUTO, basket (équipe NBA/WNBA reconnue, matching flou -- `equipe`
// est du texte libre), une seule carte par joueur (celle avec la plus
// haute résolution dispo, image_recto_hd sinon image_recto). Filtré
// ensuite côté client contre les entrées déjà présentes dans
// autograph_quiz_cards pour ne proposer que du nouveau.
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Pagine par blocs de 1000 (limite par defaut de PostgREST) -- un simple
  // .limit(5000) plafonnait silencieusement a 5000 lignes triees par date la
  // plus recente, alors que la base en a plus (6139 au moment du signalement) :
  // les cartes auto les plus anciennes n'etaient jamais considerees comme
  // candidates, donc des joueurs dont c'etait la seule carte auto manquaient
  // completement a l'appel.
  const data: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await admin
      .from('cartes_manuelles')
      .select('id, nom, equipe, image_recto, is_horizontal, user_id, rc, patch, num, annee, marque, collection')
      .eq('auto', true)
      .not('nom', 'is', null)
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data.push(...(page || []))
    if (!page || page.length < 1000) break
  }

  // image_recto uniquement, jamais image_recto_hd -- ce dernier peut provenir
  // d'un bucket/CDN different sans en-tetes CORS, ce qui faisait echouer
  // silencieusement le chargement canvas (rotation/crop) cote outil admin.
  const byPlayer = new Map<string, typeof data[number]>()
  for (const c of data || []) {
    if (!c.nom || !isBasketballTeam(c.equipe)) continue
    const key = c.nom.trim().toLowerCase()
    if (byPlayer.has(key)) continue
    byPlayer.set(key, c)
  }

  const picked = [...byPlayer.values()]
  const ownerIds = [...new Set(picked.map(c => c.user_id).filter(Boolean))]
  const { data: profiles } = ownerIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', ownerIds)
    : { data: [] as { id: string; display_name: string | null }[] }
  const ownerNames = new Map((profiles || []).map(p => [p.id, p.display_name]))

  const candidates = picked
    .map(c => ({
      id: c.id, nom: c.nom!.trim(), equipe: c.equipe, image: c.image_recto, isHorizontal: !!c.is_horizontal,
      rc: !!c.rc, patch: !!c.patch, num: c.num, annee: c.annee, marque: c.marque, collection: c.collection,
      ownerName: ownerNames.get(c.user_id) || null,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom))
  return NextResponse.json({ candidates, total: candidates.length })
}
