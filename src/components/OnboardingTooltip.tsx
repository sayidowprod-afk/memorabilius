'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'onboarding_v1'

function makeSteps(userId: string) {
  return [
    {
      icon: '👋',
      title: 'Bienvenue sur Memorabilius !',
      desc: 'Votre plateforme dédiée aux collectionneurs de cartes sportives. On vous guide en 4 étapes.',
      href: null,
      cta: null,
      completesOn: null as string | null,
    },
    {
      icon: '🖼️',
      title: 'Votre galerie',
      desc: 'Retrouvez toutes vos cartes dans votre galerie personnelle. Organisez-les en classeurs.',
      href: `/galerie/${userId}`,
      cta: 'Voir ma galerie',
      completesOn: `/galerie/${userId}`,
    },
    {
      icon: '➕',
      title: 'Ajoutez votre première carte',
      desc: 'Cliquez sur le bouton + pour scanner une carte en photo ou l\'importer manuellement.',
      href: `/galerie/${userId}`,
      cta: 'Aller à ma galerie',
      completesOn: 'card_added',
    },
    {
      icon: '👥',
      title: 'La communauté',
      desc: 'Découvrez les collections d\'autres passionnés, likez leurs cartes et proposez des échanges.',
      href: '/communaute',
      cta: 'Explorer',
      completesOn: '/communaute',
    },
    {
      icon: '👤',
      title: 'Votre profil',
      desc: 'Ajoutez une photo et un pseudo pour que la communauté vous reconnaisse.',
      href: '/profil',
      cta: 'Mon profil',
      completesOn: '/profil',
    },
  ]
}

export default function OnboardingTooltip() {
  const pathname = usePathname()
  const [visible, setVisible]       = useState(false)
  const [step, setStep]             = useState(0)
  const [completing, setCompleting] = useState(false)
  const [animOut, setAnimOut]       = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const authChecked = useRef(false)
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Auth + carte count ─────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!session?.user || authChecked.current) return
      authChecked.current = true
      subscription.unsubscribe()

      const { count } = await supabase
        .from('cartes_manuelles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      if ((count ?? 0) === 0) {
        setUserId(session.user.id)
        setVisible(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const steps = userId ? makeSteps(userId) : []
  const s = steps[step]

  // ── Completion par URL ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !s || completing) return
    const target = s.completesOn
    if (!target || target === 'card_added') return
    if (pathname.startsWith(target)) triggerComplete()
  }, [pathname, step, visible]) // eslint-disable-line

  // ── Completion par ajout de carte (step 2) ─────────────────────────────────
  useEffect(() => {
    if (!visible || !userId || !s) return
    if (s.completesOn !== 'card_added') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      const { count } = await supabase
        .from('cartes_manuelles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if ((count ?? 0) > 0) triggerComplete()
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, visible, userId]) // eslint-disable-line

  function triggerComplete() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setCompleting(true)
    setTimeout(() => {
      setCompleting(false)
      if (step < steps.length - 1) setStep(s => s + 1)
      else dismiss()
    }, 1400)
  }

  function dismiss() {
    setAnimOut(true)
    setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }, 280)
  }

  function next() {
    if (step < steps.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!visible || !s) return null

  const isLast = step === steps.length - 1

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999, width: 300,
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      animation: animOut
        ? 'ob-out 0.28s cubic-bezier(0.4,0,1,1) forwards'
        : 'ob-in 0.32s cubic-bezier(0,0,0.2,1) both',
      fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes ob-in  { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ob-out { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(16px) scale(0.94)} }
        @keyframes ob-check { 0%{opacity:0;transform:scale(0.7)} 40%{opacity:1;transform:scale(1.1)} 70%{transform:scale(0.95)} 100%{transform:scale(1)} }
      `}</style>

      {/* Overlay "étape complétée" */}
      {completing && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: 'rgba(46,125,50,0.93)', borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{ fontSize: 44, animation: 'ob-check 0.4s ease both' }}>✅</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>Étape complétée !</p>
        </div>
      )}

      <div style={{ padding: '20px 20px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>{s.title}</span>
          </div>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }} aria-label="Fermer">×</button>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>{s.desc}</p>

        {/* CTA */}
        {s.href && s.cta && (
          <Link href={s.href} style={{
            display: 'block', textAlign: 'center',
            background: '#003DA6', color: '#fff',
            borderRadius: 8, padding: '8px 12px',
            fontSize: 13, fontWeight: 600, marginBottom: 12,
          }}>
            {s.cta} →
          </Link>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 18 : 6, height: 6, borderRadius: 3,
                background: i === step ? '#003DA6' : i < step ? '#4caf50' : 'var(--border)',
                transition: 'width 0.2s, background 0.2s',
              }} />
            ))}
          </div>
          <button onClick={next} style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 7, padding: '5px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)',
          }}>
            {isLast ? 'Terminer' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  )
}
