import type { InsertCard, OddsTable } from '@/lib/guideBlockTypes'

interface Props {
  title?: string
  cards: InsertCard[]
  oddsTable: OddsTable
  players: string[]
}

// Grille de cartes inserts/case hits + tableau d'odds à colonnes + liste des joueurs.
// Rendu 100% serveur (l'effet de survol sur les cartes est du CSS pur). Cartes à
// gauche / tableau à droite sur une même ligne (façon référence fournie par
// l'utilisateur), joueurs en pleine largeur en dessous — évite le grand vide à côté
// d'une carte seule qu'un simple empilement vertical laissait. Volontairement
// compact : présenté dans une carte à part, pensé pour être placé à 2-3 côte à côte
// via `width` sur le bloc (voir la boucle de rendu dans guides/[slug]/page.tsx).
export default function InsertGridBlock({ title, cards, oddsTable, players }: Props) {
  const hasOdds = oddsTable.columns.length > 0 && oddsTable.rows.length > 0
  if (!cards.length && !hasOdds && !players.length) return null

  return (
    <div style={{
      border: '1px solid var(--border, #eee)', borderRadius: 14, padding: 18,
      background: 'var(--card-bg, #fff)', height: '100%', boxSizing: 'border-box',
    }}>
      {title && <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>{title}</h3>}

      {(cards.length > 0 || hasOdds) && (
        <div className="insert-top-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: players.length > 0 ? 14 : 0 }}>
          {cards.length > 0 && (
            <div className="insert-grid-block" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, flex: hasOdds ? '0 1 40%' : '1 1 auto', minWidth: 0 }}>
              {cards.map((card, i) => (
                <div key={i} className="insert-grid-card" style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #eee)', background: 'var(--bg3, #fafafa)' }}>
                  {card.image && <img src={card.image} alt={card.name} style={{ width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', display: 'block' }} />}
                  <div style={{ padding: '5px 6px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25 }}>{card.name}</div>
                    {card.printRun && <div style={{ fontSize: 10, color: 'var(--text3, #999)', marginTop: 1 }}>{card.printRun}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasOdds && (
            <table style={{ flex: '1 1 auto', minWidth: 0, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '5px 6px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', borderBottom: '2px solid var(--border, #eee)' }}></th>
                  {oddsTable.columns.map((col, ci) => (
                    <th key={ci} style={{ padding: '5px 6px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', borderBottom: '2px solid var(--border, #eee)' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oddsTable.rows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700, color: 'var(--text2, #555)' }}>{row.label}</td>
                    {oddsTable.columns.map((_, ci) => (
                      <td key={ci} style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 800, color: '#003DA6' }}>{row.values[ci] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {players.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 6px' }}>Joueurs</p>
          <div style={{ columns: '2 130px', columnGap: 14, fontSize: 12, lineHeight: 1.7, color: 'var(--text2, #555)' }}>
            {players.map((name, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>{name}</div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .insert-grid-card { transition: transform 0.15s, box-shadow 0.15s; }
        .insert-grid-card:hover { transform: translateY(-4px); box-shadow: 0 8px 16px -6px rgba(0,0,0,0.3); }
        @media (max-width: 480px) {
          .insert-top-row { flex-direction: column !important; }
          .insert-top-row > * { flex-basis: auto !important; width: 100%; }
        }
      `}</style>
    </div>
  )
}
