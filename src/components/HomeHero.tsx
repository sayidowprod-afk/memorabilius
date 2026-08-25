'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang, localeFor } from '@/lib/LangContext'
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
.mb-features-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
@media (max-width: 900px) {
  .mb-features-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 540px) {
  .mb-features-grid { grid-template-columns: repeat(2, 1fr); }
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

export default function HomeHero({ total, totalCartes, totalBinders, totalTrade, featuredGalleries = [] }: { total: number; totalCartes: number; totalBinders: number; totalTrade: number; featuredGalleries?: FeaturedGallery[] }) {
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

  const featureList = [
    { icon: '🤖', title: t('home_feat1_title'), desc: t('home_feat1_desc'), color: '#003DA6' },
    { icon: '🃏', title: t('home_feat2_title'), desc: t('home_feat2_desc'), color: '#7c3aed' },
    { icon: '💰', title: t('home_feat3_title'), desc: t('home_feat3_desc'), color: '#059669' },
    { icon: '🔄', title: t('home_feat4_title'), desc: t('home_feat4_desc'), color: '#d97706' },
    { icon: '📋', title: t('home_feat5_title'), desc: t('home_feat5_desc'), color: '#0284c7' },
    { icon: '📔', title: t('home_feat6_title'), desc: t('home_feat6_desc'), color: '#0d9488' },
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
        {/* Voile "aurore" tres lent en fond, purement decoratif */}
        <div className="aurora-bg" aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: dark
            ? 'radial-gradient(700px 400px at 20% 20%, rgba(0,150,255,0.16), transparent 60%), radial-gradient(700px 400px at 80% 80%, rgba(140,60,220,0.16), transparent 60%)'
            : 'radial-gradient(700px 400px at 20% 20%, rgba(0,120,255,0.10), transparent 60%), radial-gradient(700px 400px at 80% 80%, rgba(0,180,255,0.10), transparent 60%)',
        }} />
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
          <span className="mb-hero-badge">✦ {t('home_badge')}</span>
          <h1 className="mb-hero-title" style={{ color: dark ? '#fff' : '#0a2a6b' }}>
            {t('home_hero')}
          </h1>
          <p className="mb-hero-sub" style={{ color: dark ? 'rgba(255,255,255,0.72)' : '#41598f' }}>
            {t('home_sub')}
          </p>
          <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/sinscrire" className="btn-main btn-primary">{t('home_cta1')}</Link>
            <Link href="/annuaire" className="btn-main btn-secondary">{t('home_cta2')}</Link>
            <RandomBinderButton dark={dark} lang={lang} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
            {([t('home_pill_scan'), t('home_pill_gallery'), t('home_pill_prices'), t('home_pill_trades'), t('home_pill_free')]
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

      {/* Grille des 6 fonctionnalités — 1 ligne forcée */}
      <section style={{ marginBottom: 56 }}>
        <div className="section-title">{t('home_everything_needed')}</div>
        <div className="mb-features-grid">
          {featureList.map(f => (
            <div key={f.title}
              style={{
                background: dark ? 'rgba(13,18,48,0.95)' : 'white',
                border: dark ? `1px solid rgba(255,255,255,0.08)` : `1px solid #e8eeff`,
                borderTop: `3px solid ${f.color}`,
                borderRadius: 14, padding: '18px 14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,61,166,0.06)',
                transition: 'transform 0.18s, box-shadow 0.18s',
                cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = dark ? '0 8px 28px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,61,166,0.13)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,61,166,0.06)' }}>
              <span style={{ fontSize: 26 }}>{f.icon}</span>
              <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: dark ? '#e8eeff' : '#0a2a6b', lineHeight: 1.3 }}>{f.title}</h3>
              <p style={{ fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.5)' : '#5a6e90', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Galeries vedettes — plein format avec overlay */}
      {featuredGalleries.length > 0 && (
        <section style={{ marginBottom: 56 }}>
          <div className="section-title">{t('home_collecting_with_us')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            {featuredGalleries.map(g => (
              <Link key={g.id} href={`/galerie/${g.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  position: 'relative', borderRadius: 20, overflow: 'hidden', height: 310,
                  boxShadow: '0 8px 36px rgba(0,0,0,0.28)',
                  transition: 'transform 0.22s, box-shadow 0.22s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 16px 52px rgba(0,0,0,0.42)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 36px rgba(0,0,0,0.28)' }}>
                  {/* Cartes en plein format */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', background: '#06091a' }}>
                    {g.topCards.slice(0, 3).map((src, i) => (
                      <div key={i} style={{ flex: 1, overflow: 'hidden' }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ))}
                  </div>
                  {/* Gradient sombre en bas */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,3,18,0.92) 0%, rgba(0,3,18,0.3) 45%, transparent 100%)' }} />
                  {/* Infos collecteur en overlay */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <img
                        src={g.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(g.display_name || 'U')}&background=003DA6&color=fff`}
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.85)', flexShrink: 0 }} alt="" />
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{g.display_name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
                          {g.stats_total.toLocaleString(localeFor(lang))} {t('search_cards_lower')}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'white',
                      background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      padding: '6px 14px', borderRadius: 999,
                    }}>
                      {t('home_view_gallery_arrow')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/sinscrire" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 15, fontWeight: 800, color: 'white', background: '#003DA6',
              padding: '13px 28px', borderRadius: 999, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(0,61,166,0.45)',
            }}>
              {t('home_create_gallery_free')}
            </Link>
          </div>
        </section>
      )}

      <div className="section-title">{t('home_by_the_numbers')}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 50 }}>
        {[
          { val: total, label: t('home_collectors') },
          { val: totalCartes.toLocaleString(localeFor(lang)), label: t('home_cards') },
          { val: totalBinders.toLocaleString(localeFor(lang)), label: t('home_binders') },
          { val: totalTrade.toLocaleString(localeFor(lang)), label: t('home_trade') },
        ].map(s => (
          <div key={s.label} style={{ background: dark ? '#0d1230' : 'white', padding: 30, borderRadius: 15, textAlign: 'center', boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)', border: dark ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: dark ? '#4da3ff' : '#003DA6' }}>{s.val}</h3>
            <p style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#999', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, marginTop: 5 }}>{s.label}</p>
          </div>
        ))}
      </section>
    </>
  )
}

function RandomBinderButton({ dark }: { dark: boolean; lang: string }) {
  const { t } = useLang()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const go = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/random-binder')
      if (!res.ok) return
      const { userId, binderId } = await res.json()
      router.push(`/galerie/${userId}?tab=library&binder=${binderId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={go} disabled={loading} className="btn-main btn-secondary"
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {loading ? '⏳' : '🎲'} {t('home_random_binder')}
    </button>
  )
}
