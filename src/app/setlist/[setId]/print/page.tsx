'use client'
import { useEffect, useState, use, useRef, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useLang, TranslationKey } from '@/lib/LangContext'
import { saveOrShareFile } from '@/lib/saveOrShare'

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
const COLS_PER_PAGE = 4
const PX_PER_MM = 96 / 25.4
const SIDE_PAD_MM = 9
const TOP_BOTTOM_PAD_MM = 9
const HEADER_H_MM = 13
const HEADER_GAP_MM = 3
const LOGO_ASPECT = 21924 / 4866

function Header({ set, ownedCount, entriesLength, userId, t }: { set: CardSet; ownedCount: number; entriesLength: number; userId: string | null; t: (k: TranslationKey) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, borderBottom: '2px solid #111', paddingBottom: 8 }}>
      <img src="/memorabilius-logo.png" alt="Memorabilius" style={{ height: 22, width: 'auto', flexShrink: 0 }} />
      <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 2px', color: '#111' }}>{set.name}</h1>
        <div style={{ fontSize: 10, color: '#666' }}>
          {SPORT_LABEL[set.sport] || set.sport}{set.year ? ` · ${set.year}` : ''}{set.brand ? ` · ${set.brand}` : ''} · {set.total_cards.toLocaleString()} {t('setlistdetail_cards')}
          {userId && <> · {ownedCount} / {entriesLength} {t('setlistdetail_owned')}</>}
        </div>
      </div>
    </div>
  )
}

// `columns` CSS n'est pas fiable (rendu chevauché en natif comme sous
// html2canvas) : on répartit nous-mêmes dans N colonnes flex, en remplissant
// séquentiellement pour garder l'ordre alphabétique. Utilisé uniquement pour
// la vue écran (toujours affichée en entier, pas de contrainte de pagination).
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

function groupsToUnits(groups: Group[]): Unit[] {
  const units: Unit[] = []
  for (const g of groups) {
    units.push({ kind: 'header', name: g.name, count: g.items.length })
    for (const e of g.items) units.push({ kind: 'card', entry: e })
  }
  return units
}

