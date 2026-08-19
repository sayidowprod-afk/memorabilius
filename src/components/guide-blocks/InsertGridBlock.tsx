import type { InsertCard, OddsTable } from '@/lib/guideBlockTypes'

interface Props {
  title?: string
  cards: InsertCard[]
  oddsTable: OddsTable
  players: string[]
}

// Grille de cartes inserts/case hits + vrai tableau d'odds à colonnes (ex: Holo x
// Platinum) x lignes (ex: Hobby, Jumbo, Value...) + liste des joueurs présents dans
// l'insert. Rendu 100% serveur : l'effet "bougent un peu" au survol est du CSS pur
// (même pattern que .binder-slot-card:hover dans src/app/globals.css:416), pas
// besoin de composant client pour ça.
export default function InsertGridBlock({ title, cards, oddsTable, players }: Props) {
  const hasOdds = oddsTable.columns.length > 0 && oddsTable.rows.length > 0
  if (!cards.length && !hasOdds && !players.length) return null

  return (
    <div style={{ margin: '32px 0' }}>
      {title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}

      {cards.length > 0 && (
        <div className="insert-grid-block" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          {cards.map((card, i) => (
            <div key={i} className="insert-grid-card" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border, #eee)', background: 'var(--card-bg, #fff)' }}>
              {card.image && <img src={card.image} alt={card.name} style={{ width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', display: 'block' }} />}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{card.name}</div>
                {card.printRun && <div style={{ fontSize: 11, color: 'var(--text3, #999)', marginTop: 2 }}>{card.printRun}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasOdds && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: players.length > 0 ? 20 : 0 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', borderBottom: '2px solid var(--border, #eee)' }}></th>
              {oddsTable.columns.map((col, ci) => (
                <th key={ci} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', borderBottom: '2px solid var(--border, #eee)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {oddsTable.rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text2, #555)' }}>{row.label}</td>
                {oddsTable.columns.map((_, ci) => (
                  <td key={ci} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#003DA6' }}>{row.values[ci] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {players.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>Joueurs</p>
          <div style={{ columns: '2 180px', columnGap: 20 }}>
            {players.map((name, i) => (
              <div key={i} style={{ fontSize: 14, padding: '4px 0', breakInside: 'avoid' }}>{name}</div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .insert-grid-card { transition: transform 0.15s, box-shadow 0.15s; }
        .insert-grid-card:hover { transform: translateY(-6px); box-shadow: 0 10px 20px -8px rgba(0,0,0,0.3); }
        @media (max-width: 560px) {
          .insert-grid-block { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
