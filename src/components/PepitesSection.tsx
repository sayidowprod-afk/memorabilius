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
    <Link href={`/galerie/${card.userId}?card=${encodeURIComponent(card.img)}`} style={{
      flex: '0 0 auto', width: 118,
      background: dark ? '#1e1e1e' : 'white', borderRadius: 10, overflow: 'hidden',
      border: dark ? '1px solid #2a2a2a' : '1px solid #eee', textDecoration: 'none', display: 'block',
    }}>
      <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative' }}>
        <img src={card.img} alt={card.name} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'}
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

  // Défilement continu vers la gauche façon marquee : le rendu est dupliqué une
  // fois (list + list identique) et scrollLeft revient à 0 exactement à la moitié
  // du scrollWidth total — comme la seconde moitié est une copie pixel identique
  // de la première, ce reset est invisible, ce qui donne l'illusion d'une boucle
  // infinie plutôt qu'un aller-retour. Pause dès que l'utilisateur touche/scrolle.
  useEffect(() => {
    if (cards.length === 0) return
    const track = trackRef.current
    if (!track) return
    let raf: number
    const step = () => {
      if (!pausedRef.current) {
        const singleSetWidth = track.scrollWidth / 2
        if (singleSetWidth > 0) {
          let next = track.scrollLeft + 0.35
          if (next >= singleSetWidth) next -= singleSetWidth
          track.scrollLeft = next
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [cards.length])

  if (cards.length === 0) return null

  const pause = () => {
    pausedRef.current = true
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
  }
  const scheduleResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => { pausedRef.current = false }, 2200)
  }

  return (
    <section style={{ margin: '28px 0 36px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px', textAlign: 'center', color: dark ? '#fff' : '#121212' }}>
        {t('home_pepites')}
      </h2>
      <div
        ref={trackRef}
        onPointerDown={pause}
        onPointerUp={scheduleResume}
        onPointerCancel={scheduleResume}
        onTouchStart={pause}
        onTouchEnd={scheduleResume}
        onWheel={() => { pause(); scheduleResume() }}
        className="pepites-track"
        style={{
          display: 'flex', gap: 10, overflowX: 'auto',
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
