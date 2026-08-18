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
  const [exporting, setExporting] = useState<'pdf' | 'jpg' | null>(null)

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
    const varNames = Array.from(new Set(all.map(e => e.variation || 'Base')))
    // S'il n'y a qu'une seule variation (rien à choisir), on la coche d'office.
    setSelectedVariations(new Set(varNames.length <= 1 ? varNames : []))

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
  const ownedCount = entries.filter(e => owned.has(e.id)).length

  async function exportAs(kind: 'pdf' | 'jpg') {
    const el = document.getElementById('setlist-print-content')
    if (!el || exporting) return
    setExporting(kind)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const filename = (set?.name || 'checklist').replace(/[^a-z0-9]+/gi, '-')

      if (kind === 'jpg') {
        const link = document.createElement('a')
        link.download = `${filename}.jpg`
        link.href = canvas.toDataURL('image/jpeg', 0.92)
        link.click()
      } else {
        const { jsPDF } = await import('jspdf')
        const imgData = canvas.toDataURL('image/jpeg', 0.95)
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = pageWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        let position = 0
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
        pdf.save(`${filename}.pdf`)
      }
    } finally {
      setExporting(null)
    }
  }

  function toggleVariation(name: string) {
    setSelectedVariations(prev => {
      const next = new Set(prev || [])
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Regroupe TOUTES les entrées (filtrées par possession) par variation, pour
  // afficher chaque groupe avec sa case à cocher — même les groupes non
  // sélectionnés, dont seul l'en-tête reste visible (pas les cartes).
  const filteredByOwnership = entries.filter(e => {
    if (filterMode === 'owned' && !owned.has(e.id)) return false
    if (filterMode === 'missing' && owned.has(e.id)) return false
    return true
  })
  const groups: { name: string; items: Entry[] }[] = []
  for (const e of filteredByOwnership) {
    const name = e.variation || 'Base'
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.items.push(e)
    else groups.push({ name, items: [e] })
  }
  const visibleCount = groups.filter(g => activeVariations.has(g.name)).reduce((s, g) => s + g.items.length, 0)

  return (
    <div className="setlist-print-page">
      <style jsx global>{`
        @media print {
          nav, footer, .no-print, [class*="MobileTopBar"], [class*="MobileBottomNav"] { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          body { background: white !important; }
          .setlist-print-page { padding: 0 !important; }
          .a4-frame { box-shadow: none !important; border: none !important; max-width: 100% !important; }
          #setlist-print-content { padding: 0 !important; }
        }
        @page { size: A4; margin: 14mm 10mm; }
      `}</style>

      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => window.print()}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨️ {t('setlistprint_button')}
        </button>
        <button onClick={() => exportAs('pdf')} disabled={!!exporting}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
          ⬇️ {exporting === 'pdf' ? t('setlistprint_generating') : t('setlistprint_download_pdf')}
        </button>
        <button onClick={() => exportAs('jpg')} disabled={!!exporting}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
          🖼️ {exporting === 'jpg' ? t('setlistprint_generating') : t('setlistprint_download_jpg')}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'owned', 'missing'] as const).map(f => (
            <button key={f} onClick={() => setFilterMode(f)} disabled={!userId}
              style={{ padding: '9px 14px', border: '1.5px solid', borderColor: filterMode === f ? '#003DA6' : '#e0e0e0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: userId ? 'pointer' : 'default', background: filterMode === f ? '#003DA6' : 'white', color: filterMode === f ? 'white' : '#333', opacity: userId ? 1 : 0.5 }}>
              {f === 'all' ? t('setlistdetail_filter_all') : f === 'owned' ? t('setlistdetail_filter_owned') : t('setlistdetail_filter_missing')}
            </button>
          ))}
        </div>
        {allVariationNames.length > 1 && (
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button onClick={() => setSelectedVariations(new Set(allVariationNames))} style={{ border: 'none', background: 'none', color: '#003DA6', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('setlistprint_select_all')}</button>
            <button onClick={() => setSelectedVariations(new Set())} style={{ border: 'none', background: 'none', color: '#888', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('setlistprint_select_none')}</button>
          </div>
        )}
        {!userId && <span style={{ fontSize: 12, color: '#aaa' }}>{t('setlistprint_login_hint')}</span>}
      </div>

      <div className="a4-frame" style={{ maxWidth: '210mm', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', border: '1px solid #eee' }}>
        <div id="setlist-print-content" style={{ background: 'white', padding: '14mm 10mm', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: 18, borderBottom: '2px solid #111', paddingBottom: 14 }}>
            <img src="/memorabilius-logo.png" alt="Memorabilius" width={150} height={30} style={{ display: 'inline-block', margin: '0 auto 8px', height: 30, width: 'auto' }} />
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px', color: '#111' }}>{set.name}</h1>
            <div style={{ fontSize: 13, color: '#666' }}>
              {SPORT_LABEL[set.sport] || set.sport}{set.year ? ` · ${set.year}` : ''}{set.brand ? ` · ${set.brand}` : ''} · {set.total_cards.toLocaleString()} {t('setlistdetail_cards')}
              {userId && <> · {ownedCount} / {entries.length} {t('setlistdetail_owned')}</>}
            </div>
          </div>

          <div style={{ columns: '3 200px', columnGap: 24 }}>
            {groups.map((g, gi) => {
              const active = activeVariations.has(g.name)
              return (
                <div key={gi} style={{ breakInside: 'avoid-column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 4px', breakAfter: 'avoid-column' }}>
                    <input type="checkbox" className="no-print" checked={active} onChange={() => toggleVariation(g.name)}
                      style={{ flexShrink: 0, cursor: 'pointer' }} />
                    <span style={{ fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#003DA6' }}>
                      {g.name}
                    </span>
                    <span className="no-print" style={{ fontSize: 11, color: '#bbb', fontWeight: 700 }}>({g.items.length})</span>
                  </div>
                  {active && g.items.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, lineHeight: 1.4, marginBottom: 3, breakInside: 'avoid-column' }}>
                      <span style={{ flexShrink: 0, width: 12, height: 12, marginTop: 2, border: '1.3px solid #333', borderRadius: 2, background: owned.has(e.id) ? '#111' : 'white' }} />
                      <span style={{ color: '#111' }}>
                        {e.card_number && <strong>{e.card_number} </strong>}
                        {e.player_name}
                        {e.is_rc && <span style={{ fontWeight: 800 }}> RC</span>}
                        {e.team && <span style={{ color: '#888' }}> ({e.team})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {visibleCount === 0 && (
            <div className="no-print" style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
              {activeVariations.size === 0 ? t('setlistprint_pick_hint') : t('setlistdetail_no_cards')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
