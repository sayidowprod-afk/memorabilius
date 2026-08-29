import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import SetlistClient from './SetlistClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SPORT_LABELS: Record<string, string> = {
  nba: 'NBA', nfl: 'NFL', baseball: 'Baseball', hockey: 'Hockey', pokemon: 'Pokémon', mtg: 'MTG',
}

export async function generateMetadata({ params }: { params: Promise<{ setId: string }> }): Promise<Metadata> {
  const { setId } = await params
  const { data: set } = await supabase
    .from('card_sets')
    .select('name, year, brand, sport, total_cards')
    .eq('id', setId)
    .single()

  if (!set) return { title: 'Set introuvable | Memorabilius' }

  const sportLabel = SPORT_LABELS[set.sport] || set.sport
  const title = `${set.name}${set.year ? ` ${set.year}` : ''} — Checklist ${sportLabel} | Memorabilius`
  const desc = `Suivez votre progression sur le set ${set.name}${set.brand ? ` (${set.brand})` : ''} : ${set.total_cards.toLocaleString()} cartes, cochez ce que vous possédez et repérez ce qu'il vous manque.`

  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    twitter: { card: 'summary', title, description: desc },
  }
}

export default async function SetDetailPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  return <SetlistClient setId={setId} />
}
