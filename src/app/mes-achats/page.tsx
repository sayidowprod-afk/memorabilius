'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import SkeletonBlock from '@/components/SkeletonBlock'
import { useLang } from '@/lib/LangContext'
import { takeStagedShare } from '@/lib/shareBridge'
import MesAchatsView, { type Conn, type Row, type Rates } from '@/components/MesAchatsView'
import VintedAddModal, { type VintedInitial } from '@/components/VintedAddModal'

// Site eBay vers lequel pointent les liens : celui de la langue du membre (ebay.fr pour un francophone).
const EBAY_TLD: Record<string, string> = { fr: 'fr', de: 'de', es: 'es', it: 'it', en: 'com' }
const VINTED_RE = /https:\/\/(?:www\.)?vinted\.[a-z.]+\/items\/\d+[^\s"'<>]*/i
const BUDGET_LS = 'memorabilius-budget-achats'

// « Mes achats » : achats, enchères et articles suivis du membre (eBay importé automatiquement, Vinted ajouté depuis une
// capture ou un lien), avec le tracker de dépenses et le budget mensuel. L'affichage est dans MesAchatsView ; ici : session,
// chargement, synchronisation, connexion / déconnexion, ajout Vinted, budget.
export default function MesAchats() {
  const router = useRouter()
  const { lang } = useLang()
  const [rates, setRates] = useState<Rates>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [conn, setConn] = useState<Conn | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [budget, setBudget] = useState<number | null>(null)
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

  const loadBudget = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('budgets_achats').select('mensuel').eq('user_id', uid).maybeSingle()
    if (!error) { setBudget(data ? Number(data.mensuel) : null); return }
    // table pas encore créée : repli sur le navigateur
    try { const v = localStorage.getItem(BUDGET_LS); setBudget(v ? Number(v) : null) } catch { /* sans stockage */ }
  }, [])

  const saveBudget = async (v: number | null) => {
    setBudget(v)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    let error = null as { message: string } | null
    if (v === null) ({ error } = await supabase.from('budgets_achats').delete().eq('user_id', session.user.id))
    else ({ error } = await supabase.from('budgets_achats').upsert({ user_id: session.user.id, mensuel: v, updated_at: new Date().toISOString() }))
    if (error) { try { v === null ? localStorage.removeItem(BUDGET_LS) : localStorage.setItem(BUDGET_LS, String(v)) } catch { /* sans stockage */ } }
  }

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
          await Promise.all([load(session.user.id), loadBudget(session.user.id)])
          setLoading(false)

          // partage reçu depuis l'appli Vinted (lien d'annonce et/ou capture de la commande) : ouverture du formulaire
          const share = new URLSearchParams(window.location.search).get('partage') ? takeStagedShare() : null
          if (share && (share.imagePath || VINTED_RE.test(share.text || ''))) {
            setVintedInitial({ url: (share.text || '').match(VINTED_RE)?.[0], imageUrl: share.imagePath })
            setVintedOpen(true)
          }

          // ouverture de la page : mise à jour discrète si eBay est relié (le serveur limite la fréquence)
          const { data: c } = await supabase.from('ebay_connexions').select('statut').eq('user_id', session.user.id).maybeSingle()
          if (c?.statut === 'connecte') await sync(session.access_token, session.user.id, false)
        })(), 20000, undefined)
      } finally { setLoading(false) }
    })()
  }, [router, load, loadBudget, sync])

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

  const disconnect = async (deleteData: boolean) => {
    if (!token) return
    setBusy('disconnect')
    try {
      await fetch('/api/ebay/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ deleteData }) })
      await reload()
      setConfirmOut(false)
    } finally { setBusy(null) }
  }

  if (loading) return (
    <div style={{ maxWidth: 980, margin: '40px auto', padding: '0 16px' }}>
      <SkeletonBlock style={{ height: 34, width: 220, marginBottom: 20 }} />
      <SkeletonBlock style={{ height: 130, marginBottom: 12 }} /><SkeletonBlock style={{ height: 130 }} />
    </div>
  )

  return (
    <>
      <MesAchatsView
        conn={conn} rows={rows} busy={busy} msg={msg} now={now} confirmOut={confirmOut} tld={EBAY_TLD[lang] || 'fr'} rates={rates}
        budget={budget} onSaveBudget={saveBudget}
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
