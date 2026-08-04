'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'

// Bannière d'accueil : halos + éventail de cartes holographiques flottantes.
const heroCSS = `
.mb-hero-inner {
  position: relative; z-index: 2;
  text-align: center; padding: 92px 20px;
  max-width: 720px; margin: 0 auto;
}
.mb-hero-badge {
  display: inline-block; margin-bottom: 22px;
  padding: 7px 16px; border-radius: 999px;
  font-size: 12px; font-weight: 800; letter-spacing: 0.4px;
  color: #4da3ff; background: rgba(0,120,255,0.12);
  border: 1px solid rgba(0,120,255,0.28);
  backdrop-filter: blur(4px);
}
.mb-hero-title {
  font-size: clamp(2.2rem, 6vw, 4rem); font-weight: 900;
  margin: 0 0 18px; line-height: 1.02; letter-spacing: -1px;
}
.mb-hero-sub {
  font-size: clamp(1.05rem, 2.4vw, 1.3rem); font-weight: 500;
  max-width: 560px; margin: 0 auto 32px; line-height: 1.5;
}
.mb-hero-cards { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.mb-card {
  position: absolute; width: 148px; height: 207px;
  box-shadow: 0 24px 50px rgba(0,0,0,0.42);
  overflow: hidden; opacity: 0.92; background: #0a1230;
  transition: transform 0.25s cubic-bezier(.2,.7,.3,1);
  will-change: transform, translate;
  animation: mbFloat 9s ease-in-out infinite; /* toute la carte flotte */
}
.mb-card > .mb-card-inner { position: absolute; inset: 0; }
.mb-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-card-shine {
  position: absolute; top: -60%; left: -30%; width: 70%; height: 220%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
  transform: rotate(18deg); filter: blur(6px); z-index: 2;
  animation: mbSweep 5.5s ease-in-out infinite;
}
.mb-card-1 { top: 14%;  left: 4%;   transform: rotate(-15deg); animation-delay: 0s;   }
.mb-card-2 { bottom: 9%; left: 14%;  transform: rotate(9deg);  width: 120px; height: 168px; opacity: 0.78; animation-delay: 0.6s; }
.mb-card-3 { top: 15%;  right: 5%;   transform: rotate(14deg); animation-delay: 1.1s; }
.mb-card-4 { bottom: 11%; right: 15%; transform: rotate(-8deg);  width: 120px; height: 168px; opacity: 0.78; animation-delay: 0.3s; }
@keyframes mbFloat { 0%,100% { translate: 0 0; } 50% { translate: 0 -12px; } }
@keyframes mbSweep { 0% { left: -40%; } 55%,100% { left: 130%; } }
@media (max-width: 820px) {
  .mb-card-2, .mb-card-4 { display: none; }
  .mb-card-1 { left: -7%; opacity: 0.45; }
  .mb-card-3 { right: -7%; opacity: 0.45; }
  .mb-hero-inner { padding: 70px 18px; }
  /* Mobile : cartes statiques (pas de flottement/transition) pour éviter
     tout tremblement sur les navigateurs tactiles. */
  .mb-card, .mb-card-shine { animation: none !important; }
  .mb-card { transition: none !important; }
}
/* Écrans tactiles : aucune animation de carte, quelle que soit la largeur */
@media (hover: none), (pointer: coarse) {
  .mb-card, .mb-card-shine { animation: none !important; }
  .mb-card { transition: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  .mb-card, .mb-card-shine { animation: none; }
  .mb-card { transition: none; }
}
`

// Rotation de base par carte (doit matcher le CSS) — réutilisée par le parallax
// pour composer transform = rotate(base) translate(parallax).
const CARD_BASE_ROT = [-15, 9, 14, -8]
const CARD_DEPTH = [26, 16, 24, 16]

