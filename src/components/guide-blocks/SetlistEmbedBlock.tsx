import Link from 'next/link'

interface Entry {
  card_number: string | null
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
}

interface Props {
  title?: string
  setId: number
  setName: string
  totalCards: number
  entries: Entry[]
}

// Checklist compacte "façon Beckett" d'une setlist déjà existante du site, groupée
// par variation — présentation pure, pas d'interactivité (les guides sont publics,
// pas liés à la collection d'un visiteur, contrairement à /setlist/[setId]).
export default function SetlistEmbedBlock({ title, setId, setName, totalCards, entries }: Props) {
  if (!entries.length) return null

  const groups: { name: string; items: Entry[] }[] = []
  for (const e of entries) {
    const name = e.variation || 'Base'
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.items.push(e)
    else groups.push({ name, items: [e] })
  }

  return (
    <div style={{ margin: '32px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{title || setName}</h3>
        <Link href={`/setlist/${setId}`} style={{ fontSize: 12, fontWeight: 700, color: '#003DA6', textDecoration: 'none' }}>
          Voir la checklist complète ({totalCards} cartes) →
        </Link>
      </div>
      <div style={{ border: '1px solid var(--border, #eee)', borderRadius: 10, overflow: 'hidden' }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div style={{ padding: '8px 14px', background: 'var(--bg3, #f7f8fa)', fontSize: 12, fontWeight: 800, color: '#003DA6', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {g.name} <span style={{ color: 'var(--text3, #999)', fontWeight: 700 }}>({g.items.length})</span>
            </div>
            {g.items.map((e, ei) => (
              <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', fontSize: 13, borderTop: '1px solid var(--border, #f0f0f0)' }}>
                {e.card_number && <strong style={{ minWidth: 40, color: 'var(--text3, #999)' }}>{e.card_number}</strong>}
                <span style={{ flex: 1 }}>
                  {e.player_name}
                  {e.is_rc && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px' }}>RC</span>}
                </span>
                {e.team && <span style={{ color: 'var(--text3, #999)', fontSize: 12 }}>{e.team}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
