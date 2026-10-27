'use client'
import { useEffect, useRef, useState } from 'react'
import { uploadGuideImage } from '@/lib/guideUpload'
import { toast } from '@/lib/toast'
import { renderGuideCover, W, H } from '@/lib/guideCover'

// La composition de la couverture (canvas) vit dans lib/guideCover.ts.
export default function GuideCoverMaker({ defaultName, cardPool, onDone, dark }: { defaultName: string; cardPool: string[]; onDone: (url: string) => void; dark: boolean }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [boxUrl, setBoxUrl] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [seed, setSeed] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<string | null>(null)

  useEffect(() => { if (!open) setName(defaultName) }, [defaultName, open])
  // cartes par defaut : 5 images variees du guide (on saute de l'une a l'autre pour ne pas prendre cinq fois la meme famille)
  useEffect(() => {
    if (!open || picked.length) return
    const step = Math.max(1, Math.floor(cardPool.length / 5))
    const out: string[] = []
    for (let i = 0; i < cardPool.length && out.length < 5; i++) { const u = cardPool[(seed + i * step) % cardPool.length]; if (!out.includes(u)) out.push(u) }
    setPicked(out)
  }, [open, cardPool, picked.length, seed])
  useEffect(() => () => { if (boxRef.current) URL.revokeObjectURL(boxRef.current) }, [])

  const draw = async () => {
    const cv = canvasRef.current
    if (!cv) return
    setError('')
    setError('')
    const n = await renderGuideCover(cv, { name, boxUrl, picked })
    if (picked.length && !n) setError('Les photos de cartes ne se chargent pas (restriction du navigateur) : réessaie après la copie des photos dans le guide.')
  }

  useEffect(() => { if (open) draw() }, [open, name, boxUrl, picked])

  const save = async () => {
    const cv = canvasRef.current
    if (!cv) return
    setBusy(true)
    const blob: Blob | null = await new Promise(res => { try { cv.toBlob(b => res(b), 'image/jpeg', 0.92) } catch { res(null) } })
    if (!blob) { toast.error('Impossible d’exporter l’image (photo bloquée par le navigateur)'); setBusy(false); return }
    const url = await uploadGuideImage(new File([blob], 'cover.jpg', { type: 'image/jpeg' }), 'covers/')
    setBusy(false)
    if (url) { onDone(url); toast.success('Couverture enregistrée pour ce guide'); setOpen(false) }
  }

  const border = dark ? '#2a2a2a' : '#dde3ee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...btn, background: '#003DA6', color: 'white' }}>🖼️ Générer la couverture</button>
      {open && (
        <div style={{ marginTop: 10, border: `1px solid ${border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 4, textTransform: 'uppercase' }}>Nom de la collection (texte de la couverture)</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? '#2a2a2a' : '#fafafa', color: text, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 4, textTransform: 'uppercase' }}>Photo de la boîte (PNG, de préférence sans fond)</label>
            <input type="file" accept="image/png,image/webp,image/jpeg" onChange={e => {
              const f = e.target.files?.[0]
              if (boxRef.current) URL.revokeObjectURL(boxRef.current)
              const u = f ? URL.createObjectURL(f) : null
              boxRef.current = u; setBoxUrl(u)
            }} />
            {!boxUrl && <p style={{ fontSize: 11, color: sub, margin: '4px 0 0' }}>Sans boîte : fond marine et cartes réparties sur toute la largeur.</p>}
          </div>
          {cardPool.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 4, textTransform: 'uppercase' }}>Cartes de la couverture ({picked.length}/6) · clique pour ajouter / retirer</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto' }}>
                {cardPool.slice(0, 80).map(u => {
                  const on = picked.includes(u)
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" onClick={() => setPicked(p => (on ? p.filter(x => x !== u) : p.length >= 6 ? p : [...p, u]))}
                      style={{ height: 70, borderRadius: 0, cursor: 'pointer', outline: on ? '3px solid #003DA6' : '1px solid ' + border, opacity: on ? 1 : 0.55 }} />
                  )
                })}
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 600, aspectRatio: `${W} / ${H}`, border: `1px solid ${border}`, display: 'block' }} />
          {error && <p style={{ fontSize: 12, color: '#e74c3c', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={busy} onClick={save} style={{ ...btn, background: '#27ae60', color: 'white', opacity: busy ? 0.6 : 1 }}>{busy ? 'Enregistrement…' : '✓ Utiliser comme couverture'}</button>
            <button type="button" onClick={() => { setSeed(x => x + 1); setPicked([]) }} style={{ ...btn, background: 'transparent', color: text, border: `1.5px solid ${border}` }}>↻ Autres cartes</button>
          </div>
        </div>
      )}
    </div>
  )
}
