'use client'
import { useEffect, useState, use, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useLang, TranslationKey } from '@/lib/LangContext'

interface Entry {
  id: number
  card_number: string | null
  player_name: string
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

interface Group { name: string; items: Entry[] }
type Unit = { kind: 'header'; name: string; count: number } | { kind: 'card'; entry: Entry }

const SPORT_LABEL: Record<string, string> = { nba: 'NBA', nfl: 'NFL', baseball: 'Baseball', hockey: 'Hockey', pokemon: 'Pokémon' }

// Nombre de lignes (cartes + en-têtes confondus) qui tiennent raisonnablement
// sur une page A4 avec COLS_PER_PAGE colonnes — estimation empirique basée
// sur la hauteur de ligne fixe utilisée ci-dessous (~20px/carte).
const COLS_PER_PAGE = 6
const ROWS_PER_PAGE = 260

function Header({ set, ownedCount, entriesLength, userId, t }: { set: CardSet; ownedCount: number; entriesLength: number; userId: string | null; t: (k: TranslationKey) => string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 14, borderBottom: '2px solid #111', paddingBottom: 10 }}>
      <img src="/memorabilius-logo.png" alt="Memorabilius" width={150} height={30} style={{ display: 'inline-block', margin: '0 auto 6px', height: 26, width: 'auto' }} />
      <h1 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px', color: '#111' }}>{set.name}</h1>
      <div style={{ fontSize: 11, color: '#666' }}>
        {SPORT_LABEL[set.sport] || set.sport}{set.year ? ` · ${set.year}` : ''}{set.brand ? ` · ${set.brand}` : ''} · {set.total_cards.toLocaleString()} {t('setlistdetail_cards')}
        {userId && <> · {ownedCount} / {entriesLength} {t('setlistdetail_owned')}</>}
      </div>
    </div>
  )
}

// `columns` CSS n'est pas fiable (rendu chevauché en natif comme sous
// html2canvas) : on répartit nous-mêmes dans N colonnes flex, en remplissant
// séquentiellement pour garder l'ordre alphabétique.
function distributeColumns(groups: Group[], n: number): Group[][] {
  const columns: Group[][] = Array.from({ length: n }, () => [])
  const weights = groups.map(g => Math.max(1, g.items.length))
  const total = weights.reduce((s, w) => s + w, 0) || 1
  const target = total / n
  let colIdx = 0, acc = 0
  groups.forEach((g, i) => {
    columns[colIdx].push(g)
    acc += weights[i]
    if (acc >= target && colIdx < n - 1) { colIdx++; acc = 0 }
  })
  return columns
}

// Découpe les groupes sélectionnés en pages A4 indépendantes (chaque page
// aura son propre en-tête/logo à l'export), puis répartit chaque page en
// colonnes égales.
function paginate(groups: Group[], colsPerPage: number, rowsPerPage: number): Unit[][][] {
  const units: Unit[] = []
  for (const g of groups) {
    units.push({ kind: 'header', name: g.name, count: g.items.length })
    for (const e of g.items) units.push({ kind: 'card', entry: e })
  }
  const pages: Unit[][] = []
  for (let i = 0; i < units.length; i += rowsPerPage) pages.push(units.slice(i, i + rowsPerPage))
  if (pages.length === 0) pages.push([])
  return pages.map(pageUnits => {
    const cols: Unit[][] = Array.from({ length: colsPerPage }, () => [])
    const per = Math.ceil(pageUnits.length / colsPerPage) || 1
    pageUnits.forEach((u, i) => cols[Math.min(colsPerPage - 1, Math.floor(i / per))].push(u))
    return cols
  })
}

function CardRow({ e, owned }: { e: Entry; owned: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, lineHeight: 1.35, marginBottom: 2 }}>
      <span style={{ flexShrink: 0, width: 10, height: 10, marginTop: 2, border: '1.2px solid #333', borderRadius: 2, background: owned ? '#111' : 'white' }} />
      <span style={{ color: '#111' }}>
        {e.card_number && <strong>{e.card_number} </strong>}
        {e.player_name}
        {e.is_rc && <span style={{ fontWeight: 800 }}> RC</span>}
      </span>
    </div>
  )
}

