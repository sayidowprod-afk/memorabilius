'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

interface Entry {
  id: number
  card_number: string | null
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
}

interface CardSet {
  id: number
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
}

const SPORT_LABEL: Record<string, string> = { nba: 'NBA', nfl: 'NFL', baseball: 'Baseball', hockey: 'Hockey', pokemon: 'Pokémon' }

export default function SetPrintPage({ params }: { params: Promise<{ setId: string }> }) {
  const { t } = useLang()
  const { setId } = use(params)
  const [set, setSet] = useState<CardSet | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [owned, setOwned] = useState<Set<number>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlyMissing, setOnlyMissing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id || null))
  }, [])

  useEffect(() => { load() }, [setId, userId])

  async function load() {
    setLoading(true)
    const { data: setData } = await supabase.from('card_sets').select('*').eq('id', setId).single()
    if (!setData) { setLoading(false); return }
    setSet(setData)

    const all: Entry[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await supabase
        .from('card_set_entries')
        .select('id, card_number, player_name, team, variation, is_rc')
        .eq('set_id', setId)
        .range(from, from + PAGE - 1)
      if (!page?.length) break
      all.push(...(page as Entry[]))
      if (page.length < PAGE) break
    }
    all.sort((a, b) => {
      const va = a.variation || 'Base', vb = b.variation || 'Base'
      if (va !== vb) return va === 'Base' ? -1 : vb === 'Base' ? 1 : va.localeCompare(vb)
      const na = parseInt(a.card_number || '9999'), nb = parseInt(b.card_number || '9999')
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
      return String(a.card_number || '').localeCompare(String(b.card_number || ''))
    })
    setEntries(all)

    if (userId && all.length) {
      const ids = all.map(e => e.id)
      const ownedIds = new Set<number>()
      for (let i = 0; i < ids.length; i += 500) {
        const { data } = await supabase
          .from('user_set_completion')
          .select('entry_id')
          .eq('user_id', userId)
          .in('entry_id', ids.slice(i, i + 500))
        for (const row of (data as { entry_id: number }[] | null) || []) ownedIds.add(row.entry_id)
      }
      setOwned(ownedIds)
    } else {
      setOwned(new Set())
    }
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{t('setlistdetail_loading')}</div>
  if (!set) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{t('setlistdetail_not_found')}</div>

  const displayEntries = onlyMissing ? entries.filter(e => !owned.has(e.id)) : entries
  const ownedCount = entries.filter(e => owned.has(e.id)).length

  // Regroupe par variation pour afficher un séparateur avant chaque groupe
  const groups: { name: string; items: Entry[] }[] = []
  for (const e of displayEntries) {
    const name = e.variation || 'Base'
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.items.push(e)
    else groups.push({ name, items: [e] })
  }

  return (
    <div className="setlist-print-page">
      <style jsx global>{`
        @media print {
          nav, footer, .no-print, [class*="MobileTopBar"], [class*="MobileBottomNav"] { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          body { background: white !important; }
          .setlist-print-page { padding: 0 !important; }
        }
        @page { margin: 14mm 10mm; }
      `}</style>

      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => window.print()}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨️ {t('setlistprint_button')}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: userId ? 'pointer' : 'default', opacity: userId ? 1 : 0.5 }}>
          <input type="checkbox" checked={onlyMissing} disabled={!userId} onChange={e => setOnlyMissing(e.target.checked)} />
          {t('setlistprint_only_missing')}
        </label>
        {!userId && <span style={{ fontSize: 12, color: '#aaa' }}>{t('setlistprint_login_hint')}</span>}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 18, borderBottom: '2px solid #111', paddingBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '1px', color: '#003DA6', marginBottom: 6 }}>MEMORABILIUS.FR</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>{set.name}</h1>
        <div style={{ fontSize: 13, color: '#666' }}>
          {SPORT_LABEL[set.sport] || set.sport}{set.year ? ` · ${set.year}` : ''}{set.brand ? ` · ${set.brand}` : ''} · {set.total_cards.toLocaleString()} {t('setlistdetail_cards')}
          {userId && <> · {ownedCount} / {entries.length} {t('setlistdetail_owned')}</>}
        </div>
      </div>

      <div style={{ columns: '4 220px', columnGap: 24 }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ breakInside: 'avoid-column' }}>
            {(gi === 0 || g.name !== groups[gi - 1].name) && (
              <div style={{ fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#003DA6', margin: '10px 0 4px', breakAfter: 'avoid-column' }}>
                {g.name}
              </div>
            )}
            {g.items.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, lineHeight: 1.4, marginBottom: 3, breakInside: 'avoid-column' }}>
                <span style={{ flexShrink: 0, width: 12, height: 12, marginTop: 2, border: '1.3px solid #333', borderRadius: 2, background: owned.has(e.id) ? '#111' : 'white' }} />
                <span>
                  {e.card_number && <strong>{e.card_number} </strong>}
                  {e.player_name}
                  {e.is_rc && <span style={{ fontWeight: 800 }}> RC</span>}
                  {e.team && <span style={{ color: '#888' }}> ({e.team})</span>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {displayEntries.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>{t('setlistdetail_no_cards')}</div>
      )}
    </div>
  )
}
