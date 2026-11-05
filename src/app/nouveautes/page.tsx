import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Nouveautés | Memorabilius',
  description: 'Les dernières nouveautés et améliorations de Memorabilius.',
  alternates: { canonical: '/nouveautes' },
}

type Entry = { date: string; titre: string; points: string[] }

// À compléter à chaque mise à jour visible par les membres (la plus récente en premier).
const ENTRIES: Entry[] = [
  {
    date: '5 novembre 2026', titre: 'Un site plus lisible et plus pratique',
    points: [
      'Menu avatar en haut à droite : « Mon profil » et « Se déconnecter ».',
      'Palette de commandes : Ctrl / ⌘ + K pour aller n’importe où ou chercher une carte.',
      'Fenêtres de confirmation aux couleurs du site pour les suppressions.',
      'Textes plus lisibles, champs plus nets, contour bleu quand on tape.',
      'Galerie : « Partager » et « Modifier » apparaissent au survol d’une carte, nouvelle vue « Mosaïque » où chaque carte garde sa forme, images qui se précisent en chargeant.',
      'Mes achats : évolution des dépenses par rapport au mois dernier.',
      'Annuaire : bascule « Confortable / Compact » pour voir plus de lignes.',
      'Recherche : tes cartes récemment consultées, gardées sur ton appareil.',
      'Messages : recherche dans une conversation, avec les mots trouvés surlignés.',
      'Ajout de carte : petits « ? » qui expliquent variation, numérotation, grade…',
      'Connexion et inscription : alerte « Majuscules activées » et correction des fautes d’e-mail (gmial.com…).',
      'Le nombre de notifications non lues s’affiche dans l’onglet du navigateur.',
    ],
  },
  {
    date: '4 novembre 2026', titre: 'Mes achats : corrections',
    points: [
      'Le total « dépensé ce mois-ci » correspond maintenant au suivi des dépenses (une commande compte une seule fois).',
      'Un achat en préparation peut être marqué comme reçu.',
      'Galerie : une image qui échoue à charger est retentée avant d’afficher « Image indisponible ».',
    ],
  },
  {
    date: '2 novembre 2026', titre: 'Mes achats & ventes',
    points: [
      'Une seule page « Mes achats » avec les onglets Achats, Ventes et Suivi gradation.',
      'Rentabilité de tes ventes, suivi de tes envois en gradation, prix conseillé à la mise en vente.',
    ],
  },
  {
    date: '1er novembre 2026', titre: 'Import de tes achats eBay et Vinted',
    points: [
      'Import automatique de tes achats, enchères et suivis eBay, prix convertis en euros.',
      'Achats Vinted par capture d’écran ou lien, suivi de colis, budget mensuel et graphique de dépenses.',
    ],
  },
]

export default function NouveautesPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 60px' }}>
      <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.75rem)', margin: '0 0 6px' }}>Nouveautés</h1>
      <p style={{ color: 'var(--text2, #666)', margin: '0 0 26px' }}>Ce qui change sur Memorabilius, de la plus récente à la plus ancienne. Une idée ? <Link href="/guides" style={{ textDecoration: 'underline' }}>Parles-en dans les guides</Link> ou signale-la via « Signaler un bug / suggestion » en bas de page.</p>
      <div style={{ display: 'grid', gap: 16 }}>
        {ENTRIES.map(e => (
          <section key={e.date} style={{ border: '2px solid var(--border, #243063)', background: 'var(--card-bg, transparent)', padding: '16px 18px' }}>
            <div style={{ font: '800 12px system-ui, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: '#5b8def' }}>{e.date}</div>
            <h2 style={{ fontSize: 24, margin: '4px 0 8px', fontFamily: "'Surfquest', Impact, sans-serif", fontWeight: 400, textTransform: 'uppercase' }}>{e.titre}</h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              {e.points.map(p => <li key={p}>{p}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
