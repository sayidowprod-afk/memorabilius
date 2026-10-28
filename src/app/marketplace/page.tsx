'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useTheme } from '@/lib/ThemeContext'
import { useMarketplaceAccess } from '@/lib/useMarketplaceAccess'
import { fmtEur, type Listing, type ListingSeller } from '@/lib/marketplace'
import { SPORT_LABELS, inferSportFromTeamName, type Sport } from '@/lib/sportsTeams'

// Marketplace -- étape 0 (bêta privée) : annonces avec prix, contact par la messagerie.
// Aucun paiement, aucune livraison pour l'instant. Accès contrôlé côté serveur.
export default function MarketplacePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { dark } = useTheme()
  const allowed = useMarketplaceAccess()

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [grade, setGrade] = useState<'' | 'raw' | 'graded'>('')
  const [sport, setSport] = useState<Sport | ''>('')
  const [year, setYear] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [flags, setFlags] = useState({ rc: false, auto: false, patch: false })
  const [sort, setSort] = useState<'recent' | 'price_asc' | 'price_desc'>('recent')
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [sellers, setSellers] = useState<Record<string, ListingSeller>>({})
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => { if (allowed === false) router.replace('/') }, [allowed, router])
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const params = new URLSearchParams()
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim())
      if (grade) params.set('grade', grade)
      if (year.trim()) params.set('year', year.trim())
      if (min) params.set('min', min.replace(',', '.'))
      if (max) params.set('max', max.replace(',', '.'))
      if (flags.rc) params.set('rc', '1')
      if (flags.auto) params.set('auto', '1')
      if (flags.patch) params.set('patch', '1')
      if (sort !== 'recent') params.set('sort', sort)
      try {
        const res = await fetch(`/api/marketplace/listings?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (!res.ok) throw new Error('Chargement impossible')
        const json = await res.json()
        if (cancelled) return
        setListings(json.listings || []); setSellers(json.sellers || {}); setTotal(json.total || 0); setError('')
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Erreur'); setListings([]) }
      }
    })()
    return () => { cancelled = true }
  }, [allowed, debouncedQ, grade, year, min, max, flags, sort])

  // Le sport se déduit de l'équipe (pas de colonne dédiée sur les cartes) : filtre côté navigateur.
  const shown = useMemo(
    () => (listings || []).filter(l => !sport || inferSportFromTeamName(l.equipe || '') === sport),
    [listings, sport],
  )
  const sportsPresent = useMemo(() => {
    const s = new Set<Sport>()
    for (const l of listings || []) { const sp = inferSportFromTeamName(l.equipe || ''); if (sp) s.add(sp) }
    return [...s].sort()
  }, [listings])

  if (allowed !== true) return null

  const bg = dark ? '#121212' : '#f4f6fb'
  const card = dark ? '#1e1e1e' : '#fff'
  const border = dark ? '#2e2e2e' : '#e1e6f0'
  const text = dark ? '#eee' : '#1a1a1a'
  const sub = dark ? '#999' : '#6b7280'
  const input: React.CSSProperties = { padding: '9px 12px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? '#2a2a2a' : '#fff', color: text, fontSize: 14, boxSizing: 'border-box' }
  const chip = (on: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer',
    border: `1.5px solid ${on ? '#003DA6' : border}`, background: on ? '#003DA6' : 'transparent', color: on ? '#fff' : text,
  })

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '28px 16px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', color: text }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>🛒 Marketplace</h1>
          <Link href="/" style={{ ...chip(false), textDecoration: 'none' }}>← Quitter le mode marketplace</Link>
        </div>
        <p style={{ color: sub, fontSize: 13, margin: '0 0 18px' }}>
          <span style={{ background: '#e67e22', color: '#fff', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>BÊTA PRIVÉE</span>
          Visible par toi seul. Étape 0 : annonces avec prix, contact par message — pas encore de paiement ni de livraison.
        </p>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 14, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Joueur, collection, marque… (ex : erving mosaic)" style={{ ...input, flex: '2 1 240px' }} />
            <input value={year} onChange={e => setYear(e.target.value)} placeholder="Année (ex : 2023)" style={{ ...input, flex: '1 1 120px' }} />
            <input value={min} onChange={e => setMin(e.target.value)} placeholder="Prix min €" inputMode="decimal" style={{ ...input, flex: '0 1 100px' }} />
            <input value={max} onChange={e => setMax(e.target.value)} placeholder="Prix max €" inputMode="decimal" style={{ ...input, flex: '0 1 100px' }} />
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={{ ...input, flex: '1 1 160px' }}>
              <option value="recent">Plus récentes</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {([['', 'Toutes'], ['raw', 'Raw'], ['graded', 'Gradées']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setGrade(v)} style={chip(grade === v)}>{l}</button>
            ))}
            <span style={{ width: 1, height: 22, background: border, margin: '0 4px' }} />
            {(['rc', 'auto', 'patch'] as const).map(k => (
              <button key={k} type="button" onClick={() => setFlags(f => ({ ...f, [k]: !f[k] }))} style={chip(flags[k])}>{k.toUpperCase()}</button>
            ))}
            {sportsPresent.length > 1 && (
              <select value={sport} onChange={e => setSport(e.target.value as Sport | '')} style={{ ...input, marginLeft: 'auto' }}>
                <option value="">Tous les sports</option>
                {sportsPresent.map(s => <option key={s} value={s}>{SPORT_LABELS[s] ?? s}</option>)}
              </select>
            )}
          </div>
        </div>

        {error && <p style={{ color: '#e74c3c', fontWeight: 700 }}>{error}</p>}
        {listings === null ? (
          <p style={{ color: sub }}>Chargement…</p>
        ) : shown.length === 0 ? (
          <div style={{ background: card, border: `1px dashed ${border}`, borderRadius: 12, padding: '36px 20px', textAlign: 'center', color: sub }}>
            <p style={{ margin: '0 0 6px', fontWeight: 800, color: text }}>Aucune annonce pour le moment</p>
            <p style={{ margin: 0, fontSize: 14 }}>
              Ouvre une de tes cartes dans ta galerie (vue 3D) et renseigne un « Prix de vente » : elle apparaît ici.
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: sub, fontSize: 13, margin: '0 0 12px' }}>{total} annonce{total > 1 ? 's' : ''}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
              {shown.map(l => {
                const s = sellers[l.user_id]
                const mine = user?.id === l.user_id
                const grader = l.grade && l.grade.toLowerCase() !== 'raw' ? l.grade : null
                return (
                  <div key={l.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link href={`/galerie/${s?.slug || l.user_id}?card=${encodeURIComponent(l.image_recto || '')}`} style={{ display: 'block' }}>
                      {/* Pas d'arrondi sur la carte elle-même */}
                      <div style={{ aspectRatio: '5 / 7', background: dark ? '#111' : '#eef1f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {l.image_recto
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={l.image_recto} alt={l.nom} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 0 }} />
                          : <span style={{ color: sub, fontSize: 12 }}>Pas de photo</span>}
                      </div>
                    </Link>
                    <div style={{ minHeight: 64 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.25 }}>{l.nom}</div>
                      <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
                        {[l.annee, l.marque, l.collection, l.variation].filter(Boolean).join(' · ')}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {l.rc && <Tag>RC</Tag>}{l.auto && <Tag>AUTO</Tag>}{l.patch && <Tag>PATCH</Tag>}{l.num && <Tag>{l.num}</Tag>}{grader && <Tag strong>{grader}</Tag>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 20 }}>{fmtEur(Number(l.prix_vente))}</div>
                    <div style={{ fontSize: 12, color: sub }}>
                      Vendeur : <Link href={`/galerie/${s?.slug || l.user_id}`} style={{ color: '#003DA6', fontWeight: 700, textDecoration: 'none' }}>{s?.display_name || 'Membre'}</Link>
                    </div>
                    {mine ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: sub, textAlign: 'center', padding: '8px 0' }}>Ton annonce</div>
                    ) : (
                      <Link href={`/messages?to=${l.user_id}`} style={{ background: '#003DA6', color: '#fff', textAlign: 'center', padding: '9px 0', borderRadius: 8, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
                        Contacter le vendeur
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: strong ? '#003DA6' : 'rgba(0,61,166,.12)', color: strong ? '#fff' : '#003DA6' }}>{children}</span>
  )
}
