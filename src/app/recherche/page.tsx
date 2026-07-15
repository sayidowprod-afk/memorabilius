'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { playerSlug, teamSlug } from '@/lib/playerSlug'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'

export default function Recherche() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [cards, setCards] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [visibleCount, setVisibleCount] = useState(40)
  const [fYear, setFYear] = useState('')
  const [fBrand, setFBrand] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { t } = useLang()
  const { dark } = useTheme()

  const updateUrl = (q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    router.replace(q ? `/recherche?${params.toString()}` : '/recherche', { scroll: false })
  }

  const handleQuery = (q: string) => {
    setQuery(q)
    updateUrl(q)
  }

  // Lance la recherche initiale si ?q= présent dans l'URL
  useEffect(() => {
    const q = searchParams.get('q') || ''
    if (q.length >= 2) search(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (query.length < 2) { setCards([]); setUsers([]); setSearched(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    if (query.length < 2) { setTeams([]); return }
    const q = query.toLowerCase()
    // Trie par pertinence : exact > commence par > mot entier commence par > reste
    // (avant, la troncature à 8 pouvait cacher l'équipe recherchée derrière des
    // correspondances moins pertinentes selon l'ordre arbitraire de la liste)
    const rankMatch = (name: string) => {
      const n = name.toLowerCase()
      if (n === q) return 0
      if (n.startsWith(q)) return 1
      if (n.split(' ').some(w => w.startsWith(q))) return 2
      return 3
    }
    setTeams(
      SPORTS_TEAMS.filter(t => t.name.toLowerCase().includes(q))
        .sort((a, b) => rankMatch(a.name) - rankMatch(b.name) || a.name.localeCompare(b.name))
        .slice(0, 8)
    )
  }, [query])

  const search = async (q: string) => {
    setLoading(true)
    setSearched(true)
    try {
      const r = await fetch(`/api/recherche?q=${encodeURIComponent(q)}`)
      const data = await r.json()
      setCards(data.cards || [])
      setUsers(data.users || [])
      setPlayers(data.players || [])
      setVisibleCount(40)
    } catch { setCards([]); setUsers([]); setPlayers([]) }
    setLoading(false)
  }

  // Filtrage côté client par année et marque
  const filteredCards = cards.filter(c =>
    (!fYear || c.year === fYear) &&
    (!fBrand || c.brand === fBrand)
  )
  const availableYears = [...new Set(cards.map((c: any) => c.year).filter(Boolean))].sort().reverse() as string[]
  const availableBrands = [...new Set(cards.map((c: any) => c.brand).filter(Boolean))].sort() as string[]

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(c => c + 40)
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [sentinelRef.current, filteredCards.length])

  const getNumTag = (num: string) => {
    const m = num.trim().match(/\/(\d+)$/)
    const v = m ? parseInt(m[1]) : null
    if (v === 1)              return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2800', textShadow: '0 1px 0 rgba(255,255,255,0.4)', display: 'inline-block', animation: 'oon-anim 1.8s ease-in-out infinite', willChange: 'transform' }}>{num}</span>
    if (v !== null && v <= 10) return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555)', color: '#111', display: 'inline-block', animation: 'low-anim 2.2s ease-in-out infinite', willChange: 'transform' }}>{num}</span>
    if (v !== null && v <= 25) return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.6)', display: 'inline-block', animation: 'bro-anim 2.6s ease-in-out infinite', willChange: 'transform' }}>{num}</span>
    return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>{num}</span>
  }

  const getTags = (card: any) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {card.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
      {card.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
      {card.num && getNumTag(card.num)}
      {card.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '40px 20px 30px' }}>
        <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 8 }}>{t('search_title')}</h1>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 30 }}>
          {t('search_sub')}
        </p>
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
          <input
            value={query}
            onChange={e => handleQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            autoFocus
            style={{
              fontSize: 18, padding: '16px 20px 16px 50px',
              borderRadius: 50, border: '2px solid #003DA6',
              boxShadow: '0 4px 20px rgba(0,61,166,0.15)',
            }}
          />
          <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 20 }}>🔍</span>
          {loading && <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#999' }}>...</span>}
        </div>
        {query.length > 0 && query.length < 2 && (
          <p style={{ color: '#999', fontSize: 13, marginTop: 8 }}>{t('search_min_chars')}</p>
        )}
      </div>

      {/* Résultats */}
      {searched && !loading && cards.length === 0 && users.length === 0 && players.length === 0 && teams.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Aucun résultat pour "{query}"</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>{t('search_none_sub')}</p>
        </div>
      )}

      {/* Section équipes */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: '#555' }}>
            Équipes ({teams.length})
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {teams.map((team, i) => (
              <Link key={i} href={`/equipe/${teamSlug(team.name)}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: dark ? '#2a2a2a' : 'white', border: `2px solid ${team.color}`,
                  borderRadius: 50, padding: '5px 16px 5px 5px',
                  transition: '0.2s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <img
                    src={teamLogoUrl(team)}
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                    alt={team.name}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                  <span style={{ fontWeight: 800, fontSize: 13, color: dark ? '#f0f0f0' : '#121212' }}>{team.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section joueurs */}
      {players.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: '#555' }}>
            Joueurs ({players.length})
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {players.map((p, i) => (
              <Link key={i} href={`/joueur/${playerSlug(p.name)}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: dark ? '#2a2a2a' : 'white', border: '2px solid #003DA6',
                  borderRadius: 50, padding: '5px 16px 5px 5px',
                  transition: '0.2s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {p.photo
                    ? <img src={p.photo} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }} alt={p.name} />
                    : <span style={{ fontSize: 18 }}>🏀</span>
                  }
                  <span style={{ fontWeight: 800, fontSize: 13, color: dark ? '#f0f0f0' : '#121212' }}>{p.name}</span>
                  {p.isRc && <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 700 }}>RC</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section collectionneurs */}
      {users.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontWeight: 800, fontSize: 16, marginBottom: 14, color: '#555' }}>
            Collectionneurs ({users.length})
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {users.map((u, i) => (
              <Link key={i} href={`/galerie/${u.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: dark ? '#2a2a2a' : 'white', border: `2px solid ${u.accent}`,
                  borderRadius: 50, padding: '6px 16px 6px 6px',
                  transition: '0.2s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <img
                    src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || 'U')}&background=003DA6&color=fff&size=64`}
                    style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                    alt={u.display_name}
                  />
                  <span style={{ fontWeight: 800, fontSize: 14, color: dark ? '#f0f0f0' : '#121212' }}>{u.display_name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
            <p style={{ fontWeight: 700, color: '#666', fontSize: 14, margin: 0, flex: '1 1 200px' }}>
              {filteredCards.length !== cards.length
                ? <>{filteredCards.length} / {cards.length} carte{cards.length > 1 ? 's' : ''} pour "<strong>{query}</strong>"</>
                : <>{cards.length} carte{cards.length > 1 ? 's' : ''} pour "<strong>{query}</strong>"</>
              }
            </p>
            {availableYears.length > 1 && (
              <select value={fYear} onChange={e => { setFYear(e.target.value); setVisibleCount(40) }}
                style={{ border: '1.5px solid #ddd', borderRadius: 20, padding: '6px 12px', fontSize: 13, fontWeight: 700, background: fYear ? '#003DA6' : (dark ? '#2a2a2a' : 'white'), color: fYear ? 'white' : (dark ? '#eee' : '#333'), cursor: 'pointer' }}>
                <option value="">Toutes les années</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {availableBrands.length > 1 && (
              <select value={fBrand} onChange={e => { setFBrand(e.target.value); setVisibleCount(40) }}
                style={{ border: '1.5px solid #ddd', borderRadius: 20, padding: '6px 12px', fontSize: 13, fontWeight: 700, background: fBrand ? '#003DA6' : (dark ? '#2a2a2a' : 'white'), color: fBrand ? 'white' : (dark ? '#eee' : '#333'), cursor: 'pointer' }}>
                <option value="">Toutes les marques</option>
                {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {(fYear || fBrand) && (
              <button onClick={() => { setFYear(''); setFBrand('') }}
                style={{ border: 'none', background: dark ? '#333' : '#eee', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: dark ? '#ddd' : '#555' }}>
                ✕ Effacer
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {filteredCards.slice(0, visibleCount).map((card, i) => (
              <Link key={i} href={`/galerie/${card.collectorId}?card=${encodeURIComponent(card.img)}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  background: dark ? '#1e1e1e' : 'white', borderRadius: 12, overflow: 'hidden',
                  border: `2px solid ${card.accent}`,
                  transition: '0.2s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                    <img src={card.img} alt={card.name} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '10px 10px 12px' }}>
                    {getTags(card)}
                    <p style={{ fontWeight: 800, fontSize: 12, margin: '5px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: dark ? '#f0f0f0' : '#121212' }}>{card.name}</p>
                    {card.variant && <p style={{ fontSize: 10, color: card.accent, fontWeight: 700, margin: '0 0 2px', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.variant}</p>}
                    <p style={{ fontSize: 10, color: '#999', margin: 0 }}>{card.year} {card.brand}</p>
                    {/* Collectionneur */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
                      <img
                        src={card.collectorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.collector || 'U')}&background=003DA6&color=fff&size=32`}
                        style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                        alt={card.collector}
                      />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.collector}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {filteredCards.length > visibleCount && (
            <div ref={sentinelRef} style={{ height: 40, marginTop: 24 }} />
          )}
        </>
      )}
    </div>
  )
}
