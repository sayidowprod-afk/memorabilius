import type { InsertCard, OddsRow } from '@/lib/guideBlockTypes'

interface Props {
  title?: string
  cards: InsertCard[]
  oddsRows: OddsRow[]
}

// Grille de cartes inserts/case hits + tableau d'odds. Rendu 100% serveur : l'effet
// "bougent un peu" au survol est du CSS pur (même pattern que .binder-slot-card:hover
// dans src/app/globals.css:416), pas besoin de composant client pour ça.
export default function InsertGridBlock({ title, cards, oddsRows }: Props) {
  if (!cards.length && !oddsRows.length) return null

  return (
    <div style={{ margin: '32px 0' }}>
      {title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}

      {cards.length > 0 && (
        <div className="insert-grid-block" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: oddsRows.length > 0 ? 20 : 0 }}>
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

      {oddsRows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {oddsRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text2, #555)' }}>{row.label}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#003DA6' }}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
