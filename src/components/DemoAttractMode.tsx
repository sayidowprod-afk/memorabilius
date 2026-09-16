'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

const IDLE_MS = 45_000
// Evenements consideres comme une interaction -- couvre souris (web) et
// tactile (tablette), sans se limiter a un seul type qui manquerait l'autre.
const ACTIVITY_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const

// Ecran "attract mode" façon demo en boutique (telephones exposes) : sur la
// tablette du salon (compte demo uniquement), un carrousel plein ecran
// apparait apres un moment d'inactivite pour inviter les passants a toucher
// l'ecran, et ramene systematiquement au profil demo au prochain toucher --
// chaque visiteur repart d'un etat propre, peu importe ou le precedent a navigue.
export default function DemoAttractMode() {
  const { user } = useAuth()
  const router = useRouter()
  const [isDemo, setIsDemo] = useState(false)
  const [active, setActive] = useState(false)
  const [cards, setCards] = useState<string[]>([])
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) { setIsDemo(false); return }
    supabase.from('profiles').select('is_demo').eq('id', user.id).single()
      .then(({ data }) => setIsDemo(!!data?.is_demo))
  }, [user?.id])

  useEffect(() => {
    if (!isDemo) return

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setActive(true), IDLE_MS)
    }

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [isDemo])

  useEffect(() => {
    if (!active || !user) return
    supabase.from('cartes_manuelles').select('image_recto')
      .eq('user_id', user.id).not('image_recto', 'is', null).limit(60)
      .then(({ data }) => {
        const urls = (data || []).map(c => c.image_recto as string)
        for (let i = urls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[urls[i], urls[j]] = [urls[j], urls[i]]
        }
        setCards(urls.slice(0, 24))
      })
  }, [active, user?.id])

  const dismiss = () => {
    setActive(false)
    router.push('/profil')
  }

  if (!isDemo || !active) return null

  return (
    <div onClick={dismiss} onTouchStart={dismiss} style={{
      position: 'fixed', inset: 0, zIndex: 999999, background: '#0a0e1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', gap: 16, animation: 'demoAttractScroll 40s linear infinite',
        willChange: 'transform',
      }}>
        {[...cards, ...cards].map((url, i) => (
          <img key={i} src={url} alt="" loading="lazy" style={{
            width: 160, height: 224, objectFit: 'cover', borderRadius: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)', flexShrink: 0,
          }} />
        ))}
      </div>
      <div style={{
        marginTop: 48, textAlign: 'center', animation: 'demoAttractPulse 1.8s ease-in-out infinite',
      }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>👆</div>
        <div style={{ color: 'white', fontSize: 28, fontWeight: 900, letterSpacing: 0.5 }}>
          Touchez l&apos;écran pour découvrir Memorabilius
        </div>
      </div>
      <style>{`
        @keyframes demoAttractScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes demoAttractPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.97); } }
      `}</style>
    </div>
  )
}
