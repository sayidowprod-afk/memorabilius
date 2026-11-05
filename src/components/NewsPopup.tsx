'use client'
// Fenêtre « Quoi de neuf ? » : s'affiche une seule fois à l'arrivée d'un membre connecté après chaque mise à jour
// (quand la première entrée de lib/nouveautes.ts change), puis ne revient plus.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ENTRIES } from '@/lib/nouveautes'

const KEY = 'mb_news_seen'
const SKIP = ['/connexion', '/sinscrire', '/confirm', '/mot-de-passe-oublie', '/reset-password', '/nouveautes', '/admin', '/scanner', '/partage']

export default function NewsPopup() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const latest = ENTRIES[0]

  const markSeen = () => { try { localStorage.setItem(KEY, latest.date) } catch { /* stockage indisponible */ } }

  useEffect(() => {
    if (!latest || SKIP.some(p => pathname === p || pathname.startsWith(p + '/'))) return
    let seen: string | null = null
    try { seen = localStorage.getItem(KEY) } catch { return }
    if (seen === latest.date) return
    let cancelled = false
    const t = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) setShow(true)
    }, 2500)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [pathname, latest])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { markSeen(); setShow(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  if (!show || !latest) return null
  const close = () => { markSeen(); setShow(false) }
  return (
    <div className="da-confirm-back" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="da-confirm da-news" role="dialog" aria-modal="true" aria-labelledby="da-news-title">
        <div className="da-news-date">{latest.date}</div>
        <div id="da-news-title" className="da-confirm-title">Quoi de neuf ?</div>
        <div className="da-news-sub">{latest.titre}</div>
        <ul className="da-news-list">
          {latest.points.map(p => <li key={p}>{p}</li>)}
        </ul>
        <div className="da-confirm-actions">
          <Link href="/nouveautes" className="da-confirm-btn" onClick={close}>Tout voir</Link>
          <button type="button" className="da-confirm-btn news-ok" onClick={close} autoFocus>Compris</button>
        </div>
      </div>
    </div>
  )
}
