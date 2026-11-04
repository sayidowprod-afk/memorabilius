'use client'
import { useCallback, useEffect, useState } from 'react'
import type { CardMarket, Seg } from '@/lib/playerCardMarket'

// Bloc « Marché des cartes » d'une fiche joueur : catalogue mondial (TCDB) + annonces eBay en cours.
// Mis en cache sur la fiche ; « Actualiser » relance le calcul. Les prix sont des prix DEMANDÉS (annonces), en dollars.
const usd = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })
const nf = (n: number) => n.toLocaleString('fr-FR')

export default function CardMarketPanel({ sheetId, getToken, dark, color, labelStyle }: {
  sheetId: string; getToken: () => Promise<string | null>; dark: boolean; color: string; labelStyle: React.CSSProperties
}) {
  const [data, setData] = useState<CardMarket | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Renvoie { market } ou { error } sans toucher à l'état : l'appelant décide quoi afficher.
  const fetchMarket = useCallback(async (refresh: boolean): Promise<{ market?: CardMarket; error?: string }> => {
    try {
      const tok = await getToken()
      if (!tok) return { error: 'Session expirée.' }
      const res = await fetch('/api/admin/player-sheets-market', {
        method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId, refresh }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { error: json.error === 'migration' ? 'Migration 20261107 à lancer dans Supabase.' : 'Calcul impossible.' }
      return { market: json.market }
    } catch { return { error: 'Calcul impossible.' } }
  }, [getToken, sheetId])

  const load = async (refresh: boolean) => {
    setLoading(true); setErr(null)
    const r = await fetchMarket(refresh)
    if (r.market) setData(r.market)
    if (r.error) setErr(r.error)
    setLoading(false)
  }

  // premier affichage : `loading` est déjà vrai, on lit le cache (ou on calcule la première fois)
  useEffect(() => {
    let off = false
    fetchMarket(false).then(r => {
      if (off) return
      if (r.market) setData(r.market)
      if (r.error) setErr(r.error)
      setLoading(false)
    })
    return () => { off = true }
  }, [fetchMarket])

  const box: React.CSSProperties = { border: `1px solid ${dark ? '#333' : '#e5e5e5'}`, borderRadius: 10, padding: '8px 10px', background: dark ? '#111' : '#fafafa' }
  const big: React.CSSProperties = { fontSize: 20, fontWeight: 900, lineHeight: 1.1, color }
  const small: React.CSSProperties = { fontSize: 11, color: dark ? '#aaa' : '#777' }
  const c = data?.catalog, m = data?.market
  const seg = (label: string, s: Seg | null | undefined) => (
    <div style={box} key={label}>
      <div style={small}>{label}</div>
      {s ? <><div style={big}>{usd(s.median)}</div><div style={small}>{s.n} annonce{s.n > 1 ? 's' : ''} · {usd(s.min)} – {usd(s.max)}</div></>
        : <div style={{ ...small, marginTop: 4 }}>pas assez d’annonces</div>}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={labelStyle}>Marché des cartes {loading && '· calcul…'}</span>
        <button type="button" onClick={() => load(true)} disabled={loading} style={{ padding: '3px 10px', borderRadius: 14, border: `1px solid ${color}`, background: 'transparent', color, fontWeight: 700, fontSize: 11.5, cursor: loading ? 'wait' : 'pointer' }}>{data ? '↻ Actualiser' : '▶ Calculer'}</button>
        {data?.at && <span style={small}>mis à jour le {new Date(data.at).toLocaleDateString('fr-FR')}</span>}
      </div>
      {err && <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 6 }}>{err}</div>}
      {!data && !loading && !err && <div style={small}>Stats non calculées : l’équipe n’est pas cochée dans « Fiches joueurs ». Coche-la pour un calcul en lot, ou calcule celle-ci avec le bouton.</div>}
      {data && (
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {c ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 8 }}>
                <div style={box}><div style={big}>{nf(c.total)}</div><div style={small}>cartes répertoriées</div></div>
                <div style={box}><div style={big}>{nf(c.sets)}</div><div style={small}>sets</div></div>
                <div style={box}><div style={big}>{nf(c.rc)}</div><div style={small}>RC</div></div>
                <div style={box}><div style={big}>{nf(c.auto)}</div><div style={small}>autos</div></div>
                <div style={box}><div style={big}>{nf(c.patch)}</div><div style={small}>patchs</div></div>
              </div>
              <div style={small}>
                {c.firstYear && c.lastYear ? `${c.firstYear === c.lastYear ? c.firstYear : `${c.firstYear}–${c.lastYear}`} · ` : ''}
                {c.topBrands.map(b => `${b.brand} (${nf(b.count)})`).join(' · ')}
              </div>
              <div style={small}>Sets principaux : {c.topSets.map(s => `${s.year ? s.year + ' ' : ''}${s.name.replace(/^\d{4}(-\d{2})?\s*/, '')}`).join(' · ')}</div>
            </>
          ) : <div style={small}>Joueur absent du catalogue TCDB.</div>}
          {m ? (
            <>
              <div style={{ ...small, fontWeight: 700 }}>
                eBay · annonces en cours{m.listings != null ? ` (${nf(m.listings)} pour ce joueur)` : ''} · prix médians demandés
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {seg('Échantillon toutes cartes', m.all)}{seg('RC', m.rc)}{seg('Autos', m.auto)}{seg('Patchs', m.patch)}{seg('PSA 10', m.psa10)}
              </div>
              <div style={{ ...small, fontStyle: 'italic' }}>Prix demandés par les vendeurs (pas des ventes conclues), en dollars, catégorie Basketball Cards.</div>
            </>
          ) : <div style={small}>Marché eBay indisponible.</div>}
        </div>
      )}
    </div>
  )
}
