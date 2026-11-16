'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import BobbleHero from '@/components/BobbleHero'
import { playerSlug } from '@/lib/playerSlug'
import type { BobbleFig } from '@/lib/bobbleheadsServer'

// Figurines (têtes validées) des joueurs suivis dans les PCs d'une galerie, affichées dans l'en-tête du profil.
// Rien ne s'affiche tant qu'aucun joueur de PC n'a de figurine prête.
// Toutes sur UNE seule ligne, qui tient dans la largeur de la barre bleue : chaque figurine a un emplacement de largeur égale
// (largeur disponible / nombre de figurines) et sa taille s'en déduit, plafonnée à `maxHeight`.
type Pc = { type?: string; name?: string }
const VIS = 0.6          // largeur visible d'une figurine / sa hauteur
const MIN_H = 50

export default function PcBobbles({ pcs, maxHeight = 150 }: { pcs?: Pc[] | null; maxHeight?: number }) {
  const [figs, setFigs] = useState<{ name: string; fig: BobbleFig }[]>([])
  const [avail, setAvail] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const key = (pcs || []).filter(p => p?.type === 'player' && p.name).map(p => p.name as string).slice(0, 8).join('|')

  useEffect(() => {
    if (!key) { setFigs([]); return }
    let off = false
    fetch(`/api/bobble-figs?names=${encodeURIComponent(key)}`)
      .then(r => (r.ok ? r.json() : { figs: [] }))
      .then(d => { if (!off) setFigs(Array.isArray(d?.figs) ? d.figs.slice(0, 8) : []) })
      .catch(() => { if (!off) setFigs([]) })
    return () => { off = true }
  }, [key])

  useEffect(() => {
    const el = ref.current; if (!el) return
    const upd = () => setAvail(el.getBoundingClientRect().width)
    upd()
    let ro: ResizeObserver | null = null
    try { ro = new ResizeObserver(upd); ro.observe(el) } catch { /* rien */ }
    window.addEventListener('resize', upd)
    return () => { ro?.disconnect(); window.removeEventListener('resize', upd) }
  }, [figs.length])

  if (!figs.length) return null
  // largeur utilisable : toute la barre (téléphone) ; au plus 560 px sur grand écran pour ne pas recouvrir le texte à gauche
  const usable = avail > 0 ? Math.min(avail, 560) : 260
  const slot = usable / figs.length
  const h = Math.max(MIN_H, Math.min(maxHeight, Math.floor(slot / VIS)))
  return (
    <div ref={ref} className="pc-bobbles" style={{ height: 0, position: 'relative', width: '100%' }}>
      <div style={{ position: 'absolute', right: 0, bottom: 0, display: 'flex', flexWrap: 'nowrap', justifyContent: 'flex-end', alignItems: 'flex-end', width: usable, maxWidth: '100%', pointerEvents: 'none' }}>
        {figs.map(({ name, fig }) => (
          <Link key={name} href={`/joueur/${playerSlug(name)}`} title={name} aria-label={`Fiche de ${name}`}
            style={{ display: 'flex', justifyContent: 'center', width: slot, flex: `0 0 ${slot}px`, textDecoration: 'none', pointerEvents: 'auto' }}>
            <BobbleHero fig={fig} name={name} height={h} />
          </Link>
        ))}
      </div>
    </div>
  )
}
