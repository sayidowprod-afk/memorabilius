'use client'
/* eslint-disable @next/next/no-img-element */
// Pack du jour : on déchire le haut du pack (glisser), puis les cartes sortent l'une derrière l'autre : touche pour retourner, touche encore pour passer à la suivante.
// À la fin, résumé avec wishlist / lien vers le set pour chaque carte.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BASE_ODDS, PACK_CARDS, PACK_COMMONS, PACK_MAX_COMMONS, PACK_MAX, PITY_LIMIT, RARITY_COLOR, RARITY_NAME, RARITY_RULE, type PackCard, type Rarity } from '@/lib/packs'
import { PackArt } from '@/components/PackArt'
import ShareToDiscord from '@/components/ShareToDiscord'
import './packs.css'

type State = { stock: number; next: string | null; max: number; canFree: boolean; pity: number; opened: number; info: { total: number; rarity: Record<string, number> }; dev?: boolean }
type Phase = 'idle' | 'tearing' | 'deck' | 'summary'

export const nice = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bRc\b/, 'RC')
const fmt = (n: number) => n.toLocaleString('fr-FR')
export const isPatch = (v: string | null) => !!v && /(patch|jersey|relic|memorabilia|swatch|fabric|remnant|woven|logoman)/i.test(v)

// compte à rebours jusqu'au prochain pack (mm:ss)
function countdown(next: string | null, now: number): string {
  if (!next) return ''
  const sec = Math.max(0, Math.ceil((new Date(next).getTime() - now) / 1000))
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

// Photo de carte : une photo horizontale est tournée d'un quart de tour pour remplir le cadre vertical
export function CardImg({ src }: { src: string }) {
  const [rot, setRot] = useState(false)
  return <img className={rot ? 'rot' : ''} src={src} alt="" onLoad={e => { const i = e.currentTarget; setRot(i.naturalWidth > i.naturalHeight * 1.05) }} />
}

export const hasPatch = (c: { patch?: boolean; variation: string | null }) => !!c.patch || isPatch(c.variation)
export function Pills({ c }: { c: PackCard }) {
  const patch = hasPatch(c)
  return (
    <span className="pk-pills">
      {c.rc && <i className="rc">RC</i>}
      {c.auto && <i className="au">AUTO</i>}
      {patch && <i className="pa">PATCH</i>}
      {c.run ? <i className="pn">/{c.run}</i> : null}
      {c.variation && <i className="pv">{nice(c.variation)}</i>}
      {!c.rc && !c.auto && !patch && !c.run && !c.variation && <i className="pb">BASE</i>}
    </span>
  )
}

const STRIP = 64   // hauteur (px) de la bande qu'on déchire

export default function PacksClient({ demoCards, overlay, onClose }: { demoCards?: PackCard[]; overlay?: boolean; onClose?: () => void } = {}) {
  const [token, setToken] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [st, setSt] = useState<State | null>(null)
  const [err, setErr] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [cards, setCards] = useState<PackCard[]>([])
  const [idx, setIdx] = useState(0)
  const [up, setUp] = useState(false)          // la carte du dessus est retournée
  const [leaving, setLeaving] = useState(false)
  const [flash, setFlash] = useState<Rarity | null>(null)
  const [pityHit, setPityHit] = useState(false)
  const [wished, setWished] = useState<Set<number>>(new Set())
  const [now, setNow] = useState(() => Date.now())
  const [tear, setTear] = useState(0)          // 0..1 : avancement de la déchirure
  const [torn, setTorn] = useState(false)
  const drag = useRef<{ x0: number; w: number } | null>(null)
  const tearing = useRef(false)
  const tearTick = useRef(0)
  const [tilt, setTilt] = useState({ rx: 4, ry: -6, gx: 30, gy: 20 })
  const [k, setK] = useState(1)           // taille du pack : il remplit l'écran
  const [odds, setOdds] = useState(false)   // fenêtre des probabilités
  const [sel, setSel] = useState<PackCard | null>(null)   // carte ouverte en grand depuis le résumé
  useEffect(() => {
    if (!overlay) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (odds) setOdds(false); else onClose?.() } }
    window.addEventListener('keydown', key)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key) }
  }, [overlay, onClose, odds])
  useEffect(() => {
    const fit = () => setK(Math.max(0.55, Math.min(1.6, (window.innerHeight * 0.62) / 380, (window.innerWidth * 0.8) / 250)))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    if (demoCards) { setToken('demo'); setUid('demo'); setReady(true); setSt({ stock: 7, next: new Date(Date.now() + 1500000).toISOString(), max: 10, canFree: true, pity: 3, opened: 12, dev: true, info: { total: 3940, rarity: { 1: 2100, 2: 900, 3: 600, 4: 300, 5: 40 } } }); return }
    supabase.auth.getSession().then(({ data }) => { setToken(data.session?.access_token || null); setUid(data.session?.user?.id || null); setReady(true) })
  }, [])
  const load = useCallback(async (t: string) => {
    try {
      const r = await fetch('/api/packs', { headers: { Authorization: 'Bearer ' + t } })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Chargement impossible (erreur ' + r.status + ')'); return }
      setErr(''); setSt(j as State)
    } catch { setErr('Connexion impossible. Vérifie ton réseau et réessaie.') }
  }, [])
  useEffect(() => { if (token && !demoCards) void load(token) }, [token, load, demoCards])
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])
  // le prochain pack vient d'arriver : on relit la réserve
  useEffect(() => { if (token && !demoCards && st?.next && new Date(st.next).getTime() <= now && !st.canFree) void load(token) }, [now, st, token, load, demoCards])

  const reset = () => { setSel(null); setPhase('idle'); setCards([]); setIdx(0); setUp(false); setLeaving(false); setTear(0); setTorn(false); tearing.current = false }

  // la déchirure est allée au bout : on demande le tirage, puis les cartes sortent
  async function finishTear() {
    if (!token || tearing.current) return
    tearing.current = true
    setErr(''); setTear(1); setTorn(true); setPhase('tearing')
    try { navigator.vibrate?.(40) } catch { /* pas de vibration */ }
    const started = Date.now()
    if (demoCards) { await new Promise(res => setTimeout(res, 900)); setCards(demoCards); setIdx(0); setUp(false); setPhase('deck'); return }
    const r = await fetch('/api/packs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'open' }) })
    const j = await r.json().catch(() => ({}))
    await new Promise(res => setTimeout(res, Math.max(0, 900 - (Date.now() - started))))
    if (!r.ok) { setErr(j.error || 'Le tirage a échoué'); reset(); void load(token); return }
    setCards(j.cards as PackCard[]); setIdx(0); setUp(false); setPityHit(!!j.pityHit); setWished(new Set()); setPhase('deck')
    void load(token)
  }
  // bouton « Ouvrir » : la déchirure se fait toute seule
  function autoTear() {
    if (phase !== 'idle' || tearing.current) return
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 900)
      const p = Math.min(1, t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 + Math.sin(t * 38) * .012 * (1 - t))   // départ lent, accélération, petits à-coups
      setTear(p)
      if (Math.floor(p * 12) !== Math.floor(tearTick.current * 12)) { try { navigator.vibrate?.(6) } catch { /* pas de vibration */ } }
      tearTick.current = p
      if (p < 1) requestAnimationFrame(step); else void finishTear()
    }
    requestAnimationFrame(step)
  }
  function onTearDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase !== 'idle' || !st?.canFree) return
    const w = e.currentTarget.getBoundingClientRect().width
    drag.current = { x0: e.clientX, w }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onTearMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const p = Math.max(0, Math.min(1, (e.clientX - drag.current.x0) / (drag.current.w * 0.9)))
    if (Math.floor(p * 12) !== Math.floor(tearTick.current * 12)) { try { navigator.vibrate?.(6) } catch { /* pas de vibration */ } }   // petit « cran » à chaque centimètre déchiré
    tearTick.current = p
    setTear(p)
  }
  function onTearUp() {
    if (!drag.current) return
    drag.current = null
    if (tear > 0.82) void finishTear()
    else if (tear < 0.03) autoTear()                      // simple toucher : le pack se tranche tout seul
    else setTear(0)                                      // pas assez loin : le pack se referme
  }

  // cartes : on prend la carte du dessus avec le doigt. Un toucher la retourne ; une fois retournée, on la lance d'un geste (ou un toucher) pour voir la suivante.
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [grab, setGrab] = useState(false)
  const [fly, setFly] = useState<{ x: number; y: number; r: number } | null>(null)
  const [shine, setShine] = useState({ gx: 50, gy: 30, rx: 0, ry: 0 })
  const start = useRef<{ x: number; y: number } | null>(null)

  function reveal() {
    const c = cards[idx]; if (!c || up) return
    setUp(true)
    if (c.rarity >= 4) { setFlash(c.rarity); setTimeout(() => setFlash(null), 1000) }
    try { navigator.vibrate?.(c.rarity >= 4 ? [30, 40, 60] : 15) } catch { /* pas de vibration */ }
  }
  function throwAway(dx: number, dy: number) {
    if (leaving) return
    const n = Math.hypot(dx, dy) || 1
    setLeaving(true); setGrab(false)
    setFly({ x: (dx / n) * 700, y: (dy / n) * 700 - 120, r: dx * 0.12 })
    setTimeout(() => {
      setLeaving(false); setUp(false); setFly(null); setOff({ x: 0, y: 0 })
      if (idx + 1 >= cards.length) setPhase('summary'); else setIdx(idx + 1)
    }, 360)
  }
  function onCardDown(e: React.PointerEvent<HTMLDivElement>) {
    if (leaving) return
    start.current = { x: e.clientX, y: e.clientY }; setGrab(true)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture impossible */ }
  }
  function onCardMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
    setShine({ gx: px * 100, gy: py * 100, rx: (0.5 - py) * 14, ry: (px - 0.5) * 18 })
    if (!start.current || leaving) return
    setOff({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }
  function onCardUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y
    start.current = null; setGrab(false)
    const d = Math.hypot(dx, dy)
    if (d < 10) { setOff({ x: 0, y: 0 }); if (!up) reveal(); else throwAway(0.4, -1); return }   // simple toucher
    if (!up) { reveal(); setOff({ x: 0, y: 0 }); return }                                          // on tire une carte face cachée : elle se retourne
    if (d > 90) throwAway(dx, dy); else setOff({ x: 0, y: 0 })                                   // lancée assez fort : elle part, sinon elle revient
  }
  const lastCard = cards.length > 0 && idx === cards.length - 1
  const shown: PackCard | null = sel ?? (cards.length ? cards[cards.length - 1] : null)
  const best = useMemo(() => cards.reduce((m: number, c) => Math.max(m, c.rarity), 0), [cards])

  async function toWishlist(c: PackCard) {
    if (!uid || wished.has(c.id)) return
    setWished(w => new Set(w).add(c.id))
    const { data: ex } = await supabase.from('wishlist').select('id').eq('user_id', uid).eq('nom', c.player).eq('collection', c.set || '').eq('variation', c.variation || '').limit(1)
    if (ex && ex.length) return
    const { error } = await supabase.from('wishlist').insert({
      user_id: uid, nom: c.player, annee: c.year ? String(c.year) : '', marque: c.brand || '', collection: c.set || '', variation: c.variation || '',
      num: '', rc: c.rc, auto: c.auto, patch: hasPatch(c), notes: [c.number ? `#${c.number}` : '', c.team || ''].filter(Boolean).join(' · '),
    })
    if (error) setWished(w => { const n = new Set(w); n.delete(c.id); return n })
  }

  const total = st?.info.total || 0
  const pct = (r: Rarity) => st?.info.rarity[String(r)] ? fmt(st.info.rarity[String(r)]) : '0'
  const x = tear * 100
  const current = cards[idx]

  return (
    <div className={'pk pk-full' + (overlay ? ' pk-overlay' : '') + (phase === 'summary' ? ' pk-scroll' : '')} style={{ ['--k' as string]: k }}>
      {overlay && <button type="button" className="pk-x" onClick={() => onClose?.()} aria-label="Fermer">✕</button>}
      <div className="pk-spot" aria-hidden />

      {ready && !token && <div className="pk-box pk-login"><p>Connecte-toi pour ouvrir tes packs.</p><Link className="pk-btn fill" href="/connexion">Se connecter</Link></div>}
      {err && <div className="pk-err pk-float">{err}</div>}
      {token && !st && !err && <div className="pk-loading">Ton pack arrive…</div>}

      {token && st && (phase === 'idle' || phase === 'tearing') && (
        <section className="pk-stage2">
          <div className="pk-hud">
            <div className="pk-pips" aria-label={`${st.stock} packs en réserve sur ${st.max}`}>{Array.from({ length: st.max }, (_, i) => <i key={i} className={i < st.stock ? 'on' : ''} />)}</div>
            <span>{st.stock} / {st.max}{st.stock < st.max && st.next ? ` · prochain dans ${countdown(st.next, now)}` : ''}</span>
          </div>

          <div className={'pk-packbox' + (st.canFree ? '' : ' wait')} style={{ width: 250 * k, height: 380 * k }}>
            <div
              className={'pk-packwrap' + (torn ? ' torn' : '') + (!st.canFree ? ' used' : '')}
              style={{ ['--rx' as string]: `${tilt.rx}deg`, ['--ry' as string]: `${tilt.ry}deg`, ['--gx' as string]: `${tilt.gx}%`, ['--gy' as string]: `${tilt.gy}%`, transform: `scale(${k})`, transformOrigin: '0 0' }}
              onPointerMove={e => { if (drag.current || torn) return; const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; setTilt({ rx: 4 + (0.5 - py) * 16, ry: -6 + (px - 0.5) * 22, gx: px * 100, gy: py * 100 }) }}
              onPointerLeave={() => setTilt({ rx: 4, ry: -6, gx: 30, gy: 20 })}
            >
              <div className="pk-glow" />
              <div className="pk-pack">
                {torn && <div className="pk-risers"><i /><i /><i /><i /></div>}
                <div className="pk-p body" style={{ clipPath: `inset(${STRIP}px 0 0 0)` }}><PackArt /></div>
                <div className="pk-p top" style={{ clipPath: `inset(0 0 calc(100% - ${STRIP}px) 0)` }}><PackArt /></div>
                <div className="pk-glare" />
                {tear > 0 && (
                  <div className="pk-slash" style={{ width: `${x}%`, top: STRIP - 2 }}>
                    {!torn && <b className="pk-spark" />}
                  </div>
                )}
                {torn && <div className="pk-cutflash" style={{ top: STRIP - 3 }} />}
                {phase === 'idle' && st.canFree && (
                  <div className="pk-grab" role="button" tabIndex={0} aria-label="Ouvrir le pack" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoTear() } }}
                    onPointerDown={onTearDown} onPointerMove={onTearMove} onPointerUp={onTearUp} onPointerCancel={onTearUp} style={{ height: STRIP + 14 }}>
                    <span style={{ opacity: tear > 0.05 ? 0 : 1 }}>Glisse pour trancher →</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="pk-floor" aria-hidden />
          <div className="pk-caption">
            {st.canFree
              ? (phase === 'idle' ? 'Glisse sur le haut du pack, ou touche-le' : '')
              : <>Plus de pack en réserve<b>Le prochain arrive dans {countdown(st.next, now)}</b></>}
          </div>
          {st.dev && <small className="pk-dev">Mode test local : packs illimités</small>}
        </section>
      )}

        {phase === 'deck' && current && (
          <section className="pk-deck-stage" style={{ ['--rc' as string]: RARITY_COLOR[current.rarity] }}>
            <div className={'pk-aura r' + current.rarity + (up ? ' on' : '')} />
            <div className="pk-counter">{idx + 1} / {cards.length}</div>
            <div className="pk-scene">
              <div className={'pk-deck' + (idx === 0 ? ' emerge' : '')}>
                {cards.slice(idx + 1, idx + 5).reverse().map((c, k, arr) => {
                  const depth = arr.length - k   // 1 = juste derrière la carte du dessus
                  const near = depth === 1
                  const pull = Math.min(1, Math.hypot(off.x, off.y) / 180)
                  const seed = (c.id % 7) - 3
                  return (
                    <div key={c.id} className={'pk-behind r' + c.rarity} style={{ transform: `translate(${depth * 5 + seed}px, ${depth * -5}px) rotate(${depth * 1.2 + seed * 0.4}deg) scale(${near ? 0.95 + pull * 0.05 : 1})`, zIndex: 10 - depth, ['--rc' as string]: RARITY_COLOR[c.rarity] }}>
                      <span className="pk-face back"><b>M</b></span>
                    </div>
                  )
                })}
                <div
                  key={current.id}
                  role="button"
                  tabIndex={0}
                  className={'pk-card top' + (up ? ' on' : '') + (grab ? ' grab' : '') + ' r' + current.rarity}
                  style={{
                    ['--rc' as string]: RARITY_COLOR[current.rarity], ['--gx' as string]: `${shine.gx}%`, ['--gy' as string]: `${shine.gy}%`,
                    transform: fly ? `translate(${fly.x}px, ${fly.y}px) rotate(${fly.r}deg)` : `translate(${off.x}px, ${off.y}px) rotate(${off.x * 0.06}deg) rotateX(${grab ? shine.rx : 0}deg) rotateY(${grab ? shine.ry : 0}deg)`,
                    transition: fly ? 'transform .36s ease-in, opacity .36s ease-in' : grab ? 'none' : 'transform .3s cubic-bezier(.2,.9,.3,1)',
                    opacity: fly ? 0 : 1,
                  }}
                  onPointerDown={onCardDown}
                  onPointerMove={onCardMove}
                  onPointerUp={onCardUp}
                  onPointerCancel={() => { start.current = null; setGrab(false); setOff({ x: 0, y: 0 }) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!up) reveal(); else throwAway(0.4, -1) } }}
                  aria-label={up ? 'Carte suivante' : 'Retourner la carte'}
                >
                  <span className={'pk-face back hint r' + current.rarity}><b>M</b></span>
                  <span className="pk-face front">
                    <span className="pk-art"><CardImg src={current.img} /></span>
                    {current.rarity >= 3 && <span className={'pk-foil r' + current.rarity} />}
                    <span className="pk-tag">{RARITY_NAME[current.rarity]}</span>
                    <span className="pk-corner">
                      {current.rc && <i className="rc">RC</i>}
                      {current.auto && <i className="au">AUTO</i>}
                      {hasPatch(current) && <i className="pa">PATCH</i>}{current.run ? <i className="pn">/{current.run}</i> : null}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div className={'pk-now' + (up ? ' show' : '')}>
              <b>{current.player}</b>
              <small>{[current.team, current.number ? `#${current.number}` : ''].filter(Boolean).join(' · ')}</small>
              <small>{[current.year, current.set].filter(Boolean).join(' ')}</small>
              <Pills c={current} />
              {up && <div className="pk-acts">
                <button type="button" className={wished.has(current.id) ? 'on' : ''} onClick={() => void toWishlist(current)}>{wished.has(current.id) ? '★ En wishlist' : '☆ Wishlist'}</button>
                <Link href={`/setlist/${current.setId}`}>Voir le set</Link>
                {current.rarity >= 4 && <ShareToDiscord entryId={current.id} />}
              </div>}
              {up && current.credit && <small className="cr">Photo : {current.credit}</small>}
            </div>
            <div className="pk-hint">{up ? (lastCard ? 'Lance la carte pour voir le résumé' : 'Lance la carte pour voir la suivante') : 'Touche ou tire la carte pour la retourner'}</div>
            <button type="button" className="pk-skip" onClick={() => setPhase('summary')}>Tout voir d’un coup</button>
          </section>
        )}

        {phase === 'summary' && (
          <section className="pk-reveal pk-wrap pk-sumwrap">
            <div className="pk-reveal-bar">
              <b>{best >= 4 ? 'Quel tirage !' : 'Ton tirage'}</b>
              <button type="button" className="pk-btn fill" onClick={() => { if (overlay && !st?.dev) { reset(); onClose?.() } else reset() }}>{st?.dev ? 'Rouvrir (test)' : 'Terminer'}</button>
            </div>
            {pityHit && <div className="pk-note">Garantie déclenchée : après {PITY_LIMIT} packs sans carte épique, celle-ci était assurée.</div>}
            <div className="pk-sum">
              {cards.map(c => (
                <button key={c.id} type="button" className={'ph-card' + (shown && shown.id === c.id ? ' sel' : '')} style={{ ['--rc' as string]: RARITY_COLOR[c.rarity] }} onClick={() => setSel(c)} title={`${c.player} · ${RARITY_NAME[c.rarity]}`}>
                  <span className="ph-art"><CardImg src={c.img} /></span>
                  <span className="ph-tag">{RARITY_NAME[c.rarity]}</span>
                  <span className="ph-corner">{c.rc && <i className="rc">RC</i>}{c.auto && <i className="au">AUTO</i>}{hasPatch(c) && <i className="pa">PATCH</i>}{c.run ? <i className="pn">/{c.run}</i> : null}</span>
                  <span className="ph-name">{c.player}</span>
                </button>
              ))}
            </div>
            {shown && (
              <div className="pk-sum-detail" style={{ ['--rc' as string]: RARITY_COLOR[shown.rarity] }}>
                <div className="pk-sum-head">
                  <b className="da-display">{shown.player}</b>
                  <span className="pk-sum-rar">{RARITY_NAME[shown.rarity]}</span>
                </div>
                <small>{[shown.team, shown.number ? `#${shown.number}` : '', [shown.year, shown.set].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</small>
                <Pills c={shown} />
                <div className="pk-acts">
                  <button type="button" className={wished.has(shown.id) ? 'on' : ''} onClick={() => void toWishlist(shown)}>{wished.has(shown.id) ? '★ En wishlist' : '☆ Wishlist'}</button>
                  <Link href={`/setlist/${shown.setId}`}>Voir le set</Link>
                  {shown.rarity >= 4 && <ShareToDiscord entryId={shown.id} />}
                </div>
                {shown.credit && <small className="cr">Photo : {shown.credit}</small>}
              </div>
            )}
            <p className="pk-sum-hint">Touche une carte pour voir son détail</p>
          </section>
        )}

      <button type="button" className="pk-odds-btn" onClick={() => setOdds(true)}>Probabilités</button>
      {odds && (
        <div className="pk-modal" role="dialog" aria-modal="true" aria-label="Les probabilités" onClick={e => { if (e.target === e.currentTarget) setOdds(false) }}>
          <div className="pk-modal-card pk-odds">
            <button type="button" className="pk-modal-x" onClick={() => setOdds(false)} aria-label="Fermer">✕</button>
            <h2>Les probabilités</h2>
          <p>Chaque carte tirée a ces chances d’être de chaque rareté. Un tirage est toujours au hasard, sans influence de ton compte.</p>
          <div className="pk-table">
            {([1, 2, 3, 4, 5] as Rarity[]).map(r => (
              <div key={r} style={{ ['--rc' as string]: RARITY_COLOR[r] }}>
                <i /><b>{RARITY_NAME[r]}<em>{RARITY_RULE[r]}</em></b><span>{BASE_ODDS[r]} %</span><small>{pct(r)} cartes</small>
              </div>
            ))}
          </div>
          <ul>
            <li>Chaque pack contient au moins <b>{PACK_COMMONS} à {PACK_MAX_COMMONS} cartes communes</b>, <b>au moins 1 carte rare ou mieux</b> mais <b>jamais plus d’1 rare, 1 épique et 1 légendaire</b>, et jamais deux fois le même joueur.</li>
            <li><b>Garantie :</b> si tu ouvres {PITY_LIMIT} packs sans carte épique ou légendaire, le suivant en contient une à coup sûr.</li>
            <li>La rareté dépend du type de carte (base, insert, numérotée, patch, signée). Le tirage d’une série numérotée vient des cartes que les membres ont reliées : plus ils en relient, plus c’est précis.</li>
            <li>Les cartes viennent de la base du site et les photos de la communauté (créditées). Les cartes privées n’y sont jamais.</li>
          </ul>
            <small className="pk-note-total">{total ? `${fmt(total)} cartes dans le jeu` : ''} · {PACK_CARDS} cartes par pack</small>
          </div>
        </div>
      )}
      {flash && <div className="pk-flash" style={{ ['--rc' as string]: RARITY_COLOR[flash] }} />}
    </div>
  )
}
