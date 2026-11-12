'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

// 810 · Revue d'un lot ajouté : les cartes défilent une à une en grand.
// « ✓ Juste » (glisser à droite) passe à la suivante ; « ✗ Corriger » (glisser à gauche) ouvre les champs principaux, on corrige et on enregistre sans quitter la revue.
// Les champs vides sont en orange. Les bords de la carte restent nets (jamais arrondis).
interface Row { id: string; nom: string | null; equipe: string | null; annee: string | null; marque: string | null; collection: string | null; variation: string | null; num: string | null; card_number: string | null; grade: string | null; rc: boolean | null; auto: boolean | null; patch: boolean | null; image_recto: string | null; is_horizontal: boolean | null }
const COLS = 'id, nom, equipe, annee, marque, collection, variation, num, card_number, grade, rc, auto, patch, image_recto, is_horizontal'
const FIELDS: { k: keyof Row; label: string }[] = [
  { k: 'nom', label: 'Joueur' }, { k: 'equipe', label: 'Équipe' }, { k: 'annee', label: 'Année' }, { k: 'marque', label: 'Marque' },
  { k: 'collection', label: 'Collection' }, { k: 'variation', label: 'Variation' }, { k: 'card_number', label: 'N° de carte' }, { k: 'num', label: 'Numérotation' },
]
const isTodo = (r: Row) => !r.nom || r.nom === 'Carte à compléter'
const missing = (r: Row) => FIELDS.filter(f => (['nom', 'equipe', 'annee', 'collection'].includes(f.k as string) && !String(r[f.k] ?? '').trim()) || (f.k === 'nom' && isTodo(r))).map(f => f.k)

