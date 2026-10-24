'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TagIcon from '@/components/TagIcon'

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
type MyMode = 'all' | 'only' | 'exclude'

// Pagine via /api/player-cards (defilement + filtres/tri) plutot que de
// recevoir TOUTES les cartes d'un coup -- pour un joueur tres collectionne
// (ex: Michael Jordan, 2148 cartes), le payload initial de la page faisait
// 4.5 Mo et 6-7s a charger en entier. Seule la premiere page (48 cartes,
// deja calculee cote serveur) arrive avec la page ; le reste se charge a la
// demande, exactement comme l'utilisateur le voit defiler.
export default function CommunityCardsSection({ playerName, initialCards, totalCount, totalCollectors, hasAuto, hasPatch, hasNum, hasVente }: {
  playerName: string; initialCards: Card[]; totalCount: number; totalCollectors: number
  hasAuto: boolean; hasPatch: boolean; hasNum: boolean; hasVente: boolean
}) {
  const [myId, setMyId] = useState<string | null>(null)
  const [fRc, setFRc] = useState(false)
  const [fAuto, setFAuto] = useState(false)
  const [fPatch, setFPatch] = useState(false)
  const [fNum, setFNum] = useState(false)
  const [fVente, setFVente] = useState(false)
  const [myMode, setMyMode] = useState<MyMode>('all')
  const [sort, setSort] = useState<SortKey>('default')
  // Joueurs avec des centaines de cartes : on peut replier la liste pour atteindre les sets / la checklist
  const [collapsed, setCollapsed] = useState(false)

  const [cards, setCards] = useState<Card[]>(initialCards)
  const [filteredTotal, setFilteredTotal] = useState(totalCount)
  const [hasMore, setHasMore] = useState(totalCount > initialCards.length)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isDefault = !fRc && !fAuto && !fPatch && !fNum && !fVente && myMode === 'all' && sort === 'default'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setMyId(session?.user?.id || null))
  }, [])

  const loadPage = async (reset: boolean) => {
    setLoading(true)
    const offset = reset ? 0 : cards.length
    const params = new URLSearchParams({
      name: playerName, offset: String(offset), limit: '48', sort,
      rc: fRc ? '1' : '0', auto: fAuto ? '1' : '0', patch: fPatch ? '1' : '0', num: fNum ? '1' : '0', vente: fVente ? '1' : '0',
      myMode,
    })
    if (myId) params.set('myId', myId)
    try {
      const r = await fetch(`/api/player-cards?${params.toString()}`)
      if (r.ok) {
        const j = await r.json()
        setCards(prev => reset ? j.cards : [...prev, ...j.cards])
        setFilteredTotal(j.total)
        setHasMore(j.hasMore)
      }
    } catch {}
    setLoading(false)
  }

  // Filtre/tri change : repart de la premiere page deja fournie par le
  // serveur si on revient aux reglages par defaut (pas de requete reseau),
  // sinon redemande la page 1 avec les nouveaux reglages.
  useEffect(() => {
    if (isDefault) { setCards(initialCards); setFilteredTotal(totalCount); setHasMore(totalCount > initialCards.length); return }
    loadPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fRc, fAuto, fPatch, fNum, fVente, myMode, sort, myId])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting && hasMore && !loading) loadPage(false) }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, cards.length])

  const chip = (active: boolean, color: string) => ({
    padding: '5px 11px', border: `1.5px solid ${active ? color : 'var(--jp-border)'}`,
    borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 800,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', transition: '0.15s',
    background: active ? color : 'var(--jp-surface)',
    color: active ? 'white' : 'var(--jp-muted)',
  })

  const hasActive = fRc || fAuto || fPatch || fNum || fVente || myMode !== 'all' || sort !== 'default'
  const clearAll = () => { setFRc(false); setFAuto(false); setFPatch(false); setFNum(false); setFVente(false); setMyMode('all'); setSort('default') }

  return (
    <section style={{ marginBottom: 52 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>Dans les collections</h2>
        <span style={{ fontSize: 13, color: 'var(--jp-muted)', fontWeight: 600 }}>
          {filteredTotal !== totalCount
            ? `${filteredTotal} / ${totalCount} cartes`
            : `${totalCount} carte${totalCount > 1 ? 's' : ''}`
          }
          {' · '}{totalCollectors} collectionneur{totalCollectors > 1 ? 's' : ''}
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ background: 'var(--jp-surface)', color: 'var(--jp-text2)', border: '1.5px solid var(--jp-border)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {collapsed ? 'Afficher les cartes ▼' : 'Masquer les cartes ▲'}
          </button>
          <a href="#checklist-joueur"
            style={{ background: 'var(--jp-surface)', color: 'var(--jp-accent)', border: '1.5px solid var(--jp-border)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            Checklist ↓
          </a>
        </span>
      </div>
      {!collapsed && (<>

      {/* Toolbar */}
      <div style={{ background: 'var(--jp-surface)', border: '1px solid var(--jp-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setFRc(v => !v)} style={chip(fRc, '#F97316')}>RC</button>
        {hasAuto && (
          <button onClick={() => setFAuto(v => !v)} style={chip(fAuto, '#3B82F6')}>AUTO</button>
        )}
        {hasPatch && (
          <button onClick={() => setFPatch(v => !v)} style={chip(fPatch, '#EF4444')}>PATCH</button>
        )}
        {hasNum && (
          <button onClick={() => setFNum(v => !v)} style={chip(fNum, '#A855F7')}># Num</button>
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

      {cards.length === 0 && !loading ? (
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
            {cards.map((card) => (
              <Link key={card.id} href={card.source === 'manuel' ? card.cardUrl : `/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                <div className="jp-card-hover" style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--jp-surface)', border: `1.5px solid ${card.user_id === myId ? 'var(--jp-accent)' : 'var(--jp-border)'}`, height: '100%' }}>
                  <div className="holo-light" style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', background: '#111' }}>
                    <img
                      src={card.img}
                      alt={card.nom}
                      loading="lazy"
                      style={card.is_horizontal ? {
                        position: 'absolute', width: '140%', height: '71.43%',
                        left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover',
                      } : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {card.rc && <span style={{ position: 'absolute', top: 6, left: 6 }}><TagIcon kind="rc" h={26} /></span>}
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                      {card.auto && <TagIcon kind="auto" h={26} />}
                      {card.patch && <TagIcon kind="patch" h={26} />}
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
                        loading="lazy" width={13} height={13}
                        style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0 }} alt=""
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.display_name}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} style={{ height: 40, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--jp-muted)' }}>
              {loading ? 'Chargement…' : ''}
            </div>
          )}
        </>
      )}
      </>)}
    </section>
  )
}
