'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadUprightImage } from '@/lib/uprightImage'

interface QuizCard {
  id: string; player_name: string; team: string | null; image_recto: string
  crop_x: number; crop_y: number; crop_w: number; crop_h: number; rotation_deg: number
  rc: boolean; patch: boolean; num: string | null; annee: string | null
  marque: string | null; collection: string | null; owner_name: string | null
  tier: string | null
}

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const
const TIER_COLORS: Record<string, string> = { S: '#e74c3c', A: '#e67e22', B: '#f1c40f', C: '#2ecc71', D: '#3498db' }

function TierButton({ tier, active, onClick }: { tier: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 42, height: 42, borderRadius: 10, fontWeight: 900, fontSize: 17, cursor: 'pointer',
        background: lit ? TIER_COLORS[tier] : 'rgba(255,255,255,0.08)',
        color: lit ? '#111' : 'white',
        border: `2px solid ${lit ? TIER_COLORS[tier] : 'rgba(255,255,255,0.14)'}`,
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
      }}
    >{tier}</button>
  )
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Outil présentateur pour le quiz "devine le joueur" -- pas d'interaction
// spectateur, c'est l'animateur qui clique pendant l'émission. Signature
// seule affichée en grand (dessinée sur canvas depuis la zone de crop
// définie dans /admin/autograph-quiz), un clic révèle la carte complète.
export default function AutographQuizPresenterPage() {
  // allCards : tout ce qui est valide (sert de reserve pour les mauvaises
  // reponses du QCM et pour le compteur "deja classees"). cards : la file
  // active affichee -- par defaut seulement les pas-encore-classees, pour
  // pouvoir fermer et reprendre plus tard exactement la ou on en etait (le
  // tier est deja sauvegarde en base des le clic S/A/B/C/D, donc une carte
  // classee lors d'une session precedente n'est simplement plus reproposee).
  const [allCards, setAllCards] = useState<QuizCard[]>([])
  const [cards, setCards] = useState<QuizCard[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [uprightFullSrc, setUprightFullSrc] = useState<string | null>(null)
  const [qcmMode, setQcmMode] = useState(false)
  const [choices, setChoices] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setError('Connecte-toi avec ton compte admin.'); setLoading(false); return }
      try {
        const res = await fetch('/api/admin/autograph-quiz', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.status === 403) { setError('Accès réservé aux admins.'); setLoading(false); return }
        const json = await res.json()
        const valid = (json.cards || []).filter((c: QuizCard) => c.crop_w > 0 && c.crop_h > 0)
        setAllCards(valid)
        setCards(shuffle(valid.filter((c: QuizCard) => !c.tier)))
      } catch (e: any) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const current = cards[idx]

  useEffect(() => {
    if (!current || !canvasRef.current) return
    let cancelled = false
    setUprightFullSrc(null)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    // Passe d'abord par une image "upright" (voir uprightImage.ts) -- les cartes
    // horizontales sont stockees en orientation brute (portrait, tournee), sinon
    // la signature (et la carte revelee) s'affichaient de travers.
    loadUprightImage(current.image_recto, current.rotation_deg).then(upright => {
      if (cancelled) return
      setUprightFullSrc(upright.toDataURL('image/jpeg', 0.92))
      const sx = current.crop_x * upright.width
      const sy = current.crop_y * upright.height
      const sw = current.crop_w * upright.width
      const sh = current.crop_h * upright.height
      const outW = 1400
      const outH = Math.round(outW * (sh / sw))
      canvas.width = outW
      canvas.height = outH
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(upright, sx, sy, sw, sh, 0, 0, outW, outH)
    })
    return () => { cancelled = true }
  }, [current])

  // 4 choix (mode QCM) : le bon nom + 3 autres pioches parmi les autres cartes
  // validees, melanges. Recalcule a chaque nouvelle carte affichee.
  useEffect(() => {
    if (!current) return
    const others = allCards.filter(c => c.id !== current.id).map(c => c.player_name)
    const wrongs = shuffle(others).slice(0, 3)
    setChoices(shuffle([current.player_name, ...wrongs]))
  }, [current?.id, allCards])

  // Classement tier-list en direct, une fois le joueur devine et la carte
  // revelee -- maj optimiste locale + persistee en base (PATCH).
  // Token capture une seule fois au chargement expire au bout d'1h -- sur une
  // emission en direct laissee ouverte longtemps, le classement echouait en
  // 403 passe ce delai. Token frais (rafraichi si besoin) a chaque clic.
  const setTier = async (tier: string) => {
    if (!current) return
    const tok = (await supabase.auth.getSession()).data.session?.access_token
    if (!tok) { console.error('[autograph-quiz] session expirée'); return }
    const newTier = current.tier === tier ? null : tier // reclic = desassigne
    setAllCards(prev => prev.map(c => c.id === current.id ? { ...c, tier: newTier } : c))
    setCards(prev => {
      const updated = prev.map(c => c.id === current.id ? { ...c, tier: newTier } : c)
      // Hors mode revision : une carte classee sort tout de suite de la file --
      // en fermant l'onglet ici (tier deja sauvegarde en base) et en revenant
      // plus tard, elle ne sera de toute facon plus reproposee au rechargement.
      return reviewMode ? updated : updated.filter(c => c.id !== current.id || newTier === null)
    })
    try {
      await fetch('/api/admin/autograph-quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ id: current.id, tier: newTier }),
      })
    } catch (e) {
      console.error('[autograph-quiz] tier save failed', e)
    }
  }

  const next = () => { setRevealed(false); setIdx(i => (i + 1) % Math.max(1, cards.length)) }
  const prev = () => { setRevealed(false); setIdx(i => (i - 1 + cards.length) % Math.max(1, cards.length)) }
  const reshuffle = () => { setRevealed(false); setIdx(0); setCards(prev => shuffle(prev)) }
  const toggleReview = () => {
    setRevealed(false); setIdx(0)
    const next = !reviewMode
    setReviewMode(next)
    setCards(shuffle(next ? allCards : allCards.filter(c => !c.tier)))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'white', background: '#0a0e1a', minHeight: '100vh' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>{error}</div>
  if (allCards.length === 0) return <div style={{ padding: 40, textAlign: 'center' }}>Aucune carte validée. Va d'abord sur /admin/autograph-quiz.</div>
  if (cards.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: '#0a0e1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'white' }}>
        <p style={{ fontSize: 20, fontWeight: 800 }}>🎉 Toutes les cartes ont été classées</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={toggleReview} style={btnStyle}>🔁 Revoir toutes les cartes</button>
          <Link href="/admin/autograph-quiz/tierlist" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-block' }}>🏆 Voir la tier list</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: '#0a0e1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
      <img src="/memorabilius-logo.png" alt="Memorabilius" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', height: 26, width: 'auto' }} />
      <div style={{ position: 'absolute', top: 16, left: 20 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 700, margin: 0 }}>
          {idx + 1} / {cards.length}{reviewMode ? ' (revision)' : ''}
        </p>
        {!reviewMode && allCards.length > cards.length && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, margin: '2px 0 0' }}>
            {allCards.length - cards.length} déjà classée(s)
          </p>
        )}
      </div>
      <div style={{ position: 'absolute', top: 12, right: 20, display: 'flex', gap: 8 }}>
        <button onClick={toggleReview} style={{ ...btnStyle, fontSize: 12, padding: '8px 14px' }}>
          {reviewMode ? '↩️ Reprendre' : '🔁 Revoir tout'}
        </button>
        <button onClick={() => setQcmMode(v => !v)} style={{ ...btnStyle, fontSize: 12, padding: '8px 14px' }}>
          {qcmMode ? '📝 Mode QCM' : '🗽 Mode libre'}
        </button>
      </div>

      {!revealed ? (
        <canvas ref={canvasRef} style={{ maxWidth: '92vw', maxHeight: '58vh', width: 'auto', height: 'auto', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '92vw' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <img src={uprightFullSrc || current.image_recto} alt={current.player_name} style={{ maxWidth: '52vw', maxHeight: '48vh', width: 'auto', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'white', fontSize: 36, fontWeight: 900, margin: 0 }}>{current.player_name}</p>
              {current.team && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>{current.team}</p>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            {(current.rc || current.patch || current.num) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {current.rc && <span style={badgeStyle('#e67e22')}>★ RC</span>}
                {current.patch && <span style={badgeStyle('#1565c0')}>PATCH</span>}
                {current.num && <span style={badgeStyle('#7b1fa2')}>{current.num}</span>}
              </div>
            )}
            {(current.annee || current.marque || current.collection) && (
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
                {[current.annee, current.marque, current.collection].filter(Boolean).join(' · ')}
              </div>
            )}
            {current.owner_name && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Carte de</div>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>{current.owner_name}</div>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Classer dans la tier list
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIERS.map(t => (
                  <TierButton key={t} tier={t} active={current.tier === t} onClick={() => setTier(t)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {qcmMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 640 }}>
          {choices.map(name => {
            const isCorrect = name === current.player_name
            return (
              <div key={name} style={{
                padding: '12px 18px', borderRadius: 12, fontWeight: 800, fontSize: 17, textAlign: 'center',
                background: revealed && isCorrect ? '#1a7a3a' : 'rgba(255,255,255,0.08)',
                border: revealed && isCorrect ? '2px solid #2ecc71' : '2px solid rgba(255,255,255,0.12)',
                color: 'white', transition: 'all 0.2s',
              }}>
                {name}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        <button onClick={prev} style={btnStyle}>← Précédent</button>
        <button onClick={() => setRevealed(r => !r)} style={{ ...btnStyle, background: '#003DA6', minWidth: 160 }}>
          {revealed ? 'Cacher' : '👁️ Révéler'}
        </button>
        <button onClick={next} style={btnStyle}>Suivant →</button>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={reshuffle} style={{ ...btnStyle, opacity: 0.6, fontSize: 12 }}>🔀 Remélanger</button>
        <Link href="/admin/autograph-quiz/tierlist" style={{ ...btnStyle, opacity: 0.6, fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>
          🏆 Voir la tier list
        </Link>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '12px 22px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)',
  color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer',
}

const badgeStyle = (bg: string): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 99, background: bg, color: 'white',
  fontSize: 12, fontWeight: 900, letterSpacing: 0.3,
})
