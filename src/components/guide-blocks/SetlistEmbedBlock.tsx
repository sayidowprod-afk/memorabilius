'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { sportEmoji } from '@/lib/sportEmoji'

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
  sport: string | null
  entries: Entry[]
}

type TabKey = 'base' | 'variations' | 'autographs' | 'memorabilia' | 'inserts' | 'full' | 'teams'

// Checklist "façon Beckett" (voir capture de référence fournie) : onglets Base /
// Variations / Autographs / Memorabilia / Inserts / Full Checklist / Team Sets,
// au lieu d'une simple liste groupée par variation. La base de données ne distingue
// pas explicitement auto/memorabilia/insert (pas de colonne dédiée, seulement un
// champ texte `variation` libre issu du scraping TCDB) — la catégorie de chaque
// carte est donc devinée par mots-clés dans `variation`/`card_number`, comme pour les
// couleurs de la pyramide (voir fallbackColorFor dans PyramidBlock.tsx).
function classify(e: Entry): Exclude<TabKey, 'full' | 'teams'> {
  const v = (e.variation || '').toLowerCase()
  if (/auto/.test(v)) return 'autographs'
  if (/relic|patch|jersey|swatch|memorabilia/.test(v)) return 'memorabilia'
  if (/^[a-z]{1,6}-/i.test(e.card_number || '')) return 'inserts'
  if (v && v !== 'base') return 'variations'
  return 'base'
}

const TAB_LABELS: Record<TabKey, string> = {
  base: 'Base', variations: 'Variations', autographs: 'Autographs',
  memorabilia: 'Memorabilia', inserts: 'Inserts', full: 'Full Checklist', teams: 'Team Sets',
}

export default function SetlistEmbedBlock({ title, setId, setName, totalCards, sport, entries }: Props) {
  const emoji = sportEmoji(sport)
  const [tab, setTab] = useState<TabKey>('full')

  const { tabEntries, availableTabs, teamGroups } = useMemo(() => {
    const byTab: Record<Exclude<TabKey, 'full' | 'teams'>, Entry[]> = {
      base: [], variations: [], autographs: [], memorabilia: [], inserts: [],
    }
    for (const e of entries) byTab[classify(e)].push(e)

    const available: TabKey[] = ['full']
    ;(['base', 'variations', 'autographs', 'memorabilia', 'inserts'] as const).forEach(k => {
      if (byTab[k].length) available.push(k)
    })
    const teams = new Map<string, Entry[]>()
    for (const e of entries) {
      const key = e.team || 'Autres'
      if (!teams.has(key)) teams.set(key, [])
      teams.get(key)!.push(e)
    }
    if (teams.size > 1) available.push('teams')

    return { tabEntries: byTab, availableTabs: available, teamGroups: teams }
  }, [entries])

  if (!entries.length) return null

  const groupByVariation = (list: Entry[]) => {
    const groups: { name: string; items: Entry[] }[] = []
    for (const e of list) {
      const name = e.variation || 'Base'
      const last = groups[groups.length - 1]
      if (last && last.name === name) last.items.push(e)
      else groups.push({ name, items: [e] })
    }
    return groups
  }

  const renderList = (list: Entry[]) => (
    <div style={{ border: '1px solid var(--border, #eee)', borderRadius: 10, overflow: 'hidden' }}>
      {groupByVariation(list).map((g, gi) => (
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
  )

  const currentList = tab === 'full' || tab === 'teams' ? entries : tabEntries[tab]

  return (
    <div style={{ margin: '32px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
          {emoji && <span style={{ marginRight: 8 }}>{emoji}</span>}
          {title || setName}
        </h3>
        <Link href={`/setlist/${setId}`} style={{ fontSize: 12, fontWeight: 700, color: '#003DA6', textDecoration: 'none' }}>
          Voir la checklist complète ({totalCards} cartes) →
        </Link>
      </div>

      {availableTabs.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {availableTabs.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: `1px solid ${tab === k ? '#003DA6' : 'var(--border, #ddd)'}`,
                background: tab === k ? '#003DA6' : 'var(--card-bg, #fff)', color: tab === k ? 'white' : 'var(--text2, #555)',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              }}
            >
              {TAB_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {tab === 'teams' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...teamGroups.entries()].map(([teamName, items]) => (
            <div key={teamName} style={{ border: '1px solid var(--border, #eee)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'var(--bg3, #f7f8fa)', fontSize: 12, fontWeight: 800, color: 'var(--text, #222)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {teamName} <span style={{ color: 'var(--text3, #999)', fontWeight: 700 }}>({items.length})</span>
              </div>
              {items.map((e, ei) => (
                <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', fontSize: 13, borderTop: '1px solid var(--border, #f0f0f0)' }}>
                  {e.card_number && <strong style={{ minWidth: 40, color: 'var(--text3, #999)' }}>{e.card_number}</strong>}
                  <span style={{ flex: 1 }}>
                    {e.player_name}
                    {e.is_rc && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px' }}>RC</span>}
                  </span>
                  {e.variation && <span style={{ color: 'var(--text3, #999)', fontSize: 12 }}>{e.variation}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : renderList(currentList)}
    </div>
  )
}
