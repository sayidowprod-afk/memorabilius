'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { playerSlug, teamSlug } from '@/lib/playerSlug'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import { supabase } from '@/lib/supabase'
import { parseNaturalQuery } from '@/lib/parseNaturalQuery'
import SkeletonBlock from '@/components/SkeletonBlock'

type Section = 'all' | 'cards' | 'players' | 'collectors'
type SortKey = 'default' | 'y_desc' | 'y_asc' | 'name'
type MyMode = 'all' | 'only' | 'exclude'

const SPORT_EMOJI: Record<string, string> = {
  nba: '🏀', nfl: '🏈', nhl: '🏒', hockey: '🏒', baseball: '⚾', football: '⚽',
  pokemon: '🎴', mtg: '🧙',
}
function sportEmoji(sports: string[]) { return SPORT_EMOJI[sports?.[0]] ?? '🏀' }

function NumTag({ num }: { num: string }) {
  const m = num.trim().match(/\/(\d+)$/)
  const v = m ? parseInt(m[1]) : null
  if (v === 1) return <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2800' }}>{num}</span>
  if (v !== null && v <= 10) return <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: 'linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555)', color: '#111' }}>{num}</span>
  if (v !== null && v <= 25) return <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', color: 'white' }}>{num}</span>
  return <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: '#7b1fa2', color: 'white' }}>{num}</span>
}

