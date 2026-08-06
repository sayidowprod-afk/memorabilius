'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Card = {
  id: string | number
  img: string
  nom: string
  annee: string
  marque: string
  collection: string
  variation: string
  rc: boolean
  auto: boolean
  patch: boolean
  num: string
  created_at?: string | null
  is_horizontal: boolean
  user_id: string
  display_name?: string
  avatar_url?: string
  accent: string
  disponible_vente?: boolean
  source: 'manuel' | 'csv'
  cardUrl: string
}

type SortKey = 'default' | 'y_desc' | 'y_asc' | 'name' | 'date_desc' | 'num_asc' | 'rare'

function parseNumDenom(num: string): number {
  if (!num) return Infinity
  const m = num.match(/\/(\d+)/)
  if (m) return parseInt(m[1])
  const n = parseInt(num.replace(/\D/g, ''))
  return isNaN(n) ? Infinity : n
}

function rareScore(c: Card): number {
  // lower = rarer
  if (parseNumDenom(c.num) === 1) return 0
  if (c.auto && c.patch) return 1
  if (c.auto && !!c.num) return 2
  if (c.patch && !!c.num) return 3
  if (c.auto) return 4
  if (c.patch) return 5
  if (c.rc && !!c.num) return 6
  if (!!c.num) return 7
  if (c.rc) return 8
  return 9
}
type MyMode = 'all' | 'only' | 'exclude'