export default function LotReview({ userId, count, onClose }: { userId: string; count: number; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [i, setI] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Record<keyof Row, string>>>({})
  const [fixed, setFixed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number; y: number; id: number } | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data } = await supabase.from('cartes_manuelles').select(COLS).eq('user_id', userId).order('created_at', { ascending: false }).limit(Math.max(1, count))
      if (cancel) return
      // les cartes à compléter d'abord (ce sont elles qui ont besoin d'un œil), puis dans l'ordre d'ajout
      const list = ((data || []) as Row[]).reverse()
      setRows([...list.filter(isTodo), ...list.filter(r => !isTodo(r))])
    })()
    return () => { cancel = true }
  }, [userId, count])

  const done = rows !== null && i >= rows.length
  const cur = rows && !done ? rows[i] : null
  const next = useCallback(() => { setEditing(false); setError(''); setDx(0); setI(n => n + 1) }, [])
  const openEdit = useCallback(() => {
    if (!cur) return
    const d = Object.fromEntries(FIELDS.map(f => [f.k, String(cur[f.k] ?? '')])) as Partial<Record<keyof Row, string>>
    if (isTodo(cur)) d.nom = ''
    setDraft(d)
    setEditing(true); setDx(0)
  }, [cur])

  const save = async () => {
    if (!cur) return
    setSaving(true); setError('')
    const patch: Record<string, string | null> = {}
    for (const f of FIELDS) {
      const v = (draft[f.k] ?? '').toString().trim()
      patch[f.k as string] = f.k === 'nom' ? (v || 'Carte à compléter') : (v || null)
    }
    const { error: err } = await supabase.from('cartes_manuelles').update(patch).eq('id', cur.id).eq('user_id', userId)
    setSaving(false)
    if (err) { setError('Impossible d’enregistrer pour le moment.'); return }
    setRows(list => (list || []).map(r => (r.id === cur.id ? { ...r, ...(patch as Partial<Row>) } : r)))
    setFixed(n => n + 1)
    next()
  }

  // clavier : → juste, ← corriger, Échap ferme
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      const t = e.target as HTMLElement
      if (editing || t.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' && cur) next()
      if (e.key === 'ArrowLeft' && cur) openEdit()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [cur, editing, next, openEdit, onClose])

  const onDown = (e: React.PointerEvent) => { if (editing) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const x = e.clientX - d.x; if (Math.abs(x) > 6) setDx(x) }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null
    if (!d) return
    const x = e.clientX - d.x, y = e.clientY - d.y
    if (Math.abs(x) > 90 && Math.abs(x) > Math.abs(y)) { if (x > 0) next(); else openEdit() } else setDx(0)
  }

  if (typeof document === 'undefined') return null
  const warn = cur ? missing(cur) : []
  const btn: React.CSSProperties = { flex: 1, padding: '14px 10px', border: '2px solid', font: '800 14px system-ui', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', color: '#fff' }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Vérifier le lot" style={{ position: 'fixed', inset: 0, zIndex: 20000000, background: '#050912', color: '#fff', display: 'flex', flexDirection: 'column', padding: 'max(12px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom))', gap: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ flex: 1, fontSize: 16 }}>Vérifier le lot</b>
        {rows && !done && <span style={{ font: '800 12px system-ui', border: '2px solid #2f6bff', padding: '3px 8px' }}>{Math.min(i + 1, rows.length)} / {rows.length}</span>}
        <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 0, color: '#fff', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {rows === null && <div style={{ margin: 'auto', color: '#aab3d1' }}>Chargement des cartes…</div>}
      {rows !== null && rows.length === 0 && <div style={{ margin: 'auto', color: '#aab3d1' }}>Aucune carte à vérifier.</div>}

      {done && rows && rows.length > 0 && (
        <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 34 }}>✓</div>
          <b style={{ fontSize: 18 }}>{rows.length} carte{rows.length > 1 ? 's' : ''} vérifiée{rows.length > 1 ? 's' : ''}</b>
          <span style={{ color: '#aab3d1' }}>{fixed ? `${fixed} corrigée${fixed > 1 ? 's' : ''}` : 'Aucune correction'}</span>
          <button type="button" onClick={onClose} style={{ ...btn, flex: 'none', background: '#2f6bff', borderColor: '#2f6bff', padding: '12px 26px' }}>Terminer</button>
        </div>
      )}

      {cur && !editing && (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', touchAction: 'pan-y', userSelect: 'none' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setDx(0) }}>
            <div style={{ position: 'relative', height: '100%', maxHeight: '62vh', aspectRatio: cur.is_horizontal ? '7 / 5' : '5 / 7', maxWidth: '100%', transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: dx ? 'none' : 'transform .2s' }}>
              {cur.image_recto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={cur.image_recto} alt={cur.nom || 'Carte'} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', boxShadow: '0 14px 36px rgba(0,0,0,.6)' }} />
                : <div style={{ width: '100%', height: '100%', background: '#17214a' }} />}
              {dx > 40 && <span style={{ position: 'absolute', top: 14, left: 14, font: '900 18px system-ui', color: '#4fd18b', border: '3px solid #4fd18b', padding: '2px 8px', background: 'rgba(0,0,0,.5)' }}>JUSTE</span>}
              {dx < -40 && <span style={{ position: 'absolute', top: 14, right: 14, font: '900 18px system-ui', color: '#ff6b6b', border: '3px solid #ff6b6b', padding: '2px 8px', background: 'rgba(0,0,0,.5)' }}>CORRIGER</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {[['nom', cur.nom], ['equipe', cur.equipe], ['annee', cur.annee], ['collection', cur.collection]].map(([k, v]) => {
              const bad = warn.includes(k as keyof Row)
              return <span key={k as string} style={{ font: '700 12px system-ui', padding: '4px 9px', background: bad ? '#c98a12' : '#17214a', color: '#fff' }}>{bad ? ((k === 'nom' ? 'Joueur' : k === 'equipe' ? 'Équipe' : k === 'annee' ? 'Année' : 'Collection') + ' ?') : String(v)}</span>
            })}
            {cur.variation && <span style={{ font: '700 12px system-ui', padding: '4px 9px', background: '#17214a' }}>{cur.variation}</span>}
            {cur.rc && <span style={{ font: '800 11px system-ui', padding: '4px 8px', background: '#1e9e57' }}>RC</span>}
            {cur.auto && <span style={{ font: '800 11px system-ui', padding: '4px 8px', background: '#7a2bff' }}>AUTO</span>}
            {cur.patch && <span style={{ font: '800 11px system-ui', padding: '4px 8px', background: '#d6293e' }}>PATCH</span>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={openEdit} style={{ ...btn, background: '#d6293e', borderColor: '#d6293e' }}>✗ Corriger</button>
            <button type="button" onClick={next} style={{ ...btn, background: '#1e9e57', borderColor: '#1e9e57' }}>✓ Juste</button>
          </div>
          <div style={{ textAlign: 'center', font: '400 11px system-ui', color: '#8794bd' }}>Glisse la carte : à droite si c’est juste, à gauche pour corriger</div>
        </>
      )}

      {cur && editing && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {cur.image_recto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cur.image_recto} alt="" style={{ width: 70, aspectRatio: cur.is_horizontal ? '7 / 5' : '5 / 7', objectFit: 'contain', background: '#0e1530', flex: 'none' }} />
              : null}
            <b style={{ fontSize: 15 }}>Corriger cette carte</b>
          </div>
          {FIELDS.map(f => (
            <label key={f.k as string} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ font: '800 10px system-ui', letterSpacing: '.1em', textTransform: 'uppercase', color: '#aab3d1' }}>{f.label}</span>
              <input value={draft[f.k] ?? ''} onChange={e => setDraft(d => ({ ...d, [f.k]: e.target.value }))} autoCapitalize="words"
                style={{ background: '#17214a', border: '2px solid #243063', color: '#fff', padding: '10px 12px', fontSize: 16, outline: 'none' }} />
            </label>
          ))}
          {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setEditing(false)} style={{ ...btn, background: 'transparent', borderColor: '#3a4a8a' }}>Annuler</button>
            <button type="button" disabled={saving} onClick={save} style={{ ...btn, background: '#2f6bff', borderColor: '#2f6bff' }}>{saving ? '…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
