'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import BobbleHero from '@/components/BobbleHero'
import { playerSlug } from '@/lib/playerSlug'
import { withKit } from '@/lib/bobbleheads'
import { useKitCatalog } from '@/lib/useKitCatalog'
import type { BobbleFig } from '@/lib/bobbleheadsServer'

// Figurines (têtes validées) des joueurs suivis dans les PCs d'une galerie, affichées dans l'en-tête du profil.
// Rien ne s'affiche tant qu'aucun joueur de PC n'a de figurine prête.
// Toutes sur UNE seule ligne, qui tient dans la largeur de la barre bleue : chaque figurine a un emplacement de largeur égale
// (largeur disponible / nombre de figurines) et sa taille s'en déduit, plafonnée à `maxHeight`.
type Pc = { type?: string; name?: string; kit?: string }
const VIS = 0.6          // largeur visible d'une figurine / sa hauteur
const MIN_H = 50

export default function PcBobbles({ pcs, ownerId, maxHeight = 150 }: { pcs?: Pc[] | null; ownerId?: string | null; maxHeight?: number }) {
  const [figs, setFigs] = useState<{ name: string; fig: BobbleFig; pct?: number; label?: string }[]>([])
  const [avail, setAvail] = useState(0)
  const [loaded, setLoaded] = useState(false)   // la liste des figurines est arrivée (sert à réserver la place avant, sans décalage de la page)
  const ref = useRef<HTMLDivElement>(null)
  const catalog = useKitCatalog()
  const [livePcs, setLivePcs] = useState<Pc[] | null>(null)   // PC modifiés dans l'onglet Objectifs (tenue choisie) : mise à jour immédiate
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.userId === ownerId && Array.isArray(d.pcs)) setLivePcs(d.pcs) }
    window.addEventListener('pcs-updated', h)
    return () => window.removeEventListener('pcs-updated', h)
  }, [ownerId])
  const kitOf = new Map((livePcs || pcs || []).map(p => [p.name as string, p.kit]))
  const key = (pcs || []).filter(p => p?.type === 'player' && p.name).map(p => p.name as string).slice(0, 8).join('|')

  useEffect(() => {
    if (!key) { setFigs([]); setLoaded(true); return }
    let off = false
    fetch(`/api/bobble-figs?names=${encodeURIComponent(key)}`)
      .then(r => (r.ok ? r.json() : { figs: [] }))
      .then(d => { if (!off) { setFigs(Array.isArray(d?.figs) ? d.figs.slice(0, 8) : []); setLoaded(true) } })
      .catch(() => { if (!off) { setFigs([]); setLoaded(true) } })
    return () => { off = true }
  }, [key])

  // les « top x % » arrivent après les figurines : UN appel par joueur, en parallèle (chacun a son propre délai et son propre cache ; un joueur lent ne bloque plus les autres)
  useEffect(() => {
    if (!ownerId || !figs.length) return
    let off = false
    const ask = async (name: string, attempt = 0): Promise<void> => {
      try {
        const d = await fetch(`/api/player-rank?name=${encodeURIComponent(name)}&userId=${encodeURIComponent(ownerId)}`).then(r => r.json())
        if (off) return
        if (d?.error && attempt < 2) { await new Promise(r => setTimeout(r, 2500 * (attempt + 1))); return ask(name, attempt + 1) }
        if (d?.pct) setFigs(cur => cur.map(f => (f.name === name ? { ...f, pct: d.pct, label: d.label } : f)))
      } catch { /* pas de % pour ce joueur */ }
    }
    figs.forEach(f => { if (!f.pct) void ask(f.name) })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ownerId, figs.length])

  useEffect(() => {
    const el = ref.current; if (!el) return
    const upd = () => setAvail(el.getBoundingClientRect().width)
    upd()
    let ro: ResizeObserver | null = null
    try { ro = new ResizeObserver(upd); ro.observe(el) } catch { /* rien */ }
    window.addEventListener('resize', upd)
    return () => { ro?.disconnect(); window.removeEventListener('resize', upd) }
  }, [figs.length])

  if (!figs.length) {
    // Écrans étroits : les figurines sont dans le flux de la page. On réserve leur hauteur dès le départ, sinon tout le bas de l'en-tête sautait à leur arrivée.
    if (key && !loaded) {
      const n = Math.max(1, Math.min(8, key.split('|').length))
      const u = avail > 0 ? Math.min(avail, 560) : 300
      const hh = Math.max(MIN_H, Math.min(maxHeight, Math.floor(u / n / VIS)))
      return <div ref={ref} className="pc-bobbles pc-bobbles-ph" aria-hidden="true" style={{ ['--ph' as string]: `${hh + 17}px` } as React.CSSProperties} />
    }
    return null
  }
  // largeur utilisable : toute la barre (téléphone) ; au plus 560 px sur grand écran pour ne pas recouvrir le texte à gauche
  const usable = avail > 0 ? Math.min(avail, 560) : 260
  const slotFull = usable / figs.length
  const h = Math.max(MIN_H, Math.min(maxHeight, Math.floor(slotFull / VIS)))
  const slot = Math.min(slotFull, Math.round(h * VIS) + 14)   // case = largeur réelle de la figurine + un petit espace (plus de grands vides entre elles sur ordinateur)
  return (
    <div ref={ref} className="pc-bobbles" style={{ height: 0, position: 'relative', width: '100%' }}>
      <div style={{ position: 'absolute', right: 0, bottom: 0, display: 'flex', flexWrap: 'nowrap', justifyContent: 'flex-end', alignItems: 'flex-end', width: usable, maxWidth: '100%', pointerEvents: 'none' }}>
        {figs.map(({ name, fig, pct, label }) => (
          <Link key={name} href={`/joueur/${playerSlug(name)}`} title={name} aria-label={`Fiche de ${name}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: slot, flex: `0 0 ${slot}px`, textDecoration: 'none', pointerEvents: 'auto' }}>
            {pct ? <span style={{ fontSize: Math.max(8, Math.min(10, Math.round(slot / 11))), fontWeight: 700, color: 'rgba(255,255,255,.62)', letterSpacing: '.04em', lineHeight: 1, marginBottom: 7, whiteSpace: 'nowrap' }}>{label || `Top ${pct} %`}</span> : null}
            <BobbleHero fig={withKit({ ...fig, extra: catalog?.kits }, kitOf.get(name))} name={name} height={h} />
          </Link>
        ))}
      </div>
    </div>
  )
}
