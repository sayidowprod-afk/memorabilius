'use client'
// Champs de la fiche d'une carte à jouer (TCG). Remplace équipe / RC / AUTO / PATCH quand la carte est un TCG.
// La recherche pré-remplit la fiche depuis TCGdex (Pokémon) ou Scryfall (Magic) : extension, numéro, rareté, année, prix en euros.
import { useState } from 'react'
import { TCG_GAMES, TCG_LANGUAGES, TCG_CONDITIONS, getTcgGame, tcgLabel } from '@/lib/tcgGames'
import type { TcgHit } from '@/lib/tcgSources'

export interface TcgForm {
  jeu: string; nom: string; collection: string; card_number: string; rarete: string; langue: string; edition: string; etat: string
  variation: string; annee: string; marque: string; tcg_ref: string; grade: string; cert_number: string
}

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }

// « Sport » + un bouton par jeu : choisit le type de carte de la fiche
export function TcgKindPicker({ value, onChange, lang }: { value: string; onChange: (jeu: string) => void; lang: string }) {
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 13, transition: '0.15s',
    border: active ? '2px solid #003DA6' : '2px solid #e0e0e0', background: active ? '#003DA6' : 'white', color: active ? 'white' : '#333',
  })
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={LBL}>{tcgLabel('kind', lang)}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={() => onChange('')} style={chip(!value)}>🏀 {tcgLabel('sport', lang)}</button>
        {TCG_GAMES.map(g => <button key={g.id} type="button" onClick={() => onChange(g.id)} style={chip(value === g.id)}>{g.emoji} {g.label}</button>)}
      </div>
    </div>
  )
}

export default function TcgFields({ form, onChange, lang }: { form: TcgForm; onChange: (patch: Partial<TcgForm>) => void; lang: string }) {
  const game = getTcgGame(form.jeu)
  const [hits, setHits] = useState<TcgHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<TcgHit | null>(null)
  if (!game) return null

  const search = async () => {
    const q = form.nom.trim()
    if (q.length < 2 || !game.source) return
    setBusy(true); setHits(null)
    try {
      const r = await fetch(`/api/tcg/search?game=${game.id}&q=${encodeURIComponent(q)}&lang=${encodeURIComponent(form.langue || 'FR')}`)
      const j = await r.json()
      setHits((j.hits || []) as TcgHit[])
    } catch { setHits([]) }
    setBusy(false)
  }
  const pick = (h: TcgHit) => {
    setPicked(h); setHits(null)
    onChange({
      nom: h.name, collection: h.set, card_number: h.number, rarete: h.rarity && h.rarity !== 'Sans Rareté' ? h.rarity : form.rarete,
      annee: h.year || form.annee, marque: game.publisher, tcg_ref: h.ref,
      langue: TCG_LANGUAGES.includes(h.language) ? h.language : form.langue,
      variation: form.variation || (h.finishes?.includes('Normale') ? 'Normale' : h.finishes?.[0] || ''),
    })
  }

  return (
    <>
      <div>
        <label style={LBL}>{tcgLabel('name', lang)}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input required value={form.nom} onChange={e => onChange({ nom: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && game.source) { e.preventDefault(); void search() } }}
            placeholder={game.id === 'mtg' ? 'Lightning Bolt' : game.id === 'pokemon' ? 'Dracaufeu' : ''} />
          {game.source && <button type="button" onClick={search} disabled={busy || form.nom.trim().length < 2}
            style={{ whiteSpace: 'nowrap', padding: '0 14px', border: 'none', borderRadius: 10, background: '#003DA6', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? '…' : '🔍 ' + tcgLabel('find', lang)}</button>}
        </div>
        {hits && (
          <div style={{ marginTop: 8, border: '2px solid #e0e0e0', borderRadius: 10, maxHeight: 320, overflowY: 'auto', background: 'white' }}>
            {hits.length === 0 && <div style={{ padding: 12, fontSize: 13, color: '#888' }}>{tcgLabel('none', lang)}</div>}
            {hits.map(h => (
              <button key={h.ref} type="button" onClick={() => pick(h)}
                style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: 8, border: 'none', borderBottom: '1px solid #eee', background: 'white', cursor: 'pointer' }}>
                {h.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={h.image} alt="" style={{ width: 44, aspectRatio: '5/7', objectFit: 'cover', borderRadius: 3 }} /> : <span style={{ width: 44 }} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: '#111' }}>{h.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#666' }}>{[h.set, h.number, h.rarity, h.year].filter(Boolean).join(' · ')}</span>
                </span>
                {h.price?.eur != null && <span style={{ fontWeight: 800, fontSize: 13, color: '#1e9e57', whiteSpace: 'nowrap' }}>≈ {h.price.eur.toFixed(2)} €</span>}
              </button>
            ))}
          </div>
        )}
        {picked && !hits && (
          <p style={{ fontSize: 12, color: '#2e7d32', fontWeight: 700, margin: '6px 0 0' }}>
            ✓ {tcgLabel('filled', lang)}{picked.price?.eur != null ? ` · ${tcgLabel('price', lang)} ≈ ${picked.price.eur.toFixed(2)} €` : ''}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={LBL}>{tcgLabel('set', lang)}</label><input value={form.collection} onChange={e => onChange({ collection: e.target.value })} /></div>
        <div><label style={LBL}>{tcgLabel('number', lang)}</label><input value={form.card_number} onChange={e => onChange({ card_number: e.target.value })} placeholder={game.numberHint} /></div>
        <div>
          <label style={LBL}>{tcgLabel('rarity', lang)}</label>
          <input list="tcg-rarities" value={form.rarete} onChange={e => onChange({ rarete: e.target.value })} />
          <datalist id="tcg-rarities">{game.rarities.map(r => <option key={r} value={r} />)}</datalist>
        </div>
        <div>
          <label style={LBL}>{tcgLabel('finish', lang)}</label>
          <input list="tcg-finishes" value={form.variation} onChange={e => onChange({ variation: e.target.value })} />
          <datalist id="tcg-finishes">{game.finishes.map(r => <option key={r} value={r} />)}</datalist>
        </div>
        <div>
          <label style={LBL}>{tcgLabel('language', lang)}</label>
          <select value={form.langue} onChange={e => onChange({ langue: e.target.value })}><option value="">—</option>{TCG_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}</select>
        </div>
        <div>
          <label style={LBL}>{tcgLabel('edition', lang)}</label>
          <select value={form.edition} onChange={e => onChange({ edition: e.target.value })}><option value="">—</option>{game.editions.map(l => <option key={l} value={l}>{l}</option>)}</select>
        </div>
        <div>
          <label style={LBL}>{tcgLabel('condition', lang)}</label>
          <select value={form.etat} onChange={e => onChange({ etat: e.target.value })}><option value="">—</option>{TCG_CONDITIONS.map(l => <option key={l} value={l}>{l}</option>)}</select>
        </div>
        <div><label style={LBL}>{tcgLabel('year', lang)}</label><input value={form.annee} onChange={e => onChange({ annee: e.target.value })} placeholder="2024" /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={LBL}>{tcgLabel('grade', lang)}</label><input value={form.grade} onChange={e => onChange({ grade: e.target.value })} placeholder="Raw, PSA 10, PCA 9…" /></div>
        {form.grade.trim() && form.grade.trim().toLowerCase() !== 'raw' && (
          <div><label style={LBL}>N°</label><input value={form.cert_number} onChange={e => onChange({ cert_number: e.target.value })} /></div>
        )}
      </div>
    </>
  )
}
