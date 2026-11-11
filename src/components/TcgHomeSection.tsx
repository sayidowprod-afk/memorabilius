'use client'
// Accueil des collectionneurs de cartes à jouer (réglage « Je collectionne » = TCG ou Les deux) : leurs jeux, le nombre de cartes, un accès rapide à l'ajout et au guide.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { useCollectionFocus } from '@/lib/useCollectionFocus'
import { ownGalleryHref } from '@/lib/ownGallery'
import { TCG_GAMES, tcgLabel } from '@/lib/tcgGames'

const ADD: Record<string, string> = { fr: 'Ajouter une carte', en: 'Add a card', de: 'Karte hinzufügen', es: 'Añadir una carta', it: 'Aggiungi una carta' }
const MINE: Record<string, string> = { fr: 'Mes cartes TCG', en: 'My TCG cards', de: 'Meine TCG-Karten', es: 'Mis cartas TCG', it: 'Le mie carte TCG' }
const GUIDE: Record<string, string> = { fr: 'Guide TCG', en: 'TCG guide', de: 'TCG-Leitfaden', es: 'Guía TCG', it: 'Guida TCG' }

export default function TcgHomeSection() {
  const { user } = useAuth()
  const { lang } = useLang()
  const focus = useCollectionFocus()
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [value, setValue] = useState<{ eur: number; n: number } | null>(null)
  const on = !!user && focus !== 'sport'
  const uid = user?.id
  useEffect(() => {
    if (!on || !uid) return
    let dead = false
    supabase.from('cartes_manuelles').select('jeu').eq('user_id', uid).not('jeu', 'is', null).limit(5000).then(({ data, error }) => {
      if (dead || error) return
      const c: Record<string, number> = {}
      for (const r of (data || []) as { jeu: string }[]) c[r.jeu] = (c[r.jeu] || 0) + 1
      setCounts(c)
    })
    // Valeur estimée : prix du jour (Cardmarket pour Pokémon, Scryfall pour Magic) des cartes identifiées, 60 cartes au plus, mis en cache côté serveur
    supabase.from('cartes_manuelles').select('jeu, tcg_ref, langue, variation, quantite').eq('user_id', uid).not('tcg_ref', 'is', null).limit(60).then(async ({ data, error }) => {
      if (dead || error || !data?.length) return
      const rows = data as { jeu: string; tcg_ref: string; langue?: string; variation?: string; quantite?: number }[]
      let eur = 0, n = 0, i = 0
      const worker = async () => {
        while (i < rows.length && !dead) {
          const r = rows[i++]
          try {
            const j = await (await fetch(`/api/tcg/price?game=${r.jeu}&ref=${encodeURIComponent(r.tcg_ref)}&lang=${encodeURIComponent(r.langue || 'FR')}`)).json()
            const pr = j.price as { eur: number | null; eurFoil: number | null } | null
            const v = pr ? (/foil|holo/i.test(r.variation || '') && pr.eurFoil != null ? pr.eurFoil : pr.eur) : null
            if (v != null) { eur += v * (r.quantite || 1); n++ }
          } catch { /* carte ignorée */ }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      if (!dead && n > 0) setValue({ eur, n })
    })
    return () => { dead = true }
  }, [on, uid])
  if (!on || !uid) return null
  const gal = ownGalleryHref(uid)
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  const btn: React.CSSProperties = { padding: '10px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none', textAlign: 'center' }
  const outline = { ...btn, border: '2px solid rgba(128,128,128,0.4)', color: 'inherit' }
  return (
    <section style={{ maxWidth: 1100, margin: '16px auto', padding: '0 16px' }} aria-label="TCG">
      <div style={{ border: '1px solid rgba(128,128,128,0.3)', borderRadius: 14, padding: 14, background: 'rgba(128,128,128,0.06)' }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>🎴 {tcgLabel('tcg', lang)}{counts ? ` · ${total}` : ''}{value ? <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 8, color: '#1e9e57' }}>≈ {Math.round(value.eur)} € <span style={{ opacity: 0.7, fontWeight: 600 }}>({value.n})</span></span> : null}</div>
        {counts && total === 0 && <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.8 }}>{tcgLabel('focusSub', lang)}</p>}
        {counts && total > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {TCG_GAMES.filter(g => counts[g.id]).map(g => (
              <Link key={g.id} href={`${gal}?jeu=${g.id}`} style={{ padding: '6px 12px', borderRadius: 16, border: `2px solid ${g.color}`, fontWeight: 800, fontSize: 12, textDecoration: 'none', color: 'inherit' }}>
                {g.emoji} {g.label} · {counts[g.id]}
              </Link>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link href={`/galerie/${uid}/ajouter`} style={{ ...btn, background: '#003DA6', color: '#fff' }}>＋ {ADD[lang] || ADD.fr}</Link>
          <Link href={`${gal}?jeu=tcg`} style={outline}>{MINE[lang] || MINE.fr}</Link>
          <Link href="/decks" style={outline}>{lang === 'en' ? 'My decks' : 'Mes decks'}</Link>
          <Link href="/tcg" style={outline}>{GUIDE[lang] || GUIDE.fr}</Link>
        </div>
      </div>
    </section>
  )
}
