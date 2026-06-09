import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase().trim()
  if (!query || query.length < 2) return NextResponse.json([])

  // Récupérer tous les profils avec CSV
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
    .not('lien_csv', 'is', null)
    .neq('lien_csv', '')

  if (!profiles) return NextResponse.json([])

  const results: any[] = []

  await Promise.all(profiles.map(async (p) => {
    try {
      const r = await fetch(p.lien_csv, { next: { revalidate: 3600 } })
      if (!r.ok) return
      const text = await r.text()
      const rows = text.split(/\r?\n/).slice(4)

      rows.forEach(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0]?.includes('http')) return
        const name = (c[2] || '').toLowerCase()
        const team = (c[3] || '').toLowerCase()
        const variant = (c[7] || '').toLowerCase()
        const brand = (c[5] || '').toLowerCase()

        if (name.includes(query) || team.includes(query) || variant.includes(query) || brand.includes(query)) {
          results.push({
            img: c[0]?.trim(),
            name: c[2] || '',
            team: c[3] || '',
            year: c[4] || '',
            brand: c[5] || '',
            serie: c[6] || '',
            variant: c[7] || '',
            num: c[8] || '',
            auto: c[9]?.toLowerCase().includes('oui') || false,
            rc: c[10]?.toLowerCase().includes('oui') || false,
            patch: c[11]?.toLowerCase().includes('oui') || false,
            collector: p.display_name,
            collectorId: p.id,
            collectorAvatar: p.avatar_url,
            accent: p.couleur_bordure || '#003DA6',
          })
        }
      })
    } catch { }
  }))

  // Trier par pertinence (nom exact en premier)
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(query) ? 0 : 1
    const bExact = b.name.toLowerCase().startsWith(query) ? 0 : 1
    return aExact - bExact
  })

  return NextResponse.json(results.slice(0, 60))
}
