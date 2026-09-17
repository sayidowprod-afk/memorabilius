'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

const IDLE_MS = 45_000
// Evenements consideres comme une interaction -- couvre souris (web) et
// tactile (tablette), sans se limiter a un seul type qui manquerait l'autre.
const ACTIVITY_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const
const FEATURE_PILLS = ['📸 Scan IA en 1 photo', '🃏 Galerie illimitée', '🏆 Classements', '🎥 Export vidéo & photo', '📔 Classeurs personnalisés', '💬 Communauté']

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
  const [cards, setCards] = useState<{ url: string; horizontal: boolean }[]>([])
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
    // Bassin large (300) puise au hasard puis trie -- pas de tri aleatoire cote
    // Supabase, donc melange en JS. Cartes avec auto/patch/num (plus impressionnantes
    // pour un salon) passees en priorite, le reste ne complete que si besoin, pour
    // arriver a 100 cartes minimum plutot que les 24 d'avant (carrousel trop court).
    supabase.from('cartes_manuelles').select('image_recto, is_horizontal, auto, patch, num')
      .eq('user_id', user.id).not('image_recto', 'is', null).limit(300)
      .then(({ data }) => {
        const items = (data || []).map(c => ({
          url: c.image_recto as string, horizontal: !!c.is_horizontal,
          notable: !!c.auto || !!c.patch || !!(c.num && String(c.num).trim()),
        }))
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[items[i], items[j]] = [items[j], items[i]]
        }
        const notable = items.filter(c => c.notable)
        const rest = items.filter(c => !c.notable)
        setCards([...notable, ...rest].slice(0, 100))
      })
  }, [active, user?.id])

  // Duree fixe (40s) faisait defiler TOUTES les cartes en 40s quel que soit leur nombre
  // (translateX(-50%) est relatif a la largeur du conteneur, pas a un nombre de cartes) --
  // avec 24 cartes ca ne laissait qu'1,6s par carte, illisible ("ca flash"). Duree
  // proportionnelle au nombre de cartes pour garder un defilement lisible.
  const scrollSecs = Math.max(40, cards.length * 3.5)

  const dismiss = () => {
    setActive(false)
    router.push('/profil')
  }

  if (!isDemo || !active) return null

  return (
    // justifyContent: 'space-between' plutot que 'center' -- sur un ecran large et
    // COURT (tablette/TV en paysage), empiler logo + carrousel + pastilles + accroche
    // au centre avec une marge fixe debordait en haut ET en bas (logo et "Touchez
    // l'ecran" tous les deux coupes hors ecran, signale sur tablette du salon).
    // space-between colle le logo en haut et l'accroche tactile en bas -- toujours
    // visibles, seul le carrousel de cartes (au milieu, moins essentiel) absorbe
    // le manque de hauteur. Tailles en vh/clamp pour la meme raison.
    <div onClick={dismiss} onTouchStart={dismiss} className="demo-attract-root" style={{
      position: 'fixed', inset: 0, zIndex: 999999, background: '#0a0e1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer', overflow: 'hidden', padding: '3vh 0',
    }}>
      <img src="/memorabilius-logo.png" alt="Memorabilius" className="demo-attract-logo" style={{ width: 'min(420px, 60vw)', maxHeight: '14vh', height: 'auto', objectFit: 'contain', flexShrink: 0 }} />
      <div style={{
        display: 'flex', gap: 16, animation: `demoAttractScroll ${scrollSecs}s linear infinite`,
        willChange: 'transform', flexShrink: 1, minHeight: 0,
      }}>
        {[...cards, ...cards].map((c, i) => (
          <img key={i} src={c.url} alt="" loading="lazy" className="demo-attract-card" style={
            c.horizontal
              ? { width: 'auto', height: '26vh', aspectRatio: '224 / 160', objectFit: 'cover', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', flexShrink: 0 }
              : { width: 'auto', height: '26vh', aspectRatio: '160 / 224', objectFit: 'cover', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', flexShrink: 0 }
          } />
        ))}
      </div>
      <div className="demo-attract-pills" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90vw', flexShrink: 0 }}>
        {FEATURE_PILLS.map(p => (
          <div key={p} style={{
            padding: '7px 16px', borderRadius: 99, background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.85)',
            fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
          }}>{p}</div>
        ))}
      </div>
      <div style={{
        textAlign: 'center', animation: 'demoAttractPulse 1.8s ease-in-out infinite', flexShrink: 0,
      }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>👆</div>
        <div style={{ color: 'white', fontSize: 28, fontWeight: 900, letterSpacing: 0.5, padding: '0 16px' }}>
          Touchez l&apos;écran pour découvrir Memorabilius
        </div>
      </div>
      <style>{`
        @keyframes demoAttractScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes demoAttractPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.97); } }
        @media (max-height: 500px) { .demo-attract-pills { display: none !important; } }
      `}</style>
    </div>
  )
}
