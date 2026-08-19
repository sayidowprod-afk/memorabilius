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
// l'utilisateur), joueurs en pleine largeur en dessous. Cartes en flexbox à taille
// FIXE (pas une grille avec des colonnes vides qui creusaient un trou visuel quand il
// n'y a qu'1-2 cartes) ; le tableau n'est jamais flex-grow (sinon le navigateur étire
// les colonnes et écarte les cellules) — il est dans son propre encart bordé, taille
// naturelle, avec un fond alterné pour rester lisible sans le grand vide d'origine.
export default function InsertGridBlock({ title, cards, oddsTable, players }: Props) {
  const hasOdds = oddsTable.columns.length > 0 && oddsTable.rows.length > 0
  if (!cards.length && !hasOdds && !players.length) return null

  return (
    <div style={{
      border: '1px solid var(--border, #eee)', borderRadius: 14, padding: 18,
      background: 'var(--card-bg, #fff)', height: '100%', boxSizing: 'border-box',
    }}>
      {title && <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}

      {(cards.length > 0 || hasOdds) && (
        <div className="insert-top-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', marginBottom: players.length > 0 ? 16 : 0 }}>
          {cards.length > 0 && (
            <div className="insert-grid-block" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {cards.map((card, i) => (
                <div key={i} className="insert-grid-card" style={{ flex: '0 0 150px', width: 150, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border, #eee)', background: 'var(--bg3, #fafafa)', position: 'relative' }}>
                  {card.image && (
                    <div className="insert-grid-card-img" style={{ overflow: 'hidden' }}>
                      <img src={card.image} alt={card.name} style={{ width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', display: 'block' }} />
                      <div className="insert-grid-card-shine" />
                    </div>
                  )}
                  <div style={{ padding: '8px 9px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: 'var(--text, #222)' }}>{card.name}</div>
                    {card.printRun && <div style={{ fontSize: 11, color: 'var(--text3, #999)', marginTop: 2, fontWeight: 600 }}>{card.printRun}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasOdds && (
            <div style={{ border: '1px solid var(--border, #eee)', borderRadius: 10, overflow: 'hidden', flex: '0 1 auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg3, #f5f5f5)' }}>
                    <th style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', letterSpacing: 0.3 }}></th>
                    {oddsTable.columns.map((col, ci) => (
                      <th key={ci} style={{ padding: '9px 16px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {oddsTable.rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--bg3, #fafafa)' : 'transparent', borderTop: '1px solid var(--border, #eee)' }}>
                      <td style={{ padding: '8px 16px', fontWeight: 700, color: 'var(--text2, #555)', whiteSpace: 'nowrap' }}>{row.label}</td>
                      {oddsTable.columns.map((_, ci) => (
                        <td key={ci} style={{ padding: '8px 16px', textAlign: 'center', fontWeight: 800, color: '#003DA6', whiteSpace: 'nowrap' }}>{row.values[ci] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        .insert-grid-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
        .insert-grid-card:hover { transform: translateY(-5px) scale(1.03); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.4); border-color: #003DA6 !important; }
        .insert-grid-card-img { position: relative; }
        .insert-grid-card-img img { transition: transform 0.35s ease; }
        .insert-grid-card:hover .insert-grid-card-img img { transform: scale(1.08); }
        .insert-grid-card-shine {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%);
          transform: translateX(-120%); transition: transform 0.6s ease;
        }
        .insert-grid-card:hover .insert-grid-card-shine { transform: translateX(120%); }
        @media (max-width: 480px) {
          .insert-top-row { flex-direction: column !important; }
          .insert-top-row > * { flex-basis: auto !important; width: 100%; }
          .insert-grid-block { justify-content: center; }
        }
      `}</style>
    </div>
  )
}
