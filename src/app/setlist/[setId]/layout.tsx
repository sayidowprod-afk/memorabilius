import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function seasonLabel(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ setId: string }>
}): Promise<Metadata> {
  const { setId } = await params
  const { data: set } = await supabase
    .from('card_sets')
    .select('name, year, brand, sport, total_cards')
    .eq('id', setId)
    .single()

  if (!set) return { title: 'Setlist | Memorabilius' }

  const season = set.year ? seasonLabel(set.year, set.sport) : ''
  const sportUp = (set.sport || 'NBA').toUpperCase()
  const fullName = [season, set.brand, set.name].filter(Boolean).join(' ')
  const title = `${fullName} — Checklist ${sportUp} | Memorabilius`
  const desc = `Checklist complète du set ${set.name}${season ? ` (${season})` : ''} : ${set.total_cards} cartes. Cochez les cartes que vous possédez sur Memorabilius.`

  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    twitter: { card: 'summary', title, description: desc },
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
