'use client'
// Fiche d'une carte à jouer dans le viewer : jeu, extension, numéro, rareté, langue, édition, état et prix Cardmarket / Scryfall (si la carte a été identifiée).
import { useEffect, useState } from 'react'
import { getTcgGame, tcgLabel } from '@/lib/tcgGames'
import { useLang } from '@/lib/LangContext'

interface P { jeu?: string; n: string; s: string; card_number?: string; rarete?: string; langue?: string; edition?: string; etat?: string; v: string; tcg_ref?: string }
type Price = { eur: number | null; eurFoil: number | null; source: string } | null
const mem = new Map<string, Price>()

export default function TcgInfoBlock({ card, metaColor, textColor, borderColor }: { card: P; metaColor: string; textColor: string; borderColor: string }) {
  const { lang } = useLang()
  const game = getTcgGame(card.jeu)
  const key = game && card.tcg_ref ? `${game.id}|${card.tcg_ref}|${card.langue || 'FR'}` : ''
  const [price, setPrice] = useState<Price>(key ? mem.get(key) ?? null : null)
  useEffect(() => {
    if (!key || !game?.source) { setPrice(null); return }
    if (mem.has(key)) { setPrice(mem.get(key) ?? null); return }
    let dead = false
    fetch(`/api/tcg/price?game=${game.id}&ref=${encodeURIComponent(card.tcg_ref!)}&lang=${encodeURIComponent(card.langue || 'FR')}`)
      .then(r => r.json()).then(j => { mem.set(key, j.price ?? null); if (!dead) setPrice(j.price ?? null) }).catch(() => {})
    return () => { dead = true }
  }, [key, game, card.tcg_ref, card.langue])
  if (!game) return null

  const isFoil = /foil|holo/i.test(card.v || '')
  const eur = price ? (isFoil && price.eurFoil != null ? price.eurFoil : price.eur) : null
  const rows: [string, string | undefined][] = [
    [tcgLabel('game', lang), `${game.emoji} ${game.label}`],
    [tcgLabel('set', lang), card.s],
    [tcgLabel('number', lang), card.card_number],
    [tcgLabel('rarity', lang), card.rarete],
    [tcgLabel('finish', lang), card.v],
    [tcgLabel('language', lang), card.langue],
    [tcgLabel('edition', lang), card.edition],
    [tcgLabel('condition', lang), card.etat],
  ]
  return (
    <div style={{ borderTop: `1px solid ${borderColor}`, marginTop: 10, paddingTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {rows.filter(([, v]) => v && v.trim()).map(([l, v]) => (
          <div key={l}>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>{l}</label>
            <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{v}</span>
          </div>
        ))}
      </div>
      {eur != null && (
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: '#1e9e57' }}>
          {tcgLabel('price', lang).replace('Cardmarket', price?.source === 'scryfall' ? 'Scryfall' : 'Cardmarket')} ≈ {eur.toFixed(2)} €
        </div>
      )}
    </div>
  )
}