export default function HomeHero({ total, totalCartes }: { total: number; totalCartes: number }) {
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [galerieHref, setGalerieHref] = useState('/sinscrire')
  const [cardImgs, setCardImgs] = useState<string[]>([])
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setGalerieHref(`/galerie/${data.user.id}/ajouter`)
    })
  }, [])

  // Récupère quelques vraies cartes récentes (recto) pour décorer le hero
  useEffect(() => {
    supabase
      .from('cartes_manuelles')
      .select('image_recto')
      .not('image_recto', 'is', null)
      .eq('is_horizontal', false)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        const urls = (data || []).map((r: any) => r.image_recto).filter(Boolean)
        // Mélange léger puis garde 4 cartes distinctes
        const seen = new Set<string>(); const pick: string[] = []
        for (const u of urls.sort(() => Math.random() - 0.5)) {
          if (!seen.has(u)) { seen.add(u); pick.push(u) }
          if (pick.length >= 4) break
        }
        setCardImgs(pick)
      })
  }, [])

  // Parallaxe : décale chaque carte selon la position du curseur (profondeurs
  // différentes) en composant avec sa rotation de base.
  const onMove = (e: React.MouseEvent) => {
    const el = cardsRef.current
    if (!el) return
    // Pas de parallaxe sur écran tactile (source de tremblements sur mobile)
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    el.querySelectorAll<HTMLElement>('.mb-card').forEach((card: HTMLElement, i: number) => {
      const d = CARD_DEPTH[i] ?? 18
      card.style.transform = `rotate(${CARD_BASE_ROT[i] ?? 0}deg) translate(${(-nx * d).toFixed(1)}px, ${(-ny * d).toFixed(1)}px)`
    })
  }
  const onLeave = () => {
    const el = cardsRef.current
    if (!el) return
    el.querySelectorAll<HTMLElement>('.mb-card').forEach((card: HTMLElement, i: number) => {
      card.style.transform = `rotate(${CARD_BASE_ROT[i] ?? 0}deg)`
    })
  }

  const steps = lang === 'fr' ? [
    { n: 1, title: 'Crée ton compte', desc: "Inscris-toi gratuitement en quelques secondes. Ton profil devient ta vitrine de collectionneur.", link: '/sinscrire', linkText: "Créer mon compte →" },
    { n: 2, title: 'Scanne tes cartes', desc: "Recto + verso en 1 clic : l'IA identifie joueur, année, marque et variation en quelques secondes. Tu n'as plus qu'à confirmer.", link: galerieHref, linkText: "Ajouter une carte →" },
    { n: 3, title: 'Suis ta collection', desc: "Compare ta galerie à la Setlist NBA, vois ce qu'il te manque, partage ton profil et échange avec d'autres collectionneurs.", link: '/setlist', linkText: "Explorer la Setlist →" },
  ] : [
    { n: 1, title: 'Create your account', desc: "Sign up for free in seconds. Your profile becomes your collector showcase.", link: '/sinscrire', linkText: "Create my account →" },
    { n: 2, title: 'Scan your cards', desc: "Front + back in 1 tap: AI identifies player, year, brand and variation in seconds. Just confirm and you're done.", link: galerieHref, linkText: "Add a card →" },
    { n: 3, title: 'Track your collection', desc: "Compare your gallery to the NBA Setlist, see what you are missing, share your profile and trade with other collectors.", link: '/setlist', linkText: "Explore the Setlist →" },
  ]

  return (
    <>
      <style>{heroCSS}</style>
      <section className="mb-hero" style={{
        position: 'relative', overflow: 'hidden', borderRadius: 24, marginBottom: 40,
        background: dark
          ? 'radial-gradient(1000px 500px at 80% -10%, rgba(0,120,255,0.28), transparent 60%), radial-gradient(800px 500px at 0% 110%, rgba(123,31,162,0.22), transparent 55%), linear-gradient(135deg, #070a16 0%, #0d1230 100%)'
          : 'radial-gradient(1000px 500px at 80% -10%, rgba(0,61,166,0.16), transparent 60%), radial-gradient(800px 500px at 0% 110%, rgba(0,180,255,0.14), transparent 55%), linear-gradient(135deg, #f4f7ff 0%, #e6ecff 100%)',
        border: dark ? '1px solid rgba(120,150,255,0.14)' : '1px solid rgba(0,61,166,0.10)',
      }} onMouseMove={onMove} onMouseLeave={onLeave}>
        {/* Vraies cartes de sport flottantes (décor + parallaxe) */}
        <div className="mb-hero-cards" aria-hidden="true" ref={cardsRef}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`mb-card mb-card-${i + 1}`}>
              <div className="mb-card-inner">
                {cardImgs[i] && <img src={cardImgs[i]} alt="" />}
                <span className="mb-card-shine" />
              </div>
            </div>
          ))}
        </div>

        <div className="mb-hero-inner">
          <span className="mb-hero-badge">✦ {lang === 'fr' ? 'Scan IA · Galerie collectionneurs' : 'AI Scan · Collector Gallery'}</span>
          <h1 className="mb-hero-title" style={{ color: dark ? '#fff' : '#0a2a6b' }}>
            {t('home_hero')}
          </h1>
          <p className="mb-hero-sub" style={{ color: dark ? 'rgba(255,255,255,0.72)' : '#41598f' }}>
            {t('home_sub')}
          </p>
          <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/sinscrire" className="btn-main btn-primary">{t('home_cta1')}</Link>
            <Link href="/annuaire" className="btn-main btn-secondary">{t('home_cta2')}</Link>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
            {(lang === 'fr'
              ? ['⚡ 1 photo suffit', '💰 Prix eBay en direct', '🔗 Galerie partageable', '🆓 100% gratuit']
              : ['⚡ 1 photo is enough', '💰 Live eBay prices', '🔗 Shareable gallery', '🆓 100% free']
            ).map(f => (
              <span key={f} style={{
                fontSize: 11, padding: '5px 13px', borderRadius: 999, fontWeight: 700,
                background: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,61,166,0.07)',
                color: dark ? 'rgba(255,255,255,0.72)' : '#2a4a8f',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.13)' : 'rgba(0,61,166,0.14)'}`,
              }}>{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Section vitrine scan IA */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{
            display: 'inline-block', marginBottom: 14,
            background: 'rgba(0,61,166,0.08)', color: '#003DA6',
            border: '1px solid rgba(0,61,166,0.18)', borderRadius: 999,
            padding: '5px 16px', fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
          }}>
            {lang === 'fr' ? '✦ INTELLIGENCE ARTIFICIELLE' : '✦ ARTIFICIAL INTELLIGENCE'}
          </span>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 900, margin: '0 0 12px', lineHeight: 1.1, color: dark ? '#fff' : '#0a2a6b' }}>
            {lang === 'fr' ? "Identifiez n'importe quelle carte en 1 photo" : 'Identify any card in 1 photo'}
          </h2>
          <p style={{ maxWidth: 500, margin: '0 auto', fontSize: 15, lineHeight: 1.6, color: dark ? 'rgba(255,255,255,0.62)' : '#4a6080' }}>
            {lang === 'fr'
              ? "Notre IA reconnaît joueur, année, marque, collection et variation automatiquement. Plus besoin de chercher manuellement."
              : "Our AI automatically recognizes player, year, brand, set and variation. No more manual searching."}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 120, height: 168, borderRadius: 14, margin: '0 auto 10px',
              background: dark ? 'rgba(255,255,255,0.05)' : '#f0f4ff',
              border: `2px dashed ${dark ? 'rgba(255,255,255,0.18)' : '#c0d0ef'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 34 }}>📷</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.45)' : '#8090b0' }}>
                {lang === 'fr' ? 'Ta photo' : 'Your photo'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.45)' : '#8090b0', fontWeight: 600 }}>
              {lang === 'fr' ? 'Recto + verso' : 'Front + back'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{
              background: '#003DA6', color: 'white', borderRadius: 999,
              padding: '5px 13px', fontSize: 11, fontWeight: 800, letterSpacing: 0.4,
              boxShadow: '0 4px 16px rgba(0,61,166,0.4)',
            }}>IA</span>
            <span style={{ fontSize: 22, color: dark ? 'rgba(255,255,255,0.35)' : '#003DA6', fontWeight: 300 }}>→</span>
          </div>

          <div style={{
            background: dark ? '#0d1432' : 'white',
            border: dark ? '1px solid rgba(0,120,255,0.28)' : '1px solid #dce8ff',
            borderRadius: 16, padding: '18px 24px',
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.45)' : '0 8px 32px rgba(0,61,166,0.09)',
            minWidth: 210,
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#2a8a4a', letterSpacing: 0.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#2a8a4a', color: 'white', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
              {lang === 'fr' ? 'CARTE IDENTIFIÉE' : 'CARD IDENTIFIED'}
            </div>
            {(lang === 'fr'
              ? [['Joueur', 'LeBron James'], ['Année', '2022-23'], ['Marque', 'Panini Prizm'], ['Collection', 'Silver Prizm'], ['Variation', 'Holo']]
              : [['Player', 'LeBron James'], ['Year', '2022-23'], ['Brand', 'Panini Prizm'], ['Set', 'Silver Prizm'], ['Variation', 'Holo']]
            ).map(([label, val]) => (
              <div key={label} style={{ marginBottom: 7 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.4)' : '#8090b0', letterSpacing: 0.3, display: 'block', textTransform: 'uppercase' as const }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#fff' : '#0a2a6b' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-title">{lang === 'fr' ? 'Comment ça marche ?' : 'How it works?'}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 25, marginBottom: 60 }}>
        {steps.map(s => (
          <div key={s.n} style={{ background: 'white', padding: 30, borderRadius: 15, border: '1px solid #eee', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -15, left: 20, background: '#003DA6', color: 'white', width: 35, height: 35, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>{s.n}</div>
            <h4 style={{ margin: '15px 0 10px', fontWeight: 800, fontSize: 18 }}>{s.title}</h4>
            <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5 }}>{s.desc}</p>
            {s.link && <Link href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, display: 'inline-block', marginTop: 10 }}>{s.linkText}</Link>}
          </div>
        ))}
      </section>

      <div className="section-title">{lang === 'fr' ? 'En chiffres' : 'By the numbers'}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 50 }}>
        {[
          { val: total, label: t('home_collectors') },
          { val: totalCartes.toLocaleString('fr-FR'), label: t('home_cards') },
          { val: '100%', label: t('home_3d') },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', padding: 30, borderRadius: 15, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#003DA6' }}>{s.val}</h3>
            <p style={{ color: '#999', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, marginTop: 5 }}>{s.label}</p>
          </div>
        ))}
      </section>

      <div className="section-title">{t('home_pepites')}</div>
    </>
  )
}
