'use client'
/* eslint-disable @next/next/no-img-element */
// Swipe d'échanges, en plein écran : les cartes « à échanger » des autres membres défilent une à une.
// Glisser à droite (ou ♥) = j'aime, à gauche (ou ✕) = je passe. Un « j'aime » reste invisible : il y a un match seulement si l'autre a aussi aimé une de mes cartes.
// Le bouton filtre (en haut à droite) permet de ne voir que certaines cartes : équipe, joueur, collection, année, RC / auto / patch.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface SwipeCard {
  id: string; user_id: string; nom: string | null; equipe: string | null; annee: string | null; marque: string | null; collection: string | null; variation: string | null
  image_recto: string | null; rc: boolean | null; auto: boolean | null; patch: boolean | null; num: string | null; grade: string | null
  owner_name: string; owner_avatar: string | null
}
interface Filters { team: string; player: string; collection: string; year: string; rc: boolean; auto: boolean; patch: boolean }
interface Match { other: { id: string; name: string }; theirCard: { id: string; nom: string | null; image: string | null }; myCard: { id: string; nom: string | null; image: string | null } }

const EMPTY: Filters = { team: '', player: '', collection: '', year: '', rc: false, auto: false, patch: false }
const KEY = 'swipe-filters'
const countActive = (f: Filters) => [f.team, f.player, f.collection, f.year].filter(x => x.trim()).length + [f.rc, f.auto, f.patch].filter(Boolean).length

function loadFilters(): Filters {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Filters>) } } catch { return EMPTY }
}

