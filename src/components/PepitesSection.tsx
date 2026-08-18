'use client'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'

interface Card {
  img: string; name: string; variant: string; year: string
  brand: string; rc: boolean; auto: boolean; patch: boolean
  num: string; collector: string; userId: string; isHorizontal: boolean
}

function PepiteCard({ card, eager, dark }: { card: Card; eager: boolean; dark: boolean }) {
  return (
    <Link href={`/galerie/${card.userId}?card=${encodeURIComponent(card.img)}`} draggable={false} style={{
      flex: '0 0 auto', width: 'clamp(118px, 15vw, 190px)',
      background: dark ? '#1e1e1e' : 'white', borderRadius: 10, overflow: 'hidden',
      border: dark ? '1px solid #2a2a2a' : '1px solid #eee', textDecoration: 'none', display: 'block',
    }}>
      <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative' }}>
        <img src={card.img} alt={card.name} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} draggable={false}
          style={card.isHorizontal ? { position: 'absolute', width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover' } : { width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ padding: '7px 8px' }}>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
          {card.rc && <span style={{ fontSize: 7.5, fontWeight: 900, padding: '2px 4px', borderRadius: 3, background: '#e67e22', color: 'white' }}>RC</span>}
          {card.auto && <span style={{ fontSize: 7.5, fontWeight: 900, padding: '2px 4px', borderRadius: 3, background: '#2e7d32', color: 'white' }}>AUTO</span>}
          {card.patch && <span style={{ fontSize: 7.5, fontWeight: 900, padding: '2px 4px', borderRadius: 3, background: '#1976d2', color: 'white' }}>PATCH</span>}
        </div>
        <p style={{ fontWeight: 800, fontSize: 11, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: dark ? '#fff' : '#121212' }}>{card.name}</p>
        <p style={{ fontSize: 9, color: '#999', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.year} {card.brand}</p>
      </div>
    </Link>
  )
}

export default function PepitesSection({ cards }: { cards: Card[] }) {
  const { t } = useLang()
  const { dark } = useTheme()
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false })

  // Défilement continu vers la gauche façon marquee : le rendu est dupliqué une
  // fois (list + list identique) et scrollLeft revient à 0 exactement à la moitié
  // du scrollWidth total — comme la seconde moitié est une copie pixel identique
  // de la première, ce reset est invisible, ce qui donne l'illusion d'une boucle
  // infinie plutôt qu'un aller-retour. Pause dès que l'utilisateur touche/drag.
  // La section reste montée en permanence sur la home — sans garde-fou,
  // cette boucle continuerait à tourner (et à consommer CPU/batterie) même
  // scrollée hors écran. Un IntersectionObserver coupe la RAF tant qu'elle
  // n'est pas visible et la relance dès qu'elle revient dans le viewport.
  useEffect(() => {
    if (cards.length === 0) return
    const track = trackRef.current
    if (!track) return
    let raf: number | null = null
    let visible = true

    const step = () => {
      if (!pausedRef.current) {
        const singleSetWidth = track.scrollWidth / 2
        if (singleSetWidth > 0) {
          let next = track.scrollLeft + 0.5
          if (next >= singleSetWidth) next -= singleSetWidth
          track.scrollLeft = next
        }
      }
      raf = visible ? requestAnimationFrame(step) : null
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && raf === null) raf = requestAnimationFrame(step)
    }, { threshold: 0 })
    observer.observe(track)

    raf = requestAnimationFrame(step)
    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [cards.length])

  if (cards.length === 0) return null

  const pause = () => {
    pausedRef.current = true
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
  }
  const scheduleResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => { pausedRef.current = false }, 1200)
  }

  // Souris = pas de scroll tactile natif : sans ceci la rangée n'est ni
  // draggable ni cliquable-glissable à la souris, seulement au trackpad/tactile.
  const onMouseDown = (e: React.MouseEvent) => {
    const track = trackRef.current
    if (!track) return
    drag.current = { active: true, startX: e.clientX, startScrollLeft: track.scrollLeft, moved: false }
    pause()
    const onMove = (ev: MouseEvent) => {
      if (!drag.current.active || !track) return
      const dx = ev.clientX - drag.current.startX
      if (Math.abs(dx) > 3) drag.current.moved = true
      track.scrollLeft = drag.current.startScrollLeft - dx
    }
    const onUp = () => {
      drag.current.active = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      scheduleResume()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Un vrai drag (déplacement > seuil) ne doit pas déclencher le lien de la carte.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  // Scroll horizontal volontaire (trackpad/molette inclinée) uniquement — un
  // scroll vertical normal de la page ne doit pas mettre la rangée en pause
  // juste parce que le curseur passe dessus.
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    pause()
    scheduleResume()
  }

  return (
    <section style={{ margin: '28px 0 36px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px', textAlign: 'center', color: dark ? '#fff' : '#121212' }}>
        {t('home_pepites')}
      </h2>
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
        onTouchStart={pause}
        onTouchEnd={scheduleResume}
        onWheel={onWheel}
        className="pepites-track"
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', cursor: 'grab',
          width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
          padding: '0 16px 6px',
        }}
      >
        {cards.map((card, i) => <PepiteCard key={`a-${i}`} card={card} eager={i === 0} dark={dark} />)}
        {cards.map((card, i) => <PepiteCard key={`b-${i}`} card={card} eager={false} dark={dark} />)}
      </div>
    </section>
  )
}
