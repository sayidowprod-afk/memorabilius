'use client'
// Palette de commandes : Ctrl / ⌘ + K, puis quelques lettres pour aller à une page ou lancer une action (ou chercher une carte).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Cmd = { id: string; icon: string; label: string; hint: string; keywords: string; href: string; auth?: boolean }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [uid, setUid] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQ(''); setSel(0)
        setOpen(o => !o)
      } else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0) }, [open])

  const base: Cmd[] = useMemo(() => [
    { id: 'add', icon: '＋', label: 'Ajouter une carte', hint: 'Action', keywords: 'ajouter nouvelle carte photo scanner', href: uid ? `/galerie/${uid}/ajouter` : '/connexion', auth: true },
    { id: 'gal', icon: '🖼', label: 'Ma galerie', hint: 'Page', keywords: 'galerie collection cartes', href: uid ? `/galerie/${uid}` : '/connexion', auth: true },
    { id: 'ach', icon: '🛒', label: 'Mes achats & ventes', hint: 'Page', keywords: 'achats ventes ebay vinted depenses', href: '/mes-achats', auth: true },
    { id: 'prof', icon: '👤', label: 'Mon profil', hint: 'Page', keywords: 'profil compte pseudo avatar', href: '/profil', auth: true },
    { id: 'notif', icon: '🔔', label: 'Notifications', hint: 'Page', keywords: 'notifications alertes', href: '/notifications', auth: true },
    { id: 'msg', icon: '✉️', label: 'Messages', hint: 'Page', keywords: 'messages conversations discussion', href: '/messages', auth: true },
    { id: 'set', icon: '⚙️', label: 'Réglages', hint: 'Page', keywords: 'reglages parametres notifications', href: '/parametres', auth: true },
    { id: 'wish', icon: '⭐', label: 'Wishlist', hint: 'Page', keywords: 'wishlist liste envies', href: '/wishlist', auth: true },
    { id: 'scan', icon: '📷', label: 'Scanner', hint: 'Outil', keywords: 'scanner scan prix photo', href: '/scanner' },
    { id: 'rech', icon: '🔍', label: 'Recherche de cartes', hint: 'Outil', keywords: 'recherche chercher carte joueur', href: '/recherche' },
    { id: 'ann', icon: '👥', label: 'Annuaire des collectionneurs', hint: 'Communauté', keywords: 'annuaire collectionneurs membres', href: '/annuaire' },
    { id: 'teams', icon: '🏆', label: 'Teams', hint: 'Communauté', keywords: 'teams equipes groupes', href: '/teams' },
    { id: 'trades', icon: '🔄', label: 'Échanges', hint: 'Communauté', keywords: 'echanges trades offres', href: '/trades' },
    { id: 'evt', icon: '📅', label: 'Événements', hint: 'Communauté', keywords: 'evenements salons events', href: '/evenements' },
    { id: 'act', icon: '📰', label: 'Activité', hint: 'Communauté', keywords: 'activite fil actualite', href: '/activite', auth: true },
    { id: 'grad', icon: '🔍', label: 'Gradation', hint: 'Outil', keywords: 'gradation psa bgs envois', href: '/gradation' },
    { id: 'setl', icon: '📋', label: 'Setlists', hint: 'Outil', keywords: 'setlist sets checklist', href: '/setlist' },
    { id: 'guides', icon: '📖', label: 'Guides', hint: 'Aide', keywords: 'guides tutoriels aide', href: '/guides' },
    { id: 'tuto', icon: '🎓', label: 'Tutoriel', hint: 'Aide', keywords: 'tuto tutoriel debuter', href: '/tuto' },
    { id: 'sort', icon: '📅', label: 'Calendrier des sorties', hint: 'Aide', keywords: 'sorties calendrier release panini topps produits', href: '/sorties' },
    { id: 'new', icon: '✨', label: 'Nouveautés', hint: 'Aide', keywords: 'nouveautes changelog mises a jour', href: '/nouveautes' },
  ], [uid])

  const list = useMemo(() => {
    const t = norm(q.trim())
    const visible = base.filter(c => !c.auth || uid || c.id === 'add' || c.id === 'gal')
    const hits = t ? visible.filter(c => norm(c.label + ' ' + c.keywords).includes(t)) : visible.slice(0, 8)
    const out = [...hits]
    if (q.trim().length >= 2) out.push({ id: 'search', icon: '🔎', label: `Chercher « ${q.trim()} » dans les cartes`, hint: 'Recherche', keywords: '', href: `/recherche?q=${encodeURIComponent(q.trim())}` })
    return out
  }, [q, base, uid])

  const go = (c: Cmd | undefined) => { if (!c) return; setOpen(false); router.push(c.href) }

  if (!open) return null
  return (
    <div className="da-pal-back" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="da-pal" role="dialog" aria-modal="true" aria-label="Palette de commandes">
        <input
          ref={inputRef} className="da-pal-input" value={q} placeholder="Aller à… ou chercher une carte"
          aria-label="Commande" autoComplete="off" spellCheck={false}
          onChange={e => { setQ(e.target.value); setSel(0) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, list.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); go(list[sel]) }
          }}
        />
        <div className="da-pal-list" role="listbox">
          {list.length === 0 && <div className="da-pal-empty">Aucun résultat.</div>}
          {list.map((c, i) => (
            <button key={c.id} type="button" role="option" aria-selected={i === sel} className={`da-pal-item${i === sel ? ' on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(c)}>
              <span className="da-pal-ic" aria-hidden="true">{c.icon}</span>
              <span className="da-pal-lb">{c.label}</span>
              <span className="da-pal-h">{c.hint}</span>
            </button>
          ))}
        </div>
        <div className="da-pal-foot">↑↓ naviguer · Entrée ouvrir · Échap fermer</div>
      </div>
    </div>
  )
}
