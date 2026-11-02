'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import { useLang } from '@/lib/LangContext'
import { takeStagedShare } from '@/lib/shareBridge'
import MesAchatsView, { type Conn, type Row, type Rates } from '@/components/MesAchatsView'
import type { Budgets } from '@/components/SpendingTracker'
import { NO_BUDGETS } from '@/components/SpendingTracker'
import type { Compare } from '@/components/AchatExtras'
import VintedAddModal, { type VintedInitial } from '@/components/VintedAddModal'
import { looksLikeOrderText, type CarteLite } from '@/lib/achatsUi'
import { DEFAULT_PREFS, normPrefs, type AlertPrefs } from '@/lib/achatsAlertPrefs'

// Site eBay vers lequel pointent les liens : celui de la langue du membre (ebay.fr pour un francophone).
const EBAY_TLD: Record<string, string> = { fr: 'fr', de: 'de', es: 'es', it: 'it', en: 'com' }
const VINTED_RE = /https:\/\/(?:www\.)?vinted\.[a-z.]+\/items\/\d+[^\s"'<>]*/i
const BUDGET_LS = 'memorabilius-budget-achats'

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const toBudgets = (d: Record<string, unknown> | null): Budgets => ({
  mensuel: num(d?.mensuel), annuel: num(d?.annuel), budget_ebay: num(d?.budget_ebay), budget_vinted: num(d?.budget_vinted),
  objectif_nom: typeof d?.objectif_nom === 'string' && d.objectif_nom ? d.objectif_nom : null, objectif_cible: num(d?.objectif_cible),
  objectif_epargne: num(d?.objectif_epargne) ?? 0, objectif_mensuel: num(d?.objectif_mensuel),
})
const isEmpty = (b: Budgets) => b.mensuel === null && b.annuel === null && b.budget_ebay === null && b.budget_vinted === null
  && !b.objectif_nom && b.objectif_cible === null && b.objectif_epargne === 0 && b.objectif_mensuel === null

// « Mes achats » : achats, enchères et articles suivis du membre (eBay importé automatiquement, Vinted ajouté depuis une
// capture, un lien ou un e-mail), avec le tracker de dépenses, les budgets et l'objectif d'épargne. L'affichage est dans
// MesAchatsView ; ici : session, chargement, synchronisation, connexion / déconnexion, ajout Vinted, données perso, budgets, alertes.
export default function MesAchats() {
  const router = useRouter()
  const { lang } = useLang()
  const [rates, setRates] = useState<Rates>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | undefined>()
  const [conn, setConn] = useState<Conn | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [budgets, setBudgets] = useState<Budgets>(NO_BUDGETS)
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS)
  const [cartes, setCartes] = useState<CarteLite[]>([])
  const [wishlist, setWishlist] = useState<CarteLite[]>([])
  const [notifs, setNotifs] = useState<Array<{ message: string; created_at: string }>>([])
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [confirmOut, setConfirmOut] = useState(false)
  const [vintedOpen, setVintedOpen] = useState(false)
  const [vintedInitial, setVintedInitial] = useState<VintedInitial | null>(null)

  const load = useCallback(async (uid: string) => {
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('ebay_connexions').select('statut, ebay_user_id, derniere_synchro_at, derniere_erreur').eq('user_id', uid).maybeSingle(),
      supabase.from('achats_membre').select('*').eq('user_id', uid).in('source', ['ebay', 'vinted']).limit(1000),
    ])
    setConn((c as Conn) || null)
    setRows((r as Row[]) || [])
  }, [])

  const loadBudgets = useCallback(async (uid: string) => {
    let local: Budgets | null = null
    try {
      const raw = localStorage.getItem(BUDGET_LS)
      if (raw) local = raw.trim().startsWith('{') ? toBudgets(JSON.parse(raw)) : { ...NO_BUDGETS, mensuel: num(raw) }
    } catch { /* sans stockage */ }
    const { data, error } = await supabase.from('budgets_achats').select('*').eq('user_id', uid).maybeSingle()
    if (error) { if (local) setBudgets(local); return }
    // migration 20261104 pas encore appliquée : les nouveaux budgets sont gardés dans le navigateur
    if (data && !('annuel' in data) && local) { setBudgets({ ...local, mensuel: num(data.mensuel) ?? local.mensuel }); return }
    setBudgets(toBudgets(data as Record<string, unknown> | null))
  }, [])

  const saveBudgets = async (b: Budgets) => {
    setBudgets(b)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    let error = null as { message: string } | null
    if (isEmpty(b)) ({ error } = await supabase.from('budgets_achats').delete().eq('user_id', session.user.id))
    else ({ error } = await supabase.from('budgets_achats').upsert({ user_id: session.user.id, ...b, updated_at: new Date().toISOString() }))
    try {
      if (error) localStorage.setItem(BUDGET_LS, JSON.stringify(b)) // repli : tables pas à jour, on garde sur cet appareil
      else localStorage.removeItem(BUDGET_LS)
    } catch { /* sans stockage */ }
  }

  // Données qui enrichissent la page sans la bloquer : alertes reçues, préférences, collection (doublons), wishlist.
  const loadExtras = useCallback(async (uid: string) => {
    supabase.from('notifications').select('message, created_at').eq('user_id', uid).eq('type', 'ebay').order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => setNotifs((data as Array<{ message: string; created_at: string }>) || []))
    supabase.from('alertes_achats_prefs').select('prefs').eq('user_id', uid).maybeSingle()
      .then(({ data }) => { if (data) setPrefs(normPrefs(data.prefs)) })
    supabase.from('wishlist').select('id, nom, collection, variation').eq('user_id', uid).limit(1000)
      .then(({ data }) => setWishlist((data as CarteLite[]) || []))
    const all: CarteLite[] = []
    for (let from = 0; from < 6000; from += 1000) {
      const { data, error } = await supabase.from('cartes_manuelles').select('id, nom, annee, collection, variation').eq('user_id', uid).range(from, from + 999)
      if (error || !data) break
      all.push(...(data as CarteLite[]))
      if (data.length < 1000) break
    }
    setCartes(all)
  }, [])

  const sync = useCallback(async (tok: string, uid: string, force: boolean) => {
    setBusy('sync'); setMsg(null)
    try {
      const res = await fetch('/api/ebay/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ force }) })
      const json = await res.json().catch(() => ({}))
      if (json && json.ok === false && !json.skipped && json.error !== 'Compte eBay non connecté.') setMsg(json.error || 'Actualisation impossible.')
      await load(uid)
    } finally { setBusy(null) }
  }, [load])

  useEffect(() => {
    (async () => {
      try {
        await withTimeout((async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { router.replace('/connexion'); return }
          setToken(session.access_token)
          setUserId(session.user.id)
          await Promise.all([load(session.user.id), loadBudgets(session.user.id)])
          setLoading(false)
          loadExtras(session.user.id)

          // partage reçu (lien d'annonce Vinted, capture de la commande ou e-mail de confirmation) : ouverture du formulaire
          const share = new URLSearchParams(window.location.search).get('partage') ? takeStagedShare() : null
          if (share && (share.imagePath || VINTED_RE.test(share.text || '') || looksLikeOrderText(share.text))) {
            setVintedInitial({
              url: (share.text || '').match(VINTED_RE)?.[0], imageUrl: share.imagePath,
              text: !share.imagePath && !VINTED_RE.test(share.text || '') && looksLikeOrderText(share.text) ? share.text : undefined,
            })
            setVintedOpen(true)
          }

          // ouverture de la page : mise à jour discrète si eBay est relié (le serveur limite la fréquence)
          const { data: c } = await supabase.from('ebay_connexions').select('statut').eq('user_id', session.user.id).maybeSingle()
          if (c?.statut === 'connecte') await sync(session.access_token, session.user.id, false)
        })(), 20000, undefined)
      } finally { setLoading(false) }
    })()
  }, [router, load, loadBudgets, loadExtras, sync])

  useEffect(() => {
    fetch('/api/ebay/taux').then(r => r.json()).then(j => setRates(j?.rates || null)).catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const connect = async () => {
    if (!token) return
    setBusy('connect'); setMsg(null)
    try {
      const res = await fetch('/api/ebay/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) { setMsg(json.error || 'Impossible de contacter eBay.'); setBusy(null); return }
      window.location.href = json.url
    } catch { setMsg('Impossible de contacter eBay.'); setBusy(null) }
  }

  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) sync(session.access_token, session.user.id, true)
  }

  const reload = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await load(session.user.id)
  }

  const deleteVinted = async (id: string) => {
    if (!token) return
    await fetch('/api/achats/vinted', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) })
    await reload()
  }

  // appel d'une route /api/achats/* : renvoie un message d'erreur, ou null si tout s'est bien passé
  const call = async (path: string, body: unknown): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 'Session expirée : reconnecte-toi.'
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      await reload()
      return res.ok ? null : (json.error || 'Action impossible.')
    } catch { return 'Action impossible pour le moment.' }
  }
  const patchAchats = (ids: string[], patch: Record<string, unknown>) => call('/api/achats/perso', { ids, patch })
  const addTags = (ids: string[], tags: string[]) => call('/api/achats/perso', { ids, addTags: tags })
  const toCollection = (ids: string[]) => call('/api/achats/collection', { ids })

  // « Comparer au marché » : médiane des ventes eBay récentes (ou des annonces en cours) pour une annonce (recherche libre sur le titre)
  const compare = async (titre: string): Promise<Compare | null> => {
    try {
      const q = titre.replace(/[^\p{L}\p{N}\s#/-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
      const res = await fetch(`/api/ebay-sold?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      // la route renvoie la médiane des ventes, ou à défaut celle des annonces en cours (les ventes conclues sont souvent indisponibles)
      const source = json.priceSource === 'sold' ? 'sold' : json.priceSource === 'active' ? 'active' : null
      const pool = source === 'sold' ? json.sold : source === 'active' ? json.active : []
      if (!source || !pool?.length || !(json.median > 0)) return null
      return { median: Math.round(json.median * 100) / 100, n: pool.length, source }
    } catch { return null }
  }

  const savePrefs = async (p: AlertPrefs) => {
    setPrefs(p)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { error } = await supabase.from('alertes_achats_prefs').upsert({ user_id: session.user.id, prefs: p, updated_at: new Date().toISOString() })
    if (error) setMsg('Réglages d’alertes non enregistrés (migration 20261104 à appliquer).')
  }

  const disconnect = async (deleteData: boolean) => {
    if (!token) return
    setBusy('disconnect')
    try {
      await fetch('/api/ebay/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ deleteData }) })
      await reload()
      setConfirmOut(false)
    } finally { setBusy(null) }
  }

  return (
    <>
      <MesAchatsView
        loading={loading}
        conn={conn} rows={rows} busy={busy} msg={msg} now={now} confirmOut={confirmOut} tld={EBAY_TLD[lang] || 'fr'} rates={rates}
        budgets={budgets} onSaveBudgets={saveBudgets} userId={userId} cartes={cartes} wishlist={wishlist} notifs={notifs}
        prefs={prefs} onSavePrefs={savePrefs} onPatch={patchAchats} onAddTags={addTags} onCollection={toCollection} onCompare={compare}
        onAddVinted={() => { setVintedInitial(null); setVintedOpen(true) }} onDeleteVinted={deleteVinted}
        onConnect={connect} onSync={refresh} onAskDisconnect={() => setConfirmOut(true)}
        onDisconnect={disconnect} onCancelDisconnect={() => setConfirmOut(false)}
      />
      {vintedOpen && token && (
        <VintedAddModal token={token} initial={vintedInitial} onClose={() => setVintedOpen(false)} onSaved={reload} />
      )}
    </>
  )
}