function UnitRow({ u, owned }: { u: Unit; owned: boolean }) {
  if (u.kind === 'header') {
    return (
      <div style={{ fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#003DA6', margin: '8px 0 3px', lineHeight: 1.25 }}>
        {u.name}
      </div>
    )
  }
  return <CardRow e={u.entry} owned={owned} />
}

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
  const exportRootRef = useRef<HTMLDivElement>(null)

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
        .select('id, card_number, player_name, variation, is_rc')
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

  function toggleVariation(name: string) {
    setSelectedVariations(prev => {
      const next = new Set(prev || [])
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Toutes les variations restent affichées à l'écran en permanence — la case
  // à cocher ne fait que déterminer ce qui part à l'impression / export.
  const filteredByOwnership = entries.filter(e => {
    if (filterMode === 'owned' && !owned.has(e.id)) return false
    if (filterMode === 'missing' && owned.has(e.id)) return false
    return true
  })
  const groups: Group[] = []
  for (const e of filteredByOwnership) {
    const name = e.variation || 'Base'
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.items.push(e)
    else groups.push({ name, items: [e] })
  }

  const selectedGroups = groups.filter(g => activeVariations.has(g.name))
  const exportPages = paginate(selectedGroups, COLS_PER_PAGE, ROWS_PER_PAGE)

  async function exportAs(kind: 'pdf' | 'jpg') {
    if (exporting || selectedGroups.length === 0) return
    setExporting(kind)
    try {
      // Le portail ne monte les pages qu'une fois `exporting` posé : on
      // attend qu'elles apparaissent avant de les capturer.
      let pageNodes: HTMLElement[] = []
      for (let i = 0; i < 40 && pageNodes.length === 0; i++) {
        await new Promise(r => setTimeout(r, 50))
        pageNodes = exportRootRef.current ? Array.from(exportRootRef.current.querySelectorAll<HTMLElement>('.export-page')) : []
      }
      if (pageNodes.length === 0) return

      const html2canvas = (await import('html2canvas')).default
      const filename = (set?.name || 'checklist').replace(/[^a-z0-9]+/gi, '-')

      if (kind === 'jpg') {
        for (let p = 0; p < pageNodes.length; p++) {
          const canvas = await html2canvas(pageNodes[p], { scale: 2, backgroundColor: '#ffffff', useCORS: true })
          const link = document.createElement('a')
          link.download = pageNodes.length > 1 ? `${filename}-page${p + 1}.jpg` : `${filename}.jpg`
          link.href = canvas.toDataURL('image/jpeg', 0.92)
          link.click()
          if (p < pageNodes.length - 1) await new Promise(r => setTimeout(r, 200))
        }
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
        const pageWidthMm = pdf.internal.pageSize.getWidth()
        const pageHeightMm = pdf.internal.pageSize.getHeight()
        for (let p = 0; p < pageNodes.length; p++) {
          const canvas = await html2canvas(pageNodes[p], { scale: 2, backgroundColor: '#ffffff', useCORS: true })
          if (p > 0) pdf.addPage()
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidthMm, pageHeightMm)
        }
        pdf.save(`${filename}.pdf`)
      }
    } finally {
      setExporting(null)
    }
  }

  const screenColumns = distributeColumns(groups, 5)

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
          [data-variation-active="false"] { display: none !important; }
        }
        @page { size: A4; margin: 14mm 10mm; }
      `}</style>

      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => window.print()}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨️ {t('setlistprint_button')}
        </button>
        <button onClick={() => exportAs('pdf')} disabled={!!exporting || selectedGroups.length === 0}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: exporting ? 'default' : 'pointer', opacity: exporting || selectedGroups.length === 0 ? 0.5 : 1 }}>
          ⬇️ {exporting === 'pdf' ? t('setlistprint_generating') : t('setlistprint_download_pdf')}
        </button>
        <button onClick={() => exportAs('jpg')} disabled={!!exporting || selectedGroups.length === 0}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: exporting ? 'default' : 'pointer', opacity: exporting || selectedGroups.length === 0 ? 0.5 : 1 }}>
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
      {selectedGroups.length === 0 && (
        <div className="no-print" style={{ fontSize: 12, color: '#e67e22', marginBottom: 12 }}>
          {t('setlistprint_pick_hint')}
        </div>
      )}
      {selectedGroups.length > 0 && (
        <div className="no-print" style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          {exportPages.length > 1 ? `${exportPages.length} pages A4 à l'export` : '1 page A4 à l\'export'}
        </div>
      )}

      {/* Vue écran : toutes les variations restent affichées en permanence,
          en mise en page multi-colonnes (fiable, pas de `columns` CSS). La
          case à cocher ne sert qu'à choisir ce qui part à l'impression/export. */}
      <div className="a4-frame" style={{ maxWidth: '210mm', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', border: '1px solid #eee' }}>
        <div id="setlist-print-content" style={{ background: 'white', padding: '14mm 10mm', boxSizing: 'border-box' }}>
          <Header set={set} ownedCount={ownedCount} entriesLength={entries.length} userId={userId} t={t} />

          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            {screenColumns.map((col, ci) => (
              <div key={ci} style={{ flex: '1 1 0', minWidth: 0 }}>
                {col.map((g, gi) => {
                  const active = activeVariations.has(g.name)
                  return (
                    <div key={gi} data-variation-active={active}>
                      {/* Grille (colonne case à 14px fixe) plutôt que flex : le
                          texte du nom, même long, ne peut jamais pousser ou
                          chevaucher la case ou la colonne voisine. */}
                      <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr', columnGap: 6, alignItems: 'start', margin: '10px 0 4px' }}>
                        <input type="checkbox" className="no-print" checked={active} onChange={() => toggleVariation(g.name)}
                          style={{ marginTop: 2, cursor: 'pointer' }} />
                        <div style={{ fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#003DA6', lineHeight: 1.3 }}>
                          {g.name}{' '}
                          <span className="no-print" style={{ fontSize: 11, color: '#bbb', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>({g.items.length})</span>
                        </div>
                      </div>
                      {g.items.map(e => <CardRow key={e.id} e={e} owned={owned.has(e.id)} />)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>{t('setlistdetail_no_cards')}</div>
          )}
        </div>
      </div>

      {/* Rendu hors-écran dédié à l'export : une page A4 = un div indépendant
          avec son propre en-tête/logo, capturé séparément par html2canvas.
          Monté seulement pendant la capture. */}
      {exporting && createPortal(
        <div ref={exportRootRef} style={{ position: 'fixed', left: -99999, top: 0 }}>
          {exportPages.map((cols, pi) => (
            <div key={pi} className="export-page" style={{ width: '210mm', minHeight: '297mm', background: 'white', padding: '12mm 9mm', boxSizing: 'border-box' }}>
              <Header set={set} ownedCount={ownedCount} entriesLength={entries.length} userId={userId} t={t} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {cols.map((col, ci) => (
                  <div key={ci} style={{ flex: '1 1 0', minWidth: 0 }}>
                    {col.map((u, ui) => <UnitRow key={ui} u={u} owned={u.kind === 'card' ? owned.has(u.entry.id) : false} />)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
