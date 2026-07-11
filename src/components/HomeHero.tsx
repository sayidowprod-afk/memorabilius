'use client'
import { useEffect, useState } from 'react'
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
  position: absolute; width: 150px; height: 210px; border-radius: 12px;
  background: linear-gradient(135deg, #003DA6, #0a63d6 25%, #00e5ff 45%, #7b1fa2 70%, #003DA6);
  background-size: 300% 300%;
  box-shadow: 0 24px 50px rgba(0,0,0,0.38), inset 0 0 0 2px rgba(255,255,255,0.14);
  overflow: hidden; opacity: 0.9;
  animation: mbHolo 7s ease-in-out infinite, mbFloat 9s ease-in-out infinite;
}
.mb-card-shine {
  position: absolute; top: -60%; left: -30%; width: 70%; height: 220%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
  transform: rotate(18deg); filter: blur(6px);
  animation: mbSweep 5s ease-in-out infinite;
}
.mb-card-1 { top: 12%;  left: 5%;   transform: rotate(-16deg); animation-delay: 0s,   0s;   }
.mb-card-2 { bottom: 6%; left: 15%;  transform: rotate(10deg);  width: 120px; height: 168px; opacity: 0.75; animation-delay: 1.2s, 0.6s; }
.mb-card-3 { top: 14%;  right: 6%;   transform: rotate(15deg);  animation-delay: 0.6s, 1.1s; }
.mb-card-4 { bottom: 8%; right: 16%; transform: rotate(-9deg);  width: 120px; height: 168px; opacity: 0.75; animation-delay: 1.8s, 0.3s; }
@keyframes mbHolo { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes mbFloat { 0%,100% { translate: 0 0; } 50% { translate: 0 -16px; } }
@keyframes mbSweep { 0% { left: -40%; } 55%,100% { left: 130%; } }
@media (max-width: 820px) {
  .mb-card-2, .mb-card-4 { display: none; }
  .mb-card-1 { left: -6%; opacity: 0.5; }
  .mb-card-3 { right: -6%; opacity: 0.5; }
  .mb-hero-inner { padding: 70px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .mb-card, .mb-card-shine { animation: none; }
}
`

export default function HomeHero({ total, totalCartes }: { total: number; totalCartes: number }) {
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [galerieHref, setGalerieHref] = useState('/sinscrire')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setGalerieHref(`/galerie/${data.user.id}/ajouter`)
    })
  }, [])

  const steps = lang === 'fr' ? [
    { n: 1, title: 'Crée ton compte', desc: "Inscris-toi gratuitement en quelques secondes. Ton profil devient ta vitrine de collectionneur.", link: '/sinscrire', linkText: "Créer mon compte →" },
    { n: 2, title: 'Ajoute tes cartes', desc: "Prends en photo ta carte, l'IA reconnaît le joueur, l'année et la variation automatiquement. Tu n'as plus qu'à valider.", link: galerieHref, linkText: "Ajouter une carte →" },
    { n: 3, title: 'Suis ta collection', desc: "Compare ta galerie à la Setlist NBA, vois ce qu'il te manque, partage ton profil et échange avec d'autres collectionneurs.", link: '/setlist', linkText: "Explorer la Setlist →" },
  ] : [
    { n: 1, title: 'Create your account', desc: "Sign up for free in seconds. Your profile becomes your collector showcase.", link: '/sinscrire', linkText: "Create my account →" },
    { n: 2, title: 'Add your cards', desc: "Take a photo of your card, AI automatically recognizes the player, year and variation. Just confirm and save.", link: galerieHref, linkText: "Add a card →" },
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
      }}>
        {/* Cartes holographiques flottantes (décor) */}
        <div className="mb-hero-cards" aria-hidden="true">
          <div className="mb-card mb-card-1"><span className="mb-card-shine" /></div>
          <div className="mb-card mb-card-2"><span className="mb-card-shine" /></div>
          <div className="mb-card mb-card-3"><span className="mb-card-shine" /></div>
          <div className="mb-card mb-card-4"><span className="mb-card-shine" /></div>
        </div>

        <div className="mb-hero-inner">
          <span className="mb-hero-badge">✦ {lang === 'fr' ? 'Collection de cartes nouvelle génération' : 'Next-gen card collecting'}</span>
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
        </div>
      </section>

      <div className="section-title">{lang === 'fr' ? 'Comment ça marche ?' : 'How it works?'}</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 25, marginBottom: 60 }}>
        {steps.map(s => (
          <div key={s.n} style={{ background: 'white', padding: 30, borderRadius: 15, border: '1px solid #eee', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -15, left: 20, background: '#003DA6', color: 'white', width: 35, height: 35, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18 }}>{s.n}</div>
            <h4 style={{ margin: '15px 0 10px', fontWeight: 800, fontSize: 18 }}>{s.title}</h4>
            <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5 }}>{s.desc}</p>
            {s.link && <a href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, display: 'inline-block', marginTop: 10 }}>{s.linkText}</a>}
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