export default function Recherche() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [cards, setCards] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [visibleCount, setVisibleCount] = useState(48)

  // Filters (client-side)
  const [fYear, setFYear] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fRc, setFRc] = useState(false)
  const [fAuto, setFAuto] = useState(false)
  const [fNum, setFNum] = useState(false)
  const [fPatch, setFPatch] = useState(false)
  const [fVente, setFVente] = useState(false)
  const [numMax, setNumMax] = useState<number | null>(null)
  const [nlpHint, setNlpHint] = useState<string[]>([])
  const [sortCards, setSortCards] = useState<SortKey>('default')
  const [section, setSection] = useState<Section>('all')
  const [myId, setMyId] = useState<string | null>(null)
  const [myMode, setMyMode] = useState<MyMode>('all')

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const RECENT_SEARCHES_KEY = 'recherche_recentes'
  const RECENT_SEARCHES_MAX = 8
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
      if (Array.isArray(saved)) setRecentSearches(saved.filter((s): s is string => typeof s === 'string'))
    } catch {}
  }, [])

  const pushRecentSearch = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_SEARCHES_MAX)
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const removeRecentSearch = (q: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(s => s !== q)
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setMyId(session?.user?.id || null))
  }, [])

  useEffect(() => {
    const q = searchParams.get('q') || ''
    if (q.length >= 2) doSearch(q)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (query.length < 2) { setCards([]); setUsers([]); setPlayers([]); setSearched(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    if (query.length < 2) { setTeams([]); return }
    const q = query.toLowerCase()
    const rank = (name: string) => {
      const n = name.toLowerCase()
      if (n === q) return 0
      if (n.startsWith(q)) return 1
      if (n.split(' ').some(w => w.startsWith(q))) return 2
      return 3
    }
    setTeams(
      SPORTS_TEAMS.filter(t => t.name.toLowerCase().includes(q))
        .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
        .slice(0, 8)
    )
  }, [query])

  const doSearch = async (q: string) => {
    setLoading(true)
    setSearched(true)
    pushRecentSearch(q)

    // Recherche en langage naturel : "kobe rc 2024 sous /25" -> nom "kobe" +
    // filtres RC / annee 2024 / numerote <= 25 appliques automatiquement.
    const parsed = parseNaturalQuery(q)
    const hints: string[] = []
    setFRc(parsed.rc); if (parsed.rc) hints.push('RC')
    setFAuto(parsed.auto); if (parsed.auto) hints.push('Auto')
    setFPatch(parsed.patch); if (parsed.patch) hints.push('Patch')
    setFYear(parsed.year || ''); if (parsed.year) hints.push(parsed.year)
    setFNum(parsed.num)
    setNumMax(parsed.numMax)
    if (parsed.num) {
      hints.push(parsed.numMax != null ? `≤ /${parsed.numMax}` : t('search_numbered_hint'))
    }
    setNlpHint(hints)

    try {
      const r = await fetch(`/api/recherche?q=${encodeURIComponent(parsed.text)}`)
      const data = await r.json()
      setCards(data.cards || [])
      setUsers(data.users || [])
      setPlayers(data.players || [])
      setVisibleCount(48)
    } catch { setCards([]); setUsers([]); setPlayers([]) }
    setLoading(false)
  }

  const updateUrl = (q: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    router.replace(q ? `/recherche?${p.toString()}` : '/recherche', { scroll: false })
  }

  const handleQuery = (q: string) => { setQuery(q); updateUrl(q) }

  // Client-side filter + sort
  const filteredCards = useMemo(() => {
    let result = cards.filter(c =>
      (!fYear || c.year === fYear) &&
      (!fBrand || c.brand === fBrand) &&
      (!fRc || c.rc) &&
      (!fAuto || c.auto) &&
      (!fNum || c.num) &&
      (numMax == null || (() => { const m = (c.num || '').match(/\/(\d+)$/); return m ? parseInt(m[1]) <= numMax : false })()) &&
      (!fPatch || c.patch) &&
      (!fVente || c.disponible_vente) &&
      (myMode === 'all' ||
        (myMode === 'only' ? c.collectorId === myId : c.collectorId !== myId))
    )
    if (sortCards === 'y_desc') result = [...result].sort((a, b) => (b.year || '').localeCompare(a.year || ''))
    else if (sortCards === 'y_asc') result = [...result].sort((a, b) => (a.year || '').localeCompare(b.year || ''))
    else if (sortCards === 'name') result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return result
  }, [cards, fYear, fBrand, fRc, fAuto, fNum, fPatch, fVente, numMax, myMode, myId, sortCards])

  const availableYears = useMemo(() =>
    ([...new Set(cards.map((c: any) => c.year).filter(Boolean))].sort().reverse() as string[]),
    [cards])
  const availableBrands = useMemo(() =>
    ([...new Set(cards.map((c: any) => c.brand).filter(Boolean))].sort() as string[]),
    [cards])
  const hasVente = useMemo(() => cards.some(c => c.disponible_vente), [cards])

  const clearFilters = () => {
    setFYear(''); setFBrand(''); setFRc(false); setFAuto(false)
    setFNum(false); setFPatch(false); setFVente(false); setMyMode('all')
    setSortCards('default'); setNumMax(null); setNlpHint([])
  }
  const hasActiveFilter = fYear || fBrand || fRc || fAuto || fNum || fPatch || fVente || myMode !== 'all' || sortCards !== 'default'

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) setVisibleCount(c => c + 48) }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [filteredCards.length])

  // Tabs visibility
  const totalResults = cards.length + users.length + players.length + teams.length
  const showTabs = searched && totalResults > 0

  const bg = dark ? '#121212' : '#f7f8fc'
  const surface = dark ? '#1e1e1e' : '#ffffff'
  const border = dark ? '#2a2a2a' : '#e8eaf0'
  const text = dark ? '#f0f0f0' : '#111111'
  const muted = dark ? '#888' : '#666'
  const accent = '#003DA6'

  const chipStyle = (active: boolean, color = accent) => ({
    padding: '6px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
    fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    transition: '0.15s',
    background: active ? color : (dark ? '#2a2a2a' : '#f0f0f0'),
    color: active ? 'white' : (dark ? '#bbb' : '#555'),
  })

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .search-input { transition: box-shadow 0.2s, transform 0.2s; }
        .search-input:focus { box-shadow: 0 4px 28px rgba(0,61,166,0.28), 0 0 0 4px rgba(0,61,166,0.12); transform: scale(1.01); }
        @media (prefers-reduced-motion: reduce) { .search-input { transition: none; transform: none !important; } }
        .card-item-search { transition: transform 0.15s, box-shadow 0.15s; }
        .card-item-search:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
        .tab-btn { transition: 0.15s; border: none; background: transparent; cursor: pointer; }
        .tab-btn:hover { opacity: 0.8; }
        .collector-pill { transition: transform 0.15s; }
        .collector-pill:hover { transform: translateY(-2px); }
        .player-hover-preview { opacity: 0; transform: translateX(-50%) translateY(4px); transition: opacity 0.15s, transform 0.15s; }
        @media (hover: hover) and (pointer: fine) {
          .player-pill-hover:hover .player-hover-preview { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 600px) {
          .search-filters-row { flex-wrap: wrap; }
          .search-sort-row { gap: 6px !important; }
          .search-input { padding: 11px 44px 11px 44px !important; font-size: 15px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: '0 12px' }}>

        {/* ── HERO SEARCH ── */}
        <div style={{ textAlign: 'center', padding: '40px 20px 28px' }}>
          <h1 style={{ fontWeight: 900, fontSize: 30, marginBottom: 6, color: text }}>{t('search_title')}</h1>
          <p style={{ color: muted, fontSize: 15, marginBottom: 26 }}>{t('search_sub')}</p>

          <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative' }}>
            <input
              className="search-input"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                fontSize: 17, padding: '14px 48px 14px 48px',
                borderRadius: 50, border: `2px solid ${accent}`,
                background: surface, color: text,
                boxShadow: '0 4px 24px rgba(0,61,166,0.13)',
                outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 17, top: '50%', transform: 'translateY(-50%)', fontSize: 19, pointerEvents: 'none' }}>🔍</span>
            {loading && (
              <span style={{ position: 'absolute', right: 17, top: '50%', transform: 'translateY(-50%)' }}>
                <div style={{ width: 18, height: 18, border: '2.5px solid #ddd', borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </span>
            )}
          </div>
          {query.length > 0 && query.length < 2 && (
            <p style={{ color: muted, fontSize: 12, marginTop: 8 }}>{t('search_min_chars')}</p>
          )}
          {nlpHint.length > 0 && (
            <p style={{ color: muted, fontSize: 12, marginTop: 8 }}>
              {t('search_understood_as')} <strong style={{ color: accent }}>{nlpHint.join(' · ')}</strong>
            </p>
          )}

          {/* Recherches recentes -- seulement tant qu'aucune recherche n'est en
              cours, pour ne pas polluer l'affichage des resultats. */}
          {!searched && recentSearches.length > 0 && (
            <div style={{ maxWidth: 620, margin: '18px auto 0', textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {t('search_recent_title')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recentSearches.map(term => (
                  <span key={term} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: dark ? '#2a2a2a' : '#f0f0f0', borderRadius: 20, padding: '6px 6px 6px 14px',
                  }}>
                    <button onClick={() => handleQuery(term)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: text, padding: 0,
                    }}>
                      {term}
                    </button>
                    <button onClick={() => removeRecentSearch(term)} aria-label={t('search_recent_remove')} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 13,
                      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        {showTabs && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${border}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {([
              { key: 'all', label: t('search_tab_all'), count: totalResults },
              ...(cards.length > 0 ? [{ key: 'cards', label: t('gallery_cards'), count: cards.length }] : []),
              ...(players.length > 0 ? [{ key: 'players', label: t('search_players'), count: players.length }] : []),
              ...(users.length > 0 ? [{ key: 'collectors', label: t('search_collectors'), count: users.length }] : []),
            ] as { key: Section; label: string; count: number }[]).map(tab => (
              <button
                key={tab.key}
                className="tab-btn"
                onClick={() => setSection(tab.key)}
                style={{
                  padding: '10px 16px', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
                  borderBottom: section === tab.key ? `2px solid ${accent}` : '2px solid transparent',
                  color: section === tab.key ? accent : muted,
                  marginBottom: -2,
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: 700,
                  background: section === tab.key ? `${accent}18` : (dark ? '#2a2a2a' : '#f0f0f0'),
                  color: section === tab.key ? accent : muted,
                  borderRadius: 10, padding: '1px 7px',
                }}>{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── SKELETON (premier chargement, pas de resultats a l'ecran encore) ── */}
        {loading && cards.length === 0 && users.length === 0 && teams.length === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <SkeletonBlock style={{ width: '100%', aspectRatio: '2.5/3.5' }} />
                <SkeletonBlock style={{ width: '70%', height: 10, marginTop: 8 }} />
                <SkeletonBlock style={{ width: '45%', height: 8, marginTop: 6 }} />
              </div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {searched && !loading && totalResults === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 20px', color: muted }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🃏</div>
            <p style={{ fontSize: 18, fontWeight: 800, color: text, marginBottom: 8 }}>{t('search_none')} "{query}"</p>
            <p style={{ fontSize: 14 }}>{t('search_none_sub')}</p>
          </div>
        )}

        {/* ── TEAMS ── */}
        {(section === 'all') && teams.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('search_teams')} ({teams.length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {teams.map((team, i) => (
                <Link key={i} href={`/equipe/${teamSlug(team.name)}`} style={{ textDecoration: 'none' }}>
                  <div className="collector-pill" style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: surface, border: `2px solid ${team.color}`,
                    borderRadius: 50, padding: '5px 16px 5px 5px', cursor: 'pointer',
                  }}>
                    <img loading="lazy" src={teamLogoUrl(team)} style={{ width: 28, height: 28, objectFit: 'contain' }} alt={team.name}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: text }}>{team.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── PLAYERS ── */}
        {(section === 'all' || section === 'players') && players.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('search_players')} ({players.length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {players.map((p, i) => (
                <Link key={i} href={`/joueur/${playerSlug(p.name)}`} style={{ textDecoration: 'none' }}>
                  <div className="collector-pill player-pill-hover" style={{
                    display: 'flex', alignItems: 'center', gap: 7, position: 'relative',
                    background: surface, border: `2px solid ${accent}`,
                    borderRadius: 50, padding: '5px 14px 5px 5px', cursor: 'pointer',
                  }}>
                    {p.photo
                      ? <img loading="lazy" src={p.photo} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} alt={p.name} />
                      : <span style={{ width: 32, height: 32, borderRadius: '50%', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{sportEmoji(p.sports || [])}</span>
                    }
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: text, display: 'block', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: muted }}>{sportEmoji(p.sports || [])}</span>
                        {p.isRc && <span style={{ fontSize: 8, background: '#e67e22', color: 'white', padding: '1px 4px', borderRadius: 2, fontWeight: 800 }}>RC</span>}
                      </div>
                    </div>

                    {/* Aperçu au survol : photo + équipe en grand */}
                    <div className="player-hover-preview" style={{
                      position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
                      background: surface, border: `2px solid ${accent}`, borderRadius: 14, padding: 12,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 140,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)', pointerEvents: 'none', zIndex: 30,
                    }}>
                      {p.photo
                        ? <img loading="lazy" src={p.photo} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }} alt="" />
                        : <span style={{ fontSize: 32 }}>{sportEmoji(p.sports || [])}</span>
                      }
                      <span style={{ fontWeight: 800, fontSize: 12, color: text, textAlign: 'center', lineHeight: 1.2 }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: muted, fontWeight: 700 }}>{sportEmoji(p.sports || [])} {(p.sports || [])[0]?.toUpperCase()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── COLLECTORS ── */}
        {(section === 'all' || section === 'collectors') && users.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('search_collectors')} ({users.length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {users.map((u, i) => (
                <Link key={i} href={`/galerie/${u.id}`} style={{ textDecoration: 'none' }}>
                  <div className="collector-pill" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: surface, border: `2px solid ${u.accent || accent}`,
                    borderRadius: 50, padding: '6px 16px 6px 6px', cursor: 'pointer',
                  }}>
                    <img
                      src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || 'U')}&background=003DA6&color=fff&size=64`}
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                      alt={u.display_name}
                      loading="lazy"
                    />
                    <span style={{ fontWeight: 800, fontSize: 14, color: text }}>{u.display_name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── CARDS ── */}
        {(section === 'all' || section === 'cards') && cards.length > 0 && (
          <>
            {/* Filter / sort toolbar */}
            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              {/* Row 1: count + mine toggle + sort */}
              <div className="search-sort-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: hasActiveFilter ? 10 : 0 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: muted, flex: '1 1 auto' }}>
                  {filteredCards.length !== cards.length
                    ? <>{filteredCards.length} / {cards.length} {t('search_cards_lower')} — "<strong style={{ color: text }}>{query}</strong>"</>
                    : <>{cards.length} {t('search_cards_lower')} — "<strong style={{ color: text }}>{query}</strong>"</>
                  }
                </span>

                {myId && (
                  <>
                    <button onClick={() => setMyMode(m => m === 'only' ? 'all' : 'only')} style={chipStyle(myMode === 'only', '#003DA6')}>
                      👤 {t('search_my_cards')}
                    </button>
                    <button onClick={() => setMyMode(m => m === 'exclude' ? 'all' : 'exclude')} style={chipStyle(myMode === 'exclude', '#c0392b')}>
                      ✕ {t('search_exclude_mine')}
                    </button>
                  </>
                )}

                <select value={sortCards} onChange={e => setSortCards(e.target.value as SortKey)}
                  style={{ border: `1.5px solid ${sortCards !== 'default' ? accent : border}`, borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: sortCards !== 'default' ? (dark ? '#1a2240' : '#f0f4ff') : surface, color: sortCards !== 'default' ? accent : muted, cursor: 'pointer' }}>
                  <option value="default">{t('search_sort_placeholder')}</option>
                  <option value="y_desc">{t('search_sort_year_desc')}</option>
                  <option value="y_asc">{t('search_sort_year_asc')}</option>
                  <option value="name">{t('gallery_sort_player_az')}</option>
                </select>

                {availableYears.length > 1 && (
                  <select value={fYear} onChange={e => { setFYear(e.target.value); setVisibleCount(48) }}
                    style={{ border: `1.5px solid ${fYear ? accent : border}`, borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: fYear ? (dark ? '#1a2240' : '#f0f4ff') : surface, color: fYear ? accent : muted, cursor: 'pointer' }}>
                    <option value="">{t('gallery_year')}</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}

                {availableBrands.length > 1 && (
                  <select value={fBrand} onChange={e => { setFBrand(e.target.value); setVisibleCount(48) }}
                    style={{ border: `1.5px solid ${fBrand ? accent : border}`, borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: fBrand ? (dark ? '#1a2240' : '#f0f4ff') : surface, color: fBrand ? accent : muted, cursor: 'pointer' }}>
                    <option value="">{t('picker_brand')}</option>
                    {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>

              {/* Row 2: chip filters */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(['rc', 'auto', 'num', 'patch'] as const).map(k => {
                  const active = k === 'rc' ? fRc : k === 'auto' ? fAuto : k === 'num' ? fNum : fPatch
                  const setter = k === 'rc' ? setFRc : k === 'auto' ? setFAuto : k === 'num' ? setFNum : setFPatch
                  const color = k === 'rc' ? '#e67e22' : k === 'auto' ? '#2e7d32' : k === 'num' ? '#7b1fa2' : '#1976d2'
                  return (
                    <button key={k} onClick={() => setter(v => !v)} style={chipStyle(active, color)}>
                      {k === 'num' ? '# Num' : k.toUpperCase()}
                    </button>
                  )
                })}
                {hasVente && (
                  <button onClick={() => setFVente(v => !v)} style={chipStyle(fVente, '#2e7d32')}>
                    🏷️ {t('gallery_for_sale_label')}
                  </button>
                )}
                {hasActiveFilter && (
                  <button onClick={clearFilters} style={{ ...chipStyle(false), background: 'transparent', color: muted, textDecoration: 'underline', textTransform: 'none', fontWeight: 600 }}>
                    ✕ {t('search_clear')}
                  </button>
                )}
              </div>
            </div>

            {/* Card grid */}
            {filteredCards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: muted }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                <p style={{ fontWeight: 800, fontSize: 15, color: text, marginBottom: 6 }}>{t('gallery_no_match_title')}</p>
                <p style={{ fontSize: 13 }}>{t('gallery_no_match_sub')}</p>
                <button onClick={clearFilters} style={{ marginTop: 14, background: accent, color: 'white', border: 'none', borderRadius: 20, padding: '8px 20px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  {t('gallery_clear_filters')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14 }}>
                {filteredCards.slice(0, visibleCount).map((card, i) => (
                  <Link key={i} href={`/galerie/${card.collectorId}?card=${encodeURIComponent(card.img)}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className="card-item-search" style={{
                      background: surface, borderRadius: 12, overflow: 'hidden',
                      border: `2px solid ${card.collectorId === myId ? accent : (card.accent || accent)}`,
                      cursor: 'pointer', height: '100%',
                      boxShadow: card.collectorId === myId ? `0 0 0 2px ${accent}44` : undefined,
                    }}>
                      {/* Image */}
                      <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', background: '#111' }}>
                        <img src={card.img} alt={card.name} loading="lazy"
                          style={card.is_horizontal
                            ? { position: 'absolute', width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover', display: 'block' }
                            : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
                          }
                        />
                        {card.disponible_vente && (
                          <div style={{ position: 'absolute', top: 6, right: 6, background: '#2e7d32', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                            🏷️ {lang === 'fr' ? 'Trade' : 'Trade'}
                          </div>
                        )}
                        {card.collectorId === myId && (
                          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                            👤
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '8px 10px 10px' }}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                          {card.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: '#e67e22', color: 'white' }}>RC</span>}
                          {card.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: '#2e7d32', color: 'white' }}>AUTO</span>}
                          {card.num && <NumTag num={card.num} />}
                          {card.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: '#1976d2', color: 'white' }}>PATCH</span>}
                        </div>
                        <p style={{ fontWeight: 800, fontSize: 12, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: text }}>{card.name}</p>
                        {card.variant && <p style={{ fontSize: 10, color: card.accent || accent, fontWeight: 700, margin: '0 0 1px', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.variant}</p>}
                        <p style={{ fontSize: 10, color: muted, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[card.year, card.brand].filter(Boolean).join(' · ')}</p>

                        {/* Collector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${border}` }}>
                          <img
                            src={card.collectorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.collector || 'U')}&background=003DA6&color=fff&size=32`}
                            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            alt={card.collector}
                            loading="lazy"
                          />
                          <span style={{ fontSize: 10, fontWeight: 700, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.collector}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {filteredCards.length > visibleCount && (
              <div ref={sentinelRef} style={{ height: 40, marginTop: 20 }} />
            )}
          </>
        )}

      </div>
    </>
  )
}
