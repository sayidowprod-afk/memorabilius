'use client'
/* eslint-disable @next/next/no-img-element */
// Accueil : « Carte du jour » à gauche, « Packs » à droite (50 / 50). Le pack ouvre la page /packs.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import CardOfTheDay from '@/components/CardOfTheDay'
import dynamic from 'next/dynamic'
import { PackArt } from '@/components/PackArt'
// la fenêtre du pack et l'historique ne sont chargés qu'à l'ouverture (hors du premier affichage de l'accueil)
const PacksClient = dynamic(() => import('@/app/packs/PacksClient'), { ssr: false })
const PackHistory = dynamic(() => import('@/components/PackHistory'), { ssr: false })
import '@/app/packs/packs.css'

type Stock = { stock: number; max: number; next: string | null; canFree: boolean }

function countdown(next: string | null, now: number): string {
  if (!next) return ''
  const sec = Math.max(0, Math.ceil((new Date(next).getTime() - now) / 1000))
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function PackTeaser({ onOpen, onHistory, reloadKey }: { onOpen: () => void; onHistory: () => void; reloadKey: number }) {
  const [st, setSt] = useState<Stock | null>(null)
  const [logged, setLogged] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let off = false
    supabase.auth.getSession().then(async ({ data }) => {
      const t = data.session?.access_token
      if (off) return
      if (!t) { setLogged(false); return }
      setLogged(true)
      const r = await fetch('/api/packs', { headers: { Authorization: 'Bearer ' + t } }).catch(() => null)
      if (!r || !r.ok || off) return
      const j = await r.json()
      setSt({ stock: j.stock, max: j.max, next: j.next, canFree: j.canFree })
    })
    return () => { off = true }
  }, [reloadKey])
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  const ready = !!st && st.canFree
  return (
    <section className="pt" aria-label="Packs">
      <div className="pt-info">
        <span className="pt-eyebrow">Packs</span>
        <h3 className="da-display">{ready ? 'Un pack t’attend' : 'Packs gratuits'}</h3>
        <p className="pt-meta">Un pack toutes les heures, 10 en réserve. 6 vraies cartes tirées au hasard : rookies, signées, numérotées…</p>
        {logged && st && (
          <div className="pt-stock">
            <div className="pt-pips">{Array.from({ length: st.max }, (_, i) => <i key={i} className={i < st.stock ? 'on' : ''} />)}</div>
            <b>{st.stock} / {st.max} en réserve</b>
            {st.stock < st.max && st.next && <small>Prochain pack dans {countdown(st.next, now)}</small>}
          </div>
        )}
        <div className="pt-actions">
          {logged === false ? <Link href="/connexion" className="cdj-btn">Se connecter</Link> : <button type="button" className="cdj-btn" onClick={onOpen}>{ready ? 'Ouvrir un pack' : 'Voir mon pack'}</button>}
          {logged && <button type="button" className="cdj-btn alt" onClick={onHistory}>Mes cartes tirées</button>}
        </div>
      </div>
      <button type="button" className="pt-pack" aria-label="Ouvrir un pack" onClick={logged === false ? undefined : onOpen} disabled={logged === false}>
        <span className="pt-pack-in"><PackArt /></span>
        {ready && <span className="pt-badge">{st!.stock}</span>}
      </button>
    </section>
  )
}

export default function HomeDaily() {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // lien « /packs » ou ?pack=1 : on ouvre directement la fenêtre du pack
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get('pack')) setOpen(true) } catch { /* pas de paramètre */ } }, [])
  return (
    <div className="hd-row">
      <CardOfTheDay />
      <PackTeaser onOpen={() => setOpen(true)} onHistory={() => setHistory(true)} reloadKey={reloadKey} />
      {history && typeof document !== 'undefined' && createPortal(<PackHistory onClose={() => setHistory(false)} />, document.body)}
      {open && typeof document !== 'undefined' && createPortal(<PacksClient overlay onClose={() => { setOpen(false); setReloadKey(k => k + 1); try { const u = new URL(window.location.href); if (u.searchParams.has('pack')) { u.searchParams.delete('pack'); window.history.replaceState(null, '', u.pathname + u.search) } } catch { /* pas d'URL */ } }} />, document.body)}
    </div>
  )
}
