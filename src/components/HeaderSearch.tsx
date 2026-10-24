'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { playerSlug, teamSlug } from '@/lib/playerSlug'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'

interface Suggestions { players: string[]; collectors: { id: string; display_name: string; avatar_url: string | null }[] }

// Recherche du header (desktop) : la loupe s'etend EN PLACE en un champ de
// texte (pas un panneau flottant) -- open/onToggle sont controles par NavBar,
// qui retracte Communaute/Outils vers la gauche pendant ce temps pour liberer
// la place (voir NavBar.tsx). Suggestions (joueurs/collectionneurs/equipes) en
// dessous, dans un panneau qui lui reste flottant.
export default function HeaderSearch({ open, onToggle }: { open: boolean; onToggle: (v: boolean) => void }) {
  const { dark } = useTheme()
  const { t } = useLang()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [data, setData] = useState<Suggestions>({ players: [], collectors: [] })
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = () => { onToggle(false); setQ('') }

  useEffect(() => {
    if (!open) return
    // Le champ grandit via transition CSS -- le focus immediat echoue tant qu'il
    // vaut encore width:0 sur certains navigateurs, un court delai suffit.
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    const onDoc = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') close(); return }
      if (wrapRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onDoc)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onDoc) }
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
    close()
    router.push(`/recherche?q=${encodeURIComponent(query)}`)
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
    color: dark ? '#ddd' : '#333', fontWeight: 600, fontSize: 13, textDecoration: 'none',
  }
  const hasResults = data.players.length > 0 || data.collectors.length > 0 || teams.length > 0
  const showPanel = open && q.trim().length >= 2

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div style={{
        display: 'flex', alignItems: 'center', borderRadius: 20,
        background: open ? (dark ? '#111' : '#f3f3f3') : 'transparent',
        border: `1px solid ${open ? (dark ? '#333' : '#ddd') : 'transparent'}`,
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}>
        <button onClick={() => onToggle(!open)} aria-label={t('nav_search')} aria-expanded={open} aria-haspopup="true"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, height: 34, width: 34, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#ddd' : '#444' }}>
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <circle cx="7.2" cy="7.2" r="5.7" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11.4 11.4L15.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <input
          ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') goToFullSearch() }}
          placeholder={t('nav_search_placeholder')}
          style={{
            width: open ? 230 : 0, opacity: open ? 1 : 0, padding: open ? '0 12px 0 0' : 0,
            transition: 'width 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s ease',
            border: 'none', outline: 'none', background: 'none', color: dark ? '#eee' : '#111', fontSize: 14,
          }}
        />
      </div>
      {showPanel && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: dark ? '#1a1a1a' : 'white', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', width: 280, maxHeight: 340, overflowY: 'auto', zIndex: 300 }}>
          {loading && <div style={{ padding: '10px 12px', fontSize: 12, color: dark ? '#888' : '#999' }}>{t('nav_search_loading')}</div>}
          {!loading && !hasResults && <div style={{ padding: '10px 12px', fontSize: 12, color: dark ? '#888' : '#999' }}>{t('nav_search_no_results')}</div>}
          {teams.map(team => (
            <Link key={team.id} href={`/equipe/${teamSlug(team.name)}`} style={itemStyle} onClick={close}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
              {team.name}
            </Link>
          ))}
          {data.players.map(name => (
            <Link key={name} href={`/joueur/${playerSlug(name)}`} style={itemStyle} onClick={close}>
              🏀 {name}
            </Link>
          ))}
          {data.collectors.map(c => (
            <Link key={c.id} href={`/galerie/${c.id}`} style={itemStyle} onClick={close}>
              {c.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ width: 18, height: 18, borderRadius: '50%', background: dark ? '#333' : '#ddd', flexShrink: 0 }} />}
              {c.display_name}
            </Link>
          ))}
          {hasResults && (
            <button onClick={goToFullSearch} style={{ ...itemStyle, width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', cursor: 'pointer', color: '#003DA6', marginTop: 2 }}>
              🔎 {t('nav_search_see_all')} « {q.trim()} »
            </button>
          )}
        </div>
      )}
    </div>
  )
}
