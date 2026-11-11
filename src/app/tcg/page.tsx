import type { Metadata } from 'next'
import Link from 'next/link'
import { TCG_GAMES, TCG_CONDITIONS } from '@/lib/tcgGames'

export const revalidate = 604800

export const metadata: Metadata = {
  title: 'Guide des cartes à jouer (TCG) | Memorabilius',
  description: 'Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece : comment classer, décrire, évaluer et échanger ses cartes à jouer sur Memorabilius.',
}

const COND: Record<string, string> = {
  MT: 'Mint : état parfait, comme sortie du booster.', NM: 'Near Mint : quasi neuve, défauts à peine visibles.', EX: 'Excellent : légères marques sur les bords ou la surface.',
  GD: 'Good : usure visible mais carte propre.', LP: 'Light Played : usure nette, pliures légères.', PL: 'Played : très joueuse, marques importantes.', PO: 'Poor : abîmée, pliée ou tachée.',
}

export default function TcgGuide() {
  const h2: React.CSSProperties = { fontSize: 20, fontWeight: 900, margin: '28px 0 10px' }
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 60px', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>🎴 Guide des cartes à jouer (TCG)</h1>
      <p>Memorabilius accueille les cartes à jouer à côté des cartes de sport. Dans « Paramètres », règle « Je collectionne » sur TCG ou Les deux, puis ajoute tes cartes : chaque jeu a ses propres champs.</p>

      <h2 style={h2}>Les jeux pris en charge</h2>
      <ul>
        {TCG_GAMES.map(g => <li key={g.id}><strong>{g.emoji} {g.label}</strong> : numéro du type « {g.numberHint} », raretés : {g.rarities.slice(0, 6).join(', ')}…{g.source ? ' Recherche automatique de la carte et prix en euros.' : ''}</li>)}
      </ul>

      <h2 style={h2}>Ajouter une carte en 30 secondes</h2>
      <ol>
        <li>Choisis le type de carte (Pokémon, Magic…).</li>
        <li>Tape le nom puis « Rechercher la carte » : l’extension, le numéro, la rareté, l’année et le prix se remplissent tout seuls. Pour Yu-Gi-Oh!, Lorcana et One Piece, remplis les champs à la main ou prends la carte en photo avec le scan IA.</li>
        <li>Indique la langue, la finition (Normale, Reverse, Holo, Foil…), l’édition et l’état.</li>
      </ol>

      <h2 style={h2}>Les états (échelle Cardmarket)</h2>
      <ul>{TCG_CONDITIONS.map(c => <li key={c}><strong>{c}</strong> : {COND[c]}</li>)}</ul>

      <h2 style={h2}>Gradation</h2>
      <p>Une carte expertisée (PSA, PCA, CGC, BGS…) se déclare dans le champ « Gradation » avec sa note, par exemple « PSA 10 », et le numéro de certificat. Une carte non expertisée reste « Raw ».</p>

      <h2 style={h2}>Prix</h2>
      <p>Les prix affichés viennent de Cardmarket pour Pokémon (via TCGdex) et de Scryfall pour Magic. Ils sont indicatifs et mis à jour une fois par jour. Une version Holo ou Foil utilise le prix correspondant.</p>

      <h2 style={h2}>Mes decks</h2>
      <p>Colle la liste d’un deck sur la page <Link href="/decks" style={{ fontWeight: 800 }}>Mes decks</Link> : le site la compare avec les cartes de ta galerie et indique combien de cartes il te manque, avec la liste à copier pour la chercher ou l’échanger.</p>

      <h2 style={h2}>Progression par extension</h2>
      <p>Dans ta galerie, le filtre TCG affiche, pour chaque extension Pokémon, combien de cartes tu possèdes sur le total officiel.</p>

      <p style={{ marginTop: 28 }}><Link href="/parametres" style={{ fontWeight: 800 }}>→ Régler « Je collectionne »</Link></p>
    </main>
  )
}
