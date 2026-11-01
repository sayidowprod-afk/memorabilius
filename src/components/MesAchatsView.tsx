'use client'
import { useState } from 'react'
import SpendingTracker from '@/components/SpendingTracker'

// Affichage de « Mes achats » (sans logique réseau) : utilisé par /mes-achats et par la page de démonstration locale.
export type Conn = { statut: 'en_attente' | 'connecte' | 'expire'; ebay_user_id: string | null; derniere_synchro_at: string | null; derniere_erreur: string | null }
export type Row = {
  id: string; type: 'achat' | 'enchere' | 'suivi'; source?: 'ebay' | 'vinted'; item_id: string | null; transaction_id: string | null; titre: string | null; photo_url: string | null; photo_mini: string | null
  vendeur: string | null; vendeur_note: number | null; devise: string | null; prix: number | null; frais_port: number | null
  total_paye?: number | null; autres_frais?: number | null
  prix_actuel: number | null; ma_mise_max: number | null; en_tete: boolean | null; nb_encheres: number | null
  fin_at: string | null; achete_at: string | null; paye_at: string | null; expedie_at: string | null
  lien: string | null; lien_commande: string | null
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
function left(iso: string | null, now: number): { text: string; urgent: boolean; over: boolean } {
  if (!iso) return { text: '', urgent: false, over: false }
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return { text: 'Terminée', urgent: false, over: true }
  const min = Math.floor(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24)
  const text = d >= 1 ? `${d} j ${h % 24} h` : h >= 1 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${Math.max(1, min)} min`
  return { text, urgent: ms < 3600000, over: false }
}

function Photo({ r }: { r: Row }) {
  const [src, setSrc] = useState(r.photo_url || r.photo_mini)
  if (!src) return <div className="ma-photo ma-nophoto" aria-hidden="true">🃏</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ma-photo" src={src} alt={r.titre || ''} loading="lazy" onError={() => { if (src !== r.photo_mini && r.photo_mini) setSrc(r.photo_mini); else setSrc(null) }} />
}

// Étiquette de provenance : eBay ou Vinted
function SrcTag({ r }: { r: Row }) {
  const v = r.source === 'vinted'
  return <span className={`ma-src ${v ? 'vi' : 'eb'}`}>{v ? 'Vinted' : 'eBay'}</span>
}

function Step({ done, label, sub }: { done: boolean; label: string; sub?: string }) {
  return (
    <div className={`ma-step${done ? ' done' : ''}`}>
      <i />
      <span>{label}{sub ? <em> · {sub}</em> : null}</span>
    </div>
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
  budget?: number | null
  onSaveBudget?: (v: number | null) => void
  onAddVinted?: () => void
  onDeleteVinted?: (id: string) => void
}

export default function MesAchatsView({ conn, rows, busy, msg, now, confirmOut, onConnect, onSync, onAskDisconnect, onDisconnect, onCancelDisconnect, tld = 'fr', rates = null, budget = null, onSaveBudget, onAddVinted, onDeleteVinted }: MesAchatsViewProps) {
  const connected = conn?.statut === 'connecte'
  const hasData = connected || rows.length > 0
  const P = (v: number | null, d: string | null) => fmt(v, d, rates)
  const [qAchats, setQAchats] = useState('')
  const [qSuivis, setQSuivis] = useState('')
  const encheres = rows.filter(r => r.type === 'enchere').sort((a, b) => (a.fin_at || '9').localeCompare(b.fin_at || '9'))
  const achats = rows.filter(r => r.type === 'achat').sort((a, b) => (b.achete_at || '').localeCompare(a.achete_at || ''))
  const suivis = rows.filter(r => r.type === 'suivi').sort((a, b) => (a.fin_at || '9').localeCompare(b.fin_at || '9'))

  // recherche : titre ou vendeur, sans tenir compte des accents ni des majuscules ; tous les mots doivent être présents
  const norm = (s: string | null) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const matches = (r: Row, q: string) => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    if (!words.length) return true
    const hay = norm(`${r.titre || ''} ${r.vendeur || ''}`)
    return words.every(w => hay.includes(w))
  }
  const achatsShown = achats.filter(r => matches(r, qAchats))
  const suivisShown = suivis.filter(r => matches(r, qSuivis))

  const month = new Date(now).toISOString().slice(0, 7)
  const spent = achats.filter(a => (a.achete_at || '').startsWith(month)).reduce<Record<string, number>>((acc, a) => {
    const total = (a.prix || 0) + (a.frais_port || 0)
    const e = toEur(total, a.devise, rates)
    const d = e === null ? (a.devise || 'EUR') : 'EUR'
    acc[d] = (acc[d] || 0) + (e === null ? total : e)
    return acc
  }, {})
  const spentLabel = Object.entries(spent).map(([d, v]) => money(v, d)).join(' + ') || money(0, 'EUR')

  return (
    <div className="ma-wrap">
      <style>{CSS}</style>
      <div className="ma-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 38 }}>Mes achats</h1>
          {connected && <div className="ma-sub">eBay · {conn?.ebay_user_id || 'compte relié'} · mis à jour {ago(conn?.derniere_synchro_at || null, now)}</div>}
        </div>
        <div className="ma-actions">
          {onAddVinted && <button className="ma-btn" onClick={onAddVinted}>+ Achat Vinted</button>}
          {connected && <button className="ma-btn" disabled={busy !== null} onClick={onSync}>{busy === 'sync' ? 'Actualisation…' : 'Actualiser eBay'}</button>}
          {connected && <button className="ma-btn ghost" disabled={busy !== null} onClick={onAskDisconnect}>Déconnecter eBay</button>}
        </div>
      </div>

      {msg && <div className="ma-alert">{msg}</div>}
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

      {hasData && (
        <>
          <div className="ma-stats">
            <div><span className="da-num">{encheres.length}</span><small>enchère{encheres.length > 1 ? 's' : ''} en cours</small></div>
            <div><span className="da-num">{achats.length}</span><small>achat{achats.length > 1 ? 's' : ''} importé{achats.length > 1 ? 's' : ''}</small></div>
            <div><span className="da-num">{spentLabel}</span><small>dépensés ce mois-ci</small></div>
          </div>

          {onSaveBudget && <SpendingTracker rows={rows} rates={rates} budget={budget} onSaveBudget={onSaveBudget} />}

          {encheres.length > 0 && (
            <section>
              <h2 className="ma-h2">Enchères en cours</h2>
              <div className="ma-grid">
                {encheres.map(r => {
                  const t = left(r.fin_at, now)
                  return (
                    <article key={r.id} className="ma-card">
                      <Photo r={r} />
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
                        <div className={`ma-clock${t.urgent ? ' urgent' : ''}`}>⏱ {t.over ? 'Terminée — résultat à la prochaine actualisation' : `Fin dans ${t.text}`}</div>
                        <div className="ma-links">{annonceUrl(r, tld) && <a href={annonceUrl(r, tld)!} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}</div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="ma-h2">Achats</h2>
            {achats.length === 0 ? (
              <div className="ma-empty">Aucun achat pour l’instant. eBay ne donne que les 60 derniers jours à la première connexion : l’historique se construit ensuite au fil du temps.</div>
            ) : (
              <>
              <input className="ma-search" type="search" value={qAchats} onChange={e => setQAchats(e.target.value)} placeholder="Rechercher un achat (carte, joueur, vendeur…)" aria-label="Rechercher dans mes achats" />
              {achatsShown.length === 0 && <div className="ma-empty">Aucun achat ne correspond à « {qAchats} ».</div>}
              <div className="ma-grid">
                {achatsShown.map(r => (
                  <article key={r.id} className="ma-card">
                    <Photo r={r} />
                    <div className="ma-body">
                      <div className="ma-title"><SrcTag r={r} />{r.titre}</div>
                      <div className="ma-line">
                        <span className="da-num ma-price">{P(r.prix, r.devise).main}</span>
                        {P(r.prix, r.devise).sub && <span className="ma-meta">{P(r.prix, r.devise).sub}</span>}
                        {r.frais_port !== null && r.frais_port > 0 && <span className="ma-meta">+ {P(r.frais_port, r.devise).main} de port</span>}
                      </div>
                      <div className="ma-meta">{r.vendeur ? <>Vendeur : {r.vendeur}{r.vendeur_note !== null ? ` (${r.vendeur_note.toLocaleString('fr-FR')})` : ''}</> : null}{r.achete_at ? ` · acheté le ${day(r.achete_at)}` : ''}</div>
                      {r.autres_frais != null && r.autres_frais > 0 && (
                        <div className="ma-meta">dont douane / taxes / frais : {P(r.autres_frais, r.devise).main}</div>
                      )}
                      {r.total_paye != null && r.total_paye > 0 && (
                        <div className="ma-meta"><b>Total payé : {P(r.total_paye, r.devise).main}</b></div>
                      )}
                      <div className="ma-steps">
                        <Step done={!!r.paye_at} label="Payé" sub={day(r.paye_at)} />
                        <Step done={!!r.expedie_at} label={r.expedie_at ? 'Expédié' : r.paye_at ? 'En attente d’expédition' : 'Expédition'} sub={day(r.expedie_at)} />
                      </div>
                      <div className="ma-links">
                        {annonceUrl(r, tld) && <a href={annonceUrl(r, tld)!} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}
                        {commandeUrl(r, tld) && (r.expedie_at || r.paye_at) && <a href={commandeUrl(r, tld)!} target="_blank" rel="noopener noreferrer">Suivre le colis</a>}
                        {r.source === 'vinted' && onDeleteVinted && <button className="ma-del" onClick={() => { if (window.confirm('Supprimer cet achat Vinted ?')) onDeleteVinted(r.id) }}>Supprimer</button>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              </>
            )}
          </section>

          {suivis.length > 0 && (
            <section>
              <h2 className="ma-h2">Articles suivis</h2>
              <input className="ma-search" type="search" value={qSuivis} onChange={e => setQSuivis(e.target.value)} placeholder="Rechercher un article suivi (carte, joueur…)" aria-label="Rechercher dans mes articles suivis" />
              {suivisShown.length === 0 && <div className="ma-empty">Aucun article suivi ne correspond à « {qSuivis} ».</div>}
              <div className="ma-grid">
                {suivisShown.map(r => {
                  const t = left(r.fin_at, now)
                  return (
                    <article key={r.id} className="ma-card">
                      <Photo r={r} />
                      <div className="ma-body">
                        <div className="ma-title"><SrcTag r={r} />{r.titre}</div>
                        <div className="ma-line"><span className="da-num ma-price">{P(r.prix_actuel, r.devise).main}</span>{P(r.prix_actuel, r.devise).sub && <span className="ma-meta">{P(r.prix_actuel, r.devise).sub}</span>}</div>
                        {r.fin_at && <div className={`ma-clock${t.urgent ? ' urgent' : ''}`}>⏱ {t.over ? 'Terminée' : `Fin dans ${t.text}`}</div>}
                        <div className="ma-links">{annonceUrl(r, tld) && <a href={annonceUrl(r, tld)!} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}</div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

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
.ma-hero { border: 3px solid var(--border); background: var(--bg2); padding: 24px; }
.ma-points { margin: 18px 0 0; padding-left: 18px; color: var(--text2); font-size: 13px; line-height: 1.7; }
.ma-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 26px; }
.ma-stats > div { border: 3px solid var(--border); background: var(--bg2); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ma-stats .da-num { font-size: 26px; line-height: 1.1; overflow-wrap: anywhere; }
.ma-stats small { color: var(--text2); font-size: 12px; }
.ma-h2 { font-size: 24px; margin: 28px 0 12px; font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ma-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 12px; }
.ma-card { display: flex; gap: 14px; border: 3px solid var(--border); background: var(--bg2); padding: 12px; min-width: 0; }
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
.ma-links { display: flex; gap: 14px; flex-wrap: wrap; margin-top: auto; padding-top: 4px; }
.ma-links a { font: 800 12px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: #2f6bff; text-decoration: none; }
.ma-links a:hover { text-decoration: underline; }
.ma-del { background: none; border: 0; padding: 0; font: 800 12px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: var(--text3); cursor: pointer; margin-left: auto; }
.ma-del:hover { color: #d6293e; }
.ma-src { display: inline-block; font: 800 10px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 2px 6px; margin-right: 7px; vertical-align: 1px; color: #fff; }
.ma-src.eb { background: #2f6bff; } .ma-src.vi { background: #09b1ba; }
.ma-search { width: 100%; box-sizing: border-box; margin: 0 0 12px; padding: 11px 14px; border: 3px solid var(--border); background: var(--input-bg); color: var(--text); font: 600 14px system-ui, sans-serif; border-radius: 0; }
.ma-search:focus { outline: none; border-color: #2f6bff; }
.ma-empty { border: 3px dashed var(--border); padding: 22px; color: var(--text2); font-size: 14px; line-height: 1.5; }
.ma-modal { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
.ma-modal-box { background: var(--bg2); border: 3px solid var(--border); padding: 22px; max-width: 440px; width: 100%; }
@media (max-width: 520px) { .ma-photo { width: 84px; height: 84px; } .ma-stats .da-num { font-size: 20px; } .ma-card { gap: 10px; } }
`
