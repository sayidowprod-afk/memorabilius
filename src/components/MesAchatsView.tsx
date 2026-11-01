'use client'
import { useEffect, useMemo, useState } from 'react'
import SpendingTracker, { type Budgets, NO_BUDGETS } from '@/components/SpendingTracker'
import { ActivityLog, Clock, DetailsPanel, EXTRA_CSS, Lightbox, MesAchatsSkeleton, PrefsModal, type Compare, type LogEvent } from '@/components/AchatExtras'
import { groupOrders, orderTotals } from '@/lib/achatsOrders'
import { findMatch, indexCartes, matchesQuery, rappels, statutOf, STATUT_COLOR, STATUT_LABEL, trackingUrl, type CarteLite, type Statut } from '@/lib/achatsUi'
import type { AlertPrefs } from '@/lib/achatsAlertPrefs'

// Affichage de « Mes achats » (sans logique réseau) : utilisé par /mes-achats et par la page de démonstration locale.
export type Conn = { statut: 'en_attente' | 'connecte' | 'expire'; ebay_user_id: string | null; derniere_synchro_at: string | null; derniere_erreur: string | null }
export type Row = {
  id: string; type: 'achat' | 'enchere' | 'suivi'; source?: 'ebay' | 'vinted'; item_id: string | null; transaction_id: string | null; titre: string | null; photo_url: string | null; photo_mini: string | null
  vendeur: string | null; vendeur_note: number | null; devise: string | null; prix: number | null; frais_port: number | null
  total_paye?: number | null; autres_frais?: number | null; order_id?: string | null
  prix_actuel: number | null; ma_mise_max: number | null; en_tete: boolean | null; nb_encheres: number | null
  fin_at: string | null; achete_at: string | null; paye_at: string | null; expedie_at: string | null
  lien: string | null; lien_commande: string | null
  // données perso (migration 20261104)
  suivi_numero?: string | null; transporteur?: string | null; notes?: string | null; tags?: string[] | null
  valeur_estimee?: number | null; limite_perso?: number | null; seuil_alerte?: number | null; recu_at?: string | null; carte_id?: string | null
}

const money = (v: number | null, devise: string | null) =>
  v === null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: devise && devise.length === 3 ? devise : 'EUR' })
// Taux : euros pour 1 unité de la devise (ex. USD -> 0.92). Sans taux connu, on garde le prix d'origine.
export type Rates = Record<string, number> | null
const toEur = (v: number, devise: string | null, rates: Rates): number | null =>
  !devise || devise === 'EUR' ? v : rates?.[devise] ? v * rates[devise] : null
// Prix converti en euros (gros) + prix d'origine (petit) quand l'annonce n'est pas en euros.
function fmt(v: number | null, devise: string | null, rates: Rates): { main: string; sub: string | null } {
  if (v === null) return { main: '—', sub: null }
  const e = devise && devise !== 'EUR' ? toEur(v, devise, rates) : null
  return e === null ? { main: money(v, devise), sub: null } : { main: money(e, 'EUR'), sub: `${money(v, devise)} · converti` }
}
// Les liens suivent le site eBay de l'utilisateur (ebay.fr pour un francophone), pas celui de l'annonce.
const annonceUrl = (r: Row, tld: string) => (r.item_id ? `https://www.ebay.${tld}/itm/${r.item_id}` : r.lien)
const commandeUrl = (r: Row, tld: string) =>
  r.item_id && r.transaction_id ? `https://www.ebay.${tld}/vod/FetchOrderDetails?itemid=${r.item_id}&transid=${r.transaction_id}` : r.lien_commande
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
const ago = (iso: string | null, now: number) => {
  if (!iso) return 'jamais'
  const m = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'à l’instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`
}
const clip = (t: string | null, n = 60) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t || 'Achat')

function Photo({ r, onZoom }: { r: Row; onZoom?: () => void }) {
  const [src, setSrc] = useState(r.photo_url || r.photo_mini)
  if (!src) return <div className="ma-photo ma-nophoto" aria-hidden="true">🃏</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`ma-photo${onZoom ? ' zoom' : ''}`} src={src} alt={r.titre || ''} loading="lazy" onClick={onZoom}
    onError={() => { if (src !== r.photo_mini && r.photo_mini) setSrc(r.photo_mini); else setSrc(null) }} />
}

// Étiquette de provenance : eBay ou Vinted
function SrcTag({ r }: { r: Row }) {
  const v = r.source === 'vinted'
  return <span className={`ma-src ${v ? 'vi' : 'eb'}`}>{v ? 'Vinted' : 'eBay'}</span>
}
const StatutTag = ({ s }: { s: Statut }) => <span className="ma-tag" style={{ background: STATUT_COLOR[s] }}>{STATUT_LABEL[s]}</span>

function Step({ done, label, sub }: { done: boolean; label: string; sub?: string }) {
  return (
    <div className={`ma-step${done ? ' done' : ''}`}>
      <i />
      <span>{label}{sub ? <em> · {sub}</em> : null}</span>
    </div>
  )
}

// Petit champ « montant » replié : limite perso d'une enchère, seuil d'alerte d'un article suivi.
function InlineAmount({ label, current, placeholder, onSave }: { label: string; current: number | null; placeholder: string; onSave: (v: number | null) => Promise<string | null> }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState('')
  const [err, setErr] = useState<string | null>(null)
  if (!open) return <button type="button" className="ma-linkbtn" onClick={() => { setV(current !== null ? String(current) : ''); setErr(null); setOpen(true) }}>{current !== null ? `${label} : ${money(current, 'EUR')} · modifier` : label}</button>
  const save = async () => {
    const n = v.trim() === '' ? null : Number(v.replace(',', '.'))
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setErr('Montant invalide'); return }
    const e = await onSave(n)
    if (e) setErr(e); else setOpen(false)
  }
  return (
    <span className="ma-inline">
      <input className="ma-det-in" style={{ width: 110 }} inputMode="decimal" autoFocus value={v} placeholder={placeholder} aria-label={label}
        onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }} />
      <button type="button" className="ma-btn primary" style={{ padding: '5px 10px' }} onClick={save}>OK</button>
      <button type="button" className="ma-btn ghost" style={{ padding: '5px 10px' }} onClick={() => setOpen(false)}>×</button>
      {err && <span className="ma-meta" style={{ color: '#d6293e' }}>{err}</span>}
    </span>
  )
}

