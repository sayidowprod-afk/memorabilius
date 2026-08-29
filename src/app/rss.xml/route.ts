import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BASE = 'https://www.memorabilius.fr'

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET() {
  const { data: guides } = await supabase
    .from('guides')
    .select('slug, title, excerpt, published_at')
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(50)

  const items = (guides || []).map(g => `
    <item>
      <title>${escapeXml(g.title)}</title>
      <link>${BASE}/guides/${g.slug}</link>
      <guid isPermaLink="true">${BASE}/guides/${g.slug}</guid>
      <pubDate>${new Date(g.published_at).toUTCString()}</pubDate>
      ${g.excerpt ? `<description>${escapeXml(g.excerpt)}</description>` : ''}
    </item>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Memorabilius — Guides</title>
    <link>${BASE}/guides</link>
    <description>Derniers guides et checklists de cartes de sport publiés sur Memorabilius</description>
    <language>fr</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
