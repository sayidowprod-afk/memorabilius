'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { playerSlug, teamSlug } from '@/lib/playerSlug'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'

interface Suggestions { players: string[]; collectors: { id: string; display_name: string; avatar_url: string | null }[] }

// Recherche compacte du header : loupe -> panneau avec joueurs/collectionneurs/
// equipes qui matchent, en tapant. Les equipes sont filtrees cote client (liste
// statique deja importee ailleurs, latence nulle) ; joueurs/collectionneurs
// passent par /api/search-suggest, une version allegee de /api/recherche
// pensee pour etre appelee a chaque frappe sans faire exploser le cout serveur.
export default function HeaderSearch() {
  const { dark } = useTheme()
  const { t } = useLang()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [data, setData] = useState<Suggestions>({ players: [], collectors: [] })
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setOpen(false); return }
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const query = q.trim()
    if (query.length < 2) { setData({ players: [], collectors: [] }); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search-suggest?q=${encodeURIComponent(query)}`)
        if (r.ok) setData(await r.json())
      } catch {}
      setLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q])

  const nq = q.trim().toLowerCase()
  const teams = nq.length >= 2 ? SPORTS_TEAMS.filter(team => team.name.toLowerCase().includes(nq)).slice(0, 5) : []

  const goToFullSearch = () => {
    const query = q.trim()
    if (!query) return
    setOpen(false); setQ('')
    router.push(`/recherche?q=${encodeURIComponent(query)}`)
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
    color: dark ? '#ddd' : '#333', fontWeight: 600, fontSize: 13, textDecoration: 'none',
  }
  const hasResults = data.players.length > 0 || data.collectors.length > 0 || teams.length > 0

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} aria-label={t('nav_search')} aria-expanded={open} aria-haspopup="true"
        style={{ background: open ? (dark ? '#fff' : '#111') : 'none', border: 'none', cursor: 'pointer', padding: 8, height: 34, width: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: open ? (dark ? '#111' : '#fff') : (dark ? '#ddd' : '#444'), transition: 'background 0.15s, color 0.15s' }}>
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
          <circle cx="7.2" cy="7.2" r="5.7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11.4 11.4L15.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 56, right: 0, background: dark ? '#1a1a1a' : 'white', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, borderRadius: 12, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', width: 280, zIndex: 300 }}>
          <input
            ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') goToFullSearch() }}
            placeholder={t('nav_search_placeholder')}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${dark ? '#333' : '#ddd'}`, background: dark ? '#111' : '#f7f7f7', color: dark ? '#eee' : '#111', fontSize: 14, outline: 'none' }}
          />
          {q.trim().length >= 2 && (
            <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
              {loading && <div style={{ padding: '10px 12px', fontSize: 12, color: dark ? '#888' : '#999' }}>{t('nav_search_loading')}</div>}
              {!loading && !hasResults && <div style={{ padding: '10px 12px', fontSize: 12, color: dark ? '#888' : '#999' }}>{t('nav_search_no_results')}</div>}
              {teams.map(team => (
                <Link key={team.id} href={`/equipe/${teamSlug(team.name)}`} style={itemStyle} onClick={() => { setOpen(false); setQ('') }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                  {team.name}
                </Link>
              ))}
              {data.players.map(name => (
                <Link key={name} href={`/joueur/${playerSlug(name)}`} style={itemStyle} onClick={() => { setOpen(false); setQ('') }}>
                  🏀 {name}
                </Link>
              ))}
              {data.collectors.map(c => (
                <Link key={c.id} href={`/galerie/${c.id}`} style={itemStyle} onClick={() => { setOpen(false); setQ('') }}>
                  {c.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <span style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? '#333' : '#ddd', flexShrink: 0 }} />}
                  {c.display_name}
                </Link>
              ))}
              {hasResults && (
                <button onClick={goToFullSearch} style={{ ...itemStyle, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#003DA6', marginTop: 2 }}>
                  🔎 {t('nav_search_see_all')} « {q.trim()} »
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
