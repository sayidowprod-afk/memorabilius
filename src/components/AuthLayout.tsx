'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

// 288 · Connexion et inscription plus accueillantes : un mur de vraies cartes récentes en fond (très discret), et sur grand écran
// quelques mots sur ce que le site apporte, à côté du formulaire. Même source d'images que l'accueil.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLang()
  const [imgs, setImgs] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    supabase.from('cartes_manuelles').select('image_recto').not('image_recto', 'is', null).eq('is_horizontal', false)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => {
        if (cancelled) return
        const urls = Array.from(new Set((data || []).map((r: { image_recto: string | null }) => r.image_recto).filter(Boolean))) as string[]
        setImgs(urls.sort(() => Math.random() - 0.5).slice(0, 18))
      })
    return () => { cancelled = true }
  }, [])

  const fr = lang === 'fr'
  const points = fr
    ? ['📷 Ta galerie gratuite : l’IA identifie tes cartes à partir d’une photo.', '🔄 Échange, vends et suis ta wishlist avec d’autres collectionneurs.', '💰 Prix eBay en direct, setlists et calendrier des sorties.']
    : ['📷 Your free gallery: AI identifies your cards from a photo.', '🔄 Trade, sell and follow your wishlist with other collectors.', '💰 Live eBay prices, setlists and release calendar.']

  return (
    <div className="auth-split">
      <div className="auth-wall" aria-hidden="true">
        {imgs.map(u => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={u} src={u} alt="" loading="lazy" />
        ))}
      </div>
      <aside className="auth-pitch">
        <h2 className="da-display">{fr ? 'Ta collection mérite une vraie vitrine' : 'Your collection deserves a real showcase'}</h2>
        <ul>{points.map(p => <li key={p}>{p}</li>)}</ul>
      </aside>
      <div className="auth-form">{children}</div>
    </div>
  )
}