export default function SwipeDeck({ onClose, onPropose }: { onClose: () => void; onPropose: (otherId: string, otherName: string, theirCardId: string, myCardId: string) => void }) {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [showFilters, setShowFilters] = useState(false)
  const [queue, setQueue] = useState<SwipeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [match, setMatch] = useState<Match | null>(null)
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)

  const nextRef = useRef(0)
  const loadingRef = useRef(false)
  const doneRef = useRef(false)
  const seen = useRef(new Set<string>())
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const drag = useRef<{ x: number; id: number } | null>(null)

  const token = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token || '', [])

  const loadMore = useCallback(async (reset = false) => {
    if (loadingRef.current || (doneRef.current && !reset)) return
    loadingRef.current = true; setLoading(true); setError('')
    try {
      const tk = await token()
      if (!tk) { setError('Connecte-toi pour utiliser le swipe.'); return }
      if (reset) { nextRef.current = 0; doneRef.current = false; setDone(false); seen.current = new Set(); setQueue([]) }
      const f = filtersRef.current
      const qs = new URLSearchParams({ offset: String(nextRef.current) })
      if (f.team.trim()) qs.set('team', f.team.trim()); if (f.player.trim()) qs.set('player', f.player.trim())
      if (f.collection.trim()) qs.set('collection', f.collection.trim()); if (f.year.trim()) qs.set('year', f.year.trim())
      if (f.rc) qs.set('rc', '1'); if (f.auto) qs.set('auto', '1'); if (f.patch) qs.set('patch', '1')
      const res = await fetch(`/api/trades/swipe?${qs}`, { headers: { Authorization: `Bearer ${tk}` } })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(/trade_swipes|relation|schema/i.test(j.error || '') ? 'Cette fonction n’est pas encore disponible (la mise à jour de la base n’est pas appliquée).' : (j.error || 'Chargement impossible.')); return }
      nextRef.current = j.next ?? nextRef.current
      if (j.done) { doneRef.current = true; setDone(true) }
      const fresh = ((j.cards || []) as SwipeCard[]).filter(c => !seen.current.has(c.id))
      fresh.forEach(c => seen.current.add(c.id))
      setQueue(q => [...q, ...fresh])
    } catch { setError('Chargement impossible, réessaie.') }
    finally { loadingRef.current = false; setLoading(false) }
  }, [token])

  useEffect(() => {
    const f = loadFilters(); setFilters(f); filtersRef.current = f
    void loadMore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // plus beaucoup de cartes d'avance : on en demande d'autres
  useEffect(() => { if (queue.length <= 3 && !doneRef.current && !loadingRef.current && !error) void loadMore() }, [queue.length, loadMore, error])

  const current = queue[0]

  const decide = useCallback(async (like: boolean) => {
    const card = queue[0]
    if (!card || leaving) return
    setLeaving(like ? 'right' : 'left')
    const tk = await token()
    const post = tk ? fetch('/api/trades/swipe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ cardId: card.id, like }) }).then(r => r.json()).catch(() => null) : Promise.resolve(null)
    window.setTimeout(() => { setQueue(q => q.slice(1)); setLeaving(null); setDx(0) }, 220)
    const r = await post
    if (r?.match) setMatch({ other: r.other, theirCard: r.theirCard, myCard: r.myCard })
  }, [queue, leaving, token])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showFilters || match) { if (e.key === 'Escape') { setShowFilters(false); setMatch(null) } return }
      if (e.key === 'ArrowRight') void decide(true)
      else if (e.key === 'ArrowLeft') void decide(false)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, onClose, showFilters, match])

  // empêche la page derrière de défiler
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])

  const apply = (f: Filters) => {
    setFilters(f); filtersRef.current = f
    try { localStorage.setItem(KEY, JSON.stringify(f)) } catch { /* rien */ }
    setShowFilters(false); void loadMore(true)
  }

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { if (drag.current && !leaving) setDx(e.clientX - drag.current.x) }
  const onUp = () => {
    if (!drag.current) return
    drag.current = null
    if (dx > 110) void decide(true)
    else if (dx < -110) void decide(false)
    else setDx(0)
  }

  const active = countActive(filters)
  const tx = leaving === 'right' ? 700 : leaving === 'left' ? -700 : dx
  const circle: React.CSSProperties = { width: 64, height: 64, borderRadius: '50%', border: 'none', fontSize: 28, fontWeight: 900, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.4)' }
  const input: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '2px solid #243063', background: '#0e1530', color: '#fff', fontSize: 15, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#aab3d1', display: 'block', margin: '12px 0 5px' }

  return (
    <div role="dialog" aria-label="Swipe d’échanges" style={{ position: 'fixed', inset: 0, zIndex: 20000000, display: 'flex', flexDirection: 'column', color: '#fff', background: 'linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%)', touchAction: 'none', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* barre du haut : retour à gauche, filtre à droite */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', width: 42, height: 42, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '.06em', textTransform: 'uppercase' }}>🔥 Swipe</span>
        <button type="button" onClick={() => { setDraft(filters); setShowFilters(true) }} aria-label="Filtres" style={{ position: 'relative', border: 'none', background: active ? '#2f6bff' : 'rgba(255,255,255,.12)', color: '#fff', height: 42, padding: '0 14px', borderRadius: 21, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          ⚙ Filtres{active > 0 && <span style={{ marginLeft: 6, background: '#fff', color: '#06122e', borderRadius: 10, padding: '1px 7px', fontSize: 12 }}>{active}</span>}
        </button>
      </div>

      {/* carte */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        {current ? (
          <div key={current.id} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: 'relative', width: 'min(100%, 420px)', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'grab', userSelect: 'none',
              transform: `translateX(${tx}px) rotate(${tx / 30}deg)`, transition: drag.current ? 'none' : 'transform .22s ease', opacity: leaving ? 0.2 : 1 }}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              {current.image_recto && <img src={current.image_recto} alt={current.nom || 'Carte'} draggable={false} style={{ maxWidth: '100%', maxHeight: 'min(58vh, 560px)', objectFit: 'contain', boxShadow: '0 12px 40px rgba(0,0,0,.55)', pointerEvents: 'none' }} />}
              <span style={{ position: 'absolute', top: 16, left: 12, padding: '4px 10px', border: '3px solid #3ddc97', color: '#3ddc97', fontWeight: 900, fontSize: 22, letterSpacing: '.08em', transform: 'rotate(-12deg)', opacity: Math.min(1, Math.max(0, dx / 110)) }}>J’AIME</span>
              <span style={{ position: 'absolute', top: 16, right: 12, padding: '4px 10px', border: '3px solid #ff6b6b', color: '#ff6b6b', fontWeight: 900, fontSize: 22, letterSpacing: '.08em', transform: 'rotate(12deg)', opacity: Math.min(1, Math.max(0, -dx / 110)) }}>PASSE</span>
            </div>
            <div style={{ width: '100%', textAlign: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: 20, lineHeight: 1.15 }}>{current.nom || 'Carte'}</div>
              <div style={{ fontSize: 13, color: '#aab3d1', marginTop: 2 }}>{[current.annee, current.marque, current.collection, current.variation].filter(Boolean).join(' · ')}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                {current.equipe && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: '#17214a' }}>{current.equipe}</span>}
                {current.rc && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: '#F97316' }}>RC</span>}
                {current.auto && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: '#3B82F6' }}>AUTO</span>}
                {current.patch && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: '#EF4444' }}>PATCH</span>}
                {current.num && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: '#7a2bff' }}>{current.num}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#aab3d1', marginTop: 8 }}>Chez <b style={{ color: '#fff' }}>{current.owner_name}</b></div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            {loading ? <div style={{ fontSize: 15 }}>Chargement…</div> : error ? (
              <>
                <div style={{ fontSize: 15, marginBottom: 14 }}>{error}</div>
                <button type="button" onClick={() => { void loadMore(true) }} style={{ border: 'none', background: '#2f6bff', color: '#fff', fontWeight: 800, padding: '11px 20px', borderRadius: 10, cursor: 'pointer' }}>Réessayer</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44 }}>🎴</div>
                <div style={{ fontWeight: 900, fontSize: 18, margin: '8px 0 6px' }}>{active ? 'Plus de cartes avec ces filtres' : 'Tu as tout vu pour l’instant'}</div>
                <div style={{ fontSize: 13, color: '#aab3d1', marginBottom: 16 }}>{active ? 'Élargis tes filtres pour voir d’autres cartes.' : 'Reviens plus tard : de nouvelles cartes à échanger arrivent tous les jours.'}</div>
                {active > 0 && <button type="button" onClick={() => apply(EMPTY)} style={{ border: 'none', background: '#2f6bff', color: '#fff', fontWeight: 800, padding: '11px 20px', borderRadius: 10, cursor: 'pointer' }}>Retirer les filtres</button>}
              </>
            )}
          </div>
        )}
      </div>

      {/* boutons */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 36, padding: '14px 0 22px' }}>
        <button type="button" onClick={() => void decide(false)} disabled={!current} aria-label="Passer" style={{ ...circle, background: '#d6293e', color: '#fff', opacity: current ? 1 : 0.4 }}>✕</button>
        <button type="button" onClick={() => void decide(true)} disabled={!current} aria-label="J’aime" style={{ ...circle, background: '#1e9e57', color: '#fff', opacity: current ? 1 : 0.4 }}>♥</button>
      </div>

      {/* panneau de filtres */}
      {showFilters && (
        <div onClick={() => setShowFilters(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(100%, 520px)', maxHeight: '88%', overflowY: 'auto', background: '#08153b', borderTop: '3px solid #fff', padding: '18px 18px calc(18px + env(safe-area-inset-bottom, 0px))', touchAction: 'pan-y' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 900, fontSize: 18 }}>Filtres</span>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="Fermer les filtres" style={{ border: 'none', background: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <label style={lbl}>Équipe</label><input style={input} value={draft.team} onChange={e => setDraft({ ...draft, team: e.target.value })} placeholder="Philadelphia 76ers" />
            <label style={lbl}>Joueur</label><input style={input} value={draft.player} onChange={e => setDraft({ ...draft, player: e.target.value })} placeholder="Embiid" />
            <label style={lbl}>Collection</label><input style={input} value={draft.collection} onChange={e => setDraft({ ...draft, collection: e.target.value })} placeholder="Prizm" />
            <label style={lbl}>Année</label><input style={input} value={draft.year} onChange={e => setDraft({ ...draft, year: e.target.value })} placeholder="2023-24" />
            <label style={lbl}>Type de carte</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['rc', 'RC'], ['auto', 'AUTO'], ['patch', 'PATCH']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setDraft({ ...draft, [k]: !draft[k] })} aria-pressed={draft[k]}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '2px solid ' + (draft[k] ? '#2f6bff' : '#243063'), background: draft[k] ? '#2f6bff' : 'transparent', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => apply(EMPTY)} style={{ flex: 1, padding: '13px 0', borderRadius: 10, border: '2px solid #243063', background: 'transparent', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Réinitialiser</button>
              <button type="button" onClick={() => apply(draft)} style={{ flex: 2, padding: '13px 0', borderRadius: 10, border: 'none', background: '#2f6bff', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Voir les cartes</button>
            </div>
          </div>
        </div>
      )}

      {/* match */}
      {match && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,9,18,.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 34, color: '#3ddc97', letterSpacing: '.04em', textTransform: 'uppercase' }}>C’est un match !</div>
          <div style={{ fontSize: 14, color: '#aab3d1', maxWidth: 320 }}>Toi et <b style={{ color: '#fff' }}>{match.other.name}</b> avez chacun aimé une carte de l’autre.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {match.myCard.image && <img src={match.myCard.image} alt={match.myCard.nom || ''} style={{ height: 170, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }} />}
            <span style={{ fontSize: 28 }}>⇄</span>
            {match.theirCard.image && <img src={match.theirCard.image} alt={match.theirCard.nom || ''} style={{ height: 170, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }} />}
          </div>
          <button type="button" onClick={() => { const m = match; setMatch(null); onPropose(m.other.id, m.other.name, m.theirCard.id, m.myCard.id) }} style={{ border: 'none', background: '#1e9e57', color: '#fff', fontWeight: 900, fontSize: 16, padding: '14px 28px', borderRadius: 12, cursor: 'pointer' }}>Proposer l’échange</button>
          <button type="button" onClick={() => setMatch(null)} style={{ border: 'none', background: 'none', color: '#aab3d1', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Continuer à swiper</button>
        </div>
      )}
    </div>
  )
}
