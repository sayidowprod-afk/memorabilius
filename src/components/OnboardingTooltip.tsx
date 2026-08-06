'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'onboarding_v1'

const STEPS = [
  {
    icon: '👋',
    title: 'Bienvenue sur Memorabilius !',
    desc: 'Votre plateforme dédiée aux collectionneurs de cartes sportives. On va vous guider en 4 étapes.',
    href: null,
    cta: null,
  },
  {
    icon: '🖼️',
    title: 'Votre galerie',
    desc: 'Retrouvez toutes vos cartes dans votre galerie personnelle. Organisez-les en classeurs thématiques.',
    href: '/galerie',
    cta: 'Voir ma galerie',
  },
  {
    icon: '➕',
    title: 'Ajoutez votre première carte',
    desc: 'Cliquez sur le bouton + dans votre galerie pour scanner une carte en photo ou l\'importer manuellement.',
    href: '/galerie',
    cta: 'Aller à ma galerie',
  },
  {
    icon: '👥',
    title: 'La communauté',
    desc: 'Découvrez les collections d\'autres passionnés, likez leurs cartes et proposez des échanges.',
    href: '/communaute',
    cta: 'Explorer',
  },
  {
    icon: '👤',
    title: 'Votre profil',
    desc: 'Ajoutez une photo et un pseudo pour que la communauté puisse vous identifier facilement.',
    href: '/profil',
    cta: 'Mon profil',
  },
]

export default function OnboardingTooltip() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [animOut, setAnimOut] = useState(false)
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { count } = await supabase
        .from('cartes_manuelles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', data.user.id)
      if ((count ?? 0) === 0) setVisible(true)
    })
  }, [])

  function dismiss() {
    setAnimOut(true)
    setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }, 280)
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!visible) return null

  const s = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      width: 300,
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      padding: '20px 20px 16px',
      animation: animOut
        ? 'ob-out 0.28s cubic-bezier(0.4,0,1,1) forwards'
        : 'ob-in 0.32s cubic-bezier(0,0,0.2,1) both',
      fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes ob-in {
          from { opacity:0; transform: translateY(20px) scale(0.96); }
          to   { opacity:1; transform: translateY(0)    scale(1); }
        }
        @keyframes ob-out {
          from { opacity:1; transform: translateY(0)    scale(1); }
          to   { opacity:0; transform: translateY(16px) scale(0.94); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{s.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>
            {s.title}
          </span>
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 18, lineHeight: 1,
            padding: '0 0 0 8px', flexShrink: 0,
          }}
          aria-label="Fermer"
        >×</button>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>
        {s.desc}
      </p>

      {/* CTA */}
      {s.href && s.cta && (
        <Link
          href={s.href}
          onClick={next}
          style={{
            display: 'block', textAlign: 'center',
            background: '#003DA6', color: '#fff',
            borderRadius: 8, padding: '8px 12px',
            fontSize: 13, fontWeight: 600,
            marginBottom: 12, textDecoration: 'none',
          }}
        >
          {s.cta} →
        </Link>
      )}

      {/* Footer: dots + next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? '#003DA6' : 'var(--border)',
              transition: 'width 0.2s, background 0.2s',
            }} />
          ))}
        </div>
        <button
          onClick={next}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 7, padding: '5px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: 'var(--text2)',
          }}
        >
          {isLast ? 'Terminer' : 'Suivant →'}
        </button>
      </div>
    </div>
  )
}