export default function CommunityCardsSection({ cards, totalCollectors }: { cards: Card[]; totalCollectors: number }) {
  const [myId, setMyId] = useState<string | null>(null)
  const [fRc, setFRc] = useState(false)
  const [fAuto, setFAuto] = useState(false)
  const [fPatch, setFPatch] = useState(false)
  const [fNum, setFNum] = useState(false)
  const [fVente, setFVente] = useState(false)
  const [myMode, setMyMode] = useState<MyMode>('all')
  const [sort, setSort] = useState<SortKey>('default')
  const [visibleCount, setVisibleCount] = useState(48)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setMyId(session?.user?.id || null))
  }, [])

  useEffect(() => {
    setVisibleCount(48)
  }, [fRc, fAuto, fPatch, fNum, fVente, myMode, sort])

  const filtered = useMemo(() => {
    let result = cards.filter(c =>
      (!fRc || c.rc) &&
      (!fAuto || c.auto) &&
      (!fPatch || c.patch) &&
      (!fNum || !!c.num) &&
      (!fVente || c.disponible_vente) &&
      (myMode === 'all' ||
        (myMode === 'only' ? c.user_id === myId : c.user_id !== myId))
    )
    if (sort === 'y_desc') result = [...result].sort((a, b) => (b.annee || '').localeCompare(a.annee || ''))
    else if (sort === 'y_asc') result = [...result].sort((a, b) => (a.annee || '').localeCompare(b.annee || ''))
    else if (sort === 'name') result = [...result].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
    else if (sort === 'date_desc') result = [...result].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    else if (sort === 'num_asc') result = [...result].sort((a, b) => parseNumDenom(a.num) - parseNumDenom(b.num))
    else if (sort === 'rare') result = [...result].sort((a, b) => rareScore(a) - rareScore(b) || parseNumDenom(a.num) - parseNumDenom(b.num))
    return result
  }, [cards, fRc, fAuto, fPatch, fNum, fVente, myMode, myId, sort])

  const hasVente = useMemo(() => cards.some(c => c.disponible_vente), [cards])
  const hasNum = useMemo(() => cards.some(c => !!c.num), [cards])
  const hasAuto = useMemo(() => cards.some(c => c.auto), [cards])
  const hasPatch = useMemo(() => cards.some(c => c.patch), [cards])
  const hasActive = fRc || fAuto || fPatch || fNum || fVente || myMode !== 'all' || sort !== 'default'

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) setVisibleCount(c => c + 48) }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [filtered.length])

  const chip = (active: boolean, color: string) => ({
    padding: '5px 11px', border: `1.5px solid ${active ? color : 'var(--jp-border)'}`,
    borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 800,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', transition: '0.15s',
    background: active ? color : 'var(--jp-surface)',
    color: active ? 'white' : 'var(--jp-muted)',
  })

  const clearAll = () => { setFRc(false); setFAuto(false); setFPatch(false); setFNum(false); setFVente(false); setMyMode('all'); setSort('default') }

  return (
    <section style={{ marginBottom: 52 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>Dans les collections</h2>
        <span style={{ fontSize: 13, color: 'var(--jp-muted)', fontWeight: 600 }}>
          {filtered.length !== cards.length
            ? `${filtered.length} / ${cards.length} cartes`
            : `${cards.length} carte${cards.length > 1 ? 's' : ''}`
          }
          {' · '}{totalCollectors} collectionneur{totalCollectors > 1 ? 's' : ''}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{ background: 'var(--jp-surface)', border: '1px solid var(--jp-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setFRc(v => !v)} style={chip(fRc, '#e67e22')}>RC</button>
        {hasAuto && (
          <button onClick={() => setFAuto(v => !v)} style={chip(fAuto, '#2e7d32')}>AUTO</button>
        )}
        {hasNum && (
          <button onClick={() => setFNum(v => !v)} style={chip(fNum, '#7b1fa2')}># Num</button>
        )}
        {hasPatch && (
          <button onClick={() => setFPatch(v => !v)} style={chip(fPatch, '#1976d2')}>PATCH</button>
        )}
        {hasVente && (
          <button onClick={() => setFVente(v => !v)} style={chip(fVente, '#2e7d32')}>🏷️ Trade</button>
        )}

        {myId && (
          <>
            <button
              onClick={() => setMyMode(m => m === 'only' ? 'all' : 'only')}
              style={chip(myMode === 'only', '#003DA6')}
            >👤 Mes cartes</button>
            <button
              onClick={() => setMyMode(m => m === 'exclude' ? 'all' : 'exclude')}
              style={chip(myMode === 'exclude', '#c0392b')}
            >✕ Exclure mes cartes</button>
          </>
        )}

        <div style={{ flex: 1 }} />

        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          style={{
            border: `1.5px solid ${sort !== 'default' ? 'var(--jp-accent)' : 'var(--jp-border)'}`,
            borderRadius: 20, padding: '5px 11px', fontSize: 11, fontWeight: 700,
            background: 'var(--jp-surface)', color: sort !== 'default' ? 'var(--jp-accent)' : 'var(--jp-muted)', cursor: 'pointer',
          }}>
          <option value="default">— Trier —</option>
          <option value="date_desc">Ajout récent</option>
          <option value="rare">Rareté</option>
          <option value="num_asc">Numérotation</option>
          <option value="y_desc">Année ↓ (récent)</option>
          <option value="y_asc">Année ↑ (ancien)</option>
          <option value="name">Nom A→Z</option>
        </select>

        {hasActive && (
          <button
            onClick={clearAll}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--jp-muted)', fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>
            ✕ Effacer
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--jp-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <p style={{ fontWeight: 800, color: 'var(--jp-text)', marginBottom: 6 }}>Aucune carte</p>
          <p style={{ fontSize: 13 }}>Aucune carte ne correspond à ces filtres.</p>
          <button onClick={clearAll}
            style={{ marginTop: 12, background: 'var(--jp-accent)', color: 'white', border: 'none', borderRadius: 20, padding: '7px 18px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            Effacer les filtres
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
            {filtered.slice(0, visibleCount).map((card) => (
              <Link key={card.id} href={card.source === 'manuel' ? card.cardUrl : `/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                <div className="jp-card-hover" style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--jp-surface)', border: `1.5px solid ${card.user_id === myId ? 'var(--jp-accent)' : 'var(--jp-border)'}`, height: '100%' }}>
                  <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', background: '#111' }}>
                    <img
                      src={card.img}
                      alt={card.nom}
                      loading="lazy"
                      style={card.is_horizontal ? {
                        position: 'absolute', width: '140%', height: '71.43%',
                        left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover',
                      } : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {card.rc && (
                      <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, fontWeight: 900, background: '#e67e22', color: 'white', padding: '2px 6px', borderRadius: 3, lineHeight: 1.4 }}>RC</span>
                    )}
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                      {card.auto && <span style={{ fontSize: 9, fontWeight: 900, background: '#2e7d32', color: 'white', padding: '2px 5px', borderRadius: 3, lineHeight: 1.4 }}>AUTO</span>}
                      {card.patch && <span style={{ fontSize: 9, fontWeight: 900, background: '#1976d2', color: 'white', padding: '2px 5px', borderRadius: 3, lineHeight: 1.4 }}>PATCH</span>}
                      {card.disponible_vente && <span style={{ fontSize: 9, fontWeight: 900, background: '#c0392b', color: 'white', padding: '2px 5px', borderRadius: 3, lineHeight: 1.4 }}>🏷️</span>}
                    </div>
                    {card.num && (
                      <span style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 9, fontWeight: 900, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 5px', borderRadius: 3, lineHeight: 1.4 }}>{card.num}</span>
                    )}
                    {card.user_id === myId && (
                      <span style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 9, fontWeight: 900, background: 'rgba(0,0,0,0.65)', color: 'white', padding: '2px 5px', borderRadius: 3, lineHeight: 1.4 }}>👤</span>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--jp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.nom}</div>
                    <div style={{ fontSize: 10, color: 'var(--jp-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[card.annee, card.marque].filter(Boolean).join(' · ')}
                    </div>
                    {card.variation && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--jp-accent)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(0,61,166,0.07)', borderRadius: 3, padding: '1px 5px', display: 'inline-block', maxWidth: '100%' }}>
                        {card.variation}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--jp-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <img
                        src={card.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.display_name || 'U')}&background=003DA6&color=fff&size=20`}
                        style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0 }} alt=""
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.display_name}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length > visibleCount && (
            <div ref={sentinelRef} style={{ height: 40, marginTop: 16 }} />
          )}
        </>
      )}
    </section>
  )
}
