'use client'
// Outil du propriétaire : crée les miniatures des cartes qui n'en ont pas encore (cartes ajoutées avant cette fonction).
// Chaque carte : la photo est lue, réduite à ~520 px sur ton appareil, enregistrée à côté de la photo, puis la fiche est mise à jour.
// On peut arrêter et reprendre à tout moment (ce qui est fait reste fait). Rien n'est modifié sur les photos d'origine.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { makeThumb } from '@/lib/thumbnail'
import { galleryMemClear } from '@/lib/galleryMem'

type C = { id_manuelle?: string; f: string; thumb?: string }
const PARALLEL = 4

export default function ThumbBackfill({ cards, userId, onClose }: { cards: C[]; userId: string; onClose: () => void }) {
  const todo = useRef<C[]>(cards.filter(c => c.id_manuelle && !c.thumb && /^https?:\/\//.test(c.f)))
  const total = useRef(todo.current.length)
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(0)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const stop = useRef(false)
  const reasons = useRef<Record<string, number>>({})
  const started = useRef(0)

  const one = async (c: C): Promise<'ok' | 'fail' | 'schema'> => {
    const why = (m: string) => { reasons.current[m] = (reasons.current[m] || 0) + 1; return 'fail' as const }
    try {
      let res: Response
      try { res = await fetch(c.f) } catch { try { await new Promise(r => setTimeout(r, 600)); res = await fetch(c.f) } catch { return why(/supabase.co/.test(c.f) ? 'photo illisible (réseau)' : 'photo hébergée ailleurs (accès refusé)') } }
      if (!res.ok) return why(`photo introuvable (${res.status})`)
      const tb = await makeThumb(await res.blob())
      if (!tb) return why('format de photo non lisible')
      const path = `cartes/${userId}/thumbs/${c.id_manuelle}.jpg`
      const { error: up } = await supabase.storage.from('avatars').upload(path, new File([tb], `${c.id_manuelle}.jpg`, { type: 'image/jpeg' }), { upsert: true, contentType: 'image/jpeg' })
      if (up) return why(`envoi refusé : ${up.message.slice(0, 60)}`)
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('cartes_manuelles').update({ image_recto_thumb: url }).eq('id', c.id_manuelle as string).eq('user_id', userId)
      if (error) return /image_recto_thumb/.test(error.message) ? 'schema' : why(`fiche non mise à jour : ${error.message.slice(0, 60)}`)
      return 'ok'
    } catch (e) { return why(`erreur : ${e instanceof Error ? e.message.slice(0, 60) : 'inconnue'}`) }
  }

  const run = async () => {
    stop.current = false; setRunning(true); setMsg(null); setFailed(0); reasons.current = {}; started.current = Date.now()
    const queue = todo.current.filter(c => !c.thumb)
    let i = 0
    const worker = async () => {
      while (!stop.current) {
        const c = queue[i++]
        if (!c) return
        const r = await one(c)
        if (r === 'schema') { stop.current = true; setMsg('La migration 20261117 (colonne des miniatures) n’est pas encore appliquée dans Supabase.'); return }
        if (r === 'ok') { c.thumb = 'ok'; setDone(d => d + 1) } else setFailed(f => f + 1)
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
    setRunning(false)
    galleryMemClear(userId)
  }

  useEffect(() => () => { stop.current = true }, [])

  const left = Math.max(0, total.current - done)
  const rate = done > 0 ? done / ((Date.now() - started.current) / 1000) : 0
  const eta = rate > 0 ? Math.ceil(left / rate / 60) : null
  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Miniatures de la galerie" onClick={() => { if (!running) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 600000, background: 'rgba(5,8,25,.8)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 100%)', background: '#0e1530', color: '#fff', border: '3px solid #243063', padding: 18 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 20 }}>🖼️ Miniatures de la galerie</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: '#aab3d1' }}>
          La grille charge une version légère de chaque carte (environ 3 fois moins lourde). Les cartes ajoutées avant cette fonction n’en ont pas : cet outil les crée, sur ton appareil. Tu peux l’arrêter et le reprendre quand tu veux.
        </p>
        {total.current === 0 ? (
          <p style={{ fontSize: 14, fontWeight: 700 }}>✓ Toutes tes cartes ont déjà leur miniature.</p>
        ) : (
          <>
            <div style={{ height: 12, background: '#17214a', margin: '6px 0' }}><i style={{ display: 'block', height: '100%', width: `${(done / total.current) * 100}%`, background: '#2f6bff' }} /></div>
            <div style={{ fontSize: 13, color: '#aab3d1' }}>{done} / {total.current} créées{failed ? ` · ${failed} en échec` : ''}{running && eta !== null ? ` · environ ${eta} min restantes` : ''}</div>
          </>
        )}
        {!running && failed > 0 && (
          <div style={{ fontSize: 12, color: '#ffd84d', marginTop: 8 }}>
            {Object.entries(reasons.current).sort((a, b) => b[1] - a[1]).map(([k, n]) => <div key={k}>• {n} × {k}</div>)}
          </div>
        )}
        {msg && <p style={{ color: '#ffd84d', fontSize: 13 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {total.current > 0 && !running && left > 0 && <button type="button" className="btn-main btn-primary" onClick={run}>{done > 0 ? 'Reprendre' : 'Créer les miniatures'}</button>}
          {running && <button type="button" className="da-confirm-btn" onClick={() => { stop.current = true }}>Arrêter</button>}
          {!running && <button type="button" className="da-confirm-btn" onClick={onClose}>{done > 0 ? 'Fermer (recharge la galerie pour les voir)' : 'Fermer'}</button>}
        </div>
        {running && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#aab3d1' }}>Garde cette page ouverte pendant la création.</p>}
      </div>
    </div>,
    document.body,
  )
}
