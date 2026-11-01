'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import SkeletonBlock from '@/components/SkeletonBlock'
import { useLang } from '@/lib/LangContext'
import MesAchatsView, { type Conn, type Row, type Rates } from '@/components/MesAchatsView'

// Site eBay vers lequel pointent les liens : celui de la langue du membre (ebay.fr pour un francophone).
const EBAY_TLD: Record<string, string> = { fr: 'fr', de: 'de', es: 'es', it: 'it', en: 'com' }

// « Mes achats » : les achats, enchères en cours et articles suivis du membre, importés de son compte eBay
// (tables ebay_connexions / achats_membre, voir supabase/migrations/20261101_ebay_achats.sql). L'affichage est dans
// MesAchatsView ; ici : session, chargement, synchronisation, connexion / déconnexion.
export default function MesAchats() {
  const router = useRouter()
  const { lang } = useLang()
  const [rates, setRates] = useState<Rates>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [conn, setConn] = useState<Conn | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [confirmOut, setConfirmOut] = useState(false)

  const load = useCallback(async (uid: string) => {
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('ebay_connexions').select('statut, ebay_user_id, derniere_synchro_at, derniere_erreur').eq('user_id', uid).maybeSingle(),
      supabase.from('achats_membre').select('*').eq('user_id', uid).eq('source', 'ebay').limit(500),
    ])
    setConn((c as Conn) || null)
    setRows((r as Row[]) || [])
  }, [])

  const sync = useCallback(async (tok: string, uid: string, force: boolean) => {
    setBusy('sync'); setMsg(null)
    try {
      const res = await fetch('/api/ebay/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ force }) })
      const json = await res.json().catch(() => ({}))
      if (json && json.ok === false && !json.skipped) setMsg(json.error || 'Actualisation impossible.')
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
          await load(session.user.id)
          setLoading(false)
          // ouverture de la page : mise à jour discrète si la connexion est active (le serveur limite la fréquence)
          const { data: c } = await supabase.from('ebay_connexions').select('statut').eq('user_id', session.user.id).maybeSingle()
          if (c?.statut === 'connecte') await sync(session.access_token, session.user.id, false)
        })(), 20000, undefined)
      } finally { setLoading(false) }
    })()
  }, [router, load, sync])

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

  const disconnect = async (deleteData: boolean) => {
    if (!token) return
    setBusy('disconnect')
    try {
      await fetch('/api/ebay/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ deleteData }) })
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await load(session.user.id)
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
    <MesAchatsView
      conn={conn} rows={rows} busy={busy} msg={msg} now={now} confirmOut={confirmOut} tld={EBAY_TLD[lang] || 'fr'} rates={rates}
      onConnect={connect} onSync={refresh} onAskDisconnect={() => setConfirmOut(true)}
      onDisconnect={disconnect} onCancelDisconnect={() => setConfirmOut(false)}
    />
  )
}
