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

interface FeaturedGallery {
  id: string; display_name: string; avatar_url: string | null
  stats_total: number; topCards: string[]
}

export default function HomeHero({ total, totalCartes, featuredGalleries = [] }: { total: number; totalCartes: number; featuredGalleries?: FeaturedGallery[] }) {
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [cardImgs, setCardImgs] = useState<string[]>([])
  const cardsRef = useRef<HTMLDivElement>(null)

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

  const featureList = lang === 'fr' ? [
    { icon: '🤖', title: 'Scan IA instantané', desc: "1 photo suffit : notre IA reconnaît joueur, année, marque et variation automatiquement.", color: '#003DA6' },
    { icon: '🃏', title: 'Galerie 3D interactive', desc: "Tes cartes visualisées en holographique interactif. Partage ton profil de collectionneur en 1 lien.", color: '#7c3aed' },
    { icon: '💰', title: 'Prix eBay en direct', desc: "Connais la valeur de chaque carte grâce aux ventes récentes eBay, en temps réel.", color: '#059669' },
    { icon: '🔄', title: "Système d'échanges", desc: "Propose des trades directement depuis les galeries. Échange tes doubles avec la communauté.", color: '#d97706' },
    { icon: '📋', title: 'Setlist NBA & Pokémon', desc: "Compare ta collection aux sets officiels. Vois exactement quelles cartes il te manque.", color: '#0284c7' },
    { icon: '📔', title: 'Classeurs thématiques', desc: "Organise ta collection dans des classeurs partageables par équipe, saison ou thème.", color: '#0d9488' },
  ] : [
    { icon: '🤖', title: 'Instant AI Scan', desc: "1 photo is enough: our AI recognizes player, year, brand and variation automatically.", color: '#003DA6' },
    { icon: '🃏', title: 'Interactive 3D Gallery', desc: "Your cards visualized in holographic interactive view. Share your collector profile in 1 link.", color: '#7c3aed' },
    { icon: '💰', title: 'Live eBay Prices', desc: "Know the value of each card from recent eBay sales, in real time.", color: '#059669' },
    { icon: '🔄', title: 'Trading System', desc: "Propose trades directly from galleries. Exchange doubles with the community.", color: '#d97706' },
    { icon: '📋', title: 'NBA & Pokémon Setlist', desc: "Compare your collection to official sets. See exactly which cards you're missing.", color: '#0284c7' },
    { icon: '📔', title: 'Thematic Binders', desc: "Organize your collection in shareable binders by team, season or theme.", color: '#0d9488' },
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
          <span className="mb-hero-badge">✦ {lang === 'fr' ? 'La plateforme des collectionneurs de cartes' : 'The platform for card collectors'}</span>
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
              ? ['🤖 Scan IA', '🃏 Galerie 3D', '💰 Prix eBay live', '🔄 Échanges', '🆓 Gratuit']
              : ['🤖 AI Scan', '🃏 3D Gallery', '💰 Live eBay prices', '🔄 Trading', '🆓 Free']
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

      {/* Grille des 6 fonctionnalités */}
      <section style={{ marginBottom: 56 }}>
        <div className="section-title">{lang === 'fr' ? 'Tout ce dont vous avez besoin' : 'Everything you need'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {featureList.map(f => (
            <div key={f.title}
              style={{
                background: dark ? 'rgba(13,18,48,0.95)' : 'white',
                border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e8eeff',
                borderRadius: 16, padding: '24px 22px',
                display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.35)' : '0 2px 20px rgba(0,61,166,0.07)',
                transition: 'transform 0.18s, box-shadow 0.18s',
                cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,61,166,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = dark ? '0 4px 24px rgba(0,0,0,0.35)' : '0 2px 20px rgba(0,61,166,0.07)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: `${f.color}18`, flexShrink: 0 }}>
                <span role="img">{f.icon}</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: dark ? '#e8eeff' : '#0a2a6b' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: dark ? 'rgba(255,255,255,0.6)' : '#5a6e90', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Galeries vedettes */}
      {featuredGalleries.length > 0 && (
        <section style={{ marginBottom: 56 }}>
          <div className="section-title">{lang === 'fr' ? 'Leurs collections ✦' : 'Their collections ✦'}</div>
          <p style={{ textAlign: 'center', color: dark ? 'rgba(255,255,255,0.5)' : '#7a8fb0', fontSize: 14, marginTop: -12, marginBottom: 24 }}>
            {lang === 'fr' ? 'Rejoins des centaines de collectionneurs déjà sur Memorabilius' : 'Join hundreds of collectors already on Memorabilius'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {featuredGalleries.map(g => (
              <Link key={g.id} href={`/galerie/${g.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: dark ? 'rgba(13,18,48,0.95)' : 'white',
                  border: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #e0e8ff',
                  borderRadius: 18, overflow: 'hidden',
                  boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,61,166,0.10)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = dark ? '0 16px 48px rgba(0,0,0,0.55)' : '0 12px 40px rgba(0,61,166,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = dark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,61,166,0.10)' }}>
                  {/* Aperçu multi-cartes */}
                  <div style={{ height: 200, background: dark ? '#070c24' : '#f0f4ff', display: 'flex', gap: 3, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
                    {g.topCards.slice(0, 3).map((src, i) => (
                      <div key={i} style={{
                        flex: 1, height: '100%', borderRadius: 8, overflow: 'hidden',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                        transform: i === 1 && g.topCards.length === 3 ? 'scaleY(1.06)' : 'none',
                        transition: 'transform 0.2s',
                        background: dark ? '#0a1230' : '#dce6ff',
                      }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </div>
                    ))}
                  </div>
                  {/* Infos collecteur */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #eef2ff' }}>
                    <img
                      src={g.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(g.display_name || 'U')}&background=003DA6&color=fff`}
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #003DA6' }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: dark ? '#e8eeff' : '#0a2a6b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.display_name}</div>
                      <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.45)' : '#7a8fb0', marginTop: 1 }}>
                        {g.stats_total.toLocaleString('fr-FR')} {lang === 'fr' ? 'cartes dans sa collection' : 'cards in their collection'}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white', background: '#003DA6', padding: '5px 11px', borderRadius: 999, flexShrink: 0 }}>
                      {lang === 'fr' ? 'Voir →' : 'View →'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link href="/sinscrire" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 14, fontWeight: 800,
              color: 'white', background: '#003DA6',
              padding: '11px 24px', borderRadius: 999,
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,61,166,0.4)',
            }}>
              {lang === 'fr' ? '🚀 Créer ma galerie gratuitement' : '🚀 Create my gallery for free'}
            </Link>
            <Link href="/annuaire" style={{ display: 'block', marginTop: 10, fontSize: 13, fontWeight: 600, color: dark ? '#4da3ff' : '#003DA6', textDecoration: 'none' }}>
              {lang === 'fr' ? 'Explorer toutes les galeries →' : 'Explore all galleries →'}
            </Link>
          </div>
        </section>
      )}

      <div className="section-title">{lang === 'fr' ? 'En chiffres' : 'By the numbers'}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 50 }}>
        {[
          { val: total, label: t('home_collectors') },
          { val: totalCartes.toLocaleString('fr-FR'), label: t('home_cards') },
          { val: '100%', label: t('home_3d') },
        ].map(s => (
          <div key={s.label} style={{ background: dark ? '#0d1230' : 'white', padding: 30, borderRadius: 15, textAlign: 'center', boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)', border: dark ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: dark ? '#4da3ff' : '#003DA6' }}>{s.val}</h3>
            <p style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#999', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, marginTop: 5 }}>{s.label}</p>
          </div>
        ))}
      </section>

      <div className="section-title">{t('home_pepites')}</div>
    </>
  )
}