export type MesAchatsViewProps = {
  conn: Conn | null
  rows: Row[]
  busy: 'connect' | 'sync' | 'disconnect' | null
  msg: string | null
  now: number
  confirmOut: boolean
  onConnect: () => void
  onSync: () => void
  onAskDisconnect: () => void
  onDisconnect: (deleteData: boolean) => void
  onCancelDisconnect: () => void
  tld?: string          // site eBay de l'utilisateur : fr, de, com…
  rates?: Rates
  budgets?: Budgets
  onSaveBudgets?: (b: Budgets) => void
  onAddVinted?: () => void
  onDeleteVinted?: (id: string) => void
  userId?: string
  cartes?: CarteLite[]                  // collection du membre (détection de doublons)
  wishlist?: CarteLite[]                // wishlist du membre
  notifs?: Array<{ message: string; created_at: string }>   // alertes eBay reçues (journal)
  prefs?: AlertPrefs
  onSavePrefs?: (p: AlertPrefs) => void
  onPatch?: (ids: string[], patch: Record<string, unknown>) => Promise<string | null>
  onAddTags?: (ids: string[], tags: string[]) => Promise<string | null>
  onCollection?: (ids: string[]) => Promise<string | null>
  onCompare?: (titre: string) => Promise<Compare | null>
  loading?: boolean                     // chargement initial : squelette à la place de la page
}

type Filtre = 'tout' | 'arecevoir' | 'apayer' | 'terminees'
type Vue = 'cartes' | 'liste'
const VUE_LS = 'memorabilius-vue-achats'

