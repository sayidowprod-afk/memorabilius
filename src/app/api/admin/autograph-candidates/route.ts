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

  const { data, error } = await admin
    .from('cartes_manuelles')
    .select('id, nom, equipe, image_recto, is_horizontal')
    .eq('auto', true)
    .not('nom', 'is', null)
    .not('image_recto', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // image_recto uniquement, jamais image_recto_hd -- ce dernier peut provenir
  // d'un bucket/CDN different sans en-tetes CORS, ce qui faisait echouer
  // silencieusement le chargement canvas (rotation/crop) cote outil admin.
  const byPlayer = new Map<string, { id: string; nom: string; equipe: string | null; image: string; isHorizontal: boolean }>()
  for (const c of data || []) {
    if (!c.nom || !isBasketballTeam(c.equipe)) continue
    const key = c.nom.trim().toLowerCase()
    if (byPlayer.has(key)) continue
    byPlayer.set(key, { id: c.id, nom: c.nom.trim(), equipe: c.equipe, image: c.image_recto, isHorizontal: !!c.is_horizontal })
  }

  const candidates = [...byPlayer.values()].sort((a, b) => a.nom.localeCompare(b.nom))
  return NextResponse.json({ candidates, total: candidates.length })
}
