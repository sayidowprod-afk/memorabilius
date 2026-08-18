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
  const [filterMode, setFilterMode] = useState<'all' | 'owned' | 'missing'>('all')
  const [selectedVariations, setSelectedVariations] = useState<Set<string> | null>(null)

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
    setSelectedVariations(new Set(all.map(e => e.variation || 'Base')))

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

  const allVariationNames = Array.from(new Set(entries.map(e => e.variation || 'Base'))).sort((a, b) => a === 'Base' ? -1 : b === 'Base' ? 1 : a.localeCompare(b))
  const activeVariations = selectedVariations || new Set(allVariationNames)

  const displayEntries = entries.filter(e => {
    if (!activeVariations.has(e.variation || 'Base')) return false
    if (filterMode === 'owned' && !owned.has(e.id)) return false
    if (filterMode === 'missing' && owned.has(e.id)) return false
    return true
  })
  const ownedCount = entries.filter(e => owned.has(e.id)).length

  function toggleVariation(name: string) {
    setSelectedVariations(prev => {
      const next = new Set(prev || allVariationNames)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

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

      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => window.print()}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            🖨️ {t('setlistprint_button')}
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'owned', 'missing'] as const).map(f => (
              <button key={f} onClick={() => setFilterMode(f)} disabled={!userId}
                style={{ padding: '9px 14px', border: '1.5px solid', borderColor: filterMode === f ? '#003DA6' : '#e0e0e0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: userId ? 'pointer' : 'default', background: filterMode === f ? '#003DA6' : 'white', color: filterMode === f ? 'white' : '#333', opacity: userId ? 1 : 0.5 }}>
                {f === 'all' ? t('setlistdetail_filter_all') : f === 'owned' ? t('setlistdetail_filter_owned') : t('setlistdetail_filter_missing')}
              </button>
            ))}
          </div>
          {!userId && <span style={{ fontSize: 12, color: '#aaa' }}>{t('setlistprint_login_hint')}</span>}
        </div>

        {allVariationNames.length > 1 && (
          <div style={{ border: '1.5px solid #e8e8e8', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888' }}>{t('setlistprint_variations_label')}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSelectedVariations(new Set(allVariationNames))} style={{ border: 'none', background: 'none', color: '#003DA6', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('setlistprint_select_all')}</button>
                <button onClick={() => setSelectedVariations(new Set())} style={{ border: 'none', background: 'none', color: '#888', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('setlistprint_select_none')}</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              {allVariationNames.map(name => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#333', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeVariations.has(name)} onChange={() => toggleVariation(name)} />
                  {name}
                </label>
              ))}
            </div>
          </div>
        )}
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