export default function MesAchatsView({
  conn, rows, busy, msg, now, confirmOut, onConnect, onSync, onAskDisconnect, onDisconnect, onCancelDisconnect, tld = 'fr', rates = null,
  budgets = NO_BUDGETS, onSaveBudgets, onAddVinted, onDeleteVinted, userId, cartes = [], wishlist = [], notifs = [], prefs, onSavePrefs,
  onPatch, onAddTags, onCollection, onCompare, loading = false,
}: MesAchatsViewProps) {
  const connected = conn?.statut === 'connecte'
  const hasData = connected || rows.length > 0
  const P = (v: number | null, d: string | null) => fmt(v, d, rates)

  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [srcF, setSrcF] = useState<'all' | 'ebay' | 'vinted'>('all')
  const [tri, setTri] = useState<'date' | 'prix' | 'vendeur'>('date')
  const [vue, setVue] = useState<Vue>(() => {
    try { const v = localStorage.getItem(VUE_LS); if (v === 'cartes' || v === 'liste') return v } catch { /* sans stockage */ }
    return typeof window !== 'undefined' && window.innerWidth <= 520 ? 'liste' : 'cartes'
  })
  const [open, setOpen] = useState<string | null>(null)          // achat dont le panneau « Détails » est ouvert
  const [selMode, setSelMode] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bulkTag, setBulkTag] = useState('')
  const [lb, setLb] = useState<{ items: Array<{ src: string; title: string }>; start: number } | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [note, setNote] = useState<{ text: string; ko?: boolean } | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => { try { localStorage.setItem(VUE_LS, vue) } catch { /* sans stockage */ } }, [vue])
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(null), 6000); return () => clearTimeout(id) }, [note])

  const inQ = (r: Row) => matchesQuery(r, q)
  const encheres = rows.filter(r => r.type === 'enchere' && inQ(r)).sort((a, b) => (a.fin_at || '9').localeCompare(b.fin_at || '9'))
  const achatsAll = rows.filter(r => r.type === 'achat')
  const achatsQ = achatsAll.filter(inQ).sort((a, b) => (b.achete_at || '').localeCompare(a.achete_at || ''))
  const suivis = rows.filter(r => r.type === 'suivi' && inQ(r)).sort((a, b) => (a.fin_at || '9').localeCompare(b.fin_at || '9'))
  const nbEncheresAll = rows.filter(r => r.type === 'enchere').length

  // filtres + tri des achats
  const statutOfRow = (r: Row) => statutOf(r, now)
  const bySrc = achatsQ.filter(r => srcF === 'all' || (r.source || 'ebay') === srcF)
  const counts = {
    tout: bySrc.length,
    arecevoir: bySrc.filter(r => ['preparation', 'transit'].includes(statutOfRow(r))).length,
    apayer: bySrc.filter(r => statutOfRow(r) === 'apayer').length,
    terminees: bySrc.filter(r => statutOfRow(r) === 'recu').length,
  }
  const filtered = bySrc.filter(r => {
    const s = statutOfRow(r)
    return filtre === 'tout' || (filtre === 'arecevoir' && (s === 'preparation' || s === 'transit')) || (filtre === 'apayer' && s === 'apayer') || (filtre === 'terminees' && s === 'recu')
  })
  const gAmount = (g: Row[]) => {
    const r = g[0]
    const raw = g.length > 1 ? orderTotals(g).total : (r.total_paye ?? ((r.prix || 0) + (r.frais_port || 0) + (r.autres_frais || 0)))
    return toEur(raw, r.devise, rates) ?? raw
  }
  const groups = groupOrders(filtered)
  if (tri === 'prix') groups.sort((x, y) => gAmount(y) - gAmount(x))
  else if (tri === 'vendeur') groups.sort((x, y) => (x[0].vendeur || '~').localeCompare(y[0].vendeur || '~', 'fr'))

  // doublons avec la collection et correspondances avec la wishlist (recherche par mots, sans réseau)
  const cIdx = useMemo(() => indexCartes(cartes), [cartes])
  const wIdx = useMemo(() => indexCartes(wishlist), [wishlist])
  const dups = useMemo(() => {
    const m = new Map<string, CarteLite>()
    if (!cIdx.length) return m
    for (const r of rows) { if (r.carte_id || !r.titre) continue; const c = findMatch(r.titre, cIdx); if (c) m.set(r.id, c) }
    return m
  }, [rows, cIdx])
  const wishes = useMemo(() => {
    const m = new Map<string, CarteLite>()
    if (!wIdx.length) return m
    for (const r of rows) { if (r.type === 'achat' || !r.titre) continue; const c = findMatch(r.titre, wIdx, 'auto'); if (c) m.set(r.id, c) }
    return m
  }, [rows, wIdx])

  const reminders = useMemo(() => rappels(rows, now), [rows, now])

  // journal d'activité : événements des commandes + alertes reçues
  const events = ((): LogEvent[] => {
    const ev: LogEvent[] = []
    for (const g of groupOrders(achatsAll)) {
      const r = g[0], t = g.length > 1 ? `commande de ${g.length} articles` : clip(r.titre, 50)
      if (r.achete_at) ev.push({ t: new Date(r.achete_at).getTime(), icon: '🛒', texte: `Achat : ${t}` })
      if (r.paye_at && r.paye_at !== r.achete_at && Math.abs(new Date(r.paye_at).getTime() - new Date(r.achete_at || r.paye_at).getTime()) > 60000) ev.push({ t: new Date(r.paye_at).getTime(), icon: '💳', texte: `Payé : ${t}` })
      if (r.expedie_at) ev.push({ t: new Date(r.expedie_at).getTime(), icon: '📦', texte: `Expédié : ${t}` })
      if (r.recu_at) ev.push({ t: new Date(r.recu_at).getTime(), icon: '🏠', texte: `Reçu : ${t}` })
    }
    for (const n of notifs) {
      const m = n.message
      ev.push({ t: new Date(n.created_at).getTime(), icon: /gagnée/i.test(m) ? '🏆' : /surench/i.test(m) ? '⚠️' : /limite/i.test(m) ? '📈' : /seuil/i.test(m) ? '📉' : /échapp|perdue/i.test(m) ? '💔' : '⏱', texte: m })
    }
    return ev.filter(e => Number.isFinite(e.t)).sort((a, b) => b.t - a.t).slice(0, 80)
  })()

  const run = async (key: string, fn: () => Promise<string | null>, ok: string) => {
    setWorking(key)
    try { const err = await fn(); setNote(err ? { text: err, ko: true } : { text: ok }) } finally { setWorking(null) }
  }
  const patch = (ids: string[], p: Record<string, unknown>) => (onPatch ? onPatch(ids, p) : Promise.resolve<string | null>('Indisponible.'))
  const addToCollection = (ids: string[]) => { if (onCollection) run('col-' + ids[0], () => onCollection(ids), ids.length > 1 ? 'Cartes ajoutées à ta collection.' : 'Carte ajoutée à ta collection.') }

  const openLb = (list: Row[], start: number) => {
    const items = list.map(r => ({ src: r.photo_url || r.photo_mini || '', title: r.titre || '' })).filter(i => i.src)
    if (items.length) setLb({ items, start: Math.min(start, items.length - 1) })
  }
  const toggleSel = (g: Row[]) => setSel(prev => {
    const n = new Set(prev), ids = g.map(r => r.id), on = ids.every(i => n.has(i))
    ids.forEach(i => (on ? n.delete(i) : n.add(i)))
    return n
  })
  const selCount = groups.filter(g => g.every(r => sel.has(r.id))).length
  const selIds = [...sel]
  const leaveSel = () => { setSelMode(false); setSel(new Set()); setBulkTag('') }

  const paidEur = (g: Row[]) => gAmount(g)
  const gain = (g: Row[]) => {
    if (!g.every(r => r.valeur_estimee != null)) return null
    const est = g.reduce((a, r) => a + (r.valeur_estimee || 0), 0), paid = paidEur(g)
    return paid > 0 ? { est, diff: est - paid, pct: Math.round(((est - paid) / paid) * 100) } : null
  }
  const note$ = (r: Row, tone = 'dup') => {
    const d = dups.get(r.id), w = wishes.get(r.id)
    return (
      <>
        {d && userId && <div className={`ma-note ${tone}`}>⚠ Peut-être déjà dans ta collection : <a href={`/galerie/${userId}/editer/${d.id}`}>{d.nom}{d.annee ? ` (${d.annee})` : ''}</a></div>}
        {w && <div className="ma-note wish">♥ Dans ta wishlist : {w.nom}</div>}
      </>
    )
  }

  // Un achat (ou une commande de plusieurs articles) : carte complète ou ligne compacte selon la vue.
  const purchase = (g: Row[]) => {
    const r = g[0], multi = g.length > 1
    const s = statutOf(r, now), t = multi ? orderTotals(g) : null
    const ids = g.map(x => x.id)
    const isOpen = open === r.id
    const checked = ids.every(i => sel.has(i))
    const gn = gain(g)
    const inColl = g.filter(x => x.carte_id).length
    const price = P(multi ? t!.total : (r.total_paye ?? r.prix), r.devise)
    const title = multi ? `Commande de ${g.length} articles` : r.titre
    const track = r.suivi_numero ? trackingUrl(r.transporteur || null, r.suivi_numero) : null
    const orderLink = commandeUrl(r, tld)
    const canReceive = s === 'transit' && !!onPatch
    const links = (
      <>
        {!multi && annonceUrl(r, tld) && <a href={annonceUrl(r, tld)!} target="_blank" rel="noopener noreferrer">{vue === 'liste' ? 'Ouvrir' : 'Voir l’annonce'}</a>}
        {track ? <a href={track.url} target="_blank" rel="noopener noreferrer">Suivre chez {track.label}</a>
          : orderLink && (r.expedie_at || r.paye_at) && <a href={orderLink} target="_blank" rel="noopener noreferrer">Suivre le colis</a>}
        {canReceive && <button type="button" className="ma-linkbtn" disabled={working === 'rec-' + r.id} onClick={() => run('rec-' + r.id, () => patch(ids, { recu: true }), 'Marqué comme reçu.')}>Marquer reçu</button>}
        {onCollection && (inColl === g.length && userId
          ? <a href={`/galerie/${userId}/editer/${g[0].carte_id}`}>✓ En collection</a>
          : <button type="button" className="ma-linkbtn" disabled={working === 'col-' + ids[0]} onClick={() => addToCollection(ids.filter((_, i) => !g[i].carte_id))}>{working === 'col-' + ids[0] ? 'Ajout…' : multi ? `+ Ma collection (${g.length - inColl})` : '+ Ma collection'}</button>)}
        {onPatch && <button type="button" className="ma-linkbtn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>{isOpen ? 'Fermer' : 'Détails'}</button>}
        {!multi && r.source === 'vinted' && onDeleteVinted && <button className="ma-del" onClick={() => { if (window.confirm('Supprimer cet achat Vinted ?')) onDeleteVinted(r.id) }}>Supprimer</button>}
      </>
    )
    const tags = (g.flatMap(x => x.tags || []).filter((x, i, a) => a.indexOf(x) === i))
    const panel = isOpen && onPatch && (
      <DetailsPanel key={r.id} row={r} ids={ids} onPatch={patch} onClose={() => setOpen(null)} onCompare={onCompare}
        priceEur={multi ? null : (toEur(r.prix ?? 0, r.devise, rates) ?? r.prix)} />
    )
    const selBox = selMode && <input type="checkbox" className="ma-sel" aria-label="Sélectionner" checked={checked} onChange={() => toggleSel(g)} />
    const lbList = g.filter(x => x.photo_url || x.photo_mini)

    if (vue === 'liste') {
      return (
        <article key={'l-' + r.id} className={`ma-row src-${r.source === 'vinted' ? 'vi' : 'eb'}`}>
          <div className="ma-row-main">
            {selBox}
            <div className="ma-row-photo"><Photo r={r} onZoom={lbList.length ? () => openLb(lbList, 0) : undefined} />{multi && <span className="ma-row-n">{g.length}</span>}</div>
            <div className="ma-rbody">
              <div className="ma-rtitle"><SrcTag r={r} />{title}</div>
              <div className="ma-rmeta"><StatutTag s={s} /> {r.achete_at ? day(r.achete_at) : ''}{r.vendeur ? ` · ${r.vendeur}` : ''}</div>
              {gn && <div className={`ma-gain ${gn.diff >= 0 ? 'up' : 'down'}`}>{gn.diff >= 0 ? '▲ +' : '▼ −'}{money(Math.abs(gn.diff), 'EUR')} ({gn.pct > 0 ? '+' : ''}{gn.pct} %)</div>}
            </div>
            <div className="ma-rprice">{price.main}</div>
          </div>
          {tags.length > 0 && <div className="ma-tags">{tags.map(x => <span key={x} className="ma-chip on">#{x}</span>)}</div>}
          {note$(r)}
          <div className="ma-ractions">{links}</div>
          {panel}
        </article>
      )
    }

    return (
      <article key={'c-' + r.id} className={`ma-card src-${r.source === 'vinted' ? 'vi' : 'eb'}${multi ? ' ma-order' : ''}`}>
        {selBox}
        {multi ? (
          <div className="ma-mosaic" aria-hidden={lbList.length ? undefined : true}>
            {g.slice(0, 4).map((x, i) => <Photo key={x.id} r={x} onZoom={lbList.length ? () => openLb(lbList, i) : undefined} />)}
          </div>
        ) : <Photo r={r} onZoom={lbList.length ? () => openLb(lbList, 0) : undefined} />}
        <div className="ma-body">
          <div className="ma-title"><SrcTag r={r} />{title}</div>
          <div className="ma-line">
            <span className="da-num ma-price">{price.main}</span>
            <StatutTag s={s} />
            {price.sub && <span className="ma-meta">{price.sub}</span>}
          </div>
          {multi ? (
            <>
              {t!.port !== null && <div className="ma-meta">dont {P(t!.port, r.devise).main} de port (une seule fois)</div>}
              {t!.remise !== null && <div className="ma-meta" style={{ color: '#1e9e57', fontWeight: 700 }}>Remise de lot : −{P(t!.remise, r.devise).main} sur le prix des annonces</div>}
              {t!.extra !== null && <div className="ma-meta">dont douane / taxes / frais : {P(t!.extra, r.devise).main}</div>}
            </>
          ) : (
            <>
              <div className="ma-meta">{r.prix !== null && r.total_paye != null && r.total_paye !== r.prix ? `Article ${P(r.prix, r.devise).main}` : ''}{r.frais_port !== null && r.frais_port > 0 ? ` + ${P(r.frais_port, r.devise).main} de port` : ''}</div>
              {r.autres_frais != null && r.autres_frais > 0 && <div className="ma-meta">dont douane / taxes / frais : {P(r.autres_frais, r.devise).main}</div>}
            </>
          )}
          <div className="ma-meta">{r.vendeur ? <>Vendeur : {r.vendeur}{r.vendeur_note !== null ? ` (${r.vendeur_note.toLocaleString('fr-FR')})` : ''}</> : null}{r.achete_at ? ` · acheté le ${day(r.achete_at)}` : ''}</div>
          {multi && (
            <ul className="ma-items">
              {g.slice(0, 12).map(x => <li key={x.id}>{annonceUrl(x, tld) ? <a href={annonceUrl(x, tld)!} target="_blank" rel="noopener noreferrer">{x.titre}</a> : x.titre}</li>)}
              {g.length > 12 && <li>… et {g.length - 12} autres</li>}
            </ul>
          )}
          {gn && <div className={`ma-gain ${gn.diff >= 0 ? 'up' : 'down'}`}>Estimé {money(gn.est, 'EUR')} · {gn.diff >= 0 ? '▲ +' : '▼ −'}{money(Math.abs(gn.diff), 'EUR')} ({gn.pct > 0 ? '+' : ''}{gn.pct} %)</div>}
          {tags.length > 0 && <div className="ma-tags">{tags.map(x => <span key={x} className="ma-chip on">#{x}</span>)}</div>}
          {!multi && r.notes && <div className="ma-meta ma-notetxt">📝 {r.notes}</div>}
          {note$(r)}
          <div className="ma-steps">
            <Step done={!!r.achete_at} label="Acheté" sub={day(r.achete_at)} />
            <Step done={!!r.paye_at} label="Payé" sub={day(r.paye_at)} />
            <Step done={!!r.expedie_at} label={r.expedie_at ? 'Expédié' : r.paye_at ? 'En attente d’expédition' : 'Expédition'} sub={[day(r.expedie_at), r.transporteur].filter(Boolean).join(' · ')} />
            <Step done={s === 'recu'} label="Reçu" sub={r.recu_at ? day(r.recu_at) : s === 'recu' ? 'colis arrivé' : undefined} />
          </div>
          {r.suivi_numero && (
            <div className="ma-meta">📦 {r.transporteur || 'Colis'} · <b>{r.suivi_numero}</b>{' '}
              <button type="button" className="ma-linkbtn" onClick={() => { try { navigator.clipboard?.writeText(r.suivi_numero!) ; setNote({ text: 'Numéro de suivi copié.' }) } catch { /* presse-papiers indisponible */ } }}>Copier</button></div>
          )}
          <div className="ma-links">{links}</div>
        </div>
        {panel}
      </article>
    )
  }

  const month = new Date(now).toISOString().slice(0, 7)
  const spent = achatsAll.filter(a => (a.achete_at || '').startsWith(month)).reduce<Record<string, number>>((acc, a) => {
    const total = (a.prix || 0) + (a.frais_port || 0)
    const e = toEur(total, a.devise, rates)
    const d = e === null ? (a.devise || 'EUR') : 'EUR'
    acc[d] = (acc[d] || 0) + (e === null ? total : e)
    return acc
  }, {})
  const spentLabel = Object.entries(spent).map(([d, v]) => money(v, d)).join(' + ') || money(0, 'EUR')
  const nbCmd = groupOrders(achatsAll).length
  const firstLoad = busy === 'sync' && rows.length === 0 && connected

  if (loading) {
    return (
      <div className="ma-wrap">
        <style>{CSS}</style>
        <style>{EXTRA_CSS}</style>
        <h1 style={{ margin: '0 0 20px', fontSize: 38 }}>Mes achats</h1>
        <MesAchatsSkeleton />
      </div>
    )
  }

  return (
    <div className="ma-wrap">
      <style>{CSS}</style>
      <style>{EXTRA_CSS}</style>
      <div className="ma-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 38 }}>Mes achats</h1>
          {connected && <div className="ma-sub">eBay · {conn?.ebay_user_id || 'compte relié'} · mis à jour {ago(conn?.derniere_synchro_at || null, now)}</div>}
        </div>
        <div className="ma-actions">
          {onAddVinted && <button className="ma-btn" onClick={onAddVinted}>+ Achat Vinted</button>}
          {connected && <button className="ma-btn" disabled={busy !== null} onClick={onSync}>{busy === 'sync' ? 'Actualisation…' : 'Actualiser eBay'}</button>}
          {prefs && onSavePrefs && <button className="ma-btn ghost" onClick={() => setPrefsOpen(true)}>🔔 Alertes</button>}
          {connected && <button className="ma-btn ghost" disabled={busy !== null} onClick={onAskDisconnect}>Déconnecter eBay</button>}
        </div>
      </div>

      {msg && <div className="ma-alert">{msg}</div>}
      {note && <div className={`ma-alert${note.ko ? '' : ' ok'}`} role="status">{note.text}</div>}
      {conn?.statut === 'expire' && <div className="ma-alert">Ta connexion à eBay a expiré. Reconnecte ton compte pour reprendre la mise à jour.</div>}
      {connected && conn?.derniere_erreur && !msg && <div className="ma-alert">Dernière actualisation : {conn.derniere_erreur}</div>}

      {!connected && (
        <div className="ma-hero">
          <h2 style={{ margin: '0 0 8px', fontSize: 26 }}>Retrouve tout ce que tu achètes sur eBay</h2>
          <p style={{ margin: '0 0 18px', color: 'var(--text2)', lineHeight: 1.55 }}>
            Relie ton compte eBay : tes enchères en cours, tes achats et les articles que tu suis arrivent ici tout seuls,
            avec les photos, le suivi des commandes et des alertes avant la fin d’une enchère.
          </p>
          <button className="ma-btn primary" disabled={busy === 'connect'} onClick={onConnect}>
            {busy === 'connect' ? 'Redirection vers eBay…' : conn?.statut === 'expire' ? 'Reconnecter eBay' : 'Connecter mon compte eBay'}
          </button>
          <ul className="ma-points">
            <li>Tu te connectes directement chez eBay : on ne voit jamais ton mot de passe.</li>
            <li>Lecture seule : Memorabilius ne place aucune enchère et n’achète rien à ta place.</li>
            <li>Tu peux te déconnecter et effacer tes données à tout moment.</li>
          </ul>
        </div>
      )}

      {hasData && firstLoad && <MesAchatsSkeleton />}

      {hasData && !firstLoad && (
        <>
          <div className="ma-stats">
            <div><span className="da-num">{nbEncheresAll}</span><small>enchère{nbEncheresAll > 1 ? 's' : ''} en cours</small></div>
            <div><span className="da-num">{nbCmd}</span><small>commande{nbCmd > 1 ? 's' : ''} importée{nbCmd > 1 ? 's' : ''}</small></div>
            <div><span className="da-num">{spentLabel}</span><small>dépensés ce mois-ci</small></div>
          </div>

          <input className="ma-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher partout : carte, joueur, vendeur, étiquette, note…" aria-label="Rechercher dans mes achats, enchères et articles suivis" />
          {q.trim() && <div className="ma-meta" style={{ margin: '-4px 0 12px' }}>{achatsQ.length} achat{achatsQ.length > 1 ? 's' : ''} · {encheres.length} enchère{encheres.length > 1 ? 's' : ''} · {suivis.length} article{suivis.length > 1 ? 's' : ''} suivi{suivis.length > 1 ? 's' : ''}</div>}

          {!q.trim() && reminders.length > 0 && (
            <section>
              <h2 className="ma-h2">À surveiller</h2>
              <div className="ma-remind">
                {reminders.slice(0, 6).map(m => (
                  <div key={m.id} className={`ma-rem ${m.kind}`}>
                    <span aria-hidden="true" className="ma-rem-ico">{m.kind === 'paiement' ? '💳' : m.kind === 'nonexp' ? '📭' : '🚚'}</span>
                    <div className="ma-rem-t"><b>{m.texte}</b><small>{m.sous}</small></div>
                    {m.kind === 'transit' && onPatch && <button type="button" className="ma-linkbtn" onClick={() => run('rem-' + m.id, () => patch([m.row.id], { recu: true }), 'Marqué comme reçu.')}>Marquer reçu</button>}
                    {commandeUrl(m.row, tld) && <a className="ma-linkbtn" href={commandeUrl(m.row, tld)!} target="_blank" rel="noopener noreferrer">Voir</a>}
                  </div>
                ))}
                {reminders.length > 6 && <div className="ma-meta">… et {reminders.length - 6} autre{reminders.length - 6 > 1 ? 's' : ''}</div>}
              </div>
            </section>
          )}

          {onSaveBudgets && <SpendingTracker rows={rows} rates={rates} budgets={budgets} onSaveBudgets={onSaveBudgets} />}

          {encheres.length > 0 && (
            <section>
              <h2 className="ma-h2">Enchères en cours</h2>
              <div className="ma-grid">
                {encheres.map(r => {
                  const lim = r.limite_perso ?? r.ma_mise_max
                  const limPct = lim && r.prix_actuel !== null ? r.prix_actuel / lim : null
                  const lbL = [r].filter(x => x.photo_url || x.photo_mini)
                  return (
                    <article key={r.id} className="ma-card src-eb">
                      <Photo r={r} onZoom={lbL.length ? () => openLb(lbL, 0) : undefined} />
                      <div className="ma-body">
                        <div className="ma-title"><SrcTag r={r} />{r.titre}</div>
                        <div className="ma-line">
                          <span className="da-num ma-price">{P(r.prix_actuel, r.devise).main}</span>{P(r.prix_actuel, r.devise).sub && <span className="ma-meta">{P(r.prix_actuel, r.devise).sub}</span>}
                          {r.en_tete === true && <span className="ma-tag ok">En tête</span>}
                          {r.en_tete === false && <span className="ma-tag ko">Surenchéri</span>}
                        </div>
                        <div className="ma-meta">
                          {r.ma_mise_max !== null && <>Ma mise max : {P(r.ma_mise_max, r.devise).main} ·</>}
                          {r.nb_encheres !== null && <>{r.nb_encheres} enchère{r.nb_encheres > 1 ? 's' : ''}</>}
                        </div>
                        {r.fin_at && <Clock fin={r.fin_at} now={now} />}
                        {limPct !== null && lim && (
                          <div className={`ma-lim${limPct >= 1 ? ' over' : limPct >= 0.9 ? ' warn' : ''}`}>
                            <div className="ma-timebar"><i className={limPct >= 1 ? 'r' : limPct >= 0.9 ? 'o' : 'b'} style={{ width: `${Math.min(100, limPct * 100)}%` }} /></div>
                            <div className="ma-meta">{Math.round(limPct * 100)} % de ta limite ({P(lim, r.devise).main}){limPct >= 0.9 && limPct < 1 ? ' · attention' : limPct >= 1 ? ' · limite atteinte' : ''}</div>
                          </div>
                        )}
                        {note$(r)}
                        <div className="ma-links">
                          {annonceUrl(r, tld) && <a href={annonceUrl(r, tld)!} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}
                          {onPatch && <InlineAmount label="Fixer ma limite (alerte à 90 %)" current={r.limite_perso ?? null} placeholder="Ex. 300" onSave={v => patch([r.id], { limite_perso: v })} />}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <div className="ma-sec-head">
              <h2 className="ma-h2" style={{ margin: 0 }}>Achats</h2>
              {achatsAll.length > 0 && (
                <div className="ma-toolbar">
                  <div className="ma-seg" role="group" aria-label="Affichage">
                    <button type="button" className={vue === 'cartes' ? 'on' : ''} aria-pressed={vue === 'cartes'} onClick={() => setVue('cartes')}>▦ Cartes</button>
                    <button type="button" className={vue === 'liste' ? 'on' : ''} aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>☰ Liste</button>
                  </div>
                  {(onCollection || onAddTags) && <button type="button" className={`ma-btn${selMode ? ' primary' : ' ghost'}`} style={{ padding: '7px 12px' }} onClick={() => (selMode ? leaveSel() : setSelMode(true))}>{selMode ? 'Terminer' : 'Sélectionner'}</button>}
                </div>
              )}
            </div>

            {achatsAll.length === 0 ? (
              <div className="ma-empty ma-empty-rich">
                <div className="ma-empty-ico" aria-hidden="true">📦</div>
                <b>Aucun achat pour l’instant</b>
                <p>{connected ? 'eBay ne donne que les 60 derniers jours à la première connexion : l’historique se construit ensuite au fil du temps. Tu peux aussi ajouter un achat Vinted.' : 'Connecte eBay pour importer tes achats automatiquement, ou ajoute un achat Vinted depuis une capture.'}</p>
                <div className="ma-actions" style={{ justifyContent: 'center' }}>
                  {!connected && <button className="ma-btn primary" onClick={onConnect}>Connecter eBay</button>}
                  {connected && <button className="ma-btn" disabled={busy !== null} onClick={onSync}>Actualiser eBay</button>}
                  {onAddVinted && <button className="ma-btn" onClick={onAddVinted}>+ Achat Vinted</button>}
                </div>
              </div>
            ) : (
              <>
                <div className="ma-filters">
                  {([['tout', 'Tout'], ['arecevoir', 'À recevoir'], ['apayer', 'À payer'], ['terminees', 'Terminées']] as const).map(([k, l]) => (
                    <button key={k} type="button" className={`ma-fchip${filtre === k ? ' on' : ''}`} aria-pressed={filtre === k} onClick={() => setFiltre(k)}>{l} · {counts[k]}</button>
                  ))}
                  <span className="ma-fsep" />
                  {(['all', 'ebay', 'vinted'] as const).map(k => (
                    <button key={k} type="button" className={`ma-fchip${srcF === k ? ' on' : ''}`} aria-pressed={srcF === k} onClick={() => setSrcF(k)}>{k === 'all' ? 'Toutes sources' : k === 'ebay' ? 'eBay' : 'Vinted'}</button>
                  ))}
                  <label className="ma-sort">Trier
                    <select value={tri} onChange={e => setTri(e.target.value as typeof tri)}>
                      <option value="date">Date (récent)</option><option value="prix">Prix décroissant</option><option value="vendeur">Vendeur</option>
                    </select>
                  </label>
                </div>
                {groups.length === 0 && <div className="ma-empty">Aucun achat ne correspond{q.trim() ? ` à « ${q} »` : ' à ces filtres'}.</div>}
                <div className={vue === 'liste' ? 'ma-list' : 'ma-grid'}>{groups.map(purchase)}</div>
              </>
            )}
          </section>

          {suivis.length > 0 && (
            <section>
              <h2 className="ma-h2">Articles suivis</h2>
              <div className="ma-grid">
                {suivis.map(r => {
                  const under = r.seuil_alerte != null && r.prix_actuel !== null && r.prix_actuel <= r.seuil_alerte
                  const lbL = [r].filter(x => x.photo_url || x.photo_mini)
                  return (
                    <article key={r.id} className="ma-card src-eb">
                      <Photo r={r} onZoom={lbL.length ? () => openLb(lbL, 0) : undefined} />
                      <div className="ma-body">
                        <div className="ma-title"><SrcTag r={r} />{r.titre}</div>
                        <div className="ma-line">
                          <span className="da-num ma-price">{P(r.prix_actuel, r.devise).main}</span>{P(r.prix_actuel, r.devise).sub && <span className="ma-meta">{P(r.prix_actuel, r.devise).sub}</span>}
                          {under && <span className="ma-tag ok">Sous ton seuil</span>}
                        </div>
                        {r.fin_at && <Clock fin={r.fin_at} now={now} />}
                        {note$(r)}
                        <div className="ma-links">
                          {annonceUrl(r, tld) && <a href={annonceUrl(r, tld)!} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}
                          {onPatch && <InlineAmount label="🔔 M’alerter sous un prix" current={r.seuil_alerte ?? null} placeholder="Ex. 250" onSave={v => patch([r.id], { seuil_alerte: v })} />}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="ma-h2">Journal d’activité</h2>
            <ActivityLog events={events} />
          </section>
        </>
      )}

      {selMode && (
        <div className="ma-bulk" role="region" aria-label="Actions groupées">
          <b>{selCount} sélectionné{selCount > 1 ? 's' : ''}</b>
          <button type="button" className="ma-linkbtn" onClick={() => setSel(new Set(groups.flatMap(g => g.map(r => r.id))))}>Tout sélectionner</button>
          {onAddTags && (
            <>
              <input className="ma-det-in" style={{ width: 130 }} value={bulkTag} maxLength={24} placeholder="# étiquette" aria-label="Étiquette à ajouter" onChange={e => setBulkTag(e.target.value)} />
              <button type="button" className="ma-btn" disabled={!selCount || !bulkTag.trim() || working === 'bulk-tag'} onClick={() => run('bulk-tag', () => onAddTags(selIds, [bulkTag]), 'Étiquette ajoutée.').then(() => setBulkTag(''))}>Étiqueter</button>
            </>
          )}
          {onCollection && <button type="button" className="ma-btn primary" disabled={!selCount || working === 'bulk-col'} onClick={() => run('bulk-col', () => onCollection(selIds.filter(id => !rows.find(r => r.id === id)?.carte_id)), 'Cartes ajoutées à ta collection.')}>→ Ma collection</button>}
          <button type="button" className="ma-btn ghost" onClick={leaveSel}>Annuler</button>
        </div>
      )}

      {lb && <Lightbox items={lb.items} start={lb.start} onClose={() => setLb(null)} />}
      {prefsOpen && prefs && onSavePrefs && <PrefsModal prefs={prefs} onSave={onSavePrefs} onClose={() => setPrefsOpen(false)} />}

      {confirmOut && (
        <div className="ma-modal" role="dialog" aria-modal="true" onClick={onCancelDisconnect}>
          <div className="ma-modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>Déconnecter eBay ?</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text2)', lineHeight: 1.5 }}>Memorabilius n’aura plus accès à ton compte eBay. Tu peux garder l’historique de tes achats ou tout effacer.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="ma-btn" disabled={busy !== null} onClick={() => onDisconnect(false)}>Déconnecter, garder l’historique</button>
              <button className="ma-btn danger" disabled={busy !== null} onClick={() => onDisconnect(true)}>Tout effacer</button>
              <button className="ma-btn ghost" onClick={onCancelDisconnect}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.ma-wrap { max-width: 980px; margin: 36px auto 60px; padding: 0 16px; box-sizing: border-box; }
.ma-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
.ma-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.ma-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ma-btn { border: 3px solid var(--text); background: var(--bg2); color: var(--text); padding: 9px 16px; font: 800 12px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; border-radius: 0; }
.ma-btn:disabled { opacity: .55; cursor: default; }
.ma-btn.primary { background: #2f6bff; border-color: #2f6bff; color: #fff; padding: 13px 22px; }
.ma-btn.ghost { border-color: var(--border); color: var(--text2); }
.ma-btn.danger { border-color: #d6293e; color: #d6293e; }
.ma-alert { border-left: 5px solid #d6293e; background: var(--bg2); padding: 12px 14px; margin-bottom: 16px; font-size: 14px; }
.ma-alert.ok { border-left-color: #1e9e57; }
.ma-hero { border: 3px solid var(--border); background: var(--bg2); padding: 24px; }
.ma-points { margin: 18px 0 0; padding-left: 18px; color: var(--text2); font-size: 13px; line-height: 1.7; }
.ma-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 26px; }
.ma-stats > div { border: 3px solid var(--border); background: var(--bg2); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ma-stats .da-num { font-size: 26px; line-height: 1.1; overflow-wrap: anywhere; }
.ma-stats small { color: var(--text2); font-size: 12px; }
.ma-h2 { font-size: 24px; margin: 28px 0 12px; font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ma-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 12px; }
.ma-list { display: flex; flex-direction: column; gap: 8px; }
.ma-card { display: flex; flex-wrap: wrap; gap: 14px; border: 3px solid var(--border); background: var(--bg2); padding: 12px; min-width: 0; position: relative; }
.ma-card.src-eb, .ma-row.src-eb { border-left: 6px solid #2f6bff; } .ma-card.src-vi, .ma-row.src-vi { border-left: 6px solid #09b1ba; }
.ma-photo { width: 110px; height: 110px; flex-shrink: 0; object-fit: contain; background: var(--bg3); }
.ma-nophoto { display: flex; align-items: center; justify-content: center; font-size: 34px; }
.ma-body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.ma-title { font-weight: 700; font-size: 14px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ma-line { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.ma-price { font-size: 24px; }
.ma-meta { color: var(--text2); font-size: 12px; }
.ma-tag { font: 800 11px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; padding: 3px 8px; color: #fff; }
.ma-tag.ok { background: #1e9e57; } .ma-tag.ko { background: #d6293e; }
.ma-clock { font-size: 13px; font-weight: 700; color: var(--text2); }
.ma-clock.urgent { color: #d6293e; }
.ma-steps { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
.ma-step { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text3); }
.ma-step i { width: 10px; height: 10px; border: 2px solid var(--text3); flex-shrink: 0; }
.ma-step.done { color: var(--text); font-weight: 700; } .ma-step.done i { background: #1e9e57; border-color: #1e9e57; }
.ma-step em { font-style: normal; font-weight: 400; color: var(--text2); }
.ma-links { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-top: auto; padding-top: 4px; }
.ma-links a { font: 800 12px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #2f6bff; text-decoration: none; }
.ma-links a:hover { text-decoration: underline; }
.ma-mosaic { width: 110px; height: 110px; flex-shrink: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: var(--bg3); }
.ma-mosaic .ma-photo { width: 100%; height: 100%; }
.ma-items { margin: 2px 0 2px; padding-left: 16px; font-size: 12px; color: var(--text2); line-height: 1.5; max-height: 110px; overflow-y: auto; }
.ma-items a { color: inherit; text-decoration: none; } .ma-items a:hover { text-decoration: underline; }
.ma-del { background: none; border: 0; padding: 0; font: 800 12px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: var(--text3); cursor: pointer; margin-left: auto; }
.ma-del:hover { color: #d6293e; }
.ma-src { display: inline-block; font: 800 10px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 2px 6px; margin-right: 7px; vertical-align: 1px; color: #fff; }
.ma-src.eb { background: #2f6bff; } .ma-src.vi { background: #09b1ba; }
.ma-search { width: 100%; box-sizing: border-box; margin: 0 0 12px; padding: 11px 14px; border: 3px solid var(--border); background: var(--input-bg); color: var(--text); font: 600 14px system-ui, sans-serif; border-radius: 0; }
.ma-search:focus { outline: none; border-color: #2f6bff; }
.ma-empty { border: 3px dashed var(--border); padding: 22px; color: var(--text2); font-size: 14px; line-height: 1.5; }
.ma-empty-rich { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ma-empty-rich p { margin: 0 0 10px; max-width: 480px; }
.ma-empty-rich b { color: var(--text); font-size: 18px; }
.ma-empty-ico { font-size: 44px; line-height: 1; }
.ma-modal { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
.ma-modal-box { background: var(--bg2); border: 3px solid var(--border); padding: 22px; max-width: 440px; width: 100%; max-height: 92vh; overflow-y: auto; }
.ma-sec-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin: 28px 0 12px; }
.ma-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ma-seg { display: inline-flex; border: 3px solid var(--border); }
.ma-seg button { background: transparent; border: 0; color: var(--text2); font: 800 11px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 7px 12px; cursor: pointer; }
.ma-seg button.on { background: #2f6bff; color: #fff; }
.ma-filters { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.ma-fchip { border: 3px solid var(--border); background: var(--bg2); color: var(--text); font: 800 11px system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; padding: 6px 11px; cursor: pointer; border-radius: 0; }
.ma-fchip.on { background: #2f6bff; border-color: #2f6bff; color: #fff; }
.ma-fsep { width: 1px; align-self: stretch; background: var(--border); margin: 0 4px; }
.ma-sort { margin-left: auto; font: 800 11px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: var(--text2); display: flex; align-items: center; gap: 6px; }
.ma-sort select { border: 3px solid var(--border); background: var(--input-bg); color: var(--text); font: 700 12px system-ui, sans-serif; padding: 5px 8px; border-radius: 0; text-transform: none; letter-spacing: 0; }
.ma-row { border: 3px solid var(--border); background: var(--bg2); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; position: relative; }
.ma-row-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ma-row-photo { position: relative; flex-shrink: 0; }
.ma-row-photo .ma-photo { width: 56px; height: 56px; font-size: 22px; }
.ma-row-n { position: absolute; right: -4px; bottom: -4px; background: #2f6bff; color: #fff; font: 800 10px system-ui, sans-serif; padding: 1px 5px; }
.ma-rbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ma-rtitle { font-weight: 700; font-size: 13.5px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ma-rmeta { font-size: 12px; color: var(--text2); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ma-rprice { font: 400 20px 'Surfquest', Impact, 'Arial Narrow', sans-serif; text-transform: none; white-space: nowrap; }
.ma-ractions { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; border-top: 1px solid var(--border); padding-top: 6px; }
.ma-ractions a { font: 800 12px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #2f6bff; text-decoration: none; }
.ma-gain { font-size: 12.5px; font-weight: 800; } .ma-gain.up { color: #1e9e57; } .ma-gain.down { color: #d6293e; }
.ma-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.ma-tags .ma-chip { cursor: default; }
.ma-note { font-size: 12px; padding: 4px 8px; border-left: 4px solid var(--border); background: var(--bg3); color: var(--text2); }
.ma-note.dup { border-left-color: #c98a12; } .ma-note.wish { border-left-color: #d6293e; }
.ma-note a { color: #2f6bff; font-weight: 700; }
.ma-notetxt { white-space: pre-wrap; overflow-wrap: anywhere; }
.ma-inline { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ma-lim .ma-timebar { margin-bottom: 2px; }
.ma-remind { display: flex; flex-direction: column; gap: 8px; }
.ma-rem { display: flex; align-items: center; gap: 12px; border: 3px solid var(--border); border-left-width: 6px; background: var(--bg2); padding: 10px 12px; }
.ma-rem.paiement { border-left-color: #c98a12; } .ma-rem.nonexp { border-left-color: #d6293e; } .ma-rem.transit { border-left-color: #2f6bff; }
.ma-rem-ico { font-size: 22px; } .ma-rem-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 14px; }
.ma-rem-t small { color: var(--text2); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ma-rem a.ma-linkbtn { text-decoration: none; }
.ma-sel { width: 22px; height: 22px; accent-color: #2f6bff; flex-shrink: 0; cursor: pointer; }
.ma-card > .ma-sel { position: absolute; top: 8px; right: 8px; background: var(--bg2); }
.ma-bulk { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 900; background: var(--bg2); border: 3px solid #2f6bff; padding: 10px 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; max-width: calc(100vw - 24px); box-shadow: 0 8px 30px rgba(0,0,0,.5); }
@media (max-width: 520px) {
  .ma-mosaic { width: 84px; height: 84px; }
  .ma-photo { width: 84px; height: 84px; } .ma-stats .da-num { font-size: 20px; } .ma-card { gap: 10px; }
  .ma-row-photo .ma-photo { width: 52px; height: 52px; }
  .ma-ractions { justify-content: space-between; gap: 8px; }
  .ma-sort { margin-left: 0; }
}
`
