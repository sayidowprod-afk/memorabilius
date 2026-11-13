'use client'
import { useState } from 'react'
import type { Lang } from './tiktokAd'

// 938 · Sous chaque vidéo : la légende prête à coller + les hashtags de la langue choisie, avec un bouton « Copier ».
const CAPTIONS: Record<Lang, { text: string; tags: string }> = {
  fr: { text: 'Ta collection de cartes, enfin à sa place 🃏 Galerie, 3D, échanges : gratuit sur memorabilius.fr', tags: '#cartesdecollection #collectionneur #basketball #cardcollector #thehobby' },
  en: { text: 'Your card collection, finally in one place 🃏 Gallery, 3D, trades: free at memorabilius.fr', tags: '#sportscards #cardcollector #thehobby #basketballcards #nba' },
  de: { text: 'Deine Kartensammlung endlich an einem Ort 🃏 Galerie, 3D, Tausch: kostenlos auf memorabilius.fr', tags: '#sammelkarten #kartensammler #basketballkarten #sportkarten #hobby' },
  es: { text: 'Tu colección de cartas, por fin en un solo sitio 🃏 Galería, 3D, intercambios: gratis en memorabilius.fr', tags: '#cartasdecoleccion #coleccionista #baloncesto #cardcollector #thehobby' },
  it: { text: 'La tua collezione di carte, finalmente in un posto solo 🃏 Galleria, 3D, scambi: gratis su memorabilius.fr', tags: '#cartedacollezione #collezionista #basket #cardcollector #thehobby' },
}

export default function PubCaption({ lang }: { lang: Lang }) {
  const c = CAPTIONS[lang] || CAPTIONS.fr
  const full = c.text + '\n\n' + c.tags
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(full); setDone(true); setTimeout(() => setDone(false), 2000) }
    catch { /* le texte reste sélectionnable */ }
  }
  return (
    <div style={{ marginTop: 10, border: '2px solid var(--border, #243063)', padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text2, #aab3d1)', marginBottom: 6 }}>Légende prête à publier</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, overflowWrap: 'anywhere', userSelect: 'all' }}>{full}</div>
      <button type="button" onClick={copy} style={{ marginTop: 8, padding: '7px 14px', background: '#2f6bff', color: '#fff', border: 0, fontWeight: 800, cursor: 'pointer' }}>{done ? '✓ Copié' : 'Copier la légende'}</button>
    </div>
  )
}