// Toutes les lignes (cartes ET en-têtes) ont EXACTEMENT la même hauteur fixe
// et ne tiennent jamais que sur une seule ligne (nowrap + ellipsis).
const ROW_STYLE: CSSProperties = { fontSize: 11, lineHeight: 1.35, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden' }

function CardRow({ e, owned }: { e: Entry; owned: boolean }) {
  return (
    <div className="unit-row" style={{ ...ROW_STYLE, display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ flexShrink: 0, width: 10, height: 10, border: '1.2px solid #333', borderRadius: 2, background: owned ? '#111' : 'white' }} />
      <span style={{ color: '#111', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
      <div className="unit-row" style={{ ...ROW_STYLE, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#003DA6', textOverflow: 'ellipsis' }}>
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
  const [exportPhase, setExportPhase] = useState<'idle' | 'pdf' | 'jpg'>('idle')
  const [exportPages, setExportPages] = useState<Unit[][][]>([])
  const measureRootRef = useRef<HTMLDivElement>(null)
  const captureRootRef = useRef<HTMLDivElement>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id || null))
  }, [])


  useEffect(() => {
    // Précharge le logo comme élément Image indépendant du DOM : on le
    // dessine nous-mêmes sur chaque page exportée via l'API Canvas, plutôt
    // que de compter sur html2canvas pour charger une <img>.
    const img = new Image()
    img.onload = () => { logoImgRef.current = img }
    img.src = '/memorabilius-logo.png'
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
  const selectedUnits = groupsToUnits(selectedGroups)

  async function exportAs(kind: 'pdf' | 'jpg') {
    if (exportPhase !== 'idle' || selectedUnits.length === 0) return
    setExportPhase(kind)
    try {
      // Mesure le pas vertical exact d'une ligne (toutes identiques, voir
      // ROW_STYLE) via deux lignes témoins hors-écran.
      let measureEl: HTMLElement | null = null
      for (let i = 0; i < 40 && !measureEl; i++) {
        await new Promise(r => setTimeout(r, 50))
        measureEl = measureRootRef.current
      }
      if (!measureEl) return
      const probeRows = Array.from(measureEl.querySelectorAll<HTMLElement>('.unit-row'))
      const rowPitch = probeRows.length >= 2
        ? probeRows[1].getBoundingClientRect().top - probeRows[0].getBoundingClientRect().top
        : 17

      const scale = 2
      const pageWpx = 210 * PX_PER_MM * scale
      const pageHpx = 297 * PX_PER_MM * scale
      const sidePad = SIDE_PAD_MM * PX_PER_MM * scale
      const topBottomPad = TOP_BOTTOM_PAD_MM * PX_PER_MM * scale
      const headerH = HEADER_H_MM * PX_PER_MM * scale
      const headerGap = HEADER_GAP_MM * PX_PER_MM * scale
      const availablePerPageUnscaled = (pageHpx - topBottomPad * 2 - headerH - headerGap) / scale

      // Écoulement séquentiel type "journal" : on remplit la colonne 1
      // entièrement de haut en bas, puis la colonne 2, etc., puis on passe à
      // la page suivante — jamais plusieurs colonnes qui avancent en
      // parallèle sur des sections de contenu différentes. Garantit un ordre
      // de lecture toujours cohérent, aucune ligne coupée (grille uniforme)
      // et un remplissage dense (aucune colonne ne reste vide s'il reste du
      // contenu à placer).
      const rowsPerColumn = Math.max(1, Math.floor(availablePerPageUnscaled / rowPitch))
      const slotsPerPage = rowsPerColumn * COLS_PER_PAGE
      const totalPages = Math.max(1, Math.ceil(selectedUnits.length / slotsPerPage))
      const pages: Unit[][][] = []
      for (let p = 0; p < totalPages; p++) {
        const pageStart = p * slotsPerPage
        const cols: Unit[][] = []
        for (let c = 0; c < COLS_PER_PAGE; c++) {
          const start = pageStart + c * rowsPerColumn
          cols.push(selectedUnits.slice(start, start + rowsPerColumn))
        }
        pages.push(cols)
      }

      setExportPages(pages)

      let pageNodes: HTMLElement[] = []
      for (let i = 0; i < 40 && pageNodes.length === 0; i++) {
        await new Promise(r => setTimeout(r, 50))
        pageNodes = captureRootRef.current ? Array.from(captureRootRef.current.querySelectorAll<HTMLElement>('.export-page')) : []
      }
      if (pageNodes.length === 0) return

      const html2canvas = (await import('html2canvas')).default
      const filename = (set?.name || 'checklist').replace(/[^a-z0-9]+/gi, '-')
      const logo = logoImgRef.current

      function stampHeader(ctx: CanvasRenderingContext2D) {
        const logoH = headerH * 0.72
        const logoW = logoH * LOGO_ASPECT
        if (logo) ctx.drawImage(logo, sidePad, topBottomPad + (headerH - logoH) / 2, logoW, logoH)
        const textX = sidePad + logoW + 10 * scale
        ctx.fillStyle = '#111'
        ctx.font = `900 ${13 * scale}px Arial, sans-serif`
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(set!.name, textX, topBottomPad + headerH * 0.44)
        ctx.fillStyle = '#666'
        ctx.font = `${9 * scale}px Arial, sans-serif`
        const meta = `${SPORT_LABEL[set!.sport] || set!.sport}${set!.year ? ` · ${set!.year}` : ''}${set!.brand ? ` · ${set!.brand}` : ''} · ${set!.total_cards.toLocaleString()} cartes${userId ? ` · ${ownedCount} / ${entries.length} possédées` : ''}`
        ctx.fillText(meta, textX, topBottomPad + headerH * 0.8)
        ctx.strokeStyle = '#111'
        ctx.lineWidth = 2 * scale
        ctx.beginPath()
        ctx.moveTo(sidePad, topBottomPad + headerH)
        ctx.lineTo(pageWpx - sidePad, topBottomPad + headerH)
        ctx.stroke()
      }

      async function renderPage(node: HTMLElement): Promise<HTMLCanvasElement> {
        const contentCanvas = await html2canvas(node, { scale, backgroundColor: '#ffffff' })
        const page = document.createElement('canvas')
        page.width = pageWpx
        page.height = pageHpx
        const ctx = page.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, pageWpx, pageHpx)
        stampHeader(ctx)
        ctx.drawImage(contentCanvas, sidePad, topBottomPad + headerH + headerGap)
        return page
      }

      // <a download> et pdf.save() reposent sur le téléchargement navigateur, qui
      // n'existe pas dans la WebView Android — saveOrShareFile gère le fallback
      // natif (écriture + partage) automatiquement selon la plateforme.
      if (kind === 'jpg') {
        for (let p = 0; p < pageNodes.length; p++) {
          const page = await renderPage(pageNodes[p])
          const name = pageNodes.length > 1 ? `${filename}-page${p + 1}.jpg` : `${filename}.jpg`
          await saveOrShareFile(page.toDataURL('image/jpeg', 0.92), name)
          if (p < pageNodes.length - 1) await new Promise(r => setTimeout(r, 200))
        }
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
        for (let p = 0; p < pageNodes.length; p++) {
          const page = await renderPage(pageNodes[p])
          if (p > 0) pdf.addPage()
          pdf.addImage(page.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297)
        }
        await saveOrShareFile(pdf.output('blob'), `${filename}.pdf`)
      }
    } finally {
      setExportPhase('idle')
      setExportPages([])
    }
  }

  const screenColumns = distributeColumns(groups, 4)
  const exporting = exportPhase !== 'idle'

  return (
    <div className="setlist-print-page">
      <style jsx global>{`
        /* Cette checklist est toujours conçue pour être imprimée/exportée sur
           fond blanc — on neutralise ici la surcharge CSS globale du mode
           sombre (qui recolore tout élément avec un style inline "blanc" en
           fond sombre) pour ce conteneur précis. Sélecteurs ancrés sur l'#id
           du contenu pour être garantis plus spécifiques que les règles
           globales (elles-mêmes en !important) quel que soit leur ordre
           d'apparition dans la feuille de style.
        */
        [data-theme="dark"] #setlist-print-content { background: white !important; }
        [data-theme="dark"] #setlist-print-content div,
        [data-theme="dark"] #setlist-print-content h1 { color: #111 !important; }
        [data-theme="dark"] #setlist-print-content div[style*="666"],
        [data-theme="dark"] #setlist-print-content div[style*="102, 102, 102"] { color: #666 !important; }
        [data-theme="dark"] #setlist-print-content div[style*="003DA6"],
        [data-theme="dark"] #setlist-print-content div[style*="0, 61, 166"] { color: #003DA6 !important; }
        @media print {
          nav, footer, .no-print, [class*="MobileTopBar"], [class*="MobileBottomNav"] { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          body { background: white !important; }
          .setlist-print-page { padding: 0 !important; }
          .a4-frame-scroll { overflow: visible !important; }
          .a4-frame { box-shadow: none !important; border: none !important; max-width: 100% !important; width: 100% !important; }
          #setlist-print-content { padding: 0 !important; }
          [data-variation-active="false"] { display: none !important; }
        }
        @page { size: A4; margin: 14mm 10mm; }
      `}</style>

      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20, position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg, white)', padding: '10px 0' }}>
        <button onClick={() => window.print()}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨️ {t('setlistprint_button')}
        </button>
        <button onClick={() => exportAs('pdf')} disabled={exporting || selectedUnits.length === 0}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: exporting ? 'default' : 'pointer', opacity: exporting || selectedUnits.length === 0 ? 0.5 : 1 }}>
          ⬇️ {exportPhase === 'pdf' ? t('setlistprint_generating') : t('setlistprint_download_pdf')}
        </button>
        <button onClick={() => exportAs('jpg')} disabled={exporting || selectedUnits.length === 0}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 14, cursor: exporting ? 'default' : 'pointer', opacity: exporting || selectedUnits.length === 0 ? 0.5 : 1 }}>
          🖼️ {exportPhase === 'jpg' ? t('setlistprint_generating') : t('setlistprint_download_jpg')}
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
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button onClick={() => setSelectedVariations(new Set(allVariationNames))}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {t('setlistprint_select_all')}
            </button>
            <button onClick={() => setSelectedVariations(new Set())}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #e0e0e0', background: 'white', color: '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {t('setlistprint_select_none')}
            </button>
          </div>
        )}
        {!userId && <span style={{ fontSize: 12, color: '#aaa' }}>{t('setlistprint_login_hint')}</span>}
      </div>
      {selectedUnits.length === 0 && (
        <div className="no-print" style={{ fontSize: 12, color: '#e67e22', marginBottom: 12 }}>
          {t('setlistprint_pick_hint')}
        </div>
      )}

      {/* Vue écran : toutes les variations restent affichées en permanence,
          en mise en page multi-colonnes (fiable, pas de `columns` CSS). La
          case à cocher ne sert qu'à choisir ce qui part à l'impression/export. */}
      {/* Le contenu garde toujours sa largeur A4 réelle (pas de compression sur
          mobile qui rendrait le texte illisible) — sur petit écran, l'utilisateur
          fait défiler horizontalement plutôt que de voir 4 colonnes écrasées. */}
      <div className="a4-frame-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="a4-frame" style={{ width: '210mm', maxWidth: '210mm', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', border: '1px solid #eee' }}>
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
      </div>

      {/* Hors-écran : deux lignes témoins pour mesurer le pas vertical exact. */}
      {exporting && createPortal(
        <div ref={measureRootRef} style={{ position: 'fixed', left: -99999, top: 0, width: '50mm' }}>
          <UnitRow u={{ kind: 'card', entry: { id: -1, card_number: '1', player_name: 'X', variation: null, is_rc: false } }} owned={false} />
          <UnitRow u={{ kind: 'card', entry: { id: -2, card_number: '2', player_name: 'X', variation: null, is_rc: false } }} owned={false} />
        </div>,
        document.body
      )}

      {/* Hors-écran : chaque page A4 = un noeud indépendant (colonnes déjà
          calculées par écoulement séquentiel, sans en-tête ici — l'en-tête
          est redessiné après capture via l'API Canvas), capturé séparément. */}
      {exporting && createPortal(
        <div ref={captureRootRef} style={{ position: 'fixed', left: -99999, top: 0 }}>
          {exportPages.map((cols, pi) => (
            <div key={pi} className="export-page" style={{ width: `${210 - SIDE_PAD_MM * 2}mm`, background: 'white' }}>
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
